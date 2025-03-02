# Use an official lightweight Python image.
FROM python:3.9-slim

# Set working directory.
WORKDIR /app

# Copy requirements and install dependencies.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the application code.
COPY . .

# Expose port 8000 for the FastAPI app.
EXPOSE 8000

# Command to run the FastAPI app using uvicorn.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
