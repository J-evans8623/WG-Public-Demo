import os
from mistral_native_api import process_pdf_natively

# Ensure environment is loaded
print(f"Key loaded: {bool(os.getenv('mistral_native_api_key'))}")

try:
    # Provide a small test PDF
    with open("C:/Users/jneva/Desktop/ocr-test/ocr-test.pdf", "rb") as f:
        pdf_data = f.read()

    results = process_pdf_natively(pdf_data)
    print(f"Success! Found {len(results)} pages.")
    print(f"First 100 chars: {results[0][:100]}...")
except Exception as e:
    print(f"Testing Error: {e}")