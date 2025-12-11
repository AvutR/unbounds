FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# For DB mode, copy backend code (one level up from worker/)
COPY ../backend/models.py ./models.py
COPY ../backend/notifications.py ./notifications.py

COPY worker.py .

CMD ["python", "worker.py"]
