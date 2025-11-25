#!/usr/bin/env python3
"""
File: main.py
Description:
    FastAPI application for in-memory document processing.
    • Reads the entire upload into memory.
    • Dispatches bytes + fileType to the text_extraction service.
    • No temporary files are ever written to disk.
"""

import logging

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from text_extraction_service import extract_text_bytes

# Configure logging.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("doc-processing")

app = FastAPI()

@app.post("/extract")
async def extract_endpoint(
    file: UploadFile = File(...),
    fileType: str = Form(...)  # e.g. ".pdf", ".docx", ".pptx"
):
    """
    Extract text from an uploaded PDF, DOCX, or PPTX file.
    Loads the entire file into memory and calls extract_text_bytes.
    """
    try:
        # Read file completely into memory
        content = await file.read()

        # Normalize and validate type
        lower_type = fileType.lower()
        if not (lower_type.endswith(".pdf") 
                or lower_type.endswith(".docx") 
                or lower_type.endswith(".pptx")):
            raise HTTPException(
                status_code=400,
                detail="Supported types: PDF, DOCX, PPTX."
            )

        # Dispatch to in‑memory extractor
        result = extract_text_bytes(content, lower_type)
        return result

    except HTTPException:
        # pass through 400s
        raise
    except Exception as e:
        logger.error(f"Extraction error for {file.filename}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Text extraction failed: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
