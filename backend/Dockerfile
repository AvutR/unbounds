FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway will use the PORT env var automatically
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
