from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, date, time

# Token & Session Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    email: str

class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    mobile_number: str
    password: str
    role_id: int

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    mobile_number: str
    role_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerSignup(BaseModel):
    name: str
    mobile_number: str
    email: Optional[EmailStr] = None

class CustomerResponse(BaseModel):
    id: int
    name: str
    email: Optional[EmailStr] = None
    mobile_number: str
    is_guest: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Category & Product Schemas
class CategoryCreate(BaseModel):
    name: str
    color_hex: str = "#CCCCCC"
    display_order: int = 0

class CategoryResponse(BaseModel):
    id: int
    name: str
    color_hex: str
    display_order: int
    is_active: bool

    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    category_id: int
    name: str
    price: Decimal
    uom: str = "piece"
    tax_percent: Decimal = Decimal("0.00")
    description: Optional[str] = None
    image_url: Optional[str] = None
    kds_visible: bool = True

class ProductResponse(BaseModel):
    id: int
    category_id: int
    name: str
    price: Decimal
    uom: str
    tax_percent: Decimal
    description: Optional[str] = None
    image_url: Optional[str] = None
    kds_visible: bool
    is_active: bool

    class Config:
        from_attributes = True

# Inventory Schemas
class InventoryItemResponse(BaseModel):
    id: int
    product_id: int
    sku: str
    unit: str
    current_stock: Decimal
    reorder_level: Decimal
    max_stock: Optional[Decimal] = None
    is_perishable: bool
    expiry_date: Optional[date] = None

    class Config:
        from_attributes = True

class StockAdjustment(BaseModel):
    quantity: Decimal
    note: Optional[str] = None

# Order & Cart Schemas
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: Decimal
    notes: Optional[str] = None

class OrderCreate(BaseModel):
    source: str  # 'pos', 'cashier', 'self_order'
    table_id: Optional[int] = None
    customer_id: Optional[int] = None
    coupon_id: Optional[int] = None
    items: List[OrderItemCreate]
    notes: Optional[str] = None

class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    line_discount: Decimal
    line_total: Decimal
    kitchen_status: str
    notes: Optional[str] = None
    claimed_by: Optional[int] = None
    claimed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    product_name: Optional[str] = None # Added for convenience

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    order_number: str
    source: str
    table_id: Optional[int] = None
    table_session_id: Optional[int] = None
    customer_id: Optional[int] = None
    pos_session_id: Optional[int] = None
    placed_by_user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    status: str
    coupon_id: Optional[int] = None
    subtotal: Decimal
    tax_total: Decimal
    discount_total: Decimal
    total: Decimal
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True

# Payment Schemas
class PaymentCreate(BaseModel):
    payment_method_id: int
    amount_received: Optional[Decimal] = None
    reference_code: Optional[str] = None

class PaymentResponse(BaseModel):
    id: int
    order_id: int
    payment_method_id: int
    amount: Decimal
    amount_received: Optional[Decimal] = None
    change_due: Optional[Decimal] = None
    reference_code: Optional[str] = None
    status: str
    received_by: int
    created_at: datetime

    class Config:
        from_attributes = True

class PaymentMethodResponse(BaseModel):
    id: int
    type: str
    is_enabled: bool
    upi_id: Optional[str] = None
    display_name: Optional[str] = None

    class Config:
        from_attributes = True

class PaymentMethodUpdate(BaseModel):
    is_enabled: bool
    upi_id: Optional[str] = None
    display_name: Optional[str] = None

# Coupon & Promotion Schemas
class CouponCreate(BaseModel):
    code: str
    discount_type: str # 'percent', 'fixed'
    value: float
    max_uses: Optional[int] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None

class CouponResponse(BaseModel):
    id: int
    code: str
    discount_type: str
    value: Decimal
    max_uses: Optional[int] = None
    used_count: int
    is_active: bool
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None

    class Config:
        from_attributes = True

class PromotionCreate(BaseModel):
    name: str
    scope: str # 'product', 'order'
    product_id: Optional[int] = None
    min_quantity: Optional[int] = None
    min_order_amount: Optional[Decimal] = None
    discount_type: str # 'percent', 'fixed'
    value: Decimal
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None

class PromotionResponse(BaseModel):
    id: int
    name: str
    scope: str
    product_id: Optional[int] = None
    min_quantity: Optional[int] = None
    min_order_amount: Optional[Decimal] = None
    discount_type: str
    value: Decimal
    is_active: bool
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None

    class Config:
        from_attributes = True

# Venue Setting Schemas
class VenueSettingResponse(BaseModel):
    id: int
    venue_name: str
    self_ordering_enabled: bool
    self_ordering_mode: str
    self_order_lock_mode: str
    session_timeout_minutes: int
    menu_background_color: str
    menu_background_image_url: Optional[str] = None
    currency_symbol: str
    tax_label: str
    receipt_footer_text: Optional[str] = None
    kds_auto_advance: bool

    class Config:
        from_attributes = True

class VenueSettingUpdate(BaseModel):
    venue_name: Optional[str] = None
    self_ordering_enabled: Optional[bool] = None
    self_ordering_mode: Optional[str] = None
    self_order_lock_mode: Optional[str] = None
    session_timeout_minutes: Optional[int] = None
    menu_background_color: Optional[str] = None
    menu_background_image_url: Optional[str] = None
    currency_symbol: Optional[str] = None
    tax_label: Optional[str] = None
    receipt_footer_text: Optional[str] = None
    kds_auto_advance: Optional[bool] = None

# Floor & Table Schemas
class FloorCreate(BaseModel):
    name: str

class TableCreate(BaseModel):
    floor_id: int
    table_number: str
    seats: int = 4

class TableResponse(BaseModel):
    id: int
    floor_id: int
    table_number: str
    seats: int
    is_active: bool
    qr_token: str
    current_status: str
    current_waiter_id: Optional[int] = None
    current_order_id: Optional[int] = None

    class Config:
        from_attributes = True

class FloorResponse(BaseModel):
    id: int
    name: str
    display_order: int
    tables: List[TableResponse] = []

    class Config:
        from_attributes = True

# KDS Ticket Schema
class KDSTicketItem(BaseModel):
    id: int
    product_name: str
    quantity: Decimal
    kitchen_status: str
    notes: Optional[str] = None
    claimed_by_name: Optional[str] = None
    claimed_at: Optional[datetime] = None

class KDSTicket(BaseModel):
    order_id: int
    order_number: str
    table_number: Optional[str] = None
    source: str
    created_at: datetime
    items: List[KDSTicketItem]
