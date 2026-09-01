import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Load .env
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

from db_manager import get_db_connection, init_db, get_db_status

def main():
    print("\n=======================================================")
    print("      ROAD GUARDIAN AI — DATABASE CONNECTION TEST")
    print("=======================================================")
    
    supabase_url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if supabase_url:
        # Hide password in output for safety
        safe_url = supabase_url.split("@")[-1] if "@" in supabase_url else "Configured"
        print(f"📡 Found Supabase / PostgreSQL URI: ...@{safe_url}")
    else:
        print("⚠️ No SUPABASE_DB_URL or DATABASE_URL detected in .env file.")
        print("   Defaulting to local SQLite database (road_guardian.db).")

    print("\n[1/3] Establishing connection...")
    try:
        conn, db_type = get_db_connection()
        print(f"✅ Connection successful! Active DB Engine: {db_type.upper()}")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return

    print("\n[2/3] Initializing table schemas (users, detections, audits, status_history)...")
    try:
        init_db()
        print("✅ Tables initialized & verified!")
    except Exception as e:
        print(f"❌ Table initialization error: {e}")

    print("\n[3/3] Fetching database telemetry summary...")
    try:
        status = get_db_status()
        print(f"   • Database Type: {status.get('type')}")
        print(f"   • Status:        {status.get('status')}")
        print(f"   • Host/Target:   {status.get('host')}")
        print(f"   • Total Records: {status.get('count')}")
    except Exception as e:
        print(f"⚠️ Telemetry summary error: {e}")

    print("\n=======================================================")
    print("🎉 Database setup is ready for Road Guardian AI!")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
