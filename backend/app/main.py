from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# Import new-system routes
from app.routes import auth, admin, inventory, cashier, kds, payments, loyalty, reports, websockets

app = FastAPI(
    title="Cafe Odoo API",
    description="FastAPI Backend for Cafe Odoo Restaurant Management System",
    version="2.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(inventory.router)
app.include_router(cashier.router)
app.include_router(kds.router)
app.include_router(payments.router)
app.include_router(loyalty.router)
app.include_router(reports.router)
app.include_router(websockets.router)

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "app_name": "Cafe Odoo Backend",
        "version": "2.0"
    }
