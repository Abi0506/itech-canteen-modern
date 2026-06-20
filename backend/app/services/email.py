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


def send_receipt_email(
    *,
    to_email: str,
    customer_name: str,
    order_number: str,
    table_name: str | None,
    items: Iterable[dict],
    subtotal: Decimal | float | int,
    tax: Decimal | float | int,
    discount: Decimal | float | int,
    grand_total: Decimal | float | int,
) -> None:
    """Send a beautifully formatted digital receipt to the customer."""
    if not settings.SMTP_EMAIL or not settings.SMTP_APP_PASSWORD:
        return  # Silently skip if email not configured

    if not to_email:
        return

    message = EmailMessage()
    message["Subject"] = f"Your Receipt from Cafe Odoo (Order #{order_number})"
    message["From"] = settings.SMTP_EMAIL
    message["To"] = to_email

    items_text = "\n".join([f"- {item['quantity']}x {item['name']} @ {_money(item['price'])} = {_money(Decimal(item['quantity']) * Decimal(item['price']))}" for item in items])
    
    table_text = f"Table: {table_name}" if table_name else "Takeaway"

    # Plain-text fallback
    plain = (
        f"Hi {customer_name},\n\n"
        f"Thank you for dining with us! Here is your receipt for order {order_number}.\n\n"
        f"{table_text}\n"
        "----------------------------------------\n"
        f"{items_text}\n"
        "----------------------------------------\n"
        f"Subtotal: {_money(subtotal)}\n"
        f"Discount: -{_money(discount)}\n"
        f"Tax: {_money(tax)}\n"
        f"Total Paid: {_money(grand_total)}\n\n"
        "We hope to see you again soon!\n"
        "— Cafe Odoo"
    )
    message.set_content(plain)

    # HTML Receipt
    items_html = "".join([f"<tr><td style='padding:8px 0;border-bottom:1px solid #f3f4f6;'>{item['quantity']}x {item['name']}</td><td style='padding:8px 0;text-align:right;border-bottom:1px solid #f3f4f6;'>{_money(Decimal(str(item['quantity'])) * Decimal(str(item['price'])))}</td></tr>" for item in items])

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body{{font-family:'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:0}}
    .wrap{{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}}
    .header{{background:linear-gradient(135deg,#b44d2c,#e07b55);padding:36px 32px;text-align:center;color:#fff}}
    .header h1{{margin:0;font-size:24px;font-weight:900;letter-spacing:-.5px}}
    .header p{{margin:6px 0 0;font-size:14px;opacity:.9}}
    .body{{padding:32px}}
    .body p{{color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px}}
    .receipt-box{{background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px}}
    .receipt-table{{width:100%;border-collapse:collapse;font-size:14px;color:#374151}}
    .totals{{margin-top:16px;padding-top:16px;border-top:2px dashed #d1d5db}}
    .totals-row{{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:#4b5563}}
    .grand-total{{display:flex;justify-content:space-between;margin-top:12px;font-size:18px;font-weight:800;color:#111827}}
    .footer{{background:#f9fafb;padding:24px 32px;text-align:center;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Cafe Odoo</h1>
      <p>Thank you for your visit!</p>
    </div>
    <div class="body">
      <p>Hi <strong>{customer_name}</strong>,</p>
      <p>We hope you enjoyed your meal. Here's your receipt for order <strong>#{order_number}</strong> ({table_text}).</p>
      
      <div class="receipt-box">
        <table class="receipt-table">
          <tbody>
            {items_html}
          </tbody>
        </table>
        
        <div class="totals">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:14px; color:#4b5563;">
            <span>Subtotal</span><span>{_money(subtotal)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:14px; color:#4b5563;">
            <span>Discount</span><span style="color:#059669;">-{_money(discount)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:14px; color:#4b5563;">
            <span>Tax</span><span>{_money(tax)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:18px; font-weight:800; color:#111827; border-top:1px solid #e5e7eb; padding-top:12px;">
            <span>Total Paid</span><span>{_money(grand_total)}</span>
          </div>
        </div>
      </div>
      
      <p style="text-align:center; font-weight:600; color:#b44d2c;">We look forward to seeing you again!</p>
    </div>
    <div class="footer">
      <strong>Cafe Odoo</strong><br>
      A great place to eat and relax.<br><br>
      Automated receipt, please do not reply.
    </div>
  </div>
</body>
</html>"""
    message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(settings.SMTP_EMAIL, settings.SMTP_APP_PASSWORD)
            smtp.send_message(message)
    except Exception as e:
        print(f"Failed to send receipt email to {to_email}: {e}")
