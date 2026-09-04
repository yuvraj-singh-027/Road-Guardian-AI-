"""
Digital Twin & Urban Utilization — Database & Deduplication Manager
Handles MySQL Database operations with automatic local SQLite fallback,
spatial & temporal hazard deduplication, and automatic CSV migration.
"""

import os
from pathlib import Path

# Manually load .env file into os.environ if it exists
for _env_candidate in [Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parent.parent / ".env"]:
    if _env_candidate.exists():
        with open(_env_candidate, "r", encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if not _line or _line.startswith("#"):
                    continue
                if "=" in _line:
                    _key, _val = _line.split("=", 1)
                    os.environ[_key.strip()] = _val.strip()

import sqlite3
import math
import hashlib
from datetime import datetime, timedelta
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional

# Try importing PyMySQL for MySQL and psycopg2 for PostgreSQL/Supabase
try:
    import pymysql
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False

try:
    import psycopg2
    import psycopg2.extras
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR) # Root directory
SQLITE_DB_PATH = os.path.join(BASE_DIR, "road_guardian.db")
CSV_FILE_PATH = os.path.join(BASE_DIR, "pothole_data.csv")

try:
    from .risk_engine import calculate_road_risk
except ImportError:
    from risk_engine import calculate_road_risk


def get_db_connection():
    """
    Attempts to connect to:
    1. Supabase / PostgreSQL (SUPABASE_DB_URL, DATABASE_URL, POSTGRES_URL)
    2. MySQL (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD)
    3. Local SQLite fallback (road_guardian.db)
    Returns (connection_obj, db_type: 'postgres'|'mysql'|'sqlite')
    """
    # 1. Supabase / PostgreSQL cloud connection
    supabase_url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if POSTGRES_AVAILABLE and supabase_url:
        try:
            # Format connection URL for SSL compatibility
            target_url = supabase_url
            if "sslmode" not in target_url.lower():
                target_url += ("&sslmode=require" if "?" in target_url else "?sslmode=require")

            conn = psycopg2.connect(
                target_url,
                cursor_factory=psycopg2.extras.RealDictCursor
            )
            conn.autocommit = True
            return conn, "postgres"
        except Exception as pg_err:
            print(f"[Supabase / PostgreSQL Connection Warning]: Connection failed ({pg_err}). Falling back to next engine...")

    # 2. MySQL database connection
    mysql_host = os.getenv("MYSQL_HOST")
    mysql_user = os.getenv("MYSQL_USER")
    mysql_pass = os.getenv("MYSQL_PASSWORD", "")
    mysql_db = os.getenv("MYSQL_DB", "road_guardian_db")
    mysql_port = int(os.getenv("MYSQL_PORT", 3306))

    if MYSQL_AVAILABLE and mysql_host and mysql_user:
        try:
            conn = pymysql.connect(
                host=mysql_host,
                user=mysql_user,
                password=mysql_pass,
                database=mysql_db,
                port=mysql_port,
                autocommit=True,
                cursorclass=pymysql.cursors.DictCursor
            )
            return conn, "mysql"
        except pymysql.err.OperationalError:
            try:
                temp_conn = pymysql.connect(
                    host=mysql_host,
                    user=mysql_user,
                    password=mysql_pass,
                    port=mysql_port,
                    autocommit=True
                )
                with temp_conn.cursor() as cursor:
                    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{mysql_db}`")
                temp_conn.close()

                conn = pymysql.connect(
                    host=mysql_host,
                    user=mysql_user,
                    password=mysql_pass,
                    database=mysql_db,
                    port=mysql_port,
                    autocommit=True,
                    cursorclass=pymysql.cursors.DictCursor
                )
                return conn, "mysql"
            except Exception:
                pass
        except Exception:
            pass

    # 3. Fallback to local SQLite database
    conn = sqlite3.connect(SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn, "sqlite"


_DB_INITIALIZED = False

def init_db():
    """Initializes the users and pothole_detections table schemas and runs column migrations."""
    global _DB_INITIALIZED
    if _DB_INITIALIZED:
        return
    _DB_INITIALIZED = True

    conn, db_type = get_db_connection()
    try:
        if db_type == "postgres":
            with conn.cursor() as cursor:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255),
                    is_verified INT DEFAULT 0,
                    verification_token VARCHAR(255),
                    reset_token VARCHAR(255),
                    reset_token_expires TIMESTAMPTZ,
                    google_id VARCHAR(255) UNIQUE,
                    profile_picture VARCHAR(500),
                    role VARCHAR(50) DEFAULT 'public',
                    role_request VARCHAR(50) DEFAULT 'none',
                    request_agency VARCHAR(255) NULL,
                    request_designation VARCHAR(255) NULL,
                    request_reason TEXT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                """)
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_request VARCHAR(50) DEFAULT 'none';")
                    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS request_agency VARCHAR(255) NULL;")
                    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS request_designation VARCHAR(255) NULL;")
                    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS request_reason TEXT NULL;")
                except Exception:
                    pass
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS pothole_detections (
                    id SERIAL PRIMARY KEY,
                    image_name VARCHAR(255) NOT NULL,
                    latitude VARCHAR(50),
                    longitude VARCHAR(50),
                    severity VARCHAR(50),
                    confidence FLOAT,
                    time TIMESTAMPTZ,
                    lat_numeric DOUBLE PRECISION,
                    lon_numeric DOUBLE PRECISION,
                    risk_score DOUBLE PRECISION,
                    image_hash VARCHAR(64),
                    user_id INT NULL,
                    user_email VARCHAR(255) NULL,
                    reporter_email VARCHAR(255) NULL,
                    status VARCHAR(50) DEFAULT 'AI_VERIFIED',
                    landmark_name VARCHAR(255) NULL,
                    description TEXT NULL,
                    damage_type VARCHAR(100) DEFAULT 'Pothole',
                    phash VARCHAR(64) NULL,
                    authenticity_score FLOAT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS authenticity_audits (
                    id SERIAL PRIMARY KEY,
                    image_name VARCHAR(255) NOT NULL,
                    phash VARCHAR(64),
                    authenticity_score FLOAT,
                    status VARCHAR(50),
                    status_code VARCHAR(50),
                    bullet_summary TEXT,
                    report_json TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS report_status_history (
                    id SERIAL PRIMARY KEY,
                    report_id INT NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    status_label VARCHAR(100),
                    message TEXT,
                    changed_by VARCHAR(50) DEFAULT 'system',
                    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                """)
                # Add user_email, reporter_email, and user_gmail columns to existing Postgres tables if they don't exist yet
                try:
                    cursor.execute("ALTER TABLE pothole_detections ADD COLUMN IF NOT EXISTS user_email VARCHAR(255) NULL;")
                    cursor.execute("ALTER TABLE pothole_detections ADD COLUMN IF NOT EXISTS reporter_email VARCHAR(255) NULL;")
                    cursor.execute("ALTER TABLE pothole_detections ADD COLUMN IF NOT EXISTS user_gmail VARCHAR(255) NULL;")
                except Exception:
                    pass  # Column already exists or unsupported (no-op)
        elif db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255),
                    is_verified TINYINT DEFAULT 0,
                    verification_token VARCHAR(255),
                    reset_token VARCHAR(255),
                    reset_token_expires DATETIME,
                    google_id VARCHAR(255) UNIQUE,
                    profile_picture VARCHAR(500),
                    role VARCHAR(50) DEFAULT 'public',
                    role_request VARCHAR(50) DEFAULT 'none',
                    request_agency VARCHAR(255) NULL,
                    request_designation VARCHAR(255) NULL,
                    request_reason TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
                for ucol, udef in [("role_request", "VARCHAR(50) DEFAULT 'none'"), ("request_agency", "VARCHAR(255) NULL"), ("request_designation", "VARCHAR(255) NULL"), ("request_reason", "TEXT NULL")]:
                    try:
                        cursor.execute(f"ALTER TABLE users ADD COLUMN `{ucol}` {udef}")
                    except Exception:
                        pass
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS pothole_detections (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    image_name VARCHAR(255) NOT NULL,
                    latitude VARCHAR(50),
                    longitude VARCHAR(50),
                    severity VARCHAR(50),
                    confidence FLOAT,
                    time DATETIME,
                    lat_numeric DOUBLE,
                    lon_numeric DOUBLE,
                    risk_score DOUBLE,
                    image_hash VARCHAR(64),
                    user_id INT NULL,
                    reporter_email VARCHAR(255) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS authenticity_audits (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    image_name VARCHAR(255) NOT NULL,
                    phash VARCHAR(64),
                    authenticity_score FLOAT,
                    status VARCHAR(50),
                    status_code VARCHAR(50),
                    bullet_summary TEXT,
                    report_json LONGTEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS report_status_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    report_id INT NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    status_label VARCHAR(100),
                    message TEXT,
                    changed_by VARCHAR(50) DEFAULT 'system',
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
                # Try adding dynamic columns if missing on existing MySQL table
                cols_to_add = [
                    ("user_id", "INT NULL"),
                    ("user_email", "VARCHAR(255) NULL"),
                    ("reporter_email", "VARCHAR(255) NULL"),
                    ("user_gmail", "VARCHAR(255) NULL"),
                    ("phash", "VARCHAR(64) NULL"),
                    ("authenticity_score", "FLOAT NULL"),
                    ("status", "VARCHAR(50) DEFAULT 'AI_VERIFIED'"),
                    ("landmark_name", "VARCHAR(255) NULL"),
                    ("description", "TEXT NULL"),
                    ("damage_type", "VARCHAR(100) DEFAULT 'Pothole'"),
                    ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
                ]
                for col_name, col_def in cols_to_add:
                    try:
                        cursor.execute(f"SELECT `{col_name}` FROM pothole_detections LIMIT 1")
                    except Exception:
                        try:
                            cursor.execute(f"ALTER TABLE pothole_detections ADD COLUMN `{col_name}` {col_def}")
                        except Exception:
                            pass
        else: # SQLite
            with conn:
                conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT,
                    is_verified INTEGER DEFAULT 0,
                    verification_token TEXT,
                    reset_token TEXT,
                    reset_token_expires TEXT,
                    google_id TEXT UNIQUE,
                    profile_picture TEXT,
                    role TEXT DEFAULT 'public',
                    role_request TEXT DEFAULT 'none',
                    request_agency TEXT NULL,
                    request_designation TEXT NULL,
                    request_reason TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
                for ucol, udef in [("role_request", "TEXT DEFAULT 'none'"), ("request_agency", "TEXT NULL"), ("request_designation", "TEXT NULL"), ("request_reason", "TEXT NULL")]:
                    try:
                        conn.execute(f"ALTER TABLE users ADD COLUMN {ucol} {udef}")
                    except Exception:
                        pass
                conn.execute("""
                CREATE TABLE IF NOT EXISTS pothole_detections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    image_name TEXT NOT NULL,
                    latitude TEXT,
                    longitude TEXT,
                    severity TEXT,
                    confidence REAL,
                    time TEXT,
                    lat_numeric REAL,
                    lon_numeric REAL,
                    risk_score REAL,
                    image_hash TEXT,
                    user_id INTEGER NULL,
                    reporter_email TEXT NULL,
                    phash TEXT,
                    authenticity_score REAL,
                    status TEXT DEFAULT 'AI_VERIFIED',
                    landmark_name TEXT,
                    description TEXT,
                    damage_type TEXT DEFAULT 'Pothole',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT
                );
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS authenticity_audits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    image_name TEXT NOT NULL,
                    phash TEXT,
                    authenticity_score REAL,
                    status TEXT,
                    status_code TEXT,
                    bullet_summary TEXT,
                    report_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
                conn.execute("""
                CREATE TABLE IF NOT EXISTS report_status_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    report_id INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    status_label TEXT,
                    message TEXT,
                    changed_by TEXT DEFAULT 'system',
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
                # Dynamically add user_email, reporter_email, user_gmail, and metadata columns if missing
                cols_sqlite = [
                    ("user_id", "INTEGER NULL"),
                    ("user_email", "TEXT NULL"),
                    ("reporter_email", "TEXT NULL"),
                    ("user_gmail", "TEXT NULL"),
                    ("phash", "TEXT NULL"),
                    ("authenticity_score", "REAL NULL"),
                    ("status", "TEXT DEFAULT 'AI_VERIFIED'"),
                    ("landmark_name", "TEXT NULL"),
                    ("description", "TEXT NULL"),
                    ("damage_type", "TEXT DEFAULT 'Pothole'"),
                    ("updated_at", "TEXT")
                ]
                for col_name, col_def in cols_sqlite:
                    try:
                        conn.execute(f"SELECT {col_name} FROM pothole_detections LIMIT 1")
                    except Exception:
                        try:
                            conn.execute(f"ALTER TABLE pothole_detections ADD COLUMN {col_name} {col_def}")
                        except Exception:
                            pass
    finally:
        conn.close()
    
    # Auto-migrate legacy CSV data if DB table is currently empty
    # migrate_csv_to_db()

    # Seed demo hazard records for hackathon presentation (Commented out to keep DB empty by default)
    # seed_demo_data_if_empty()


def compute_image_hash(image_path_or_bytes) -> str:
    """Computes MD5 hash for image content deduplication."""
    hasher = hashlib.md5()
    if isinstance(image_path_or_bytes, (str, os.PathLike)):
        if os.path.exists(image_path_or_bytes):
            with open(image_path_or_bytes, "rb") as f:
                hasher.update(f.read())
            return hasher.hexdigest()
        return ""
    elif isinstance(image_path_or_bytes, bytes):
        hasher.update(image_path_or_bytes)
        return hasher.hexdigest()
    return ""


def is_duplicate_detection(
    lat_num: float,
    lon_num: float,
    severity: str,
    img_hash: str = "",
    spatial_threshold_deg: float = 0.0002, # ~20 meters
    temporal_window_sec: int = 60
) -> Tuple[bool, str]:
    """
    Checks if a detection is a spatial/temporal duplicate or image hash duplicate.
    Returns (is_duplicate: bool, reason: str)
    """
    conn, db_type = get_db_connection()
    try:
        # 1. Exact Image Hash Deduplication
        if img_hash:
            if db_type in ["mysql", "postgres"]:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT id FROM pothole_detections WHERE image_hash = %s LIMIT 1", (img_hash,))
                    row = cursor.fetchone()
            else: # sqlite
                cursor = conn.execute("SELECT id FROM pothole_detections WHERE image_hash = ? LIMIT 1", (img_hash,))
                row = cursor.fetchone()
            if row:
                return True, f"Duplicate image hash detected (Record ID #{dict(row)['id']})"

        # 2. Spatial & Temporal Proximity Deduplication
        if lat_num != 0.0 and lon_num != 0.0:
            if db_type in ["mysql", "postgres"]:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT id, lat_numeric, lon_numeric, time, severity FROM pothole_detections
                        WHERE ABS(lat_numeric - %s) <= %s
                          AND ABS(lon_numeric - %s) <= %s
                        ORDER BY id DESC LIMIT 10
                    """, (lat_num, spatial_threshold_deg, lon_num, spatial_threshold_deg))
                    rows = cursor.fetchall()
            else:
                cursor = conn.execute("""
                    SELECT id, lat_numeric, lon_numeric, time, severity FROM pothole_detections
                    WHERE ABS(lat_numeric - ?) <= ?
                      AND ABS(lon_numeric - ?) <= ?
                    ORDER BY id DESC LIMIT 10
                """, (lat_num, spatial_threshold_deg, lon_num, spatial_threshold_deg))
                rows = [dict(r) for r in cursor.fetchall()]

            for r in rows:
                rec_id = r["id"]
                # Parse timestamp
                time_val = r["time"]
                if isinstance(time_val, str):
                    try:
                        dt = datetime.strptime(time_val, "%Y-%m-%d %H:%M:%S")
                    except Exception:
                        try:
                            dt = datetime.fromisoformat(time_val)
                        except Exception:
                            dt = datetime.now()
                elif isinstance(time_val, datetime):
                    dt = time_val
                else:
                    dt = datetime.now()

                if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
                    dt = dt.replace(tzinfo=None)

                time_diff = abs((datetime.now() - dt).total_seconds())
                if time_diff <= temporal_window_sec:
                    return True, f"Spatial-Temporal duplicate hazard logged within {int(time_diff)}s (Record ID #{rec_id})"

        return False, ""
    finally:
        conn.close()


def insert_detection(
    image_name: str,
    latitude: Any,
    longitude: Any,
    severity: str,
    confidence: float,
    time_val: Any = None,
    image_bytes_or_path: Any = None,
    skip_dedup: bool = False,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    reporter_email: Optional[str] = None,
    phash: str = "",
    authenticity_score: Optional[float] = None,
    landmark_name: Optional[str] = None,
    description: Optional[str] = None,
    damage_type: str = "Pothole",
    status: str = "AI_VERIFIED"
) -> Tuple[bool, str, Optional[int]]:
    """
    Inserts a new pothole detection record into the database after deduplication checks,
    and initializes its status history records.
    Returns (success: bool, message: str, report_id: Optional[int])
    """
    init_db()
    
    eff_email = user_email or reporter_email or None

    # Parse numeric coordinates
    try:
        lat_num = float(latitude)
    except (ValueError, TypeError):
        lat_num = 28.6139 # Default fallback
    try:
        lon_num = float(longitude)
    except (ValueError, TypeError):
        lon_num = 77.2090 # Default fallback

    # Format time string / datetime
    if time_val is None:
        time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    elif isinstance(time_val, datetime):
        time_str = time_val.strftime("%Y-%m-%d %H:%M:%S")
    else:
        time_str = str(time_val)

    # Calculate image hash
    img_hash = compute_image_hash(image_bytes_or_path) if image_bytes_or_path else ""

    # Perform Deduplication
    if not skip_dedup:
        is_dup, reason = is_duplicate_detection(lat_num, lon_num, severity, img_hash)
        if is_dup:
            return False, f"Suppressed Duplicate: {reason}", None

    # Calculate Risk Score
    risk_info = calculate_road_risk(severity=severity, confidence=confidence)
    risk_score = risk_info["score"]

    conn, db_type = get_db_connection()
    inserted_id = None
    try:
        if db_type == "postgres":
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO pothole_detections 
                    (image_name, latitude, longitude, severity, confidence, time, lat_numeric, lon_numeric, 
                     risk_score, image_hash, user_id, user_email, reporter_email, user_gmail, phash, authenticity_score, landmark_name, description, damage_type, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (image_name, str(latitude), str(longitude), severity, float(confidence), time_str, lat_num, lon_num, 
                      risk_score, img_hash, user_id, eff_email, eff_email, eff_email, phash or None, authenticity_score, landmark_name, description, damage_type, status))
                row = cursor.fetchone()
                if row:
                    inserted_id = row["id"] if isinstance(row, dict) else row[0]
                conn.commit()
        elif db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO pothole_detections 
                    (image_name, latitude, longitude, severity, confidence, time, lat_numeric, lon_numeric, 
                     risk_score, image_hash, user_id, user_email, reporter_email, user_gmail, phash, authenticity_score, landmark_name, description, damage_type, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (image_name, str(latitude), str(longitude), severity, float(confidence), time_str, lat_num, lon_num, 
                      risk_score, img_hash, user_id, eff_email, eff_email, eff_email, phash or None, authenticity_score, landmark_name, description, damage_type, status))
                inserted_id = cursor.lastrowid
                conn.commit()
        else: # sqlite
            with conn:
                cursor = conn.execute("""
                    INSERT INTO pothole_detections 
                    (image_name, latitude, longitude, severity, confidence, time, lat_numeric, lon_numeric, 
                     risk_score, image_hash, user_id, user_email, reporter_email, user_gmail, phash, authenticity_score, landmark_name, description, damage_type, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (image_name, str(latitude), str(longitude), severity, float(confidence), time_str, lat_num, lon_num, 
                      risk_score, img_hash, user_id, eff_email, eff_email, eff_email, phash or None, authenticity_score, landmark_name, description, damage_type, status))
                inserted_id = cursor.lastrowid
    except Exception as e:
        return False, f"Database insertion error: {e}", None
    finally:
        conn.close()

    # Automatically record baseline status history entries
    if inserted_id:
        # Step 1: SUBMITTED (Citizen upload)
        add_status_history(
            report_id=inserted_id,
            status="SUBMITTED",
            status_label="Report Submitted",
            message="Road hazard photograph and geotag submitted by citizen.",
            changed_by="user"
        )
        # Step 2: AI_VERIFIED (Autonomous YOLO & Authenticity perception)
        auth_str = f"{int(authenticity_score)}/100" if authenticity_score is not None else "Verified"
        conf_pct = int(confidence * 100) if confidence else 85
        add_status_history(
            report_id=inserted_id,
            status="AI_VERIFIED",
            status_label="AI Verification Completed",
            message=f"Autonomous YOLO perception ({severity} severity, {conf_pct}% confidence) and Authenticity Engine check ({auth_str}) completed successfully.",
            changed_by="AI"
        )

    return True, f"Successfully logged detection '{image_name}' to {db_type.upper()} database (ID #{inserted_id}).", inserted_id


def add_status_history(
    report_id: int,
    status: str,
    status_label: Optional[str] = None,
    message: Optional[str] = None,
    changed_by: str = "system"
) -> bool:
    """
    Appends a new chronological status event to report_status_history.
    """
    init_db()
    label = status_label or status.replace("_", " ").title()
    msg = message or f"Status updated to {label}"
    conn, db_type = get_db_connection()
    try:
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO report_status_history (report_id, status, status_label, message, changed_by)
                    VALUES (%s, %s, %s, %s, %s)
                """, (report_id, status, label, msg, changed_by))
        else:
            with conn:
                conn.execute("""
                    INSERT INTO report_status_history (report_id, status, status_label, message, changed_by)
                    VALUES (?, ?, ?, ?, ?)
                """, (report_id, status, label, msg, changed_by))
        return True
    except Exception as e:
        print(f"[DB STATUS HISTORY ERROR]: {e}")
        return False
    finally:
        conn.close()


def get_user_reports(
    user_id: int,
    is_admin: bool = False,
    status_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Securely retrieves road hazard reports.
    If is_admin is False: returns ONLY reports belonging to user_id (WHERE user_id = ?).
    If is_admin is True: returns all reports across the platform.
    """
    init_db()
    conn, db_type = get_db_connection()
    reports = []
    try:
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                if is_admin:
                    query = """
                        SELECT p.*, u.name as user_name, u.email as user_email
                        FROM pothole_detections p
                        LEFT JOIN users u ON p.user_id = u.id
                    """
                    params = []
                    if status_filter and status_filter.upper() != "ALL":
                        query += " WHERE p.status = %s"
                        params.append(status_filter.upper())
                    query += " ORDER BY p.id DESC"
                    cursor.execute(query, tuple(params))
                else:
                    query = """
                        SELECT p.*, u.name as user_name, u.email as user_email
                        FROM pothole_detections p
                        LEFT JOIN users u ON p.user_id = u.id
                        WHERE p.user_id = %s
                    """
                    params = [user_id]
                    if status_filter and status_filter.upper() != "ALL":
                        query += " AND p.status = %s"
                        params.append(status_filter.upper())
                    query += " ORDER BY p.id DESC"
                    cursor.execute(query, tuple(params))
                rows = cursor.fetchall()
        else: # sqlite
            if is_admin:
                query = """
                    SELECT p.*, u.name as user_name, u.email as user_email
                    FROM pothole_detections p
                    LEFT JOIN users u ON p.user_id = u.id
                """
                params = []
                if status_filter and status_filter.upper() != "ALL":
                    query += " WHERE p.status = ?"
                    params.append(status_filter.upper())
                query += " ORDER BY p.id DESC"
                cursor = conn.execute(query, tuple(params))
            else:
                query = """
                    SELECT p.*, u.name as user_name, u.email as user_email
                    FROM pothole_detections p
                    LEFT JOIN users u ON p.user_id = u.id
                    WHERE p.user_id = ?
                """
                params = [user_id]
                if status_filter and status_filter.upper() != "ALL":
                    query += " AND p.status = ?"
                    params.append(status_filter.upper())
                query += " ORDER BY p.id DESC"
                cursor = conn.execute(query, tuple(params))
            rows = [dict(r) for r in cursor.fetchall()]

        for r in rows:
            rec_id = r.get("id")
            raw_lat = r.get("lat_numeric") or r.get("latitude")
            raw_lon = r.get("lon_numeric") or r.get("longitude")
            try:
                lat_val = float(raw_lat) if raw_lat is not None else 28.6139
            except Exception:
                lat_val = 28.6139
            try:
                lon_val = float(raw_lon) if raw_lon is not None else 77.2090
            except Exception:
                lon_val = 77.2090

            eff_email = r.get("reporter_email") or r.get("user_email") or ""
            eff_name = r.get("user_name")
            if not eff_name or eff_name in ["Jane Citizen", "Citizen Contributor"]:
                if eff_email:
                    eff_name = eff_email.split("@")[0].replace(".", " ").title()
                else:
                    eff_name = "Citizen Contributor"

            reports.append({
                "id": rec_id,
                "report_id": f"RG-{1000 + rec_id}",
                "user_id": r.get("user_id"),
                "user_name": eff_name,
                "user_email": eff_email,
                "reporter_email": eff_email,
                "image_name": r.get("image_name"),
                "damage_type": r.get("damage_type") or "Pothole Hazard",
                "severity": r.get("severity") or "Medium",
                "confidence": float(r.get("confidence") or 0.82),
                "latitude": lat_val,
                "longitude": lon_val,
                "landmark_name": r.get("landmark_name") or "Municipal Road Segment",
                "description": r.get("description") or "",
                "risk_score": float(r.get("risk_score") or 55.0),
                "authenticity_score": float(r.get("authenticity_score") or 92.0),
                "status": r.get("status") or "AI_VERIFIED",
                "created_at": str(r.get("created_at") or r.get("time")),
                "updated_at": str(r.get("updated_at") or r.get("created_at") or r.get("time"))
            })
        return reports
    finally:
        conn.close()


def get_report_by_id_with_history(
    report_id: int,
    current_user_id: int,
    is_admin: bool = False
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Retrieves a report and its complete status timeline history.
    Enforces authorization: returns (None, 'unauthorized') if current user does not own the report
    and is not an admin.
    Returns (report_dict, None) on success, or (None, 'not_found' | 'unauthorized').
    """
    init_db()
    conn, db_type = get_db_connection()
    try:
        # 1. Fetch report record
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT p.*, u.name as user_name, u.email as user_email
                    FROM pothole_detections p
                    LEFT JOIN users u ON p.user_id = u.id
                    WHERE p.id = %s LIMIT 1
                """, (report_id,))
                row = cursor.fetchone()
        else:
            cursor = conn.execute("""
                SELECT p.*, u.name as user_name, u.email as user_email
                FROM pothole_detections p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.id = ? LIMIT 1
            """, (report_id,))
            r = cursor.fetchone()
            row = dict(r) if r else None

        if not row:
            return None, "not_found"

        report_owner_id = row.get("user_id")

        # 2. Strict authorization check
        if not is_admin and (report_owner_id is not None and report_owner_id != current_user_id):
            return None, "unauthorized"

        # 3. Fetch chronological status history
        history_events = []
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, status, status_label, message, changed_by, changed_at
                    FROM report_status_history
                    WHERE report_id = %s
                    ORDER BY id ASC
                """, (report_id,))
                history_rows = cursor.fetchall()
        else:
            cursor = conn.execute("""
                SELECT id, status, status_label, message, changed_by, changed_at
                FROM report_status_history
                WHERE report_id = ?
                ORDER BY id ASC
            """, (report_id,))
            history_rows = [dict(hr) for hr in cursor.fetchall()]

        for hr in history_rows:
            history_events.append({
                "id": hr.get("id"),
                "status": hr.get("status"),
                "status_label": hr.get("status_label") or hr.get("status", "").replace("_", " ").title(),
                "message": hr.get("message") or "",
                "changed_by": hr.get("changed_by") or "system",
                "changed_at": str(hr.get("changed_at"))
            })

        # If no history exists on legacy record, construct default timeline
        if not history_events:
            t_created = str(row.get("created_at") or row.get("time"))
            history_events = [
                {
                    "id": 1,
                    "status": "SUBMITTED",
                    "status_label": "Report Submitted",
                    "message": "Road hazard photograph and geotag submitted by citizen.",
                    "changed_by": "user",
                    "changed_at": t_created
                },
                {
                    "id": 2,
                    "status": row.get("status") or "AI_VERIFIED",
                    "status_label": (row.get("status") or "AI_VERIFIED").replace("_", " ").title(),
                    "message": f"Autonomous YOLO perception ({row.get('severity')} severity) and Authenticity verification completed.",
                    "changed_by": "AI",
                    "changed_at": t_created
                }
            ]

        raw_lat = row.get("lat_numeric") or row.get("latitude")
        raw_lon = row.get("lon_numeric") or row.get("longitude")
        try:
            lat_val = float(raw_lat) if raw_lat is not None else 28.6139
        except Exception:
            lat_val = 28.6139
        try:
            lon_val = float(raw_lon) if raw_lon is not None else 77.2090
        except Exception:
            lon_val = 77.2090

        eff_email = row.get("reporter_email") or row.get("user_email") or ""
        eff_name = row.get("user_name")
        if not eff_name or eff_name in ["Jane Citizen", "Citizen Contributor"]:
            if eff_email:
                eff_name = eff_email.split("@")[0].replace(".", " ").title()
            else:
                eff_name = "Citizen Contributor"

        report_obj = {
            "id": row.get("id"),
            "report_id": f"RG-{1000 + row.get('id')}",
            "user_id": row.get("user_id"),
            "user_name": eff_name,
            "user_email": eff_email,
            "reporter_email": eff_email,
            "image_name": row.get("image_name"),
            "damage_type": row.get("damage_type") or "Pothole Hazard",
            "severity": row.get("severity") or "Medium",
            "confidence": float(row.get("confidence") or 0.82),
            "latitude": lat_val,
            "longitude": lon_val,
            "landmark_name": row.get("landmark_name") or "Municipal Road Segment",
            "description": row.get("description") or "",
            "risk_score": float(row.get("risk_score") or 55.0),
            "authenticity_score": float(row.get("authenticity_score") or 92.0),
            "status": row.get("status") or "AI_VERIFIED",
            "created_at": str(row.get("created_at") or row.get("time")),
            "updated_at": str(row.get("updated_at") or row.get("created_at") or row.get("time")),
            "status_history": history_events
        }

        return report_obj, None
    finally:
        conn.close()


def update_report_status(
    report_id: int,
    new_status: str,
    message: Optional[str] = None,
    changed_by: str = "admin",
    status_label: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Updates the active status of a report and appends a record to report_status_history.
    """
    init_db()
    status_clean = new_status.strip().upper()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    label = status_label or status_clean.replace("_", " ").title()
    msg = message or f"Status transitioned to {label} by {changed_by}."

    conn, db_type = get_db_connection()
    try:
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE pothole_detections 
                    SET status = %s, updated_at = %s 
                    WHERE id = %s
                """, (status_clean, now_str, report_id))
        else:
            with conn:
                conn.execute("""
                    UPDATE pothole_detections 
                    SET status = ?, updated_at = ? 
                    WHERE id = ?
                """, (status_clean, now_str, report_id))
        
        # Append to status history
        add_status_history(
            report_id=report_id,
            status=status_clean,
            status_label=label,
            message=msg,
            changed_by=changed_by
        )
        return True, f"Report RG-{1000 + report_id} successfully updated to '{status_clean}'."
    except Exception as e:
        return False, f"Failed updating report status: {e}"
    finally:
        conn.close()


def get_historical_phashes() -> List[Dict[str, Any]]:
    """
    Fetches all previously logged perceptual hashes from both pothole_detections and authenticity_audits
    to perform live pHash similarity comparison.
    """
    init_db()
    conn, db_type = get_db_connection()
    results = []
    try:
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, image_name, phash, time as created_at FROM pothole_detections WHERE phash IS NOT NULL AND phash != '' ORDER BY id DESC LIMIT 500")
                rows1 = cursor.fetchall()
                cursor.execute("SELECT id, image_name, phash, created_at FROM authenticity_audits WHERE phash IS NOT NULL AND phash != '' ORDER BY id DESC LIMIT 500")
                rows2 = cursor.fetchall()
        else:
            cursor = conn.execute("SELECT id, image_name, phash, time as created_at FROM pothole_detections WHERE phash IS NOT NULL AND phash != '' ORDER BY id DESC LIMIT 500")
            rows1 = [dict(r) for r in cursor.fetchall()]
            cursor = conn.execute("SELECT id, image_name, phash, created_at FROM authenticity_audits WHERE phash IS NOT NULL AND phash != '' ORDER BY id DESC LIMIT 500")
            rows2 = [dict(r) for r in cursor.fetchall()]

        seen_hashes = set()
        for r in rows1 + rows2:
            h = r.get("phash")
            if h and h not in seen_hashes:
                seen_hashes.add(h)
                results.append({
                    "id": r.get("id"),
                    "filename": r.get("image_name"),
                    "phash": h,
                    "timestamp": str(r.get("created_at", ""))
                })
        return results
    except Exception as e:
        print(f"[DB Warning] get_historical_phashes error: {e}")
        return []
    finally:
        conn.close()


def log_authenticity_audit(
    image_name: str,
    phash: str,
    authenticity_score: float,
    status: str,
    status_code: str,
    bullet_summary: List[str],
    report_dict: Dict[str, Any]
) -> int:
    """
    Persists an image authenticity verification report into the database for auditability.
    """
    init_db()
    conn, db_type = get_db_connection()
    import json
    bullet_str = json.dumps(bullet_summary)
    slim_report = {k: v for k, v in report_dict.items() if k != "ela_visualization_b64"}
    report_json_str = json.dumps(slim_report)

    try:
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO authenticity_audits 
                    (image_name, phash, authenticity_score, status, status_code, bullet_summary, report_json)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (image_name, phash, authenticity_score, status, status_code, bullet_str, report_json_str))
                return cursor.lastrowid
        else:
            with conn:
                cur = conn.execute("""
                    INSERT INTO authenticity_audits 
                    (image_name, phash, authenticity_score, status, status_code, bullet_summary, report_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (image_name, phash, authenticity_score, status, status_code, bullet_str, report_json_str))
                return cur.lastrowid
    except Exception as e:
        print(f"[DB Error] log_authenticity_audit error: {e}")
        return -1
    finally:
        conn.close()


def get_authenticity_history(limit: int = 20) -> List[Dict[str, Any]]:
    """
    Fetches recent authenticity audit reports from database.
    """
    init_db()
    conn, db_type = get_db_connection()
    import json
    try:
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM authenticity_audits ORDER BY id DESC LIMIT %s", (limit,))
                rows = cursor.fetchall()
        else:
            cursor = conn.execute("SELECT * FROM authenticity_audits ORDER BY id DESC LIMIT ?", (limit,))
            rows = [dict(r) for r in cursor.fetchall()]

        audits = []
        for r in rows:
            rd = dict(r)
            try:
                rd["bullet_summary"] = json.loads(rd.get("bullet_summary") or "[]")
            except Exception:
                rd["bullet_summary"] = []
            try:
                rd["report_json"] = json.loads(rd.get("report_json") or "{}")
            except Exception:
                rd["report_json"] = {}
            audits.append(rd)
        return audits
    except Exception as e:
        print(f"[DB Error] get_authenticity_history error: {e}")
        return []
    finally:
        conn.close()


def get_all_detections(user_id: Optional[int] = None) -> pd.DataFrame:
    """
    Fetches all detection records from the database as a pandas DataFrame.
    Calculates dynamic risk status, badges, and formats columns expected by dash.py.
    """
    init_db()
    conn, db_type = get_db_connection()
    try:
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                if user_id is not None:
                    cursor.execute("SELECT * FROM pothole_detections WHERE user_id = %s ORDER BY id DESC", (user_id,))
                else:
                    cursor.execute("SELECT * FROM pothole_detections ORDER BY id DESC")
                rows = cursor.fetchall()
            df = pd.DataFrame(rows)
        else:
            if user_id is not None:
                df = pd.read_sql_query("SELECT * FROM pothole_detections WHERE user_id = ? ORDER BY id DESC", conn, params=[user_id])
            else:
                df = pd.read_sql_query("SELECT * FROM pothole_detections ORDER BY id DESC", conn)

        if df.empty:
            return pd.DataFrame(columns=["id", "Image", "Latitude", "Longitude", "Severity", "Confidence", "Time", "lat_numeric", "lon_numeric", "Risk_Score", "Risk_Status", "Risk_Badge"])

        # Normalize column names for dash.py compatibility
        col_rename = {
            "image_name": "Image",
            "latitude": "Latitude",
            "longitude": "Longitude",
            "severity": "Severity",
            "confidence": "Confidence",
            "time": "Time"
        }
        df = df.rename(columns=col_rename)

        # Standardize numeric columns
        df['Confidence'] = pd.to_numeric(df['Confidence'], errors='coerce').fillna(0.8)
        df['lat_numeric'] = pd.to_numeric(df['lat_numeric'], errors='coerce').fillna(28.6139)
        df['lon_numeric'] = pd.to_numeric(df['lon_numeric'], errors='coerce').fillna(77.2090)
        df['Time'] = pd.to_datetime(df['Time'], errors='coerce')

        # Use stored risk_score column, recompute only for legacy rows with NULL/0 values
        if 'risk_score' not in df.columns:
            df['risk_score'] = 0.0
        df['risk_score'] = pd.to_numeric(df['risk_score'], errors='coerce').fillna(0.0)

        r_scores, r_statuses, r_badges = [], [], []
        for _, row in df.iterrows():
            stored = float(row.get('risk_score', 0.0))
            if stored and stored > 0.0:
                score = stored
            else:
                sev = str(row.get('Severity', 'Medium'))
                conf = float(row.get('Confidence', 0.8))
                score = calculate_road_risk(severity=sev, confidence=conf)["score"]
            r_scores.append(score)
            if score < 26.0:
                r_statuses.append("Healthy")
                r_badges.append("🟢 Healthy")
            elif score < 51.0:
                r_statuses.append("Degraded")
                r_badges.append("🟡 Degraded")
            elif score < 76.0:
                r_statuses.append("High Risk")
                r_badges.append("🟠 High Risk")
            else:
                r_statuses.append("Critical")
                r_badges.append("🔴 Critical")

        df['Risk_Score'] = r_scores
        df['Risk_Status'] = r_statuses
        df['Risk_Badge'] = r_badges

        return df
    except Exception as e:
        print(f"Error reading detections from database: {e}")
        return pd.DataFrame()
    finally:
        conn.close()


USER_CLEARED_FLAG = os.path.join(BASE_DIR, ".user_cleared_db")

def clear_all_detections() -> Tuple[bool, str]:
    """Clears all records from the pothole_detections table across PostgreSQL, MySQL, and SQLite."""
    conn, db_type = get_db_connection()
    try:
        if db_type == "postgres":
            with conn.cursor() as cursor:
                cursor.execute("TRUNCATE TABLE pothole_detections RESTART IDENTITY CASCADE;")
                cursor.execute("TRUNCATE TABLE authenticity_audits RESTART IDENTITY CASCADE;")
                cursor.execute("TRUNCATE TABLE report_status_history RESTART IDENTITY CASCADE;")
        elif db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("TRUNCATE TABLE pothole_detections;")
                cursor.execute("TRUNCATE TABLE authenticity_audits;")
                cursor.execute("TRUNCATE TABLE report_status_history;")
        else: # sqlite
            with conn:
                conn.execute("DELETE FROM pothole_detections;")
                conn.execute("DELETE FROM authenticity_audits;")
                conn.execute("DELETE FROM report_status_history;")
                conn.execute("VACUUM;")

        # Set user cleared flag to prevent auto CSV re-seeding
        try:
            with open(USER_CLEARED_FLAG, "w") as f:
                f.write("1")
        except Exception as ex:
            print(f"[Clear DB Flag Warning]: {ex}")

        return True, "All detection records, audits, and report histories successfully cleared from database."
    except Exception as e:
        print(f"[Clear DB Error]: {e}")
        return False, f"Clear database failed: {e}"
    finally:
        conn.close()


def delete_detection(detection_id: int) -> Tuple[bool, str]:
    """Deletes a single record by ID across PostgreSQL, MySQL, and SQLite."""
    conn, db_type = get_db_connection()
    try:
        if db_type in ["postgres", "mysql"]:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM pothole_detections WHERE id = %s", (detection_id,))
        else: # sqlite
            with conn:
                conn.execute("DELETE FROM pothole_detections WHERE id = ?", (detection_id,))
        return True, f"Record #{detection_id} deleted."
    except Exception as e:
        print(f"[Delete Record Error]: {e}")
        return False, f"Delete failed: {e}"
    finally:
        conn.close()


def migrate_csv_to_db():
    """
    Checks if legacy pothole_data.csv exists and migrates records into the database if DB is empty.
    Skipped if user explicitly cleared database.
    """
    if os.path.exists(USER_CLEARED_FLAG):
        return # User intentionally cleared database, do not auto-repopulate sample CSV

    if not os.path.exists(CSV_FILE_PATH):
        return

    conn, db_type = get_db_connection()
    try:
        # Check if database table already contains records
        count = 0
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) as cnt FROM pothole_detections")
                row = cursor.fetchone()
                count = row["cnt"] if row else 0
        else:
            cursor = conn.execute("SELECT COUNT(*) as cnt FROM pothole_detections")
            row = cursor.fetchone()
            count = row["cnt"] if row else 0

        if count > 0:
            return # Database already populated

        # Read CSV file
        df = pd.read_csv(CSV_FILE_PATH, header=None)
        if df.empty:
            return

        if len(df.columns) >= 6:
            df.columns = ["Image", "Latitude", "Longitude", "Severity", "Confidence", "Time"]
            if 'Severity' in df.columns:
                df = df[df['Severity'] != 'Severity']

            migrated_count = 0
            for _, row in df.iterrows():
                img = str(row.get("Image", ""))
                lat = str(row.get("Latitude", "28.6139"))
                lon = str(row.get("Longitude", "77.2090"))
                sev = str(row.get("Severity", "Medium"))
                conf = float(row.get("Confidence", 0.8)) if pd.notnull(row.get("Confidence")) else 0.8
                tm = str(row.get("Time", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))

                # Check deduplication & insert
                insert_detection(img, lat, lon, sev, conf, tm, skip_dedup=True)
                migrated_count += 1

            print(f"[DB] Successfully migrated {migrated_count} legacy records from CSV into {db_type.upper()} database.")
    except Exception as e:
        print(f"CSV migration notice: {e}")
    finally:
        conn.close()


def seed_demo_data_if_empty():
    """Seeds 25 realistic urban hazard records for hackathon demo if DB is empty."""
    conn, db_type = get_db_connection()
    try:
        count = 0
        if db_type in ["mysql", "postgres"]:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) as cnt FROM pothole_detections")
                row = cursor.fetchone()
                count = row["cnt"] if row else 0
        else:
            cursor = conn.execute("SELECT COUNT(*) as cnt FROM pothole_detections")
            row = cursor.fetchone()
            count = row["cnt"] if row else 0
        if count >= 10:
            return

        CENTER_LAT, CENTER_LON = 28.6139, 77.2090
        STREET_NAMES = [
            "Connaught Place Ring Road", "Janpath Boulevard", "Rajiv Chowk Service Lane",
            "Barakhamba Avenue", " Kasturba Gandhi Marg", "Tolstoy Lane",
            "Parliament Street", "Dr. Zakir Hussain Marg", "India Gate C-Hexagon",
            "Tilak Bridge Approach", "Mandi House Bypass", "ITO Junction Ramp",
            "Daryaganj Outer Road", "Chandni Chowk Link Road", "Lodhi Road Green Belt",
            "Khan Market Access Way", "Sunder Nagar Arterial", "Pragati Maidan Corridor",
            "Paharganj Main Rd", "Karol Bagh Outer Ring"
        ]
        SEV_DIST = ["Critical", "High", "High", "Medium", "Medium", "Medium", "Low", "Low"]
        import random
        random.seed(42)

        now = datetime.now()
        seeded = 0
        for i in range(25):
            lat = round(CENTER_LAT + random.uniform(-0.012, 0.012), 5)
            lon = round(CENTER_LON + random.uniform(-0.015, 0.015), 5)
            sev = random.choice(SEV_DIST)
            conf = round(random.uniform(0.52, 0.97), 2)
            st_name = STREET_NAMES[i % len(STREET_NAMES)]
            tag = st_name.replace(" ", "_").lower()[:16]
            img = f"demo_{tag}_{i+1:02d}.jpg"
            mins_ago = random.randint(2, 720)
            ts = (now - timedelta(minutes=mins_ago)).strftime("%Y-%m-%d %H:%M:%S")
            success, _ = insert_detection(img, str(lat), str(lon), sev, conf, ts, skip_dedup=True)
            if success:
                seeded += 1
        print(f"[DB] Seeded {seeded} demo hazard records for SIH presentation.")
    except Exception as e:
        print(f"[DB] Demo seed notice: {e}")
    finally:
        conn.close()


def get_db_status() -> Dict[str, Any]:
    """Returns metadata about the active database engine & record count."""
    conn, db_type = get_db_connection()
    try:
        count = 0
        if db_type in ["mysql", "postgres"]:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as cnt FROM pothole_detections")
            row = cursor.fetchone()
            count = row["cnt"] if (row and "cnt" in row) else (list(row.values())[0] if row else 0)
        else:
            cursor = conn.execute("SELECT COUNT(*) as cnt FROM pothole_detections")
            row = cursor.fetchone()
            count = row["cnt"] if row else 0

        target_host = "Supabase PostgreSQL Cloud" if db_type == "postgres" else (os.getenv("MYSQL_HOST", "Local Database") if db_type == "mysql" else "Local SQLite File")
        return {
            "type": db_type.upper(),
            "status": "Connected (Online)",
            "host": target_host,
            "count": count
        }
    except Exception as e:
        return {
            "type": db_type.upper(),
            "status": f"Error ({e})",
            "host": "N/A",
            "count": 0
        }
    finally:
        conn.close()


# Auto-initialize database schema on module import
try:
    init_db()
except Exception as e:
    print(f"[DB AUTO-INIT WARNING]: {e}")


if __name__ == "__main__":
    init_db()
    status = get_db_status()
    print(f"[DB] Digital Twin & Urban Utilization Database Engine Initialized: {status}")
