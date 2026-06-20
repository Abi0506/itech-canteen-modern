from app.db.bootstrap import bootstrap_database


if __name__ == "__main__":
    bootstrap_database()
    print("Database initialized and demo data seeded.")
