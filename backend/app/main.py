from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import auth, users, cashier, admin, websockets, kds, display, self_order
from app.db.bootstrap import bootstrap_database

app = FastAPI(
    title="iTech Canteen Portal API",
    description="FastAPI Backend for iTech Canteen System",
    version="2.0"
)

# CORS configuration
origins = [
    "http://localhost:5173", # Vite React default
    "http://127.0.0.1:5173",
    "http://localhost:3000", # Alternative dev port
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(cashier.router)
app.include_router(admin.router)
app.include_router(kds.router)
app.include_router(display.router)
app.include_router(self_order.router)
app.include_router(websockets.router)


@app.on_event("startup")
def startup_database():
    bootstrap_database()


@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "app_name": "iTech Canteen Modern Portal Backend",
        "version": "2.0"
    }
