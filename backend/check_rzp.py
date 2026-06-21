import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent))

from app.db.session import SessionLocal
from app.db.models import VenueSetting
from app.core.config import settings
import razorpay

db = SessionLocal()
try:
    venue = db.query(VenueSetting).first()
    print("DB Key ID:", repr(venue.razorpay_key_id) if venue else "No venue")
    print("DB Key Secret:", repr(venue.razorpay_key_secret) if venue else "No venue")
    print("ENV Key ID:", repr(settings.RAZORPAY_KEY_ID))
    print("ENV Key Secret:", repr(settings.RAZORPAY_KEY_SECRET))

    key_id = venue.razorpay_key_id if venue and venue.razorpay_key_id else settings.RAZORPAY_KEY_ID
    key_secret = venue.razorpay_key_secret if venue and venue.razorpay_key_secret else settings.RAZORPAY_KEY_SECRET

    print("Resolved Key ID:", repr(key_id))
    print("Resolved Key Secret:", repr(key_secret))

    client = razorpay.Client(auth=(key_id, key_secret))
    try:
        # Check auth by fetching a dummy order or listing orders
        client.order.all({'count': 1})
        print("Razorpay Auth: SUCCESS")
    except Exception as e:
        print("Razorpay Auth: FAILED", str(e))
finally:
    db.close()
