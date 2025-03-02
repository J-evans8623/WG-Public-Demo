"""
File: text_extraction_service.py
Description:
    Extended text extraction service with parallel OCR processing
    for multi-page PDF documents. If no selectable text is found,
    OCR is offloaded to Celery tasks for parallel processing.
"""

import fitz
import logging
import time
from io import BytesIO
from celery import group
from celery_app import celery_app
from ocr_tasks import ocr_page_task
from pdf2image import convert_from_path
from docx import Document
from pptx import Presentation


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_path: str) -> str:
    logger.info(f"Extracting text from PDF file: {file_path}")
    document = fitz.open(file_path)
    
    # First pass: attempt to extract text from each page.
    extracted_pages = []
    for page_num in range(len(document)):
        page = document.load_page(page_num)
        text = page.get_text().strip()
        extracted_pages.append(text)
    
    # If any page has selectable text, return concatenated text.
    if any(text for text in extracted_pages):
        logger.info("Using regular text extraction")
        return "\n".join(extracted_pages)
    else:
        logger.info("No extracted text found; falling back to OCR processing")
        try:
            start_time = time.time()
            # Convert PDF pages to images using pdf2image.
            pages = convert_from_path(file_path, dpi=300)
            
            # Create a task group for parallel OCR processing.
            ocr_jobs = group(
                ocr_page_task.s(page_image_data=_get_image_bytes(page))
                for page in pages
            )
            
            # Dynamic timeout: 60 seconds per page plus a 60-second buffer (min 300s).
            timeout = max(300, (60 * len(pages)) + 60)
            
            # Execute all OCR tasks in parallel.
            result = ocr_jobs.apply_async()
            ocr_results = result.get(timeout=timeout)
            
            elapsed = time.time() - start_time
            logger.info(f"OCR completed in {elapsed:.2f}s")
            return "\n".join(ocr_results)
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise

def _get_image_bytes(image) -> bytes:
    """Helper function to convert a PIL image to PNG byte data."""
    buf = BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()

def extract_text_from_docx(file_path: str) -> str:
    logger.info(f"Extracting text from DOCX file: {file_path}")
    doc = Document(file_path)
    texts = [para.text for para in doc.paragraphs]
    return "\n".join(texts)

def extract_text_from_pptx(file_path: str) -> str:
    logger.info(f"Extracting text from PPTX file: {file_path}")
    prs = Presentation(file_path)
    texts = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                texts.append(shape.text)
    return "\n".join(texts)

def extract_text(file_path: str, file_type: str) -> dict:
    """
    Unified function to extract text from a document file (PDF, DOCX, or PPTX)
    and return a dictionary with the extracted text and metadata.
    """
    result = {"text": "", "metadata": {"file": file_path, "type": file_type}}
    if file_type.endswith(".pdf"):
        result["text"] = extract_text_from_pdf(file_path)
        try:
            document = fitz.open(file_path)
            result["metadata"]["pages"] = len(document)
        except Exception as e:
            logger.error(f"Error retrieving PDF metadata: {e}")
            result["metadata"]["pages"] = None
    elif file_type.endswith(".docx"):
        result["text"] = extract_text_from_docx(file_path)
    elif file_type.endswith(".pptx"):
        result["text"] = extract_text_from_pptx(file_path)
    else:
        logger.error(f"Unsupported file type for text extraction: {file_type}")
        raise ValueError(f"Unsupported file type: {file_type}")
    
    return result

if __name__ == "__main__":
    import sys, json
    if len(sys.argv) != 3:
        print("Usage: python text_extraction_service.py <file_path> <mime_type>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    input_type = sys.argv[2]
    
    try:
        extraction_result = extract_text(input_file, input_type)
        print(json.dumps(extraction_result, indent=4))
    except Exception as e:
        print(f"Error: {e}")
