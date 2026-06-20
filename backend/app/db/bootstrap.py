from decimal import Decimal
import uuid

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine.url import make_url

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.models import (
    Category,
    Coupon,
    Customer,
    Floor,
    InventoryItem,
    PaymentMethod,
    PosSession,
    Product,
    Role,
    StockMovement,
    TableMaster,
    User,
    VenueSetting,
)
from app.db.session import Base, SessionLocal, engine

# Import models so SQLAlchemy registers every mapped table before create_all runs.
from app.db import models  # noqa: F401

LEGACY_TABLE_NAMES = {
    "departments",
    "food_items",
    "idea_upvotes",
    "ideas",
    "loyalty_accounts",
    "restaurant_floors",
    "restaurant_tables",
    "stock_audit_logs",
    "system_controls",
    "wallet_transactions",
}


def _create_database_if_needed():
    url = make_url(settings.DATABASE_URL)
    if url.get_backend_name() != "mysql" or not url.database:
        return

    server_url = url.set(database="")
    server_engine = create_engine(server_url, pool_pre_ping=True)
    quoted_db = server_engine.dialect.identifier_preparer.quote(url.database)

    with server_engine.begin() as connection:
        connection.execute(
            text(
                f"CREATE DATABASE IF NOT EXISTS {quoted_db} "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        )

    server_engine.dispose()


def bootstrap_database():
    _create_database_if_needed()
    _ensure_order_item_kitchen_status_enum()
    if _needs_schema_reset():
        _reset_database_schema()
    Base.metadata.create_all(bind=engine)
    if settings.BOOTSTRAP_SEED_DEMO_DATA:
        _seed_demo_data()


def _needs_schema_reset() -> bool:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    return bool(existing_tables & LEGACY_TABLE_NAMES)


def _reset_database_schema():
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    if not existing_tables:
        return

    quoted_tables = ", ".join(f"`{name}`" for name in existing_tables)
    with engine.begin() as connection:
        connection.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        connection.execute(text(f"DROP TABLE IF EXISTS {quoted_tables}"))
        connection.execute(text("SET FOREIGN_KEY_CHECKS=1"))


def _ensure_order_item_kitchen_status_enum():
    if engine.dialect.name != "mysql":
        return

    inspector = inspect(engine)
    if "order_items" not in inspector.get_table_names():
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE order_items MODIFY COLUMN kitchen_status "
                "ENUM('pending','claimed','done','to_cook','preparing','completed') "
                "NOT NULL DEFAULT 'to_cook'"
            )
        )
        connection.execute(
            text(
                "UPDATE order_items SET kitchen_status='to_cook' WHERE kitchen_status='pending'"
            )
        )
        connection.execute(
            text(
                "UPDATE order_items SET kitchen_status='preparing' WHERE kitchen_status='claimed'"
            )
        )
        connection.execute(
            text(
                "UPDATE order_items SET kitchen_status='completed' WHERE kitchen_status='done'"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE order_items MODIFY COLUMN kitchen_status "
                "ENUM('to_cook','preparing','completed') "
                "NOT NULL DEFAULT 'to_cook'"
            )
        )


def _upsert_role(db, role_id: int, name: str):
    role = db.query(Role).filter(Role.id == role_id).first()
    if role is None:
        db.add(Role(id=role_id, name=name))
    else:
        role.name = name


def _upsert_user(db, *, name: str, email: str, mobile_number: str, password: str, role_id: int):
    user = db.query(User).filter(User.email == email).first()
    hashed_password = get_password_hash(password)
    if user is None:
        db.add(
            User(
                name=name,
                email=email,
                mobile_number=mobile_number,
                password_hash=hashed_password,
                role_id=role_id,
                is_active=True,
            )
        )
    else:
        user.name = name
        user.mobile_number = mobile_number
        user.password_hash = hashed_password
        user.role_id = role_id
        user.is_active = True


def _seed_demo_data():
    db = SessionLocal()
    try:
        demo_password = settings.BOOTSTRAP_PASSWORD

        for role_id, role_name in [
            (1, "superadmin"),
            (2, "cashier"),
            (3, "inventory_manager"),
            (4, "chef"),
        ]:
            _upsert_role(db, role_id, role_name)

        demo_staff = [
            {
                "name": "Super Admin",
                "email": "superadmin@example.com",
                "mobile_number": "9999999999",
                "role_id": 1,
            },
            {
                "name": "Cashier One",
                "email": "cashier@example.com",
                "mobile_number": "8888888888",
                "role_id": 2,
            },
            {
                "name": "Inventory Manager",
                "email": "inventory@example.com",
                "mobile_number": "7777777777",
                "role_id": 3,
            },
            {
                "name": "Kitchen Chef",
                "email": "chef@example.com",
                "mobile_number": "6666666666",
                "role_id": 4,
            },
        ]
        for staff in demo_staff:
            _upsert_user(db, password=demo_password, **staff)

        demo_customer = db.query(Customer).filter(Customer.mobile_number == "9000000000").first()
        if demo_customer is None:
            db.add(
                Customer(
                    name="Walk-in Customer",
                    email="customer@example.com",
                    mobile_number="9000000000",
                    password_hash=None,
                    is_guest=True,
                )
            )

        category_specs = [
            ("Breakfast", "#F59E0B", 1),
            ("Snacks", "#10B981", 2),
            ("Beverages", "#3B82F6", 3),
        ]
        categories = {}
        for name, color_hex, display_order in category_specs:
            category = db.query(Category).filter(Category.name == name).first()
            if category is None:
                category = Category(
                    name=name,
                    color_hex=color_hex,
                    display_order=display_order,
                    is_active=True,
                )
                db.add(category)
                db.flush()
            else:
                category.color_hex = color_hex
                category.display_order = display_order
                category.is_active = True
            categories[name] = category

        product_specs = [
            ("Idli Plate", "Breakfast", Decimal("40.00"), "plate", Decimal("0.00"), True, 30),
            ("Samosa", "Snacks", Decimal("20.00"), "piece", Decimal("0.00"), True, 50),
            ("Tea", "Beverages", Decimal("10.00"), "cup", Decimal("0.00"), True, 100),
        ]
        products = {}
        for name, category_name, price, uom, tax_percent, kds_visible, stock in product_specs:
            product = db.query(Product).filter(Product.name == name).first()
            if product is None:
                product = Product(
                    category_id=categories[category_name].id,
                    name=name,
                    price=price,
                    uom=uom,
                    tax_percent=tax_percent,
                    description=name,
                    image_url=None,
                    kds_visible=kds_visible,
                    is_active=True,
                )
                db.add(product)
                db.flush()
            else:
                product.category_id = categories[category_name].id
                product.price = price
                product.uom = uom
                product.tax_percent = tax_percent
                product.description = name
                product.kds_visible = kds_visible
                product.is_active = True
            products[name] = product

            inv = db.query(InventoryItem).filter(InventoryItem.product_id == product.id).first()
            if inv is None:
                inv = InventoryItem(
                    product_id=product.id,
                    sku=f"{''.join(ch for ch in name if ch.isalnum())[:8].upper()}-{product.id}",
                    unit=uom,
                    current_stock=Decimal(str(stock)),
                    reorder_level=Decimal("10.00"),
                    max_stock=Decimal(str(stock)),
                    is_perishable=False,
                )
                db.add(inv)
            else:
                inv.current_stock = Decimal(str(stock))
                inv.reorder_level = Decimal("10.00")
                inv.max_stock = Decimal(str(stock))
                inv.unit = uom
                inv.is_perishable = False

        floor = db.query(Floor).filter(Floor.name == "Main Hall").first()
        if floor is None:
            floor = Floor(name="Main Hall", display_order=1)
            db.add(floor)
            db.flush()
        else:
            floor.display_order = 1

        for idx, table_number in enumerate(["T1", "T2", "T3", "T4"], start=1):
            table = db.query(TableMaster).filter(TableMaster.floor_id == floor.id, TableMaster.table_number == table_number).first()
            if table is None:
                db.add(
                    TableMaster(
                        floor_id=floor.id,
                        table_number=table_number,
                        seats=4,
                        is_active=True,
                        current_status="available",
                        current_waiter_id=None,
                        current_order_id=None,
                        qr_token=str(uuid.uuid4()),
                    )
                )
            else:
                table.seats = 4
                table.is_active = True
                table.current_status = "available"
                if not table.qr_token:
                    table.qr_token = str(uuid.uuid4())

        for payment_type, display_name, upi_id in [
            ("cash", "Cash", None),
            ("card", "Card", None),
            ("upi", "UPI", "canteen@upi"),
            ("wallet", "Wallet", None),
        ]:
            method = db.query(PaymentMethod).filter(PaymentMethod.type == payment_type).first()
            if method is None:
                db.add(
                    PaymentMethod(
                        type=payment_type,
                        is_enabled=True,
                        upi_id=upi_id,
                        display_name=display_name,
                    )
                )
            else:
                method.is_enabled = True
                method.upi_id = upi_id
                method.display_name = display_name

        venue = db.query(VenueSetting).first()
        if venue is None:
            db.add(
                VenueSetting(
                    venue_name="Cafe Odoo",
                    self_ordering_enabled=True,
                    self_ordering_mode="both",
                    self_order_lock_mode="pin",
                    session_timeout_minutes=15,
                    menu_background_color="#FFFFFF",
                    menu_background_image_url=None,
                    currency_symbol="₹",
                    tax_label="GST",
                    receipt_footer_text="Thank you for visiting Cafe Odoo",
                    kds_auto_advance=False,
                )
            )
        else:
            venue.venue_name = "Cafe Odoo"
            venue.self_ordering_enabled = True
            venue.self_ordering_mode = "both"
            venue.self_order_lock_mode = "pin"
            venue.session_timeout_minutes = 15
            venue.menu_background_color = "#FFFFFF"
            venue.currency_symbol = "₹"
            venue.tax_label = "GST"
            venue.receipt_footer_text = "Thank you for visiting Cafe Odoo"
            venue.kds_auto_advance = False

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    bootstrap_database()
    print("Database bootstrap completed successfully.")
