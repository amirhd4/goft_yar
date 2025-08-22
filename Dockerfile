# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Prevents Python from writing pyc files to disc and ensures output is sent to terminal
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Copy only the requirements file to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY ./app /app/

# The command to run the app will be taken from docker-compose.yml
# This makes the Dockerfile more reusable.