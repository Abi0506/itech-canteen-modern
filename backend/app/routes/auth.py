from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import timedelta
import re

from app.db.session import get_db
from app.db.models import User, Role, Customer
from app.models.schemas import UserLogin, UserRegister, Token, UserResponse, CustomerSignup, CustomerResponse
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings

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
    user = db.query(User).filter(User.email == login_in.email).first()
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
        (User.email == user_in.email) | (User.mobile_number == user_in.mobile_number)
    ).first()
    if existing:
        if existing.email == user_in.email:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
        if existing.mobile_number == user_in.mobile_number:
            raise HTTPException(status_code=400, detail="An account with this phone number already exists.")

    hashed_pw = get_password_hash(user_in.password)
    new_user = User(
        name=user_in.name,
        email=user_in.email,
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
    # Validate phone
    if not is_valid_phone(cust_in.mobile_number):
        raise HTTPException(status_code=400, detail="Please enter a valid phone number (10-15 digits).")

    # Check if duplicate phone exists
    existing = db.query(Customer).filter(Customer.mobile_number == cust_in.mobile_number).first()
    if existing:
        return existing

    new_cust = Customer(
        name=cust_in.name,
        email=cust_in.email,
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
