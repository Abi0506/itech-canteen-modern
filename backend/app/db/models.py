from sqlalchemy import Column, Integer, String, Boolean, Decimal, DateTime, Time, Date, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.core.security import decrypt_wallet_balance, encrypt_wallet_balance

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("FoodItem", back_populates="category")


class CategoryTiming(Base):
    __tablename__ = "category_timings"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"))
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_available = Column(Boolean, default=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    roll_no = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    phone_no = Column(String(20))
    password = Column(String(255), nullable=False)
    role = Column(String(20), default="user") # 'user', 'cashier', 'admin', 'dept'
    user_type = Column(String(20), default="student") # 'student', 'faculty', 'external'
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verify_token = Column(String(64))
    wallet_balance = Column(String(255)) # Encrypted balance representation
    favourites = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    reset_code = Column(String(10))
    reset_code_expiry = Column(DateTime(timezone=True))
    group_deleted_notification = Column(Boolean, default=False)
    group_order_success_notification = Column(Boolean, default=False)
    action_otp = Column(String(10))
    action_otp_expiry = Column(DateTime(timezone=True))
    deleted_at = Column(DateTime(timezone=True))
    bulk_order_enabled = Column(Boolean, default=False)

    orders = relationship("Order", back_populates="user")
    wallet_transactions = relationship("WalletTransaction", back_populates="user", foreign_keys="[WalletTransaction.user_id]")

    def get_balance(self) -> float:
        return decrypt_wallet_balance(self.wallet_balance, self.id)

    def set_balance(self, amount: float):
        self.wallet_balance = encrypt_wallet_balance(amount, self.id)


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    dept_name = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    name = Column(String(100), nullable=False)
    description = Column(Text)
    price = Column(Decimal(10, 2), nullable=False)
    cash_price = Column(Decimal(10, 2))
    image = Column(String(255))
    quantity_available = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_stock_update = Column(DateTime(timezone=True))
    perishable = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="items")


class GroupCart(Base):
    __tablename__ = "group_carts"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    join_code = Column(String(10), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))


class GroupCartMember(Base):
    __tablename__ = "group_cart_members"

    id = Column(Integer, primary_key=True, index=True)
    group_cart_id = Column(Integer, ForeignKey("group_carts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())


class GroupCartItem(Base):
    __tablename__ = "group_cart_items"

    id = Column(Integer, primary_key=True, index=True)
    group_cart_id = Column(Integer, ForeignKey("group_carts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    food_item_id = Column(Integer, ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    bill_number = Column(String(50), unique=True, nullable=False)
    total_amount = Column(Decimal(10, 2), nullable=False)
    items = Column(JSON, default=dict) # JSON breakdown of quantities, rates, etc.
    payment_method = Column(String(20), nullable=False) # 'wallet', 'razorpay', 'partial', 'cash', 'upi'
    payment_status = Column(String(20), default="pending") # 'pending', 'completed', 'failed', 'refunded'
    is_scanned = Column(Boolean, default=False)
    razorpay_order_id = Column(String(100))
    razorpay_payment_id = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_group_order = Column(Boolean, default=False, nullable=False)
    group_cart_id = Column(Integer, ForeignKey("group_carts.id", ondelete="SET NULL"))
    wallet_amount = Column(Decimal(10, 2), default=0.00)
    online_amount = Column(Decimal(10, 2), default=0.00)

    user = relationship("User", back_populates="orders")
    items_list = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    food_item_id = Column(Integer, ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Decimal(10, 2), nullable=False)

    order = relationship("Order", back_populates="items_list")
    food_item = relationship("FoodItem")


class OrderPrintKey(Base):
    pass


class Refund(Base):
    __tablename__ = "refunds"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Decimal(10, 2), nullable=False)
    reason = Column(String(255))
    stock_restored = Column(Boolean, default=False, nullable=False)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    action = Column(String(100), nullable=False)
    table_name = Column(String(50))
    row_id = Column(Integer)
    before_state = Column(JSON)
    after_state = Column(JSON)
    meta = Column(JSON)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(20), nullable=False) # 'credit', 'debit'
    amount = Column(Decimal(10, 2), nullable=False)
    description = Column(String(255))
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"))
    performed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="wallet_transactions", foreign_keys=[user_id])


class StockAuditLog(Base):
    __tablename__ = "stock_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    actor_roll_no = Column(String(64))
    actor_role = Column(String(32))
    action = Column(String(32), nullable=False)
    food_item_id = Column(Integer, ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False)
    food_item_name = Column(String(255))
    before_quantity = Column(Integer)
    after_quantity = Column(Integer)
    change_amount = Column(Integer)
    source = Column(String(32), default="cashier_stock_update")
    ip_address = Column(String(45))
    user_agent = Column(Text)
    meta = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StockNotification(Base):
    __tablename__ = "stock_notifications"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False)
    notification_type = Column(String(50), default="stock_update")
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SystemControl(Base):
    __tablename__ = "system_controls"

    id = Column(Integer, primary_key=True, index=True)
    sales_mode = Column(String(20), default="closed", nullable=False) # 'closed', 'open', 'emergency'
    sales_open_date = Column(Date)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Wastage(Base):
    __tablename__ = "wastage"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False)
    wastage_date = Column(Date, nullable=False)
    quantity_wasted = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Idea(Base):
    __tablename__ = "ideas"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    upvotes = Column(Integer, default=0)
    status = Column(String(30), default="pending") # 'pending', 'approved', 'rejected'
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class IdeaUpvote(Base):
    __tablename__ = "idea_upvotes"

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KioskApiToken(Base):
    __tablename__ = "kiosk_api_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token_name = Column(String(100), nullable=False)
    token_hash = Column(String(255), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))


class KioskAuditLog(Base):
    __tablename__ = "kiosk_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    kiosk_id = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KioskAuthLockout(Base):
    __tablename__ = "kiosk_auth_lockouts"

    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(String(100), nullable=False)
    failed_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True))
    last_attempt_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ClosingBalance(Base):
    __tablename__ = "closing_balance"

    id = Column(Integer, primary_key=True, index=True)
    dates = Column(Date, server_default=func.current_date())
    balance = Column(Decimal(12, 2), nullable=False)
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))


class MorningBalance(Base):
    __tablename__ = "morning_balance"

    id = Column(Integer, primary_key=True, index=True)
    dates = Column(Date, server_default=func.current_date())
    balance = Column(Decimal(12, 2), nullable=False)
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))


class SpecialItem(Base):
    __tablename__ = "special_item"

    id = Column(Integer, primary_key=True, index=True)
    food_name = Column(String(100), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BulkOrderPaymentLog(Base):
    __tablename__ = "bulk_order_payment_log"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, nullable=False)
    amount = Column(Decimal(10, 2), nullable=False)
    logged_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    payment_method = Column(String(20), nullable=False)
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashierRequest(Base):
    __tablename__ = "cashier_requests"

    id = Column(Integer, primary_key=True, index=True)
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    request_type = Column(String(50), nullable=False)
    amount = Column(Decimal(10, 2))
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))


class FacultyBulkRequest(Base):
    __tablename__ = "faculty_bulk_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_name = Column(String(255), nullable=False)
    event_date = Column(Date, nullable=False)
    delivery_time = Column(Time, nullable=False)
    total_amount = Column(Decimal(10, 2), nullable=False)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))


class FacultyBulkItem(Base):
    __tablename__ = "faculty_bulk_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("faculty_bulk_requests.id", ondelete="CASCADE"), nullable=False)
    food_item_id = Column(Integer, ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Decimal(10, 2), nullable=False)
