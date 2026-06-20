from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.security import decrypt_wallet_balance, encrypt_wallet_balance
from app.db.session import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    color = Column(String(20), nullable=False, default="#F59E0B")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("FoodItem", back_populates="category")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    dept_name = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    roll_no = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100))
    email = Column(String(100), unique=True, nullable=False)
    phone_no = Column(String(20))
    password = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    user_type = Column(String(20), default="student")
    email_verified = Column(Boolean, default=False, nullable=False)
    wallet_balance = Column(String(255))
    favourites = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True))
    bulk_order_enabled = Column(Boolean, default=False, nullable=False)
    loyalty_points = Column(Integer, default=0, nullable=False)

    orders = relationship("Order", back_populates="user", foreign_keys="Order.user_id")
    wallet_transactions = relationship(
        "WalletTransaction",
        back_populates="user",
        foreign_keys="WalletTransaction.user_id",
    )

    def get_balance(self) -> float:
        return decrypt_wallet_balance(self.wallet_balance, self.id)

    def set_balance(self, amount: float):
        self.wallet_balance = encrypt_wallet_balance(amount, self.id)


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    name = Column(String(100), nullable=False)
    description = Column(Text)
    price = Column(Numeric(10, 2), nullable=False)
    cash_price = Column(Numeric(10, 2))
    unit_of_measure = Column(String(30), default="piece")
    tax_rate = Column(Numeric(5, 2), default=0.00)
    image = Column(String(255))
    quantity_available = Column(Integer, default=0, nullable=False)
    reserved_quantity = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_stock_update = Column(DateTime(timezone=True))
    last_reserved_at = Column(DateTime(timezone=True))
    perishable = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="items")


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


class SystemControl(Base):
    __tablename__ = "system_controls"

    id = Column(Integer, primary_key=True, index=True)
    sales_mode = Column(String(20), default="closed", nullable=False)
    sales_open_date = Column(Date)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Idea(Base):
    __tablename__ = "ideas"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    upvotes = Column(Integer, default=0, nullable=False)
    status = Column(String(30), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class IdeaUpvote(Base):
    __tablename__ = "idea_upvotes"
    __table_args__ = (UniqueConstraint("idea_id", "user_id", name="uq_idea_upvotes_idea_user"),)

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RestaurantFloor(Base):
    __tablename__ = "restaurant_floors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tables = relationship("RestaurantTable", back_populates="floor")


class RestaurantTable(Base):
    __tablename__ = "restaurant_tables"

    id = Column(Integer, primary_key=True, index=True)
    floor_id = Column(Integer, ForeignKey("restaurant_floors.id", ondelete="CASCADE"), nullable=False)
    table_number = Column(String(20), nullable=False)
    seats = Column(Integer, default=2, nullable=False)
    status = Column(String(20), default="available", nullable=False)
    active_cashier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    active_order_id = Column(Integer)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    floor = relationship("RestaurantFloor", back_populates="tables")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    method_key = Column(String(30), unique=True, nullable=False)
    label = Column(String(50), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    upi_id = Column(String(100))
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    discount_type = Column(String(20), nullable=False)
    discount_value = Column(Numeric(10, 2), nullable=False)
    minimum_order_amount = Column(Numeric(10, 2), default=0.00)
    maximum_discount_amount = Column(Numeric(10, 2))
    is_active = Column(Boolean, default=True, nullable=False)
    starts_at = Column(DateTime(timezone=True))
    ends_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    target_type = Column(String(20), nullable=False)
    target_id = Column(Integer)
    discount_type = Column(String(20), nullable=False)
    discount_value = Column(Numeric(10, 2), nullable=False)
    minimum_quantity = Column(Integer)
    minimum_order_amount = Column(Numeric(10, 2))
    is_active = Column(Boolean, default=True, nullable=False)
    starts_at = Column(DateTime(timezone=True))
    ends_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TableSession(Base):
    __tablename__ = "table_sessions"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    session_pin = Column(String(4), nullable=False)
    session_token = Column(String(64), unique=True, nullable=False)
    status = Column(String(20), default="active", nullable=False)
    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    closed_at = Column(DateTime(timezone=True))


class LoyaltyAccount(Base):
    __tablename__ = "loyalty_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_points = Column(Integer, default=0, nullable=False)
    lifetime_spend = Column(Numeric(12, 2), default=0.00)
    tier = Column(String(30), default="standard")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    floor_id = Column(Integer, ForeignKey("restaurant_floors.id", ondelete="SET NULL"))
    table_id = Column(Integer, ForeignKey("restaurant_tables.id", ondelete="SET NULL"))
    session_id = Column(Integer, ForeignKey("table_sessions.id", ondelete="SET NULL"))
    bill_number = Column(String(50), unique=True, nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    subtotal_amount = Column(Numeric(10, 2), default=0.00)
    tax_amount = Column(Numeric(10, 2), default=0.00)
    discount_amount = Column(Numeric(10, 2), default=0.00)
    items = Column(JSON, default=dict)
    payment_method = Column(String(20), nullable=False)
    payment_status = Column(String(20), default="pending")
    order_status = Column(String(20), default="draft")
    kitchen_status = Column(String(20), default="to_cook")
    is_scanned = Column(Boolean, default=False)
    razorpay_order_id = Column(String(100))
    razorpay_payment_id = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    wallet_amount = Column(Numeric(10, 2), default=0.00)
    online_amount = Column(Numeric(10, 2), default=0.00)
    coupon_code = Column(String(50))
    loyalty_points_earned = Column(Integer, default=0, nullable=False)
    closed_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="orders", foreign_keys=[user_id])
    items_list = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    food_item_id = Column(Integer, ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), default="pending")
    kitchen_status = Column(String(20), default="to_cook")
    assigned_chef_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    sent_to_kitchen_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    order = relationship("Order", back_populates="items_list")
    food_item = relationship("FoodItem")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(20), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(String(255))
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"))
    performed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="wallet_transactions", foreign_keys=[user_id])
