"""
Digital Twin & Urban Utilization — Database & Deduplication Manager
Handles MySQL Database operations with automatic local SQLite fallback,
spatial & temporal hazard deduplication, and automatic CSV migration.
"""

import os
from pathlib import Path

# Manually load .env file into os.environ if it exists
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    with open(_env_path, "r", encoding="utf-8") as _f:
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

# Try importing PyMySQL for MySQL database connections
try:
    import pymysql
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False

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
    Attempts to connect to MySQL using environment variables.
    If MySQL configuration is missing or connection fails, falls back gracefully to local SQLite.
    Returns (connection_obj, db_type: 'mysql'|'sqlite')
    """
    mysql_host = os.getenv("MYSQL_HOST")
    mysql_user = os.getenv("MYSQL_USER")
    mysql_pass = os.getenv("MYSQL_PASSWORD", "")
    mysql_db = os.getenv("MYSQL_DB", "road_guardian_db")
    mysql_port = int(os.getenv("MYSQL_PORT", 3306))

    if MYSQL_AVAILABLE and mysql_host and mysql_user:
        try:
            # First attempt connecting directly to database
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
            # Try creating database if it doesn't exist
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

    # Fallback to local SQLite database
    conn = sqlite3.connect(SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn, "sqlite"


_DB_INITIALIZED = False

def init_db():
    """Initializes the users and pothole_detections table schemas if they do not exist."""
    global _DB_INITIALIZED
    if _DB_INITIALIZED:
        return
    _DB_INITIALIZED = True

    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
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
                # Try adding user_id dynamically if column is missing on existing table
                try:
                    cursor.execute("SELECT user_id FROM pothole_detections LIMIT 1")
                except Exception:
                    cursor.execute("ALTER TABLE pothole_detections ADD COLUMN user_id INT NULL")
                try:
                    cursor.execute("SELECT phash FROM pothole_detections LIMIT 1")
                except Exception:
                    cursor.execute("ALTER TABLE pothole_detections ADD COLUMN phash VARCHAR(64) NULL")
                try:
                    cursor.execute("SELECT authenticity_score FROM pothole_detections LIMIT 1")
                except Exception:
                    cursor.execute("ALTER TABLE pothole_detections ADD COLUMN authenticity_score FLOAT NULL")
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                # Try adding dynamic columns if missing on existing table
                try:
                    conn.execute("SELECT user_id FROM pothole_detections LIMIT 1")
                except Exception:
                    conn.execute("ALTER TABLE pothole_detections ADD COLUMN user_id INTEGER")
                try:
                    conn.execute("SELECT phash FROM pothole_detections LIMIT 1")
                except Exception:
                    conn.execute("ALTER TABLE pothole_detections ADD COLUMN phash TEXT")
                try:
                    conn.execute("SELECT authenticity_score FROM pothole_detections LIMIT 1")
                except Exception:
                    conn.execute("ALTER TABLE pothole_detections ADD COLUMN authenticity_score REAL")
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
            if db_type == "mysql":
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
            if db_type == "mysql":
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
    phash: str = "",
    authenticity_score: Optional[float] = None
) -> Tuple[bool, str]:
    """
    Inserts a new pothole detection record into the database after deduplication checks.
    Returns (success: bool, message: str)
    """
    init_db()
    
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
            return False, f"Suppressed Duplicate: {reason}"

    # Calculate Risk Score
    risk_info = calculate_road_risk(severity=severity, confidence=confidence)
    risk_score = risk_info["score"]

    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO pothole_detections 
                    (image_name, latitude, longitude, severity, confidence, time, lat_numeric, lon_numeric, risk_score, image_hash, user_id, phash, authenticity_score)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (image_name, str(latitude), str(longitude), severity, float(confidence), time_str, lat_num, lon_num, risk_score, img_hash, user_id, phash or None, authenticity_score))
        else: # sqlite
            with conn:
                conn.execute("""
                    INSERT INTO pothole_detections 
                    (image_name, latitude, longitude, severity, confidence, time, lat_numeric, lon_numeric, risk_score, image_hash, user_id, phash, authenticity_score)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (image_name, str(latitude), str(longitude), severity, float(confidence), time_str, lat_num, lon_num, risk_score, img_hash, user_id, phash or None, authenticity_score))
        return True, f"Successfully logged detection '{image_name}' to {db_type.upper()} database."
    except Exception as e:
        return False, f"Database insertion error: {e}"
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
        if db_type == "mysql":
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
        if db_type == "mysql":
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
        if db_type == "mysql":
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
        if db_type == "mysql":
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


def clear_all_detections() -> Tuple[bool, str]:
    """Clears all records from the pothole_detections table."""
    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("TRUNCATE TABLE pothole_detections")
        else:
            with conn:
                conn.execute("DELETE FROM pothole_detections")
        return True, "All detection records successfully cleared from database."
    except Exception as e:
        return False, f"Clear database failed: {e}"
    finally:
        conn.close()


def delete_detection(detection_id: int) -> Tuple[bool, str]:
    """Deletes a single record by ID."""
    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM pothole_detections WHERE id = %s", (detection_id,))
        else:
            with conn:
                conn.execute("DELETE FROM pothole_detections WHERE id = ?", (detection_id,))
        return True, f"Record #{detection_id} deleted."
    except Exception as e:
        return False, f"Delete failed: {e}"
    finally:
        conn.close()


def migrate_csv_to_db():
    """
    Checks if legacy pothole_data.csv exists and migrates records into the database if DB is empty.
    """
    if not os.path.exists(CSV_FILE_PATH):
        return

    conn, db_type = get_db_connection()
    try:
        # Check if database table already contains records
        count = 0
        if db_type == "mysql":
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
        if db_type == "mysql":
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
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) as cnt FROM pothole_detections")
                row = cursor.fetchone()
                count = row["cnt"] if row else 0
        else:
            cursor = conn.execute("SELECT COUNT(*) as cnt FROM pothole_detections")
            row = cursor.fetchone()
            count = row["cnt"] if row else 0

        return {
            "type": db_type.upper(),
            "status": "Connected (Online)",
            "host": os.getenv("MYSQL_HOST", "Local SQLite") if db_type == "mysql" else "Local SQLite File",
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
