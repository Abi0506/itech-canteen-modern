import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from app.db.session import SessionLocal
from app.db.models import VenueSetting

db = SessionLocal()
try:
    venue = db.query(VenueSetting).first()
    if venue:
        venue.razorpay_key_id = None
        venue.razorpay_key_secret = None
        db.commit()
        print("Cleared invalid razorpay credentials from venue_settings.")
except Exception as e:
    print("Error:", e)
finally:
    db.close()
