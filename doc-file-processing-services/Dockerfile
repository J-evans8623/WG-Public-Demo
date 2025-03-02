FROM python:3.9-slim

# 1. Install base dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 2. Manually download and install English language data
RUN mkdir -p /usr/share/tesseract-ocr/tessdata && \
    wget -q https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata \
    -O /usr/share/tesseract-ocr/tessdata/eng.traineddata

# 3. Set environment variables
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/tessdata

# Rest of Dockerfile remains the same
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]