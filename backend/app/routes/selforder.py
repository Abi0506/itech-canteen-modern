from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime, date
import uuid
import random
from typing import List, Optional, Dict, Any

from app.db.session import get_db
from app.db.models import TableMaster, TableSession, Customer, Product, Category, Order, OrderItem, VenueSetting, Coupon
from app.models.schemas import OrderResponse, CustomerSignup
from app.routes.websockets import manager

router = APIRouter(prefix="/selforder", tags=["selforder"])

def get_active_session(qr_token: str, db: Session, x_device_token: Optional[str] = Header(None)):
    table = db.query(TableMaster).filter(TableMaster.qr_token == qr_token).first()
    if not table:
        raise HTTPException(status_code=404, detail="Invalid QR code")
        
    session = db.query(TableSession).filter(TableSession.table_id == table.id, TableSession.status == 'active').first()
    if not session:
        raise HTTPException(status_code=400, detail="No active session on this table. Please check in with cashier.")
        
    if session.lock_mode == 'device' and session.device_token != x_device_token:
        raise HTTPException(status_code=401, detail="Unauthorized device for this session")
        
    return session, table

@router.get("/{qr_token}")
def resolve_qr_token(qr_token: str, db: Session = Depends(get_db)):
    table = db.query(TableMaster).filter(TableMaster.qr_token == qr_token).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
        
    venue = db.query(VenueSetting).first()
    
    # Check if there is an active session
    session = db.query(TableSession).filter(TableSession.table_id == table.id, TableSession.status == 'active').first()
    
    return {
        "table_id": table.id,
        "table_number": table.table_number,
        "seats": table.seats,
        "self_ordering_enabled": venue.self_ordering_enabled if venue else True,
        "self_ordering_mode": venue.self_ordering_mode if venue else "online_ordering",
        "has_active_session": session is not None,
        "lock_mode": session.lock_mode if session else (venue.self_order_lock_mode if venue else "device")
    }

@router.post("/{qr_token}/signup")
def customer_self_signup(qr_token: str, cust_in: CustomerSignup, db: Session = Depends(get_db)):
    table = db.query(TableMaster).filter(TableMaster.qr_token == qr_token).first()
    if not table:
        raise HTTPException(status_code=404, detail="Invalid QR code")
        
    # Create customer if doesn't exist
    customer = db.query(Customer).filter(Customer.mobile_number == cust_in.mobile_number).first()
    if not customer:
        customer = Customer(
            name=cust_in.name,
            mobile_number=cust_in.mobile_number,
            email=cust_in.email,
            is_guest=False
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        
    # Check if active session exists
    session = db.query(TableSession).filter(TableSession.table_id == table.id, TableSession.status == 'active').first()
    if not session:
        # Create a new session
        device_token = str(uuid.uuid4())
        pin = f"{random.randint(1000, 9999)}"
        venue = db.query(VenueSetting).first()
        lock_mode = venue.self_order_lock_mode if venue else "device"
        
        session = TableSession(
            table_id=table.id,
            status='active',
            lock_mode=lock_mode,
            device_token=device_token,
            pin_code=pin,
            opened_at=datetime.utcnow()
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
        # Update table status
        table.current_status = 'occupied'
        table.current_order_id = None
        db.commit()
        
    return {
        "success": True,
        "device_token": session.device_token,
        "pin_code": session.pin_code,
        "customer_id": customer.id
    }

@router.post("/{qr_token}/join")
def join_table_session(qr_token: str, payload: Dict[str, str], db: Session = Depends(get_db)):
    table = db.query(TableMaster).filter(TableMaster.qr_token == qr_token).first()
    if not table:
        raise HTTPException(status_code=404, detail="Invalid QR code")
        
    session = db.query(TableSession).filter(TableSession.table_id == table.id, TableSession.status == 'active').first()
    if not session:
        raise HTTPException(status_code=400, detail="No active session to join")
        
    input_pin = payload.get("pin")
    if session.pin_code != input_pin:
        raise HTTPException(status_code=400, detail="Invalid PIN code")
        
    return {
        "success": True,
        "device_token": session.device_token
    }

@router.get("/{qr_token}/menu")
def get_read_only_menu(qr_token: str, db: Session = Depends(get_db)):
    # Check if table exists
    table = db.query(TableMaster).filter(TableMaster.qr_token == qr_token).first()
    if not table:
        raise HTTPException(status_code=404, detail="Invalid QR code")
        
    categories = db.query(Category).filter(Category.is_active == True).order_by(Category.display_order).all()
    result = []
    for c in categories:
        products = db.query(Product).filter(Product.category_id == c.id, Product.is_active == True).all()
        if products:
            result.append({
                "category_id": c.id,
                "category_name": c.name,
                "color_hex": c.color_hex,
                "products": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "price": float(p.price),
                        "description": p.description,
                        "image_url": p.image_url,
                        "uom": p.uom
                    }
                    for p in products
                ]
            })
    return result

@router.post("/{qr_token}/order", response_model=OrderResponse)
async def create_self_order(qr_token: str, payload: Dict[str, Any], db: Session = Depends(get_db), x_device_token: Optional[str] = Header(None)):
    venue = db.query(VenueSetting).first()
    if venue and not venue.self_ordering_enabled:
        raise HTTPException(status_code=400, detail="Self-ordering is currently disabled by venue")
        
    if venue and venue.self_ordering_mode == 'qr_menu':
        raise HTTPException(status_code=400, detail="Ordering is not allowed in QR Menu mode")

    # Resolve session
    session, table = get_active_session(qr_token, db, x_device_token)
    
    # Build order number
    date_str = datetime.utcnow().strftime("%y%m%d")
    today_start = datetime.combine(date.today(), datetime.min.time())
    count = db.query(Order).filter(Order.created_at >= today_start).count()
    order_num = f"S{date_str}{count + 1:04d}"
    
    # Calculate totals
    subtotal = Decimal("0.00")
    items_in = payload.get("items", [])
    
    for item in items_in:
        prod = db.query(Product).filter(Product.id == item["product_id"]).first()
        if not prod or not prod.is_active:
            raise HTTPException(status_code=400, detail="Product not available")
        subtotal += prod.price * Decimal(str(item["quantity"]))
        
    tax_total = subtotal * Decimal("0.05")
    total = subtotal + tax_total
    
    customer_id = payload.get("customer_id")
    
    new_order = Order(
        order_number=order_num,
        source="self_order",
        table_id=table.id,
        table_session_id=session.id,
        customer_id=customer_id,
        status="draft",
        subtotal=subtotal,
        tax_total=tax_total,
        discount_total=Decimal("0.00"),
        total=total,
        notes=payload.get("notes")
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    # Add items
    for item in items_in:
        prod = db.query(Product).filter(Product.id == item["product_id"]).first()
        line_total = prod.price * Decimal(str(item["quantity"]))
        order_item = OrderItem(
            order_id=new_order.id,
            product_id=item["product_id"],
            quantity=Decimal(str(item["quantity"])),
            unit_price=prod.price,
            line_total=line_total,
            kitchen_status="to_cook",
            notes=item.get("notes")
        )
        db.add(order_item)
        
    db.commit()
    
    # Update table active order
    table.current_order_id = new_order.id
    db.commit()
    db.refresh(new_order)
    
    # Broadcast updates
    await manager.broadcast_all({
        "event": "cart_updated",
        "table_id": table.id,
        "order_id": new_order.id,
        "items": [{"name": i.product.name, "quantity": float(i.quantity), "price": float(i.unit_price)} for i in new_order.items],
        "subtotal": float(new_order.subtotal),
        "tax_total": float(new_order.tax_total),
        "total": float(new_order.total)
    })
    
    return new_order
