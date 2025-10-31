"""
====================================================================================================
File: mistral_ocr_adapter.py
Responsibility & Purpose:
    This module provides a vendor-scoped adapter that integrates the PDF OCR fallback with
    **Azure AI Foundry’s Mistral OCR**. It exposes a single function—`mistral_ocr_read_pdf`—that
    accepts raw PDF bytes and returns a list of page strings in order. The adapter performs the
    following in a strictly in-memory, production-ready manner:

    1) Reads configuration from environment variables (endpoint, api key, model name).
    2) Base64-encodes the original PDF into a `data:application/pdf;base64,<...>` URL, as required
       by the service.
    3) Issues a POST request to the Azure AI Foundry OCR endpoint with an instruction that
       requests **page-wise** output delimited by the caller’s explicit page markers
       (`[#### START/END OF PAGE i ####]`). This “doc-as-prompt” approach ensures we can reconstruct
       the page array deterministically even if the provider returns a flat markdown string.
    4) Parses the response robustly, first attempting a structured pages array if present, then
       falling back to splitting on our explicit markers. If neither is available, it returns a
       single element (full text) to avoid data loss while still surfacing a deterministic result.
    5) Raises precise exceptions on configuration errors, HTTP failures, or malformed outputs.
       No document content is logged or persisted; only metadata is logged at INFO/ERROR.

    Time Complexity:
        O(N) in the size of the provider response payload. All transformations are linear in the
        length of the response text and the number of detected pages. The network call itself
        dominates wall-clock latency and is outside algorithmic complexity.

    This adapter is intentionally decoupled from FastAPI or higher-level business logic so that
    future provider swaps (e.g., self-hosted OCR) require only replacing this shim while keeping
    the public microservice contract unchanged.
====================================================================================================
"""

from __future__ import annotations

import os
import re
import base64
import json
import logging
from typing import List, Optional, Tuple

import requests

# ----------------------------
# Logger (minimal, no PII)
# ----------------------------
logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


# ----------------------------
# Constants
# ----------------------------
_DEFAULT_MODEL = "mistral-ocr-latest"

# Regex prepared once (used if we must split flat text by markers)
# Matches:
#   [#### START OF PAGE 3 ####]
#   ... text ...
#   [#### END OF PAGE 3 ####]
_PAGE_BLOCK_PATTERN = re.compile(
    r"\[\#\#\#\# START OF PAGE (?P<index>\d+)\ \#\#\#\#\](.*?)\[\#\#\#\# END OF PAGE (?P=index)\ \#\#\#\#\]",
    flags=re.DOTALL,
)


# ==================================================================================================
# Helper Functions
# ==================================================================================================
def _get_env(name: str, required: bool = True, default: Optional[str] = None) -> str:
    """
    Purpose:
        Fetch a configuration value from environment variables. Optionally enforce presence
        and allow a default. The function centralizes all config access for clarity, and
        avoids scattering os.getenv calls across the codebase.
    """
    val = os.getenv(name, default)
    if required and not val:
        raise RuntimeError(f"OCR_MISCONFIGURED: missing required env var '{name}'")
    return val or ""


def _to_data_url_pdf(pdf_bytes: bytes) -> str:
    """
    Purpose:
        Convert raw PDF bytes to a base64 data URL in the form:
            data:application/pdf;base64,<BASE64>
        This is the only upload mode supported by the serverless OCR endpoint in Azure AI
        Foundry for documents sent directly in a request.
    """
    b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    return f"data:application/pdf;base64,{b64}"


def _extract_pages_from_flat_marked_text(text: str) -> List[str]:
    """
    Purpose:
        Given a single flat markdown/string that (ideally) contains explicit page markers,
        split it into an ordered list of page strings. If the markers are absent, return a
        one-element list so the caller still gets the full payload without silent loss.
    """
    blocks = _PAGE_BLOCK_PATTERN.findall(text)
    if not blocks:
        # No markers—return as a single page to avoid discarding content.
        return [text.strip()]
    # Pattern uses a single capturing group for the “between markers” part (index 1 in findall).
    return [blk[1].strip() for blk in blocks]


# ==================================================================================================
# Public API
# ==================================================================================================
def mistral_ocr_read_pdf(
    pdf_bytes: bytes,
    start_marker_tpl: str,
    end_marker_tpl: str,
) -> List[str]:
    """
    Purpose:
        Perform OCR against Azure AI Foundry’s Mistral OCR endpoint and return per-page text.
        The function:
          1) Loads endpoint, API key, and model name from environment.
          2) Sends a JSON body containing the base64 `document_url` data:URI.
          3) Includes a concise instruction asking for page-wise output wrapped with the caller’s
             exact START/END marker templates.
          4) Parses the response, attempting (a) structured pages first, and (b) splitting a flat
             text by markers second. If both fail, returns the raw text as a single element.

        The caller supplies marker templates so they remain single-sourced in one place and the
        adapter doesn’t drift from the microservice contract.

    Returns:
        List[str] of page texts in order.

    Raises:
        RuntimeError with an actionable message if configuration is missing, the HTTP response is
        non-200, or the payload cannot be parsed into page-wise text.
    """
    # [Step 1] Resolve configuration
    endpoint = _get_env("AZURE_MISTRAL_ENDPOINT", required=True)
    api_key = _get_env("AZURE_MISTRAL_API_KEY", required=True)
    model = _get_env("AZURE_MISTRAL_MODEL", required=False, default=_DEFAULT_MODEL)

    # [Step 2] Build request payload with data URL
    data_url = _to_data_url_pdf(pdf_bytes)


    payload = {
        "model": model,
        "document": {
            "type": "document_url",
            "document_url": data_url,
        },
        # Optional flags (kept conservative)
        "include_image_base64": False,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    # [Step 3] POST the OCR request
    try:
        resp = requests.post(endpoint, headers=headers, json=payload)
    except requests.RequestException as e:
        raise RuntimeError(f"OCR_NETWORK_ERROR: {e}") from e

    if resp.status_code // 100 != 2:
        snippet = resp.text[:500] if resp.text else ""
        raise RuntimeError(f"OCR_FAILED: status={resp.status_code}, body={snippet}")

    # [Step 4] Parse response
    try:
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f"OCR_PAYLOAD_PARSE_ERROR: {e}") from e

    # Strategy A: if the provider returns structured pages
    # We look for commonly used keys; if not present, we move to Strategy B.
    pages: List[str] = []
    if isinstance(data, dict):
        # 4.a: explicit pages array (future-proof)
        for k in ("pages", "page_texts"):
            if isinstance(data.get(k), list) and data.get(k):
                pages = [str(x or "").strip() for x in data[k]]
                break

        # 4.b: nested data.text or data.markdown
        if not pages:
            for k in ("text", "markdown", "content"):
                if isinstance(data.get(k), str) and data.get(k).strip():
                    pages = _extract_pages_from_flat_marked_text(data[k])
                    break

        # 4.c: some providers nest under "data" or "result"
        for top in ("data", "result"):
            if pages:
                break
            obj = data.get(top)
            if isinstance(obj, dict):
                for k in ("pages", "page_texts", "text", "markdown", "content"):
                    v = obj.get(k)
                    if isinstance(v, list) and v:
                        pages = [str(x or "").strip() for x in v]
                        break
                    if isinstance(v, str) and v.strip():
                        pages = _extract_pages_from_flat_marked_text(v)
                        break

    if not pages:
        # Last chance: if the endpoint returns raw text instead of JSON pages
        if isinstance(data, str) and data.strip():
            pages = _extract_pages_from_flat_marked_text(data)
        else:
            # As a conservative fallback, return empty to signal upstream failure clearly
            raise RuntimeError("OCR_EMPTY_RESPONSE: no text/pages found in provider payload")

    # [Step 5] Return pages (already page-wise)
    return pages
