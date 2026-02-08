# mistral-native-api.py
import os
import base64
from typing import List
from mistralai import Mistral

def process_pdf_natively(pdf_bytes: bytes) -> List[str]:
    """
    Encapsulated logic for the Mistral.ai Native OCR API.
    Initializes the client using your custom environment variable.
    """
    # 1. Fetch your custom environment variable
    custom_key = os.getenv("mistral_native_api_key")
    if not custom_key:
        raise RuntimeError("MISSING_API_KEY: 'mistral_native_api_key' is not set in your environment.")

    # 2. Initialize the client with the custom key
    with Mistral(api_key=custom_key) as client:
        # Convert bytes to base64 data URI
        b64_pdf = base64.b64encode(pdf_bytes).decode("utf-8")
        data_url = f"data:application/pdf;base64,{b64_pdf}"

        # 3. Request OCR processing
        # model="mistral-ocr-latest" is the production-ready name for OCR 3
        response = client.ocr.process(
            model="mistral-ocr-2512",
            document={
                "type": "document_url",
                "document_url": data_url
            }
        )

        # 4. Handle the response and extract page content
        if not response or not hasattr(response, 'pages'):
            return []
            
        return [page.markdown for page in response.pages]