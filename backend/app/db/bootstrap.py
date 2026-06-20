from decimal import Decimal

from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.models import (
    Category,
    Department,
    FoodItem,
    PaymentMethod,
    RestaurantFloor,
    RestaurantTable,
    SystemControl,
    User,
)
from app.db.session import Base, SessionLocal, engine

# Import models so SQLAlchemy registers every mapped table before create_all runs.
from app.db import models  # noqa: F401


def _create_database_if_needed():
    url = make_url(settings.DATABASE_URL)
    if url.get_backend_name() != "mysql":
        return
    if not url.database:
        return

    server_url = url.set(database=None)
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
    Base.metadata.create_all(bind=engine)
    if settings.BOOTSTRAP_SEED_DEMO_DATA:
        _seed_demo_data()


def _seed_demo_data():
    db = SessionLocal()
    try:
        # Core control row
        if db.query(SystemControl).first() is None:
            db.add(SystemControl(sales_mode="closed"))

        # Operational users
        demo_users = [
            {
                "roll_no": "superadmin",
                "display_name": "Super Admin",
                "email": "superadmin@example.com",
                "phone_no": "9999999999",
                "role": "superadmin",
                "user_type": "staff",
            },
            {
                "roll_no": "cashier01",
                "display_name": "Cashier One",
                "email": "cashier@example.com",
                "phone_no": "8888888888",
                "role": "cashier",
                "user_type": "staff",
            },
            {
                "roll_no": "inventory01",
                "display_name": "Inventory Manager",
                "email": "inventory@example.com",
                "phone_no": "7777777777",
                "role": "inventory_manager",
                "user_type": "staff",
            },
            {
                "roll_no": "WALKIN",
                "display_name": "Walk-in Guest",
                "email": "walkin@example.com",
                "phone_no": "6666666666",
                "role": "customer",
                "user_type": "customer",
            },
        ]
        for user_data in demo_users:
            existing = db.query(User).filter(User.roll_no == user_data["roll_no"]).first()
            if existing is None:
                db.add(
                    User(
                        password=get_password_hash(settings.BOOTSTRAP_PASSWORD),
                        email_verified=True,
                        bulk_order_enabled=False,
                        favourites=[],
                        loyalty_points=0,
                        **user_data,
                    )
                )
            else:
                existing.email = user_data["email"]
                existing.display_name = user_data["display_name"]
                existing.phone_no = user_data["phone_no"]
                existing.role = user_data["role"]
                existing.user_type = user_data["user_type"]
                existing.email_verified = True

        # Departments
        if db.query(Department).filter(Department.dept_name == "canteen").first() is None:
            db.add(
                Department(
                    dept_name="canteen",
                    password=get_password_hash(settings.BOOTSTRAP_PASSWORD),
                )
            )

        # Menu categories and sample items
        category_specs = [
            ("Breakfast", "#F59E0B"),
            ("Snacks", "#10B981"),
            ("Beverages", "#3B82F6"),
        ]
        categories = {}
        for name, color in category_specs:
            category = db.query(Category).filter(Category.name == name).first()
            if category is None:
                category = Category(name=name, color=color, is_active=True)
                db.add(category)
                db.flush()
            categories[name] = category

        item_specs = [
            ("Idli Plate", "Breakfast", Decimal("40.00"), Decimal("35.00"), "plate", Decimal("0.00"), 30),
            ("Samosa", "Snacks", Decimal("20.00"), Decimal("18.00"), "piece", Decimal("0.00"), 50),
            ("Tea", "Beverages", Decimal("10.00"), Decimal("10.00"), "cup", Decimal("0.00"), 100),
        ]
        for name, category_name, price, cash_price, unit, tax_rate, qty in item_specs:
            existing = db.query(FoodItem).filter(FoodItem.name == name).first()
            if existing is None:
                db.add(
                    FoodItem(
                        category_id=categories[category_name].id,
                        name=name,
                        description=name,
                        price=price,
                        cash_price=cash_price,
                        unit_of_measure=unit,
                        tax_rate=tax_rate,
                        quantity_available=qty,
                        reserved_quantity=0,
                        is_active=True,
                        perishable=False,
                    )
                )

        # Dining layout
        floor = db.query(RestaurantFloor).filter(RestaurantFloor.name == "Main Hall").first()
        if floor is None:
            floor = RestaurantFloor(name="Main Hall", sort_order=1, is_active=True)
            db.add(floor)
            db.flush()

        for table_number in ["T1", "T2", "T3", "T4"]:
            if db.query(RestaurantTable).filter(
                RestaurantTable.floor_id == floor.id,
                RestaurantTable.table_number == table_number,
            ).first() is None:
                db.add(
                    RestaurantTable(
                        floor_id=floor.id,
                        table_number=table_number,
                        seats=4,
                        status="available",
                        is_active=True,
                    )
                )

        # Payment methods used by the UI
        payment_methods = [
            ("wallet", "Wallet", None),
            ("razorpay", "Razorpay", None),
            ("cash", "Cash", None),
            ("upi", "UPI", "canteen@upi"),
        ]
        for method_key, label, upi_id in payment_methods:
            existing = db.query(PaymentMethod).filter(PaymentMethod.method_key == method_key).first()
            if existing is None:
                db.add(
                    PaymentMethod(
                        method_key=method_key,
                        label=label,
                        upi_id=upi_id,
                        sort_order=0,
                        is_enabled=True,
                    )
                )

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    bootstrap_database()
    print("Database bootstrap completed successfully.")
