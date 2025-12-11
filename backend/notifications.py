# notifications.py
import os
import aiohttp
import asyncio

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")

async def send_email(to_email: str, subject: str, text: str):
    """Send email via SendGrid."""
    if not SENDGRID_API_KEY:
        print(f"WARNING: SENDGRID_API_KEY not set. Email not sent to {to_email}")
        return False
    
    url = "https://api.sendgrid.com/v3/mail/send"
    payload = {
      "personalizations": [{"to": [{"email": to_email}], "subject": subject}],
      "from": {"email": "no-reply@command-gateway.example"},
      "content": [{"type": "text/plain", "value": text}]
    }
    headers = {"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"}
    
    try:
        async with aiohttp.ClientSession() as s:
            async with s.post(url, json=payload, headers=headers) as r:
                return r.status in (200, 202)
    except Exception as e:
        print(f"ERROR sending email: {e}")
        return False
