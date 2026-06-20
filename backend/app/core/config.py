import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    APP_ENV: str = "development"
    DATABASE_URL: str = "mysql+pymysql://root:redwolf_8324@localhost:3306/cafe"
    BOOTSTRAP_PASSWORD: str = "redwolf_8324"
    BOOTSTRAP_SEED_DEMO_DATA: bool = True
    
    # Security Settings
    SECRET_KEY: str = "replace_with_a_super_secret_jwt_signing_key_at_least_32_characters"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440 # 24 hours
    
    # Wallet Cryptography
    ENCRYPTION_KEY: str = "replace_with_a_unique_32_character_minimum_secret"
    BACKUP_ENCRYPTION_KEY: Optional[str] = None
    
    # Payment Integration
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    
    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    
    # SMTP
    SMTP_EMAIL: Optional[str] = None
    SMTP_APP_PASSWORD: Optional[str] = None
    EMAIL_ATTACH_LOGO: int = 0
    EMAIL_LOGO_URL: str = "https://canteen.psgitech.ac.in/assets/img/logo-64.webp"
    
    # Printer Configuration
    PRINTER_CONNECTOR: Optional[str] = None
    PRINTER_NAME: Optional[str] = None
    PRINTER_DEVICE_PATH: Optional[str] = None
    PRINTER_WINDOWS_SHARE: Optional[str] = None

    class Config:
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()
