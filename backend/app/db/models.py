from sqlalchemy import Column, Integer, String, Boolean, Numeric, DateTime, Time, Date, ForeignKey, Text, JSON, SmallInteger as SMALLINT, SmallInteger, BigInteger, Enum, CHAR, VARCHAR, TIMESTAMP
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base

# ─── Roles ──────────────────────────────────────────────────────────────────
class Role(Base):
    __tablename__ = "roles"
    id = Column(TINYINT, primary_key=True, index=True)
    name = Column(VARCHAR(30), nullable=False)

    users = relationship("User", back_populates="role")

# ─── Users ──────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(VARCHAR(100), nullable=False)
    email = Column(VARCHAR(150), nullable=False, unique=True, index=True)
    mobile_number = Column(VARCHAR(15), nullable=False)
    password_hash = Column(VARCHAR(255), nullable=False)
    role_id = Column(TINYINT, ForeignKey("roles.id"), nullable=False)
    is_active = Column(TINYINT, nullable=False, default=1)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP, nullable=True)

    role = relationship("Role", back_populates="users")

# ─── Password Reset Tokens ───────────────────────────────────────────────────
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(VARCHAR(128), nullable=False, unique=True, index=True)
    expires_at = Column(TIMESTAMP, nullable=False)
    used_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    user = relationship("User")

# ─── Customers ───────────────────────────────────────────────────────────────
class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(VARCHAR(100), nullable=False)
    email = Column(VARCHAR(150), nullable=True)
    mobile_number = Column(VARCHAR(15), nullable=False)
    password_hash = Column(VARCHAR(255), nullable=True)
    is_guest = Column(TINYINT, nullable=False, default=1)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())

    orders = relationship("Order", back_populates="customer")

# ─── Categories ──────────────────────────────────────────────────────────────
class Category(Base):
    __tablename__ = "categories"
    id = Column(SMALLINT, primary_key=True, index=True)
    name = Column(VARCHAR(60), nullable=False)
    color_hex = Column(CHAR(7), nullable=False, default="#CCCCCC")
    display_order = Column(TINYINT, nullable=False, default=0)
    is_active = Column(TINYINT, nullable=False, default=1)

    products = relationship("Product", back_populates="category")

# ─── Products ─────────────────────────────────────────────────────────────────
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(SMALLINT, ForeignKey("categories.id"), nullable=False)
    name = Column(VARCHAR(120), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    uom = Column(VARCHAR(20), nullable=False, default="piece")
    tax_percent = Column(Numeric(5, 2), nullable=False, default=0.00)
    description = Column(Text, nullable=True)
    image_url = Column(VARCHAR(500), nullable=True)
    kds_visible = Column(TINYINT, nullable=False, default=1)
    is_active = Column(TINYINT, nullable=False, default=1)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="products")
    inventory_item = relationship("InventoryItem", back_populates="product", uselist=False)

# ─── InventoryItem ────────────────────────────────────────────────────────────
class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    sku = Column(VARCHAR(50), nullable=False)
    unit = Column(VARCHAR(20), nullable=False, default="piece")
    current_stock = Column(Numeric(10, 2), nullable=False, default=0.00)
    reorder_level = Column(Numeric(10, 2), nullable=False, default=0.00)
    max_stock = Column(Numeric(10, 2), nullable=True)
    is_perishable = Column(TINYINT, nullable=False, default=0)
    expiry_date = Column(Date, nullable=True)
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="inventory_item")

# ─── StockMovement ────────────────────────────────────────────────────────────
class StockMovement(Base):
    __tablename__ = "stock_movements"
    id = Column(BigInteger, primary_key=True, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    movement_type = Column(Enum('purchase_in', 'sale_out', 'wastage', 'adjustment', 'return_in'), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    reference_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    note = Column(VARCHAR(255), nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

# ─── Floors ───────────────────────────────────────────────────────────────────
class Floor(Base):
    __tablename__ = "floors"
    id = Column(TINYINT, primary_key=True, index=True)
    name = Column(VARCHAR(60), nullable=False)
    display_order = Column(TINYINT, nullable=False, default=0)

    tables = relationship("TableMaster", back_populates="floor")

# ─── Tables ───────────────────────────────────────────────────────────────────
class TableMaster(Base):
    __tablename__ = "tables_master"
    id = Column(SMALLINT, primary_key=True, index=True)
    floor_id = Column(TINYINT, ForeignKey("floors.id"), nullable=False)
    table_number = Column(VARCHAR(10), nullable=False)
    seats = Column(TINYINT, nullable=False, default=4)
    is_active = Column(TINYINT, nullable=False, default=1)
    current_status = Column(Enum('available', 'reserved', 'occupied'), nullable=False, default='available')
    current_waiter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    current_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    qr_token = Column(CHAR(36), nullable=False)

    floor = relationship("Floor", back_populates="tables")

# ─── Coupons ──────────────────────────────────────────────────────────────────
class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(VARCHAR(30), nullable=False)
    discount_type = Column(Enum('percent', 'fixed'), nullable=False)
    value = Column(Numeric(10, 2), nullable=False)
    max_uses = Column(Integer, nullable=True)
    used_count = Column(Integer, nullable=False, default=0)
    is_active = Column(TINYINT, nullable=False, default=1)
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

# ─── Promotions ───────────────────────────────────────────────────────────────
class Promotion(Base):
    __tablename__ = "promotions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(VARCHAR(100), nullable=False)
    scope = Column(Enum('product', 'order'), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    min_quantity = Column(Integer, nullable=True)
    min_order_amount = Column(Numeric(10, 2), nullable=True)
    discount_type = Column(Enum('percent', 'fixed'), nullable=False)
    value = Column(Numeric(10, 2), nullable=False)
    is_active = Column(TINYINT, nullable=False, default=1)
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)

# ─── Payment Methods ──────────────────────────────────────────────────────────
class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    id = Column(TINYINT, primary_key=True, index=True)
    type = Column(Enum('cash', 'card', 'upi', 'wallet'), nullable=False)
    is_enabled = Column(TINYINT, nullable=False, default=1)
    upi_id = Column(VARCHAR(100), nullable=True)
    display_name = Column(VARCHAR(50), nullable=True)

# ─── POS Sessions ─────────────────────────────────────────────────────────────
class PosSession(Base):
    __tablename__ = "pos_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum('open', 'closed'), nullable=False)
    opening_cash = Column(Numeric(10, 2), nullable=False)
    closing_cash = Column(Numeric(10, 2), nullable=True)
    notes = Column(VARCHAR(500), nullable=True)
    opened_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    closed_at = Column(TIMESTAMP, nullable=True)

# ─── Orders ───────────────────────────────────────────────────────────────────
class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(VARCHAR(20), nullable=False, unique=True)
    source = Column(Enum('pos', 'cashier', 'self_order'), nullable=False)
    table_id = Column(SMALLINT, ForeignKey("tables_master.id"), nullable=True)
    table_session_id = Column(BigInteger, ForeignKey("table_sessions.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    pos_session_id = Column(Integer, ForeignKey("pos_sessions.id"), nullable=True)
    placed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    waiter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum('draft', 'sent_to_kitchen', 'paid', 'cancelled'), nullable=False, default='draft')
    coupon_id = Column(Integer, ForeignKey("coupons.id"), nullable=True)
    subtotal = Column(Numeric(10, 2), nullable=False, default=0.00)
    tax_total = Column(Numeric(10, 2), nullable=False, default=0.00)
    discount_total = Column(Numeric(10, 2), nullable=False, default=0.00)
    total = Column(Numeric(10, 2), nullable=False, default=0.00)
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")

# ─── Order Items ─────────────────────────────────────────────────────────────
class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(BigInteger, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(8, 2), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    line_discount = Column(Numeric(10, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(10, 2), nullable=False)
    kitchen_status = Column(Enum('to_cook', 'preparing', 'completed'), nullable=False, default='to_cook')
    notes = Column(VARCHAR(255), nullable=True)
    claimed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    claimed_at = Column(TIMESTAMP, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")

# ─── Payments ─────────────────────────────────────────────────────────────────
class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    payment_method_id = Column(TINYINT, ForeignKey("payment_methods.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    amount_received = Column(Numeric(10, 2), nullable=True)
    change_due = Column(Numeric(10, 2), nullable=True)
    reference_code = Column(VARCHAR(100), nullable=True)
    status = Column(Enum('pending', 'completed', 'failed', 'refunded'), nullable=False)
    received_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

# ─── Pin Rate Limits ──────────────────────────────────────────────────────────
class PinRateLimit(Base):
    __tablename__ = "pin_rate_limits"
    id = Column(Integer, primary_key=True, index=True)
    table_session_id = Column(BigInteger, ForeignKey("table_sessions.id"), nullable=False)
    ip_address = Column(VARCHAR(45), nullable=False)
    failed_attempts = Column(TINYINT, nullable=False, default=0)
    locked_until = Column(TIMESTAMP, nullable=True)
    last_attempt_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

# ─── Table Sessions ───────────────────────────────────────────────────────────
class TableSession(Base):
    __tablename__ = "table_sessions"
    id = Column(BigInteger, primary_key=True, index=True)
    table_id = Column(SMALLINT, ForeignKey("tables_master.id"), nullable=False)
    status = Column(Enum('active', 'closed'), nullable=False)
    lock_mode = Column(Enum('locked', 'unlocked'), nullable=False)
    device_token = Column(CHAR(36), nullable=True)
    pin_code = Column(CHAR(4), nullable=True)
    opened_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    closed_at = Column(TIMESTAMP, nullable=True)
    last_activity_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

# ─── Suppliers ────────────────────────────────────────────────────────────────
class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(VARCHAR(120), nullable=False)
    contact_person = Column(VARCHAR(100), nullable=True)
    mobile_number = Column(VARCHAR(15), nullable=True)
    email = Column(VARCHAR(150), nullable=True)
    address = Column(VARCHAR(255), nullable=True)
    is_active = Column(TINYINT, nullable=False, default=1)

# ─── Purchase Orders ──────────────────────────────────────────────────────────
class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    status = Column(Enum('draft', 'ordered', 'received', 'cancelled'), nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    received_at = Column(TIMESTAMP, nullable=True)

class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    unit_cost = Column(Numeric(10, 2), nullable=False)

# ─── Loyalty ──────────────────────────────────────────────────────────────────
class LoyaltyCredit(Base):
    __tablename__ = "loyalty_credits"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    credits_earned = Column(Integer, nullable=False, default=0)
    credits_redeemed = Column(Integer, nullable=False, default=0)
    total_credits = Column(Integer, nullable=False, default=0)
    last_visit_at = Column(TIMESTAMP, nullable=True)

class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"
    id = Column(BigInteger, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    type = Column(Enum('earn', 'redeem'), nullable=False)
    amount = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

# ─── Stock Reservations ───────────────────────────────────────────────────────
class StockReservation(Base):
    __tablename__ = "stock_reservations"
    id = Column(BigInteger, primary_key=True, index=True)
    order_item_id = Column(BigInteger, ForeignKey("order_items.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum('reserved', 'finalized', 'released'), nullable=False, default='reserved')
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

# ─── Audit Logs ───────────────────────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(VARCHAR(60), nullable=False)
    entity_type = Column(VARCHAR(40), nullable=False)
    entity_id = Column(Integer, nullable=False)
    details = Column(JSON, nullable=True)
    ip_address = Column(VARCHAR(45), nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

# ─── Receipt Logs ─────────────────────────────────────────────────────────────
class ReceiptLog(Base):
    __tablename__ = "receipt_logs"
    id = Column(BigInteger, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    recipient_email = Column(VARCHAR(150), nullable=False)
    sent_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    delivery_status = Column(Enum('sent', 'failed'), nullable=False)
    error_message = Column(Text, nullable=True)

# ─── User Sessions Log ───────────────────────────────────────────────────────────
class UserSessionsLog(Base):
    __tablename__ = "user_sessions_log"
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    login_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    logout_at = Column(TIMESTAMP, nullable=True)
    ip_address = Column(VARCHAR(45), nullable=True)
    user_agent = Column(Text, nullable=True)

# ─── Venue Settings ───────────────────────────────────────────────────────────
class VenueSetting(Base):
    __tablename__ = "venue_settings"
    id = Column(TINYINT, primary_key=True, index=True)
    venue_name = Column(VARCHAR(100), nullable=False, default="Cafe Odoo")
    self_ordering_enabled = Column(TINYINT, nullable=False, default=1)
    self_ordering_mode = Column(Enum('online_ordering', 'qr_menu', 'both', 'kiosk', 'qr_table'), nullable=False, default='both')
    self_order_lock_mode = Column(Enum('device', 'pin', 'none', 'otp'), nullable=False, default='pin')
    session_timeout_minutes = Column(SmallInteger, nullable=False, default=15)
    menu_background_color = Column(CHAR(7), nullable=False, default="#FFFFFF")
    menu_background_image_url = Column(VARCHAR(500), nullable=True)
    currency_symbol = Column(VARCHAR(5), nullable=False, default="₹")
    tax_label = Column(VARCHAR(20), nullable=False, default="GST")
    receipt_footer_text = Column(VARCHAR(255), nullable=True)
    kds_auto_advance = Column(TINYINT, nullable=False, default=0)
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())
