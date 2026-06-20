import base64
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Union, Any, Optional
from app.core.config import settings

# passlib context mapping to PHP compatible bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# ── Wallet Encryption & Decryption ──────────────────────────────────────────

def encrypt_wallet_balance(amount: float, user_id: int, key: str = settings.ENCRYPTION_KEY) -> str:
    """
    Encrypts wallet balance using AES-256-CBC to match the PHP implementation.
    PHP format: base64_encode(base64_encode(ciphertext) + "::" + binary_iv)
    """
    try:
        # Prepare 32-byte key
        key_bytes = key.encode('utf-8')[:32]
        if len(key_bytes) < 32:
            key_bytes = key_bytes.ljust(32, b'\0')

        # Payload is user_id:amount formatted to 2 decimals
        payload = f"{user_id}:{amount:.2f}".encode('utf-8')

        # Add PKCS7 padding
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(payload) + padder.finalize()

        # Generate random 16-byte IV
        iv = os.urandom(16)

        # Encrypt
        cipher = Cipher(algorithms.AES(key_bytes), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(padded_data) + encryptor.finalize()

        # base64 encode ciphertext
        ciphertext_b64 = base64.b64encode(ciphertext)

        # Concatenate base64 ciphertext + "::" + binary IV
        combined = ciphertext_b64 + b"::" + iv

        # Final base64 encoding
        return base64.b64encode(combined).decode('utf-8')
    except Exception as e:
        raise RuntimeError(f"Wallet encryption failed: {e}")

def decrypt_wallet_balance(encrypted_str: str, user_id: int, key: str = settings.ENCRYPTION_KEY) -> float:
    """
    Decrypts wallet balance using AES-256-CBC, checking primary and backup keys.
    """
    if not encrypted_str or encrypted_str == "0.00" or encrypted_str == "0":
        return 0.0

    # Try primary key
    val = _decrypt_with_key(encrypted_str, key, user_id)
    if val is not None:
        return val

    # Try backup key if primary failed
    if settings.BACKUP_ENCRYPTION_KEY:
        val = _decrypt_with_key(encrypted_str, settings.BACKUP_ENCRYPTION_KEY, user_id)
        if val is not None:
            return val

    # Fallback to 0 if all failed
    return 0.0

def _decrypt_with_key(encrypted_str: str, key: str, user_id: int) -> Optional[float]:
    try:
        decoded_bytes = base64.b64decode(encrypted_str)
        if b"::" not in decoded_bytes:
            return None

        parts = decoded_bytes.split(b"::", 1)
        if len(parts) < 2:
            return None

        ciphertext_b64, iv = parts
        ciphertext = base64.b64decode(ciphertext_b64)

        key_bytes = key.encode('utf-8')[:32]
        if len(key_bytes) < 32:
            key_bytes = key_bytes.ljust(32, b'\0')

        cipher = Cipher(algorithms.AES(key_bytes), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        padded_payload = decryptor.update(ciphertext) + decryptor.finalize()

        # Unpad
        unpadder = padding.PKCS7(128).unpadder()
        payload = unpadder.update(padded_payload) + unpadder.finalize()

        payload_str = payload.decode('utf-8')
        decrypted_user_id, amount_str = payload_str.split(":", 1)

        if int(decrypted_user_id) != user_id:
            return None

        return float(amount_str)
    except Exception:
        return None
