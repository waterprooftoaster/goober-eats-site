"""
@file addon.py
@description mitmproxy addon that captures JSON API responses from *.grubhub.com
  and saves them as enveloped JSON files to data/raw/.
  Called by: mitmdump -s src/addon.py
@dependencies mitmproxy
"""

from __future__ import annotations

import json
import logging
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from mitmproxy import http
from mitmproxy.options import Options

logger = logging.getLogger(__name__)

HOST_PATTERN = re.compile(r"(^|\.)grubhub\.com$")
MAX_PATH_SLUG_LEN = 80


"""
Captures JSON responses from Grubhub API endpoints and saves to disk.
"""
class GrubhubCapture:

    def __init__(self) -> None:
        self._output_dir = Path("data/raw")
        self._seen: Counter[tuple[str, str]] = Counter()
        self._captured = 0
        self._skipped = 0

    """
    Called when the addon is loaded. Creates the output directory and logs
    startup info.
    @called-by mitmproxy lifecycle
    """
    def load(self, loader: Options) -> None:
        self._output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(
            "GrubhubCapture loaded — filtering *.grubhub.com JSON responses → %s",
            self._output_dir,
        )

    """
    Intercepts every HTTP response. Saves JSON responses from Grubhub hosts
    as enveloped JSON files in the output directory.
    @param flow - the completed HTTP flow (request + response)
    @called-by mitmproxy response hook
    """
    def response(self, flow: http.HTTPFlow) -> None:
        if flow.response is None:
            return

        host = flow.request.pretty_host
        if not HOST_PATTERN.search(host):
            self._skipped += 1
            return

        content_type = flow.response.headers.get("content-type", "")
        if "application/json" not in content_type:
            self._skipped += 1
            return

        body = _parse_response_body(flow.response)
        envelope = _build_envelope(flow, body)
        filepath = self._next_filepath(flow.request.method, flow.request.path)

        filepath.write_text(json.dumps(envelope, indent=2, ensure_ascii=False))
        self._captured += 1
        logger.info("Captured: %s %s → %s", flow.request.method, flow.request.path, filepath.name)

    """
    Called when mitmproxy shuts down. Logs a summary of the session.
    @called-by mitmproxy lifecycle
    """
    def done(self) -> None:
        logger.info(
            "GrubhubCapture done — captured: %d, skipped: %d",
            self._captured,
            self._skipped,
        )

    """
    Generates a unique, filesystem-safe filename for a captured response.
    @param method - HTTP method (GET, POST, etc.)
    @param path - URL path
    @returns Path to the output file
    @called-by self.response
    """
    def _next_filepath(self, method: str, path: str) -> Path:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
        slug = _path_to_slug(path)
        # Key on slug (not raw path) to prevent collisions from different paths
        # that produce the same truncated slug
        key = (method.upper(), slug)
        self._seen[key] += 1
        count = self._seen[key]

        name = f"{now}_{method.lower()}_{slug}"
        if count > 1:
            name += f"_{count}"
        return self._output_dir / f"{name}.json"


# --- Helpers ---


"""
Attempts to parse the response body as JSON. Returns the parsed object,
or a dict with _raw_text if parsing fails.
@param response - the HTTP response
@returns parsed JSON object or fallback dict
@called-by GrubhubCapture.response
"""
def _parse_response_body(response: http.Response) -> object:
    try:
        return json.loads(response.get_text(strict=False))
    except (json.JSONDecodeError, ValueError):
        logger.warning("Response body is not valid JSON despite content-type header")
        return {"_raw_text": response.get_text(strict=False)}


"""
Wraps a captured response in a metadata envelope. Does NOT include request
headers (they contain auth tokens).
@param flow - the HTTP flow
@param body - parsed response body
@returns envelope dict
@called-by GrubhubCapture.response
"""
def _build_envelope(flow: http.HTTPFlow, body: object) -> dict:
    # Store only host + path, not full URL — query strings may contain auth tokens
    return {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "request": {
            "method": flow.request.method,
            "host": flow.request.pretty_host,
            "path": flow.request.path,
        },
        "response": {
            "status_code": flow.response.status_code,
            "body": body,
        },
    }


"""
Converts a URL path to a filesystem-safe slug.
@param path - URL path (e.g., /restaurants/123/menu)
@returns slug string (e.g., _restaurants_123_menu)
@called-by GrubhubCapture._next_filepath
"""
def _path_to_slug(path: str) -> str:
    slug = path.replace("/", "_")
    # Strip query params
    slug = slug.split("?")[0]
    # Remove non-alphanumeric chars except underscores and hyphens
    slug = re.sub(r"[^a-zA-Z0-9_\-]", "", slug)
    return slug[:MAX_PATH_SLUG_LEN]


addons = [GrubhubCapture()]
