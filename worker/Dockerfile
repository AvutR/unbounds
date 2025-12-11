FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py .

# At runtime, Python will find models.py in the same directory (set via PYTHONPATH or symlink)
CMD ["python", "worker.py"]

