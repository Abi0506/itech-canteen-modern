from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from decimal import Decimal
from typing import List, Optional, Dict, Any

from app.db.session import get_db
from app.db.models import Product, Category, InventoryItem, StockMovement, User
from app.models.schemas import ProductCreate, ProductResponse, CategoryCreate, CategoryResponse, InventoryItemResponse, StockAdjustment
from app.routes.auth import require_role

router = APIRouter(prefix="/inventory", tags=["inventory"])

inventory_dependency = Depends(require_role(["superadmin", "inventory_manager"]))
catalog_dependency = Depends(require_role(["superadmin", "inventory_manager", "cashier"]))


def _attach_stock(product: Product, db: Session) -> dict:
    """Return product fields + current_stock from inventory_items."""
    inv = db.query(InventoryItem).filter(InventoryItem.product_id == product.id).first()
    return {
        "id": product.id,
        "category_id": product.category_id,
        "name": product.name,
        "price": product.price,
        "uom": product.uom,
        "tax_percent": product.tax_percent,
        "description": product.description,
        "image_url": product.image_url,
        "kds_visible": bool(product.kds_visible),
        "is_active": bool(product.is_active),
        "current_stock": float(inv.current_stock) if inv else 0.0,
    }


@router.get("/products", dependencies=[catalog_dependency])
def list_products(
    include_inactive: bool = Query(False),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Product)
    if not include_inactive:
        query = query.filter(Product.is_active == True)
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
    products = query.order_by(Product.name).all()
    return [_attach_stock(p, db) for p in products]


@router.post("/products", dependencies=[inventory_dependency])
def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == product_in.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="Invalid Category ID")

    new_prod = Product(
        category_id=product_in.category_id,
        name=product_in.name,
        price=product_in.price,
        uom=product_in.uom,
        tax_percent=product_in.tax_percent,
        description=product_in.description,
        image_url=product_in.image_url,
        kds_visible=product_in.kds_visible,
        is_active=True,
    )
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)

    # Proactively create inventory item
    sku_name = "".join(x for x in product_in.name if x.isalnum())[:10].upper()
    sku = f"{sku_name}-{new_prod.id}"
    new_inv = InventoryItem(
        product_id=new_prod.id,
        sku=sku,
        unit=product_in.uom,
        current_stock=Decimal("0.00"),
        reorder_level=Decimal("10.00"),
        is_perishable=False,
    )
    db.add(new_inv)
    db.commit()

    return _attach_stock(new_prod, db)


@router.put("/products/{prod_id}", dependencies=[inventory_dependency])
def update_product(prod_id: int, product_in: ProductCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == prod_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    category = db.query(Category).filter(Category.id == product_in.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="Invalid Category ID")

    product.category_id = product_in.category_id
    product.name = product_in.name
    product.price = product_in.price
    product.uom = product_in.uom
    product.tax_percent = product_in.tax_percent
    product.description = product_in.description
    product.image_url = product_in.image_url
    product.kds_visible = product_in.kds_visible

    db.commit()
    db.refresh(product)
    return _attach_stock(product, db)


@router.patch("/products/{prod_id}/status", dependencies=[inventory_dependency])
def toggle_product_status(prod_id: int, db: Session = Depends(get_db)):
    """Toggle a product's active/inactive status."""
    product = db.query(Product).filter(Product.id == prod_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = not product.is_active
    db.commit()
    db.refresh(product)
    return _attach_stock(product, db)


@router.delete("/products/{prod_id}", dependencies=[inventory_dependency])
def delete_product(prod_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == prod_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()
    return {"success": True, "message": "Product deactivated successfully"}


@router.get("/categories", dependencies=[catalog_dependency])
def list_categories(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
):
    query = db.query(Category)
    if not include_inactive:
        query = query.filter(Category.is_active == True)
    return query.order_by(Category.display_order, Category.name).all()


@router.post("/categories", response_model=CategoryResponse, dependencies=[inventory_dependency])
def create_category(cat_in: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == cat_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    new_cat = Category(
        name=cat_in.name,
        color_hex=cat_in.color_hex,
        display_order=cat_in.display_order,
        is_active=True,
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat


@router.put("/categories/{cat_id}", response_model=CategoryResponse, dependencies=[inventory_dependency])
def update_category(cat_id: int, cat_in: CategoryCreate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    cat.name = cat_in.name
    cat.color_hex = cat_in.color_hex
    cat.display_order = cat_in.display_order
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/categories/{cat_id}/status", response_model=CategoryResponse, dependencies=[inventory_dependency])
def toggle_category_status(cat_id: int, db: Session = Depends(get_db)):
    """Toggle a category's active/inactive status."""
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_active = not cat.is_active
    db.commit()
    db.refresh(cat)
    return cat


@router.get("/stock", response_model=List[InventoryItemResponse], dependencies=[inventory_dependency])
def get_stock_levels(db: Session = Depends(get_db)):
    return db.query(InventoryItem).all()


@router.put("/stock/{prod_id}", response_model=InventoryItemResponse)
def adjust_stock(
    prod_id: int,
    adj: StockAdjustment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["superadmin", "inventory_manager"])),
):
    inv_item = db.query(InventoryItem).filter(InventoryItem.product_id == prod_id).first()
    if not inv_item:
        raise HTTPException(status_code=404, detail="Inventory item for product not found")

    inv_item.current_stock += adj.quantity
    db.commit()

    mvt = StockMovement(
        inventory_item_id=inv_item.id,
        movement_type="adjustment",
        quantity=abs(adj.quantity),
        performed_by=current_user.id,
        note=adj.note or "Manual Stock Adjustment",
    )
    db.add(mvt)
    db.commit()
    db.refresh(inv_item)
    return inv_item
