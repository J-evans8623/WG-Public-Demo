"""
File: text_extraction_service.py
Description:
    In‑memory text extraction service for multi‑page PDF, DOCX, and PPTX.
    • PDF: returns a list of page‑strings (with start/end markers).
    • DOCX/PPTX: returns a single concatenated string.
    
    Page markers have been added around each page’s text in the
    regular (selectable‐text) path. In the OCR fallback path, a
    reminder has been left to re-insert markers once you swap to
    a future OCR API call.
"""
import io
import fitz
import logging
from docx import Document
from pptx import Presentation


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_text_from_pdf(data: bytes) -> list[str]:
    logger.info("Opening PDF from bytes")
    document = fitz.open(stream=data, filetype="pdf")
    
    # First pass: attempt to extract text from each page, injecting markers.
    extracted_pages = []
    for page_num in range(len(document)):
        page = document.load_page(page_num)
        raw_text = page.get_text().strip()
        # Insert conspicuous page markers:
        start_marker = f"[#### START OF PAGE {page_num + 1} ####]"
        end_marker   = f"[#### END OF PAGE {page_num + 1} ####]"
        # Wrap the raw text for this page in markers:
        marked = f"{start_marker}\n{raw_text}\n{end_marker}"
        extracted_pages.append(marked)
    
    # If any page has selectable text, return concatenated marked text.
    if any(text for text in extracted_pages):
        logger.info("Using regular text extraction with page markers")
        return extracted_pages
    else:
        logger.info("No selectable text found; OCR fallback is not implemented")
        raise NotImplementedError("OCR fallback not implemented")


def extract_text_from_docx_bytes(data: bytes) -> str:
    logger.info("Opening DOCX from bytes")
    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs)

def extract_text_from_pptx_bytes(data: bytes) -> str:
    logger.info("Opening PPTX from bytes")
    prs = Presentation(io.BytesIO(data))
    texts: list[str] = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                texts.append(shape.text)
    return "\n".join(texts)

def extract_text_bytes(data: bytes, file_type: str) -> dict:
    """
    In‑memory wrapper for all formats.
    Returns: {
      "text": list[str] for PDF or str for others,
      "metadata": { "type": file_type, "pages": int | None }
    }
    """
    result: dict = {
        "text": [],
        "metadata": {"type": file_type, "pages": None}
    }

    if file_type.endswith(".pdf"):
        pages = extract_text_from_pdf(data)
        result["text"] = pages
        result["metadata"]["pages"] = len(pages)

    elif file_type.endswith(".docx"):
        text = extract_text_from_docx_bytes(data)
        result["text"] = text

    elif file_type.endswith(".pptx"):
        text = extract_text_from_pptx_bytes(data)
        result["text"] = text

    else:
        msg = f"Unsupported type: {file_type}"
        logger.error(msg)
        raise ValueError(msg)

    return result

if __name__ == "__main__":
    import sys, json
    if len(sys.argv) != 3:
        print("Usage: python text_extraction_service.py <file> <.pdf|.docx|.pptx>")
        sys.exit(1)

    path, typ = sys.argv[1], sys.argv[2]
    with open(path, "rb") as f:
        data = f.read()

    try:
        out = extract_text_bytes(data, typ)
        print(json.dumps(out, indent=2))
    except Exception as e:
        print(f"Error: {e}")