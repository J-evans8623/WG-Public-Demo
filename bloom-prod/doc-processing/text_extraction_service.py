"""
File: text_extraction_service.py
Description:
    [update - 1]
    Production-grade, in-memory text extraction service for multi-page PDF, DOCX, and PPTX with a
    **selectable-text fast path** and a **Mistral OCR (Azure AI Foundry) fallback**. The module
    maintains the public contract expected by the Next.js client:
        • PDF → returns an array of per-page strings.
        • DOCX/PPTX → returns a single concatenated string.
    Key properties:
        1) No temp files—bytes are processed entirely in memory.
        2) Deterministic behavior without custom timeout logic: we reject work up-front based on
           maximum upload size and maximum page count (configurable via environment).
        3) OCR fallback is invoked based on **intelligent text quality analysis** rather than
           simple presence/absence. The system distinguishes between "no text" and "no usable text"
           by evaluating content density, word formation, sentence structure, and character
           distribution. This prevents false positives from stray glyphs (e.g., "Σ", "310", Cyrillic
           snippets) while correctly identifying scanned documents that require OCR. Fallback
           integrates with Azure AI Foundry's Mistral OCR endpoint by sending a base64 `data:` URL,
           and it enforces the same conspicuous page markers as the fast path for downstream consistency.
        4) Errors are mapped to actionable messages; logging is minimal and excludes content.

    Big-O Complexity:
        PDF fast path → O(N) across pages.
        Quality analysis → O(N*L) where N = pages, L = average text length per page.
        OCR path → O(N) on result size; network latency dominates but is outside algorithmic cost.
"""

# =========================
# [update - 2] Imports
# =========================
import io
import os
import re
import logging
from typing import List, Tuple, Dict
from collections import Counter

import fitz  # PyMuPDF
from docx import Document
from pptx import Presentation

from mistral_ocr_adapter import mistral_ocr_read_pdf  # new adapter

# =========================
# Logger Setup
# =========================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =========================
# [update - 3] Config
# =========================
def _env_int(name: str, default: int) -> int:
    """
    Purpose:
        Read integer configuration from environment with a sane default, avoiding scattered
        int(...) calls and providing a single source for limit tuning. Returns the default
        when the variable is missing or invalid.
    """
    try:
        return int(os.getenv(name, str(default)))
    except Exception:
        return default


def _env_float(name: str, default: float) -> float:
    """
    Purpose:
        Read float configuration from environment with a sane default. Returns the default
        when the variable is missing or invalid. Used for quality threshold tuning.
    """
    try:
        return float(os.getenv(name, str(default)))
    except Exception:
        return default


MAX_UPLOAD_MB = _env_int("MAX_UPLOAD_MB", 50)          # cap raw file size (MB)
MAX_PDF_PAGES = _env_int("MAX_PDF_PAGES", 100)         # cap number of pages

# =========================
# [update - 3a] Quality Detection Thresholds
# =========================
# These thresholds control when OCR fallback is triggered based on text quality analysis.
# Tune these values based on your document corpus characteristics.

MIN_CHARS_PER_PAGE = _env_int("MIN_CHARS_PER_PAGE", 100)
"""Minimum non-whitespace characters for a page to be considered having content."""

MIN_WORDS_PER_PAGE = _env_int("MIN_WORDS_PER_PAGE", 20)
"""Minimum recognizable word tokens (2+ chars) for quality text detection."""

MIN_QUALITY_PAGE_RATIO = _env_float("MIN_QUALITY_PAGE_RATIO", 0.3)
"""Minimum ratio of pages with quality text (score >= 50) to use fast path. 
   Example: 0.3 means at least 30% of pages must have usable text."""

MIN_AVG_WORD_LENGTH = _env_float("MIN_AVG_WORD_LENGTH", 2.5)
"""Minimum average word length threshold. Natural language averages 4-5 chars; 
   random glyphs typically produce shorter "words"."""

QUALITY_SCORE_THRESHOLD = _env_float("QUALITY_SCORE_THRESHOLD", 50.0)
"""Score threshold (0-100) for considering a page to have "quality" text."""

# =========================
# [update - 4] Page Markers
# =========================
def _page_markers(page_index_one_based: int) -> Tuple[str, str]:
    """
    Purpose:
        Construct the established START/END page markers for a given page index (1-based).
        Centralizing this format guarantees consistent output between the fast path and the
        OCR fallback and allows trivial future changes without chasing literals.
    """
    start_marker = f"[#### START OF PAGE {page_index_one_based} ####]"
    end_marker = f"[#### END OF PAGE {page_index_one_based} ####]"
    return start_marker, end_marker


def _compact_payload_len(text: str) -> int:
    """
    Purpose:
        Return the number of non-whitespace characters in `text`. This ignores future page markers
        and layout whitespace so our "does this page have selectable text?" decision is precise.
        Complexity is O(L) in the string length.
    """
    if not text:
        return 0
    return sum(1 for ch in text if not ch.isspace())


# =========================
# [update - 5] Text Quality Analysis
# =========================
def _analyze_text_quality(text: str) -> Dict[str, any]:
    """
    Purpose:
        Perform multi-factor analysis of extracted text to determine if it represents usable
        content versus OCR artifacts, random glyphs, or noise. This function implements a
        composite scoring system that evaluates:
        
        1) Character count (non-whitespace) - filters pages with only a handful of glyphs
        2) Word count (2+ alphanumeric chars) - distinguishes real words from isolated symbols
        3) Average word length - natural language has longer average word length than noise
        4) Sentence structure - presence of proper punctuation and capitalization patterns
        5) Character distribution - balanced letter frequency vs. repeated/dominant characters
        
        The composite quality score ranges from 0-100 with the following distribution:
        - 30 points: Sufficient character count (>= MIN_CHARS_PER_PAGE)
        - 25 points: Sufficient word count (>= MIN_WORDS_PER_PAGE)
        - 20 points: Natural word length (>= MIN_AVG_WORD_LENGTH)
        - 15 points: Sentence structure present
        - 10 points: Balanced character distribution
        
    Args:
        text: Raw extracted text from a page
        
    Returns:
        Dictionary with quality metrics:
        - char_count: int - non-whitespace character count
        - word_count: int - number of recognizable word tokens (2+ chars)
        - avg_word_length: float - average length of extracted words
        - has_sentence_structure: bool - whether text has sentence markers
        - balanced_distribution: bool - whether character distribution is natural
        - quality_score: float - composite score from 0-100
        
    Complexity:
        O(L) where L is the length of the text string. Each character is examined once for
        counting, and word extraction via regex is linear in text length.
    """
    if not text:
        return {
            "char_count": 0,
            "word_count": 0,
            "avg_word_length": 0.0,
            "has_sentence_structure": False,
            "balanced_distribution": False,
            "quality_score": 0.0,
        }
    
    # Count non-whitespace characters
    char_count = sum(1 for ch in text if not ch.isspace())
    
    # Extract word-like tokens (2+ alphanumeric chars)
    # This filters out isolated glyphs like "Σ", "3", "о" which are common OCR artifacts
    words = re.findall(r'\b\w{2,}\b', text, re.UNICODE)
    word_count = len(words)
    
    # Calculate average word length
    avg_word_length = sum(len(w) for w in words) / word_count if word_count > 0 else 0.0
    
    # Check for sentence structure (periods followed by spaces and capital letters)
    # This pattern is a strong indicator of natural language text
    has_sentence_structure = bool(re.search(r'[.!?]\s+[A-Z]', text))
    
    # Analyze character distribution - natural text has balanced character frequency
    # Dominant single characters suggest OCR artifacts or noise
    char_dist = Counter(ch.lower() for ch in text if ch.isalpha())
    if char_dist:
        most_common_ratio = char_dist.most_common(1)[0][1] / sum(char_dist.values())
        # If any single character represents more than 15% of all letters, flag as unbalanced
        balanced_distribution = most_common_ratio < 0.15
    else:
        balanced_distribution = False
    
    # Composite quality score (0-100) - weighted sum of quality factors
    score = 0.0
    
    # Factor 1: Sufficient character count (0-30 points)
    # Linear scaling up to MIN_CHARS_PER_PAGE, then full points
    if char_count >= MIN_CHARS_PER_PAGE:
        score += 30.0
    else:
        score += (char_count / MIN_CHARS_PER_PAGE) * 30.0
    
    # Factor 2: Sufficient word count (0-25 points)
    # Linear scaling up to MIN_WORDS_PER_PAGE, then full points
    if word_count >= MIN_WORDS_PER_PAGE:
        score += 25.0
    else:
        score += (word_count / MIN_WORDS_PER_PAGE) * 25.0
    
    # Factor 3: Natural word length (0-20 points)
    # Longer average word length indicates natural language vs. noise
    if avg_word_length >= MIN_AVG_WORD_LENGTH:
        score += 20.0
    elif avg_word_length > 0:
        score += (avg_word_length / MIN_AVG_WORD_LENGTH) * 20.0
    
    # Factor 4: Sentence structure (0-15 points)
    # Binary: either present or not
    if has_sentence_structure:
        score += 15.0
    
    # Factor 5: Balanced character distribution (0-10 points)
    # Binary: either balanced or not
    if balanced_distribution:
        score += 10.0
    
    return {
        "char_count": char_count,
        "word_count": word_count,
        "avg_word_length": round(avg_word_length, 2),
        "has_sentence_structure": has_sentence_structure,
        "balanced_distribution": balanced_distribution,
        "quality_score": round(score, 2),
    }


def _should_use_ocr(page_qualities: List[Dict[str, any]]) -> Tuple[bool, str]:
    """
    Purpose:
        Determine if OCR fallback should be triggered based on aggregate page quality analysis.
        This function implements the core decision logic that distinguishes between documents
        with "no text" versus "no usable text".
        
        Decision Strategy:
        1) If ALL pages are completely empty (zero characters), trigger OCR - this is the
           traditional case of a fully scanned document.
        2) If the ratio of pages with quality text (score >= QUALITY_SCORE_THRESHOLD) falls
           below MIN_QUALITY_PAGE_RATIO, trigger OCR - this catches documents where PyMuPDF
           extracted only noise/glyphs but no meaningful content.
        3) Otherwise, use the fast path - the document has sufficient selectable text.
        
        This approach handles common scenarios:
        - Textbooks with illustrations: Most pages have text, some are diagrams → fast path
        - Scanned documents: All or most pages have low quality scores → OCR
        - Mixed documents: Ratio-based decision ensures robustness
        
    Args:
        page_qualities: List of quality metric dictionaries from _analyze_text_quality
        
    Returns:
        Tuple of (should_use_ocr: bool, reason: str) where reason explains the decision
        for logging and diagnostics.
        
    Complexity:
        O(N) where N is the number of pages, as we iterate once to count quality pages.
    """
    if not page_qualities:
        return True, "No pages to analyze"
    
    total_pages = len(page_qualities)
    
    # Count pages with quality text (score >= threshold)
    quality_pages = sum(
        1 for pq in page_qualities 
        if pq["quality_score"] >= QUALITY_SCORE_THRESHOLD
    )
    quality_ratio = quality_pages / total_pages
    
    # Count completely empty pages
    empty_pages = sum(1 for pq in page_qualities if pq["char_count"] == 0)
    
    # Decision logic
    
    # Case 1: All pages are empty → definitely use OCR
    if empty_pages == total_pages:
        return True, f"All {total_pages} pages are empty"
    
    # Case 2: Insufficient quality pages → use OCR
    # This catches the false positive case where PyMuPDF extracts stray glyphs
    # but no meaningful content (e.g., "Σ", "310", Cyrillic fragments)
    if quality_ratio < MIN_QUALITY_PAGE_RATIO:
        return True, (
            f"Only {quality_pages}/{total_pages} pages ({quality_ratio:.1%}) have usable text "
            f"(threshold: {MIN_QUALITY_PAGE_RATIO:.1%})"
        )
    
    # Case 3: Sufficient quality text → use fast path
    # Calculate average quality score for informative logging
    avg_score = sum(pq["quality_score"] for pq in page_qualities) / total_pages
    
    return False, (
        f"Document has sufficient quality text: {quality_pages}/{total_pages} pages "
        f"({quality_ratio:.1%}) with avg score {avg_score:.1f}/100"
    )


# =====================================================================================
# Core Extraction Functions (PDF, DOCX, PPTX)
# =====================================================================================
def _enforce_size_limit(data: bytes) -> None:
    """
    Purpose:
        [update - 5]
        Enforce the configured maximum upload size without relying on custom timeout logic.
        If the raw bytes exceed the limit, raise a ValueError that the FastAPI layer will
        convert to a clean 4xx response.
    """
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise ValueError(f"FILE_TOO_LARGE: exceeds {MAX_UPLOAD_MB} MB cap")


def extract_text_from_pdf(data: bytes) -> List[str]:
    """
    Purpose:
        [update - 6]
        Extract text from a PDF with intelligent quality-based OCR fallback decision.
        
        Process Flow:
        1) Fast path extraction using PyMuPDF: iterate pages, collect raw text (no markers),
           and perform multi-factor quality analysis on each page.
        2) Aggregate quality analysis: determine if the document has sufficient "usable" text
           based on content density, word formation, sentence structure, and character distribution.
        3) Decision point:
           a) If quality is sufficient → return all pages with markers applied (fast path)
           b) If quality is insufficient → invoke Mistral OCR via Azure adapter (OCR fallback)
        4) OCR path: send base64 `data:` URL and request page-wise output using the same
           markers. Reconstruct pages from the OCR response and return them.
        
        Key Enhancement:
        The function now distinguishes between "no text" and "no usable text" by analyzing
        the quality of extracted content. This prevents false positives where PyMuPDF extracts
        a few stray glyphs (e.g., "Σ", "310", Cyrillic snippets) that don't represent meaningful
        content, while still using the fast path for legitimate documents like textbooks with
        illustrations where some pages naturally have no text.
        
        The function also enforces the configured **page cap** to avoid unbounded work without
        timeouts. Errors carry actionable messages for the API gateway.
        
    Args:
        data: Raw PDF bytes to process
        
    Returns:
        List of strings, one per page, each wrapped with START/END page markers
        
    Raises:
        ValueError: If page count exceeds MAX_PDF_PAGES
        RuntimeError: If OCR fallback fails
        
    Complexity:
        Fast path: O(N*L) where N = pages, L = average text length (for quality analysis)
        OCR path: O(N) on result processing; network call dominates wall-clock time
    """
    # [Step 0] size cap (independent of type)
    # Note: Commented out to allow large research papers, but can be enabled if needed
    # _enforce_size_limit(data)

    # [Step 1] open PDF and enforce page cap
    logger.info("Opening PDF from bytes")
    document = fitz.open(stream=data, filetype="pdf")
    page_count = len(document)
    if page_count > MAX_PDF_PAGES:
        raise ValueError(f"PAGE_LIMIT_EXCEEDED: {page_count} pages > cap {MAX_PDF_PAGES}")

    # [Step 2] first pass: extract raw text and analyze quality per page
    logger.info(f"Analyzing text quality across {page_count} pages")
    raw_pages: List[str] = []
    page_qualities: List[Dict[str, any]] = []
    
    for page_num in range(page_count):
        page = document.load_page(page_num)
        raw_text = page.get_text().strip()
        raw_pages.append(raw_text)
        
        # Perform quality analysis on this page
        quality = _analyze_text_quality(raw_text)
        page_qualities.append(quality)
        
        # Log individual page quality for debugging (only in DEBUG mode to avoid spam)
        logger.debug(
            f"Page {page_num + 1}: chars={quality['char_count']}, "
            f"words={quality['word_count']}, score={quality['quality_score']}"
        )

    # [Step 3] aggregate decision: should we use OCR fallback?
    use_ocr, reason = _should_use_ocr(page_qualities)
    
    if not use_ocr:
        # Fast path: document has sufficient quality text
        logger.info(f"Fast path hit: {reason}")
        marked: List[str] = []
        for i, txt in enumerate(raw_pages, start=1):
            start_marker, end_marker = _page_markers(i)
            marked.append(f"{start_marker}\n{txt}\n{end_marker}")
        return marked

    # [Step 4] OCR fallback: document lacks usable text
    logger.info(f"OCR fallback triggered: {reason}")
    # We pass templates with `{i}` placeholder so adapter can craft the instruction text.
    start_tpl = "[#### START OF PAGE {i} ####]"
    end_tpl = "[#### END OF PAGE {i} ####]"
    try:
        ocr_pages = mistral_ocr_read_pdf(data, start_tpl, end_tpl)
    except Exception as e:
        # Surface a precise, actionable message (no content)
        raise RuntimeError(f"OCR_FAILED: {e}")

    # [Step 5] apply markers defensively if provider did not include them
    marked: List[str] = []
    for i, txt in enumerate(ocr_pages, start=1):
        start_marker, end_marker = _page_markers(i)
        # Avoid duplicating markers if the provider emitted them already
        s = txt.strip()
        if s.startswith(start_marker) and s.endswith(end_marker):
            marked.append(s)
        else:
            marked.append(f"{start_marker}\n{s}\n{end_marker}")

    logger.info(f"OCR completed: extracted text from {len(marked)} pages")
    return marked


def extract_text_from_docx_bytes(data: bytes) -> str:
    """
    Purpose:
        Extract and join textual paragraphs from a DOCX file, preserving the legacy single-string
        return shape. The function streams bytes into python-docx, iterates paragraphs in order,
        and returns a newline-joined body. Complexity is O(N) over the number of paragraphs.
    """
    _enforce_size_limit(data)  # [update - 7]
    logger.info("Opening DOCX from bytes")
    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs)


def extract_text_from_pptx_bytes(data: bytes) -> str:
    """
    Purpose:
        Extract plain textual content from PPTX slides by gathering `shape.text` where present,
        returning a newline-joined string. This preserves the legacy single-string behavior for
        PPTX and is O(N) over shapes across slides.
    """
    _enforce_size_limit(data)  # [update - 8]
    logger.info("Opening PPTX from bytes")
    prs = Presentation(io.BytesIO(data))
    texts: List[str] = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                texts.append(shape.text)
    return "\n".join(texts)


def extract_text_bytes(data: bytes, file_type: str) -> dict:
    """
    Purpose:
        Unified wrapper for all formats that returns a dict with:
          - "text": list[str] for PDF, or str for DOCX/PPTX
          - "metadata": {"type": file_type, "pages": int | None}
        The function preserves the existing external API contract and adds no new fields.
        Complexity is O(N) dictated by the underlying extractor.
    """
    # [update - 9] wrapper remains public contract; guards are enforced inside type handlers
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
        msg = f"UNSUPPORTED_TYPE: {file_type}"
        logger.error(msg)
        raise ValueError(msg)

    return result


# =========================
# CLI Smoke Test (unchanged)
# =========================
if __name__ == "__main__":
    """
    Purpose:
        Simple CLI harness for quick manual validation:
          python text_extraction_service.py <file> <.pdf|.docx|.pptx>
        Prints the JSON result or an error. This is not used in production deployments but
        helps local iteration. Complexity depends on the selected extractor.
    """
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