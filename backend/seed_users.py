import pymysql
import bcrypt

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Database credentials
HOST     = "localhost"
PORT     = 3306
USER     = "root"
PASSWORD = "Adhianu@2886"
DB_NAME  = "cafe_pos"

users_to_seed = [
    {
        "name": "Super Admin",
        "email": "admin@cafeodoo.com",
        "mobile_number": "1234567890",
        "password": "adminpassword",
        "role_id": 1
    },
    {
        "name": "Cashier User",
        "email": "cashier@cafeodoo.com",
        "mobile_number": "1234567891",
        "password": "cashierpassword",
        "role_id": 3
    },
    {
        "name": "Inventory Manager",
        "email": "inventory@cafeodoo.com",
        "mobile_number": "1234567892",
        "password": "inventorypassword",
        "role_id": 4
    },
    {
        "name": "Kitchen Chef",
        "email": "chef@cafeodoo.com",
        "mobile_number": "1234567893",
        "password": "chefpassword",
        "role_id": 5
    }
]

print("Connecting to DB...")
conn = pymysql.connect(
    host=HOST, port=PORT, user=USER, password=PASSWORD,
    database=DB_NAME, autocommit=True, charset="utf8mb4"
)
cursor = conn.cursor()

for u in users_to_seed:
    hashed = get_password_hash(u["password"])
    try:
        cursor.execute(
            "INSERT INTO users (name, email, mobile_number, password_hash, role_id, is_active) VALUES (%s, %s, %s, %s, %s, 1)",
            (u["name"], u["email"], u["mobile_number"], hashed, u["role_id"])
        )
        print(f"Seeded user: {u['email']}")
    except Exception as e:
        print(f"Failed to seed user {u['email']}: {e}")

cursor.close()
conn.close()
print("Done seeding users!")
