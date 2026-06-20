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
