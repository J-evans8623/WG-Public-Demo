#!/usr/bin/env python3
"""
File: celery_app.py
Description:
    Configuration for the Celery worker using Redis as the message broker.
    
    WARNING:
    -----------
    For production deployments, do NOT hardcode sensitive environment variables 
    (such as Redis credentials) directly in the Docker image or in the code. Instead, 
    inject these variables at runtime via secure methods (e.g., Cloud Run environment variables, 
    Kubernetes secrets, or a secure secret management service). This file is acceptable for 
    development only.
    
Usage:
    This module is imported by other parts of the application (e.g., ocr_tasks.py) to initialize 
    the Celery worker.
"""#!/usr/bin/env python3
"""
File: celery_app.py
Description:
    Configuration for the Celery worker using Redis as the message broker.
    ...
"""
#!/usr/bin/env python3
"""
File: celery_app.py
Description:
    Configuration for the Celery worker using Redis as the message broker.
    
    WARNING:
    -----------
    For production deployments, do NOT hardcode sensitive environment variables 
    (such as Redis credentials) directly in the Docker image or in the code. Instead, 
    inject these variables at runtime via secure methods (e.g., Cloud Run environment variables, 
    Kubernetes secrets, or a secure secret management service). This file is acceptable for 
    development only.
    
Usage:
    This module is imported by other parts of the application (e.g., ocr_tasks.py) to initialize 
    the Celery worker.
"""

from dotenv import load_dotenv
from pathlib import Path
import os
import urllib.parse

# Print debugging info.
print("Current working directory:", os.getcwd())
print("__file__:", __file__)

# Adjust the path to load .env from the current directory.
env_path = Path(__file__).resolve().parent / '.env'
print('env path printed :')
print(env_path)
load_dotenv(dotenv_path=env_path)

from celery import Celery

# Retrieve Redis configuration from environment variables.
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = os.environ.get("REDIS_PORT", "6379")
REDIS_USERNAME = os.environ.get("REDIS_USERNAME", "")
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
print('Redis Port:', REDIS_PORT)

# Build the Redis connection URL.
encoded_password = urllib.parse.quote_plus(REDIS_PASSWORD)
redis_url = f"redis://{REDIS_USERNAME}:{encoded_password}@{REDIS_HOST}:{REDIS_PORT}/0"

# Create the Celery application with explicit task registration
celery_app = Celery(
    'celery_app',  # Changed to match the module name
    broker=redis_url,
    backend=redis_url,
    include=['ocr_tasks']  # Critical: Explicitly register tasks
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    worker_send_task_events=True,
    task_ignore_result=False
)