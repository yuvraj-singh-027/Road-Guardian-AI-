import os
import requests
import datetime
import threading
from typing import Dict, Any, Optional
from pathlib import Path

# Auto-load backend/.env if not already in environment
BASE_DIR = Path(__file__).resolve().parent
_env_path = BASE_DIR / ".env"
if _env_path.exists():
    with open(_env_path, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

# Read n8n webhook URL & auth credentials from environment variables or default
DEFAULT_N8N_URL = "https://yuvi027.app.n8n.cloud/webhook/road-guardian-report"
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", DEFAULT_N8N_URL)
N8N_WEBHOOK_TOKEN = os.getenv("N8N_WEBHOOK_TOKEN", "")
N8N_HEADER_NAME = os.getenv("N8N_HEADER_NAME", "road-guardian-ai")
N8N_AUTH_USER = os.getenv("N8N_AUTH_USER", "")
N8N_AUTH_PASS = os.getenv("N8N_AUTH_PASS", "")

def _get_alternate_url(url: str) -> Optional[str]:
    """Generates production URL if test URL is passed, or vice-versa, across road-guardian-report and road-guardian-ai."""
    if "/webhook-test/" in url:
        return url.replace("/webhook-test/", "/webhook/")
    elif "/webhook/" in url:
        return url.replace("/webhook/", "/webhook-test/")
    return None

def _get_headers() -> Dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "RoadGuardianAI/2.0-n8nDispatcher"
    }
    token = os.getenv("N8N_WEBHOOK_TOKEN", N8N_WEBHOOK_TOKEN)
    header_name = os.getenv("N8N_HEADER_NAME", N8N_HEADER_NAME)
    if token:
        headers[header_name] = token
        headers["X-N8N-TOKEN"] = token
        headers["Authorization"] = f"Bearer {token}"
    return headers

def _get_auth():
    user = os.getenv("N8N_AUTH_USER", N8N_AUTH_USER)
    pwd = os.getenv("N8N_AUTH_PASS", N8N_AUTH_PASS)
    if user or pwd:
        return (user, pwd)
    return None

def trigger_n8n_event(event_type: str, payload: Dict[str, Any], webhook_url: Optional[str] = None) -> None:
    """
    Asynchronously posts event data to n8n webhook without blocking main FastAPI execution.
    """
    target_url = webhook_url or os.getenv("N8N_WEBHOOK_URL") or N8N_WEBHOOK_URL
    if not target_url:
        print("[n8n Dispatcher] Webhook URL disabled or empty. Skipping dispatch.")
        return

    def _async_post():
        raw_email = (
            payload.get("user_email") or 
            payload.get("user_gmail") or
            payload.get("reporter_email") or 
            payload.get("email") or 
            os.getenv("DEFAULT_REPORTER_EMAIL") or
            "citizen@roadguardian.gov"
        )
        email_val = str(raw_email).strip() if raw_email else "citizen@roadguardian.gov"
        
        # Ensure all aliases are explicitly set with the active user's actual email
        payload["user_email"] = email_val
        payload["user_gmail"] = email_val
        payload["reporter_email"] = email_val
        payload["email"] = email_val

        event_body = {
            "system": "Road Guardian AI Digital Twin",
            "event": event_type,
            "timestamp": datetime.datetime.now().isoformat(),
            "user_email": email_val,
            "user_gmail": email_val,
            "reporter_email": email_val,
            "email": email_val,
            "payload": payload
        }
        headers = _get_headers()
        
        urls_to_try = [target_url]
        alt_url = _get_alternate_url(target_url)
        if alt_url and alt_url not in urls_to_try:
            urls_to_try.append(alt_url)

        for attempt_url in urls_to_try:
            try:
                response = requests.post(attempt_url, json=event_body, headers=headers, auth=_get_auth(), timeout=8)
                if response.status_code in [200, 201, 202, 204]:
                    is_test_mode = "/webhook-test/" in attempt_url
                    mode_str = "TEST MODE" if is_test_mode else "ACTIVE PRODUCTION"
                    print(f"[n8n Dispatcher OK ({mode_str})] Event '{event_type}' sent to n8n ({attempt_url}). Status: {response.status_code}")
                    return
                elif response.status_code == 404 and len(urls_to_try) > 1 and attempt_url == urls_to_try[0]:
                    print(f"[n8n Dispatcher INFO] HTTP 404 at {attempt_url}. Retrying alternate URL: {urls_to_try[1]}...")
                    continue
                else:
                    print(f"[n8n Dispatcher WARNING] n8n at {attempt_url} returned HTTP {response.status_code}: {response.text[:200]}")
                    break
            except Exception as ex:
                print(f"[n8n Dispatcher ERROR] Failed reaching n8n at {attempt_url}: {ex}")

    # Dispatch in a non-blocking background thread
    thread = threading.Thread(target=_async_post, daemon=True)
    thread.start()

def test_n8n_connection(webhook_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Ping test function to verify n8n cloud webhook listener connectivity.
    """
    target_url = webhook_url or os.getenv("N8N_WEBHOOK_URL") or N8N_WEBHOOK_URL
    urls_to_try = [target_url]
    alt_url = _get_alternate_url(target_url)
    if alt_url and alt_url not in urls_to_try:
        urls_to_try.append(alt_url)

    test_payload = {
        "system": "Road Guardian AI Digital Twin",
        "event": "PING_TEST",
        "timestamp": datetime.datetime.now().isoformat(),
        "payload": {"message": "n8n Cloud Webhook Connection Test"}
    }
    headers = _get_headers()

    last_error = None
    for attempt_url in urls_to_try:
        try:
            res = requests.post(attempt_url, json=test_payload, headers=headers, auth=_get_auth(), timeout=6)
            if res.status_code < 400:
                is_test_mode = "/webhook-test/" in attempt_url
                return {
                    "success": True,
                    "status_code": res.status_code,
                    "webhook_url": attempt_url,
                    "mode": "TEST_MODE" if is_test_mode else "ACTIVE_PRODUCTION",
                    "header_auth_active": bool(headers.get("road-guardian-ai") or headers.get("X-N8N-TOKEN")),
                    "response": res.text[:300]
                }
            elif res.status_code == 404 and attempt_url == urls_to_try[0] and len(urls_to_try) > 1:
                continue
            else:
                return {
                    "success": False,
                    "status_code": res.status_code,
                    "webhook_url": attempt_url,
                    "header_auth_active": bool(headers.get("road-guardian-ai") or headers.get("X-N8N-TOKEN")),
                    "response": res.text[:300]
                }
        except Exception as err:
            last_error = str(err)

    return {
        "success": False,
        "status_code": 500,
        "webhook_url": target_url,
        "error": last_error or "Unable to connect to n8n cloud webhook"
    }
