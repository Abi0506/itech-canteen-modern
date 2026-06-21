from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# Import new-system routes
from app.routes import auth, admin, inventory, cashier, kds, payments, loyalty, pos_session, self_order, selforder, websockets, cfd

try:
    from app.routes import reports
except ModuleNotFoundError:
    reports = None

app = FastAPI(
    title="Cafe Odoo API",
    description="FastAPI Backend for Cafe Odoo Restaurant Management System",
    version="2.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
app.include_router(pos_session.router)
app.include_router(self_order.router)
app.include_router(selforder.router)
app.include_router(websockets.router)
app.include_router(cfd.router)
if reports is not None:
    app.include_router(reports.router)




@app.on_event("startup")
async def startup_event():
    import asyncio
    from app.routes.websockets import manager
    manager.loop = asyncio.get_running_loop()


@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "app_name": "Cafe Odoo Backend",
        "version": "2.0"
    }
