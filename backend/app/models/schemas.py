from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, date, time

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    roll_no: str

class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None

# User Schemas
class UserLogin(BaseModel):
    roll_no: str # roll_no or email
    password: str

class UserRegister(BaseModel):
    roll_no: str
    email: EmailStr
    phone_no: str
    password: str
    user_type: str = "student" # 'student', 'faculty', 'external'

class UserResponse(BaseModel):
    id: int
    roll_no: str
    email: EmailStr
    phone_no: Optional[str] = None
    role: str
    user_type: str
    wallet_balance: float
    email_verified: bool
    favourites: List[int] = []
    bulk_order_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Category & Item Schemas
class CategoryResponse(BaseModel):
    id: int
    name: str
    is_active: bool

    class Config:
        from_attributes = True

class CategoryCreate(BaseModel):
    name: str

class FoodItemResponse(BaseModel):
    id: int
    category_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    price: Decimal
    cash_price: Optional[Decimal] = None
    image: Optional[str] = None
    quantity_available: int
    is_active: bool
    perishable: bool

    class Config:
        from_attributes = True

class FoodItemCreate(BaseModel):
    name: str
    category_id: int
    price: Decimal
    cash_price: Optional[Decimal] = None
    description: Optional[str] = None
    quantity_available: int = 0
    is_active: bool = True
    perishable: bool = False

# Cart & Order Schemas
class CartItem(BaseModel):
    food_item_id: int
    quantity: int

class UserCheckout(BaseModel):
    items: List[CartItem]
    payment_method: str # 'wallet', 'razorpay'

class OrderItemSchema(BaseModel):
    id: int
    food_item_id: int
    quantity: int
    price: Decimal
    name: str

class OrderResponse(BaseModel):
    id: int
    user_id: int
    bill_number: str
    total_amount: Decimal
    items: Dict[str, Any]
    payment_method: str
    payment_status: str
    created_at: datetime

    class Config:
        from_attributes = True

class GoogleLoginPayload(BaseModel):
    credential: str

# Cashier Schemas
class CashierBillingItem(BaseModel):
    id: int
    name: str
    price: Decimal
    quantity: int
    category: str

class CashierCheckout(BaseModel):
    customer_roll: str # roll_no, phone_no, or email
    payment_method: str # 'cash', 'upi', 'wallet', 'partial'
    items: List[CashierBillingItem]
    amount_received: Decimal = Decimal("0.00")
    wallet_amount: Decimal = Decimal("0.00")
    online_amount: Decimal = Decimal("0.00")

# Idea Schemas
class IdeaCreate(BaseModel):
    title: str
    description: str

class IdeaResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: str
    upvotes: int
    status: str
    created_at: datetime
    is_upvoted: bool = False

    class Config:
        from_attributes = True
