from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import timedelta, datetime
import re
import secrets

from app.db.session import get_db
from app.db.models import User, Role, Customer, PasswordResetToken
from app.models.schemas import UserLogin, UserRegister, Token, UserResponse, CustomerSignup, CustomerResponse
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.services.email import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == int(sub)).first()
    if user is None or not user.is_active or user.deleted_at is not None:
        raise credentials_exception
    return user

def require_role(roles_list: list):
    def dependency(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        role = db.query(Role).filter(Role.id == current_user.role_id).first()
        role_name = role.name if role else None
        if not role_name or role_name not in roles_list:
            raise HTTPException(status_code=403, detail="Not authorized to access this resource.")
        return current_user
    return dependency

def is_valid_phone(phone: str) -> bool:
    cleaned = re.sub(r"\D+", "", phone)
    return 10 <= len(cleaned) <= 15

def is_valid_password(password: str) -> bool:
    return (
        len(password) >= 8
        and bool(re.search(r"[A-Z]", password))
        and bool(re.search(r"\d", password))
        and bool(re.search(r"[^A-Za-z0-9\s]", password))
    )


def password_constraint_message() -> str:
    return "Password must be at least 8 characters and contain one uppercase letter, one number, and one special character."

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    email = login_in.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password.")
    
    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(status_code=400, detail="This account has been suspended/deactivated.")
        
    if not verify_password(login_in.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password.")
        
    # Get role name
    role = db.query(Role).filter(Role.id == user.role_id).first()
    role_name = role.name if role else "employee"

    token = create_access_token(subject=str(user.id))
    return Token(
        access_token=token,
        token_type="bearer",
        role=role_name,
        email=user.email
    )

@router.post("/signup", response_model=UserResponse)
def signup(user_in: UserRegister, db: Session = Depends(get_db)):
    email = user_in.email.strip().lower()
    # Verify role exists
    role = db.query(Role).filter(Role.id == user_in.role_id).first()
    if not role:
        raise HTTPException(status_code=400, detail="Role does not exist.")

    # Validate phone
    if not is_valid_phone(user_in.mobile_number):
        raise HTTPException(status_code=400, detail="Please enter a valid phone number (10-15 digits).")

    if not is_valid_password(user_in.password):
        raise HTTPException(
            status_code=400,
            detail=password_constraint_message(),
        )

    # Check duplicates
    existing = db.query(User).filter(
        (User.email == email) | (User.mobile_number == user_in.mobile_number)
    ).first()
    if existing:
        if existing.email == email:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
        if existing.mobile_number == user_in.mobile_number:
            raise HTTPException(status_code=400, detail="An account with this phone number already exists.")

    hashed_pw = get_password_hash(user_in.password)
    new_user = User(
        name=user_in.name,
        email=email,
        mobile_number=user_in.mobile_number,
        password_hash=hashed_pw,
        role_id=user_in.role_id,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/customer-signup", response_model=CustomerResponse)
def customer_signup(cust_in: CustomerSignup, db: Session = Depends(get_db)):
    email = cust_in.email.strip().lower() if cust_in.email else None
    # Validate phone
    if not is_valid_phone(cust_in.mobile_number):
        raise HTTPException(status_code=400, detail="Please enter a valid phone number (10-15 digits).")

    # Check if duplicate phone exists
    existing = db.query(Customer).filter(Customer.mobile_number == cust_in.mobile_number).first()
    if existing:
        return existing

    new_cust = Customer(
        name=cust_in.name,
        email=email,
        mobile_number=cust_in.mobile_number,
        is_guest=False
    )
    db.add(new_cust)
    db.commit()
    db.refresh(new_cust)
    return new_cust

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == current_user.role_id).first()
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "mobile_number": current_user.mobile_number,
        "role_name": role.name if role else "employee",
        "is_active": current_user.is_active
    }


# ─── Forgot / Reset Password ───────────────────────────────────────────────────

TOKEN_EXPIRY_MINUTES = 60  # 1 hour


@router.post("/forgot-password")
def forgot_password(payload: dict, request: Request, db: Session = Depends(get_db)):
    """
    Accepts {"email": "..."}. Looks up the staff user, creates a single-use
    token valid for 1 hour and emails a reset link. Always returns a generic
    200 response so email enumeration is not possible.
    """
    email = (payload.get("email") or "").strip().lower()
    user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()

    if user and user.is_active:
        # Invalidate any existing unused tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ).delete(synchronize_session=False)

        token_value = secrets.token_hex(64)
        expires = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRY_MINUTES)
        token = PasswordResetToken(
            user_id=user.id,
            token=token_value,
            expires_at=expires,
        )
        db.add(token)
        db.commit()

        # Build the reset link pointing to the frontend
        origin = str(request.base_url).rstrip("/")
        # Replace backend port with frontend port when in dev
        frontend_origin = origin.replace(":8000", ":5173").replace(":8000", ":5173")
        reset_link = f"{frontend_origin}/reset-password?token={token_value}"

        try:
            send_password_reset_email(
                to_email=user.email,
                user_name=user.name,
                reset_link=reset_link,
            )
        except Exception:
            # Do not surface email failures to the client
            pass

    return {
        "success": True,
        "message": "If an account with that email exists, a reset link has been sent."
    }


@router.post("/reset-password")
def reset_password(payload: dict, db: Session = Depends(get_db)):
    """
    Accepts {"token": "...", "password": "..."}.
    Validates the token (not expired, not used), then updates the password.
    """
    token_value = (payload.get("token") or "").strip()
    new_password = payload.get("password") or ""

    if not token_value:
        raise HTTPException(status_code=400, detail="Reset token is required.")

    if not is_valid_password(new_password):
        raise HTTPException(status_code=400, detail=password_constraint_message())

    token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token_value
    ).first()

    if not token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    if token.used_at is not None:
        raise HTTPException(status_code=400, detail="This reset link has already been used.")

    if datetime.utcnow() > token.expires_at:
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one.")

    user = db.query(User).filter(User.id == token.user_id).first()
    if not user or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status_code=400, detail="User account not found or inactive.")

    # Mark token as used immediately (single-use)
    token.used_at = datetime.utcnow()
    user.password_hash = get_password_hash(new_password)
    db.commit()

    return {"success": True, "message": "Password has been reset. You can now log in."}
