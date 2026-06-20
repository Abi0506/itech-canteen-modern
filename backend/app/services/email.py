from __future__ import annotations

import smtplib
from email.message import EmailMessage
from decimal import Decimal
from typing import Iterable

from app.core.config import settings


RELEASE_RECIPIENT_EMAIL = "abishek25052006@gmail.com"


def _money(value: Decimal | float | int | None) -> str:
    return f"Rs.{Decimal(str(value or 0)).quantize(Decimal('0.01'))}"


def send_table_release_email(
    *,
    table_number: str,
    table_id: int,
    orders: Iterable[dict],
    grand_total: Decimal | float | int,
) -> None:
    if not settings.SMTP_EMAIL or not settings.SMTP_APP_PASSWORD:
        raise RuntimeError("SMTP_EMAIL and SMTP_APP_PASSWORD must be configured to send release emails")

    message = EmailMessage()
    message["Subject"] = f"Table {table_number} released - bill summary"
    message["From"] = settings.SMTP_EMAIL
    message["To"] = RELEASE_RECIPIENT_EMAIL

    order_lines = []
    for order in orders:
        order_lines.append(
            f"- {order['order_number']} | {order['status']} | total {_money(order['total'])}"
        )

    body = "\n".join(
        [
            f"Table: {table_number} (ID: {table_id})",
            "",
            "Orders:",
            *(order_lines or ["- No orders found"]),
            "",
            f"Cumulative total: {_money(grand_total)}",
        ]
    )
    message.set_content(body)

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(settings.SMTP_EMAIL, settings.SMTP_APP_PASSWORD)
        smtp.send_message(message)


def send_password_reset_email(
    *,
    to_email: str,
    user_name: str,
    reset_link: str,
) -> None:
    """Send a one-time password-reset link to a staff member."""
    if not settings.SMTP_EMAIL or not settings.SMTP_APP_PASSWORD:
        raise RuntimeError("SMTP_EMAIL and SMTP_APP_PASSWORD must be configured to send reset emails")

    message = EmailMessage()
    message["Subject"] = "Cafe Odoo – Password Reset Request"
    message["From"] = settings.SMTP_EMAIL
    message["To"] = to_email

    # Plain-text fallback
    plain = (
        f"Hi {user_name},\n\n"
        "We received a request to reset your Cafe Odoo staff-portal password.\n\n"
        f"Reset link (valid for 1 hour, single use):\n{reset_link}\n\n"
        "If you did not request this, please ignore this email.\n\n"
        "— Cafe Odoo System"
    )
    message.set_content(plain)

    # Rich HTML alternative
    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body{{font-family:'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:0}}
    .wrap{{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}}
    .header{{background:linear-gradient(135deg,#b44d2c,#e07b55);padding:36px 32px;text-align:center;color:#fff}}
    .header h1{{margin:0;font-size:22px;font-weight:700;letter-spacing:-.5px}}
    .header p{{margin:6px 0 0;font-size:13px;opacity:.85}}
    .body{{padding:32px}}
    .body p{{color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px}}
    .btn{{display:inline-block;padding:14px 32px;background:#b44d2c;color:#fff!important;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;margin:8px 0 20px}}
    .note{{background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;color:#92400e;font-size:12px}}
    .footer{{background:#f9fafb;padding:16px 32px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #f3f4f6}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Cafe Odoo</h1>
      <p>Staff Portal · Password Reset</p>
    </div>
    <div class="body">
      <p>Hi <strong>{user_name}</strong>,</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <p style="text-align:center"><a class="btn" href="{reset_link}">Reset My Password</a></p>
      <div class="note">
        ⚠️ This link is <strong>valid for 1 hour</strong> and can only be used <strong>once</strong>.<br/>
        If you didn't request a reset, you can safely ignore this email.
      </div>
    </div>
    <div class="footer">© Cafe Odoo POS · Automated message, do not reply</div>
  </div>
</body>
</html>"""
    message.add_alternative(html, subtype="html")

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(settings.SMTP_EMAIL, settings.SMTP_APP_PASSWORD)
        smtp.send_message(message)
