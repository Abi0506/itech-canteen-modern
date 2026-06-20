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
    landing_path: str

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
    user_type: str = "customer" # 'customer', 'staff', 'external'

class UserResponse(BaseModel):
    id: int
    roll_no: str
    display_name: Optional[str] = None
    email: EmailStr
    phone_no: Optional[str] = None
    role: str
    user_type: str
    wallet_balance: float
    email_verified: bool
    favourites: List[int] = []
    bulk_order_enabled: bool
    loyalty_points: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# Category & Item Schemas
class CategoryResponse(BaseModel):
    id: int
    name: str
    color: str = "#F59E0B"
    is_active: bool

    class Config:
        from_attributes = True

class CategoryCreate(BaseModel):
    name: str
    color: str = "#F59E0B"

class FoodItemResponse(BaseModel):
    id: int
    category_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    price: Decimal
    cash_price: Optional[Decimal] = None
    unit_of_measure: str = "piece"
    tax_rate: Decimal = Decimal("0.00")
    image: Optional[str] = None
    quantity_available: int
    reserved_quantity: int = 0
    is_active: bool
    perishable: bool

    class Config:
        from_attributes = True

class FoodItemCreate(BaseModel):
    name: str
    category_id: int
    price: Decimal
    cash_price: Optional[Decimal] = None
    unit_of_measure: str = "piece"
    tax_rate: Decimal = Decimal("0.00")
    description: Optional[str] = None
    quantity_available: int = 0
    reserved_quantity: int = 0
    is_active: bool = True
    perishable: bool = False

class FloorCreate(BaseModel):
    name: str
    sort_order: int = 0
    is_active: bool = True

class FloorResponse(BaseModel):
    id: int
    name: str
    sort_order: int = 0
    is_active: bool

    class Config:
        from_attributes = True

class TableCreate(BaseModel):
    floor_id: int
    table_number: str
    seats: int = 2
    is_active: bool = True

class TableResponse(BaseModel):
    id: int
    floor_id: int
    table_number: str
    seats: int
    status: str
    is_active: bool

    class Config:
        from_attributes = True

class PaymentMethodResponse(BaseModel):
    id: int
    method_key: str
    label: str
    is_enabled: bool
    upi_id: Optional[str] = None

    class Config:
        from_attributes = True

class CouponCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: Decimal
    minimum_order_amount: Decimal = Decimal("0.00")
    maximum_discount_amount: Optional[Decimal] = None
    is_active: bool = True

class CouponResponse(BaseModel):
    id: int
    code: str
    discount_type: str
    discount_value: Decimal
    minimum_order_amount: Decimal = Decimal("0.00")
    maximum_discount_amount: Optional[Decimal] = None
    is_active: bool

    class Config:
        from_attributes = True

class PromotionCreate(BaseModel):
    name: str
    target_type: str
    target_id: Optional[int] = None
    discount_type: str
    discount_value: Decimal
    minimum_quantity: Optional[int] = None
    minimum_order_amount: Optional[Decimal] = None
    is_active: bool = True

class PromotionResponse(BaseModel):
    id: int
    name: str
    target_type: str
    target_id: Optional[int] = None
    discount_type: str
    discount_value: Decimal
    minimum_quantity: Optional[int] = None
    minimum_order_amount: Optional[Decimal] = None
    is_active: bool

    class Config:
        from_attributes = True

class TableSessionCreate(BaseModel):
    table_id: int
    customer_id: Optional[int] = None
    cashier_id: Optional[int] = None
    session_pin: str
    session_token: str

class TableSessionResponse(BaseModel):
    id: int
    table_id: int
    customer_id: Optional[int] = None
    cashier_id: Optional[int] = None
    session_pin: str
    session_token: str
    status: str
    opened_at: datetime

    class Config:
        from_attributes = True

class LoyaltyAccountResponse(BaseModel):
    id: int
    user_id: int
    total_points: int
    lifetime_spend: Decimal
    tier: str

    class Config:
        from_attributes = True

class SelfOrderSignup(BaseModel):
    name: str
    phone_no: str
    email: Optional[str] = None

class SessionJoin(BaseModel):
    session_pin: str

class SelfOrderItemPayload(BaseModel):
    id: int
    quantity: int = 1

class SelfOrderItemsPayload(BaseModel):
    items: List[SelfOrderItemPayload]

class CouponApplyPayload(BaseModel):
    code: str

class SelfOrderPaymentPayload(BaseModel):
    payment_method: str
    coupon_code: Optional[str] = None
    redeem_points: int = 0

# Cart & Order Schemas
class CartItem(BaseModel):
    food_item_id: int
    quantity: int

class UserCheckout(BaseModel):
    items: List[CartItem]
    payment_method: str # 'wallet', 'razorpay'
    table_id: Optional[int] = None
    session_id: Optional[int] = None

class OrderItemSchema(BaseModel):
    id: int
    food_item_id: int
    quantity: int
    price: Decimal
    name: str

class OrderResponse(BaseModel):
    id: int
    user_id: int
    cashier_id: Optional[int] = None
    table_id: Optional[int] = None
    bill_number: str
    total_amount: Decimal
    subtotal_amount: Decimal = Decimal("0.00")
    tax_amount: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")
    items: Dict[str, Any]
    payment_method: str
    payment_status: str
    order_status: str = "draft"
    kitchen_status: str = "to_cook"
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
    unit_of_measure: str = "piece"
    tax_rate: Decimal = Decimal("0.00")

class CashierCheckout(BaseModel):
    customer_roll: str # roll_no, phone_no, or email
    payment_method: str # 'cash', 'upi', 'wallet', 'partial'
    items: List[CashierBillingItem]
    amount_received: Decimal = Decimal("0.00")
    wallet_amount: Decimal = Decimal("0.00")
    online_amount: Decimal = Decimal("0.00")
    table_id: Optional[int] = None
    session_id: Optional[int] = None
    coupon_code: Optional[str] = None

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
