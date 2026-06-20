from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import timedelta
import re
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.db.session import get_db
from app.db.models import User, Department
from app.models.schemas import UserLogin, UserRegister, Token, UserResponse, GoogleLoginPayload
from app.core.security import verify_password, get_password_hash, create_access_token, encrypt_wallet_balance
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login-form-compatibility")

ROLE_HOME_PATHS = {
    "superadmin": "/admin/dashboard",
    "admin": "/admin/dashboard",
    "inventory_manager": "/admin/items",
    "cashier": "/cashier/billing",
    "chef": "/kitchen",
    "customer": "/dashboard",
    "user": "/dashboard",
    "dept": "/dashboard",
    "external": "/dashboard",
}

def validate_email_domain(email: str) -> bool:
    if "@" not in email:
        return False
    return True

def is_valid_phone(phone: str) -> bool:
    cleaned = re.sub(r"\D+", "", phone)
    return len(cleaned) == 10 and cleaned[0] in "6789"

def _build_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        roll_no=user.roll_no,
        display_name=user.display_name,
        email=user.email,
        phone_no=user.phone_no,
        role=user.role,
        user_type=user.user_type,
        wallet_balance=user.get_balance(),
        email_verified=user.email_verified,
        favourites=user.favourites or [],
        bulk_order_enabled=user.bulk_order_enabled,
        loyalty_points=user.loyalty_points or 0,
        created_at=user.created_at,
    )


def _landing_path_for_role(role: str) -> str:
    return ROLE_HOME_PATHS.get(role, "/dashboard")

@router.post("/register", response_model=UserResponse)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    # Validate phone
    if not is_valid_phone(user_in.phone_no):
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit phone number.")
        
    # Validate email format
    if not validate_email_domain(user_in.email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    # Check duplicate
    existing_user = db.query(User).filter(
        (User.roll_no == user_in.roll_no) | 
        (User.email == user_in.email) | 
        (User.phone_no == user_in.phone_no)
    ).first()
    
    if existing_user:
        if existing_user.roll_no == user_in.roll_no:
            raise HTTPException(status_code=400, detail="An account with this roll number already exists.")
        if existing_user.email == user_in.email:
            raise HTTPException(status_code=400, detail="An account with this email address already exists.")
        if existing_user.phone_no == user_in.phone_no:
            raise HTTPException(status_code=400, detail="An account with this phone number already exists.")

    hashed_pw = get_password_hash(user_in.password)
    
    bulk_enabled = False
    
    new_user = User(
        roll_no=user_in.roll_no,
        email=user_in.email,
        phone_no=user_in.phone_no,
        password=hashed_pw,
        role="user",
        user_type=user_in.user_type,
        email_verified=False,
        bulk_order_enabled=bulk_enabled,
        favourites=[]
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Initialize wallet balance with 0.00
    new_user.set_balance(0.00)
    db.commit()
    db.refresh(new_user)
    
    return _build_user_response(new_user)

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    # 1. Try logging in as User
    user = db.query(User).filter(
        (User.roll_no == login_in.roll_no) | (User.email == login_in.roll_no)
    ).first()
    
    if user:
        if user.deleted_at is not None:
            raise HTTPException(status_code=400, detail="This account has been suspended.")
        if not verify_password(login_in.password, user.password):
            raise HTTPException(status_code=400, detail="Invalid password.")
            
        token = create_access_token(subject=user.id)
        return Token(
            access_token=token,
            token_type="bearer",
            role=user.role,
            roll_no=user.roll_no,
            landing_path=_landing_path_for_role(user.role),
        )

    # 2. Try logging in as Department
    dept = db.query(Department).filter(Department.dept_name == login_in.roll_no).first()
    if dept:
        if not verify_password(login_in.password, dept.password):
            raise HTTPException(status_code=400, detail="Invalid password.")
        
        # We model department as special user ID prepended with "dept_" or mapped to role "dept"
        # We can issue JWT token for subject dept.id with extra claims
        # For simplicity, we can return role "dept" and roll_no as dept_name
        token = create_access_token(subject=f"dept_{dept.id}")
        return Token(
            access_token=token,
            token_type="bearer",
            role="dept",
            roll_no=dept.dept_name,
            landing_path=_landing_path_for_role("dept"),
        )
        
    raise HTTPException(status_code=400, detail="This user does not exist.")

@router.post("/google", response_model=Token)
def google_login(payload: GoogleLoginPayload, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured on the server.")

    try:
        id_info = google_id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Google credential.")

    email = id_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account did not return an email address.")

    name = id_info.get("name") or email.split("@")[0]
    picture = id_info.get("picture")
    google_sub = id_info.get("sub")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        base_roll_no = f"google-{google_sub}"
        roll_no = base_roll_no[:50]
        suffix = 1
        while db.query(User).filter(User.roll_no == roll_no).first() is not None:
            roll_no = f"{base_roll_no[:45]}-{suffix}"[:50]
            suffix += 1

        user = User(
            roll_no=roll_no,
            email=email,
            phone_no="0000000000",
            password=get_password_hash(google_sub),
            role="user",
            user_type="external",
            email_verified=True,
            bulk_order_enabled=False,
            favourites=[],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        user.set_balance(0.00)
        db.commit()
        db.refresh(user)
    else:
        if not user.email_verified:
            user.email_verified = True
        if user.user_type == "student" and email.endswith("@gmail.com"):
            user.user_type = "external"
        db.commit()
        db.refresh(user)

    token = create_access_token(subject=user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        roll_no=user.roll_no,
        landing_path=_landing_path_for_role(user.role),
    )

# Dependency to fetch current user
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
        
    # Check if department session
    if sub.startswith("dept_"):
        dept_id = int(sub.split("_")[1])
        dept = db.query(Department).filter(Department.id == dept_id).first()
        if not dept:
            raise credentials_exception
        # Return mock user class representing department
        return User(id=dept.id, roll_no=dept.dept_name, role="dept", user_type="faculty", email="dept@canteen.local")
        
    user = db.query(User).filter(User.id == int(sub)).first()
    if user is None:
        raise credentials_exception
    return user

def require_role(roles: list):
    def dependency(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Not authorized to access this resource.")
        return current_user
    return dependency
