FROM python:3.10-slim

WORKDIR /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY app/ app/
COPY static/ static/

# Create folders for uploads/static
RUN mkdir -p static uploads

# Expose port
EXPOSE 8000

# Start backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
