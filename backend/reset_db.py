from app.db.session import engine, Base
from app.db.bootstrap import bootstrap_database
from sqlalchemy import text, inspect

def reset_database():
    print("Resetting database...")
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    if existing_tables:
        quoted_tables = ", ".join(f"`{name}`" for name in existing_tables)
        print(f"Dropping tables: {quoted_tables}")
        with engine.begin() as connection:
            connection.execute(text("SET FOREIGN_KEY_CHECKS=0"))
            connection.execute(text(f"DROP TABLE IF EXISTS {quoted_tables}"))
            connection.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    
    # Run bootstrap to recreate and seed
    bootstrap_database()
    print("Database reset and seeded successfully!")

if __name__ == "__main__":
    reset_database()
