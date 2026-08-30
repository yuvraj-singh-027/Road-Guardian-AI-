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

import secrets
import hashlib
import hmac
import base64
import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional, Tuple

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel, EmailStr, Field

# Import database connection from db_manager
try:
    from .db_manager import get_db_connection
except ImportError:
    from db_manager import get_db_connection

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET") or "road_guardian_secure_secret_hash_2026_key"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

# Frontend Redirect URL
FRONTEND_URL = os.getenv("FRONTEND_URL") or "http://localhost:3000"

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# --- Pydantic Request Models ---
class SignUpRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=6)
    confirmPassword: str
    adminPasscode: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    rememberMe: Optional[bool] = False

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=6)
    confirmPassword: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class MockGoogleLoginRequest(BaseModel):
    name: str
    email: EmailStr
    google_id: str
    profile_picture: Optional[str] = None
    role: Optional[str] = "public"

# --- Security Helpers ---

def hash_password(password: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256."""
    salt = secrets.token_bytes(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    salt_b64 = base64.b64encode(salt).decode('ascii')
    hash_b64 = base64.b64encode(pw_hash).decode('ascii')
    return f"pbkdf2_sha256$100000${salt_b64}${hash_b64}"

def verify_password(password: str, hashed: str) -> bool:
    """Verifies a password against its PBKDF2-HMAC-SHA256 hash."""
    try:
        parts = hashed.split('$')
        if len(parts) != 4 or parts[0] != 'pbkdf2_sha256':
            return False
        iterations = int(parts[1])
        salt = base64.b64decode(parts[2].encode('ascii'))
        expected_hash = base64.b64decode(parts[3].encode('ascii'))
        actual_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
        return hmac.compare_digest(actual_hash, expected_hash)
    except Exception:
        return False

def create_access_token(data: dict) -> str:
    """Creates a JWT token."""
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and verifies a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

# --- Email Notifications ---

def send_email(to_email: str, subject: str, body_html: str, fallback_link: str):
    """Sends an email using SMTP or logs to console if SMTP variables are not set."""
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL") or smtp_user
    smtp_from_name = os.getenv("SMTP_FROM_NAME") or "Road Guardian Support"

    if smtp_host and smtp_port and smtp_user and smtp_password:
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{smtp_from_name} <{smtp_from_email}>"
            msg['To'] = to_email

            part_html = MIMEText(body_html, 'html')
            msg.attach(part_html)

            port = int(smtp_port)
            if port == 465:
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=5)
            else:
                server = smtplib.SMTP(smtp_host, port, timeout=5)
                server.starttls()
            
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from_email, [to_email], msg.as_string())
            server.quit()
            print(f"[SMTP] Successfully sent email to {to_email}")
            return
        except Exception as e:
            print(f"[SMTP ERROR] Failed to send email: {e}")

    # Fallback developer email logging console output
    border = "=" * 80
    print(f"\n{border}")
    print(f"[EMAIL SIMULATION] Recipient: {to_email}")
    print(f"[EMAIL SIMULATION] Subject:   {subject}")
    print(f"[EMAIL SIMULATION] Action Link: {fallback_link}")
    print(f"{border}\n")

def send_verification_email(name: str, email: str, token: str):
    link = f"http://localhost:8000/api/auth/verify-email?token={token}"
    subject = "Verify Your Road Guardian Account"
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background: #121217; border: 1px solid #27272a; padding: 32px; border-radius: 12px;">
          <h2 style="color: #00E6B4; font-family: 'Space Grotesk', sans-serif;">Road Guardian AI</h2>
          <p>Hello {name},</p>
          <p>Thank you for registering. Please verify your email address to unlock your account and access the dashboard:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{link}" style="background: #00E6B4; color: #09090b; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          <p style="font-size: 0.8rem; color: #71717a;">If the button doesn't work, copy and paste this link in your browser:</p>
          <p style="font-size: 0.8rem; color: #38BDF8; word-break: break-all;">{link}</p>
        </div>
      </body>
    </html>
    """
    send_email(email, subject, html, link)

def send_password_reset_email(name: str, email: str, token: str):
    # Frontend handles password reset views via query params
    link = f"{FRONTEND_URL}/?action=reset-password&token={token}"
    subject = "Reset Your Road Guardian Password"
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background: #121217; border: 1px solid #27272a; padding: 32px; border-radius: 12px;">
          <h2 style="color: #F59E0B; font-family: 'Space Grotesk', sans-serif;">Road Guardian AI</h2>
          <p>Hello {name},</p>
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{link}" style="background: #F59E0B; color: #09090b; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="font-size: 0.8rem; color: #71717a;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
          <p style="font-size: 0.8rem; color: #38BDF8; word-break: break-all;">{link}</p>
        </div>
      </body>
    </html>
    """
    send_email(email, subject, html, link)

# --- Database User Management Operations ---

def get_user_by_email(email: str) -> Optional[dict]:
    conn, db_type = get_db_connection()
    try:
        email_clean = email.strip().lower()
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM users WHERE LOWER(email) = %s LIMIT 1", (email_clean,))
                row = cursor.fetchone()
                return dict(row) if row else None
        else:
            cursor = conn.execute("SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1", (email_clean,))
            row = cursor.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()

def get_user_by_id(user_id: int) -> Optional[dict]:
    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
                row = cursor.fetchone()
                return dict(row) if row else None
        else:
            cursor = conn.execute("SELECT * FROM users WHERE id = ? LIMIT 1", (user_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()

def get_user_by_google_id(google_id: str) -> Optional[dict]:
    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM users WHERE google_id = %s LIMIT 1", (google_id,))
                row = cursor.fetchone()
                return dict(row) if row else None
        else:
            cursor = conn.execute("SELECT * FROM users WHERE google_id = ? LIMIT 1", (google_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()

def create_user(
    name: str, 
    email: str, 
    password: Optional[str] = None, 
    google_id: Optional[str] = None,
    profile_picture: Optional[str] = None,
    role: str = 'public',
    is_verified: int = 0
) -> Tuple[bool, Optional[int]]:
    conn, db_type = get_db_connection()
    email_clean = email.strip().lower()
    pw_hash = hash_password(password) if password else None
    v_token = secrets.token_urlsafe(32) if is_verified == 0 else None

    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO users (name, email, password_hash, is_verified, verification_token, google_id, profile_picture, role)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (name, email_clean, pw_hash, is_verified, v_token, google_id, profile_picture, role))
                user_id = cursor.lastrowid
        else:
            with conn:
                cursor = conn.execute("""
                    INSERT INTO users (name, email, password_hash, is_verified, verification_token, google_id, profile_picture, role)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (name, email_clean, pw_hash, is_verified, v_token, google_id, profile_picture, role))
                user_id = cursor.lastrowid
        return True, user_id
    except Exception as e:
        print(f"[DB USER CREATION ERROR]: {e}")
        return False, None
    finally:
        conn.close()

def update_user_verification(user_id: int, is_verified: int):
    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("UPDATE users SET is_verified = %s, verification_token = NULL WHERE id = %s", (is_verified, user_id))
        else:
            with conn:
                conn.execute("UPDATE users SET is_verified = ?, verification_token = NULL WHERE id = ?", (is_verified, user_id))
    finally:
        conn.close()

def update_user_reset_token(user_id: int, token: Optional[str], expires: Optional[str]):
    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("UPDATE users SET reset_token = %s, reset_token_expires = %s WHERE id = %s", (token, expires, user_id))
        else:
            with conn:
                conn.execute("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?", (token, expires, user_id))
    finally:
        conn.close()

def update_user_password(user_id: int, new_password_hash: str):
    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("UPDATE users SET password_hash = %s, reset_token = NULL, reset_token_expires = NULL WHERE id = %s", (new_password_hash, user_id))
        else:
            with conn:
                conn.execute("UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?", (new_password_hash, user_id))
    finally:
        conn.close()

def update_user_role(user_id: int, role: str):
    conn, db_type = get_db_connection()
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("UPDATE users SET role = %s WHERE id = %s", (role, user_id))
        else:
            with conn:
                conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
    finally:
        conn.close()

# --- Middleware / Authentication Dependency Guard ---

async def get_current_user(request: Request) -> dict:
    """FastAPI Dependency to retrieve and authorize the current session user (Bypassed)."""
    return {
        "id": 1,
        "name": "Authority Admin",
        "email": "admin@roadguardian.ai",
        "role": "admin",
        "profile_picture": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100",
        "is_verified": 1,
        "created_at": "2026-08-30 00:00:00"
    }


# --- Auth Routes Implementation ---

@router.post("/signup")
async def signup(req: SignUpRequest):
    if req.password != req.confirmPassword:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    # Email uniqueness check
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    # Role assessment
    role = "public"
    if req.adminPasscode:
        if req.adminPasscode.strip() == "Admin@RoadGuardian2026":
            role = "admin"
        else:
            raise HTTPException(status_code=400, detail="Invalid Authority Admin Passcode.")

    # Create account (not verified by default)
    success, user_id = create_user(
        name=req.name.strip(),
        email=req.email,
        password=req.password,
        role=role,
        is_verified=0
    )

    if not success or not user_id:
        raise HTTPException(status_code=500, detail="Database insertion failed. Try again.")

    # Fetch token and send email
    user = get_user_by_id(user_id)
    verification_token = user.get("verification_token")
    if verification_token:
        send_verification_email(req.name.strip(), req.email, verification_token)

    return {
        "success": True,
        "message": "Account created successfully. Please verify your email before logging in."
    }

@router.post("/login")
async def login(req: LoginRequest, response: Response):
    user = get_user_by_email(req.email)
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password.")

    # Prevent credential checks for pure Google users trying to input random passwords
    if not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="This account uses Google Login. Click 'Continue with Google'.")

    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid email or password.")

    # Verification guard
    if not user.get("is_verified", 0):
        return JSONResponse(
            status_code=403,
            content={"success": False, "detail": "EMAIL_UNVERIFIED", "email": req.email}
        )

    # Issue JWT Token
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    
    # Store token in HttpOnly cookie as an extra layer
    response.set_cookie(
        key="road_guardian_token",
        value=token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax"
    )

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "profile_picture": user.get("profile_picture")
        }
    }

@router.post("/resend-verification")
async def resend_verification(req: ResendVerificationRequest):
    user = get_user_by_email(req.email)
    if not user:
        # Prevent account enumeration
        return {"success": True, "message": "If this email is registered, a new verification link has been sent."}

    if user.get("is_verified", 0):
        return {"success": True, "message": "Email is already verified."}

    # Retrieve or update verification token
    v_token = user.get("verification_token")
    if not v_token:
        v_token = secrets.token_urlsafe(32)
        # Save new token
        conn, db_type = get_db_connection()
        try:
            if db_type == "mysql":
                with conn.cursor() as cursor:
                    cursor.execute("UPDATE users SET verification_token = %s WHERE id = %s", (v_token, user["id"]))
            else:
                with conn:
                    conn.execute("UPDATE users SET verification_token = ? WHERE id = ?", (v_token, user["id"]))
        finally:
            conn.close()

    send_verification_email(user["name"], user["email"], v_token)
    return {"success": True, "message": "If this email is registered, a new verification link has been sent."}

@router.get("/verify-email", response_class=HTMLResponse)
async def verify_email_endpoint(token: str = Query(...)):
    conn, db_type = get_db_connection()
    user = None
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM users WHERE verification_token = %s LIMIT 1", (token,))
                row = cursor.fetchone()
                user = dict(row) if row else None
        else:
            cursor = conn.execute("SELECT * FROM users WHERE verification_token = ? LIMIT 1", (token,))
            row = cursor.fetchone()
            user = dict(row) if row else None
    finally:
        conn.close()

    if not user:
        return f"""
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center; background: #121217; border: 1px solid #EF4444; padding: 40px; border-radius: 12px; max-width: 450px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
              <div style="color: #EF4444; font-size: 3rem; margin-bottom: 16px;">❌</div>
              <h2 style="margin-bottom: 8px;">Verification Failed</h2>
              <p style="color: #a1a1aa; font-size: 0.9rem; margin-bottom: 24px;">The verification link is expired, invalid, or has already been used.</p>
              <a href="{FRONTEND_URL}" style="background: #ef4444; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Return to Login</a>
            </div>
          </body>
        </html>
        """

    # Activate user account
    update_user_verification(user["id"], 1)

    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
        <div style="text-align: center; background: #121217; border: 1px solid #00E6B4; padding: 40px; border-radius: 12px; max-width: 450px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          <div style="color: #00E6B4; font-size: 3rem; margin-bottom: 16px;">✅</div>
          <h2 style="margin-bottom: 8px;">Email Verified!</h2>
          <p style="color: #a1a1aa; font-size: 0.9rem; margin-bottom: 24px;">Your email address has been successfully verified. You can now log into the application.</p>
          <a href="{FRONTEND_URL}" style="background: #00E6B4; color: #09090b; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Proceed to Dashboard Login</a>
        </div>
      </body>
    </html>
    """

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    user = get_user_by_email(req.email)
    
    # Show confirmation message without revealing whether the email exists (prevent scanning)
    confirm_response = {
        "success": True, 
        "message": "If the account exists, a secure password-reset link has been sent to your email."
    }
    
    if not user:
        return confirm_response

    # Standard users only (OAuth users must authenticate through Google)
    if not user.get("password_hash"):
        return confirm_response

    # Generate token
    token = secrets.token_urlsafe(32)
    expires = (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
    update_user_reset_token(user["id"], token, expires)

    send_password_reset_email(user["name"], user["email"], token)
    return confirm_response

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    if req.password != req.confirmPassword:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    conn, db_type = get_db_connection()
    user = None
    try:
        if db_type == "mysql":
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM users WHERE reset_token = %s LIMIT 1", (req.token,))
                row = cursor.fetchone()
                user = dict(row) if row else None
        else:
            cursor = conn.execute("SELECT * FROM users WHERE reset_token = ? LIMIT 1", (req.token,))
            row = cursor.fetchone()
            user = dict(row) if row else None
    finally:
        conn.close()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    # Expiration check
    expiry_str = user.get("reset_token_expires")
    if expiry_str:
        try:
            expiry_dt = datetime.datetime.strptime(expiry_str, "%Y-%m-%d %H:%M:%S")
            if datetime.datetime.utcnow() > expiry_dt:
                raise ValueError("Expired")
        except Exception:
            raise HTTPException(status_code=400, detail="Password reset token has expired.")

    # Save new password
    new_hash = hash_password(req.password)
    update_user_password(user["id"], new_hash)

    return {"success": True, "message": "Password successfully updated. You can now log in."}

@router.get("/me")
async def get_current_user_profile(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "profile_picture": user.get("profile_picture"),
        "is_verified": bool(user.get("is_verified", 0)),
        "created_at": str(user.get("created_at"))
    }

class UpgradeRequest(BaseModel):
    passcode: str

@router.post("/upgrade")
async def upgrade_role(req: UpgradeRequest, current_user: dict = Depends(get_current_user)):
    if req.passcode != "Admin@RoadGuardian2026":
        raise HTTPException(status_code=400, detail="Invalid admin passcode.")
    
    update_user_role(current_user["id"], "admin")
    
    # Re-issue JWT token with updated role
    token = create_access_token({"sub": str(current_user["id"]), "role": "admin"})
    
    return {
        "success": True,
        "token": token,
        "message": "Account upgraded successfully."
    }

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("road_guardian_token")
    return {"success": True, "message": "Logged out successfully"}

# --- Google OAuth Sandbox (Fallback Demo Mode) ---

@router.post("/google/mock-login")
async def google_mock_login(req: MockGoogleLoginRequest, response: Response):
    """
    Simulates Google Identity Authentication (OAuth Callback) for development environments.
    Retrieves or inserts a user based on Google ID and signs a secure JWT.
    """
    user = get_user_by_google_id(req.google_id)
    
    if not user:
        # Fallback search by email to merge standard registration with Google OAuth profile
        user = get_user_by_email(req.email)
        if user:
            # Bind google_id and photo
            conn, db_type = get_db_connection()
            try:
                if db_type == "mysql":
                    with conn.cursor() as cursor:
                        cursor.execute("UPDATE users SET google_id = %s, profile_picture = %s WHERE id = %s", 
                                       (req.google_id, req.profile_picture, user["id"]))
                else:
                    with conn:
                        conn.execute("UPDATE users SET google_id = ?, profile_picture = ? WHERE id = ?", 
                                     (req.google_id, req.profile_picture, user["id"]))
            finally:
                conn.close()
            user = get_user_by_id(user["id"])
        else:
            # Create a new verified user account automatically
            success, user_id = create_user(
                name=req.name,
                email=req.email,
                google_id=req.google_id,
                profile_picture=req.profile_picture,
                role=req.role or "public",
                is_verified=1 # Google users are pre-verified
            )
            if not success or not user_id:
                raise HTTPException(status_code=500, detail="Google authentication database link failed.")
            user = get_user_by_id(user_id)

    # Issue JWT Token
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    
    # Store token in HttpOnly cookie
    response.set_cookie(
        key="road_guardian_token",
        value=token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax"
    )

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "profile_picture": user.get("profile_picture")
        }
    }

# --- Google OAuth Standard Integration ---

@router.get("/google/status")
async def google_status():
    """Allows frontend to check if client keys are set without triggering CORS redirects."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    return {"configured": bool(client_id)}

@router.get("/google/login")
async def google_standard_login(request: Request):
    """Redirects user to Google Consent screen if keys exist, otherwise returns error indicating sandbox required."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI") or f"{request.url.scheme}://{request.url.netloc}/api/auth/google/callback"
    
    if not client_id:
        # Tell the client standard keys are not found (forces Sandbox redirect flow)
        raise HTTPException(
            status_code=400, 
            detail="GOOGLE_OAUTH_KEYS_NOT_CONFIGURED"
        )
        
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        "response_type=code&"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        "scope=openid%20email%20profile"
    )
    return RedirectResponse(google_auth_url)

@router.get("/google/callback")
async def google_standard_callback(code: str, request: Request, response: Response):
    """Exchanges code for Google user details and issues a valid app JWT."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI") or f"{request.url.scheme}://{request.url.netloc}/api/auth/google/callback"

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth configuration missing on server.")

    # 1. Exchange auth code for tokens
    import urllib.request
    import json
    import urllib.parse
    
    try:
        token_url = "https://oauth2.googleapis.com/token"
        data = urllib.parse.urlencode({
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }).encode("utf-8")
        
        req = urllib.request.Request(token_url, data=data)
        with urllib.request.urlopen(req) as resp:
            tokens = json.loads(resp.read().decode("utf-8"))
            
        access_token = tokens.get("access_token")
        
        # 2. Retrieve Google profile info
        profile_url = f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={access_token}"
        with urllib.request.urlopen(profile_url) as resp:
            profile = json.loads(resp.read().decode("utf-8"))
            
        # Extract fields
        google_id = profile.get("sub")
        email = profile.get("email")
        name = profile.get("name", email.split('@')[0])
        picture = profile.get("picture")
        
        # 3. Retrieve or create user record
        user = get_user_by_google_id(google_id)
        if not user:
            user = get_user_by_email(email)
            if user:
                # Merge existing email account
                conn, db_type = get_db_connection()
                try:
                    if db_type == "mysql":
                        with conn.cursor() as cursor:
                            cursor.execute("UPDATE users SET google_id = %s, profile_picture = %s WHERE id = %s", 
                                           (google_id, picture, user["id"]))
                    else:
                        with conn:
                            conn.execute("UPDATE users SET google_id = ?, profile_picture = ? WHERE id = ?", 
                                         (google_id, picture, user["id"]))
                finally:
                    conn.close()
                user = get_user_by_id(user["id"])
            else:
                # Sign up new Google user
                success, user_id = create_user(
                    name=name,
                    email=email,
                    google_id=google_id,
                    profile_picture=picture,
                    role="public",
                    is_verified=1
                )
                if not success or not user_id:
                    raise ValueError("Failed creating user")
                user = get_user_by_id(user_id)
                
        # 4. Issue JWT
        token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
        
        # Redirect user back to React frontend dashboard with token parameter
        redirect_target = f"{FRONTEND_URL}/?token={token}"
        return RedirectResponse(redirect_target)
        
    except Exception as e:
        print(f"[GOOGLE OAUTH CALLBACK ERROR]: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/?error=google_auth_failed")
