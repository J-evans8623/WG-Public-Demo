#!/usr/bin/env python3
"""
File: ocr_tasks.py
Description:
    OCR task with retry capabilities for processing a single image.
"""

from celery_app import celery_app
import pytesseract
from PIL import Image
from io import BytesIO

pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

@celery_app.task(bind=True, max_retries=3)
def ocr_page_task(self, page_image_data: bytes) -> str:
    try:
        image = Image.open(BytesIO(page_image_data))
        extracted_text = pytesseract.image_to_string(image)
        return extracted_text
    except Exception as exc:
        self.retry(countdown=2 ** self.request.retries, exc=exc)
