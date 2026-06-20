import pymysql

HOST = "localhost"
PORT = 3306
USER = "root"
PASSWORD = "Adhianu@2886"
DB_NAME = "cafe_pos"

def init_database():
    print("Connecting to MySQL server to ensure database exists...")
    # Connect without Database name to create the database if it doesn't exist
    conn = pymysql.connect(host=HOST, port=PORT, user=USER, password=PASSWORD, autocommit=True)
    cursor = conn.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    cursor.close()
    conn.close()
    print(f"Database '{DB_NAME}' checked/created.")

    # Now import SQLAlchemy base and create tables 
    # (import happens here to ensure DB exists before engine tries to connect)
    from app.db.session import engine
    from app.db.models import Base, Role
    from sqlalchemy.orm import sessionmaker
    
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")
    
    print("Seeding roles...")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    roles = [
        (1, 'superadmin'),
        (2, 'manager'),
        (3, 'cashier'),
        (4, 'inventory_manager'),
        (5, 'chef')
    ]
    
    for role_id, role_name in roles:
        existing = db.query(Role).filter_by(id=role_id).first()
        if not existing:
            new_role = Role(id=role_id, name=role_name)
            db.add(new_role)
            print(f"Added role: {role_name}")
        else:
            if existing.name != role_name:
                existing.name = role_name
                print(f"Updated role {role_id} to {role_name}")
    
    try:
        db.commit()
        print("Roles seeded successfully.")
    except Exception as e:
        print(f"Error seeding roles: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
