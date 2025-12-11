# notifications.py
import os
import aiohttp
import asyncio

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")  # could be group/admins

async def send_telegram(text: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    async with aiohttp.ClientSession() as s:
        async with s.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": text}) as r:
            return r.status == 200

async def send_email(to_email: str, subject: str, text: str):
    if not SENDGRID_API_KEY:
        return False
    url = "https://api.sendgrid.com/v3/mail/send"
    payload = {
      "personalizations":[{"to":[{"email": to_email}], "subject": subject}],
      "from":{"email":"no-reply@command-gateway.example"},
      "content":[{"type":"text/plain","value":text}]
    }
    headers = {"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type":"application/json"}
    async with aiohttp.ClientSession() as s:
        async with s.post(url, json=payload, headers=headers) as r:
            return r.status in (200, 202)
