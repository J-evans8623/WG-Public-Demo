#!/usr/bin/env python3
"""
File: main.py
Description:
    FastAPI application for document processing.
    This service now exposes one endpoint:
      - POST /extract: Extracts text from a PDF, DOCX, or PPTX file.
    
Usage:
    Run this service with uvicorn:
        uvicorn main:app --host 0.0.0.0 --port 8000
"""

import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
import logging
from text_extraction_service import extract_text

# Configure logging.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("doc-processing")

app = FastAPI()

@app.post("/extract")
async def extract_endpoint(
    file: UploadFile = File(...),
    fileType: str = Form(...)  # For example: "example.pdf", "example.docx", "example.pptx"
):
    """
    Extract text from an uploaded PDF, DOCX, or PPTX file.
    The client must send a 'fileType' field explicitly.
    """
    try:
        temp_filename = f"/tmp/{uuid.uuid4()}_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Validate supported file types.
        lower_filetype = fileType.lower()
        if not (lower_filetype.endswith(".pdf") or lower_filetype.endswith(".docx") or lower_filetype.endswith(".pptx")):
            os.remove(temp_filename)
            raise HTTPException(
                status_code=400,
                detail="Text extraction supports only PDF, DOCX, and PPTX files."
            )
        
        result = extract_text(temp_filename, lower_filetype)
        os.remove(temp_filename)
        return result
    except Exception as e:
        logger.error(f"Extraction error for file {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
