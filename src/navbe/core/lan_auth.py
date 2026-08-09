"""LAN remote pairing token — required for non-loopback HTTP clients.

Desktop enables LAN by binding ``0.0.0.0`` and setting ``NAVBE_LAN_TOKEN``
(or writing ``~/.navbe/lan_token``). Loopback clients stay unauthenticated.
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from navbe.core.paths import default_data_home

_LOOPBACK = frozenset({"127.0.0.1", "::1", "localhost", "testclient"})


def lan_token_path() -> Path:
    """Path to the pairing token file under the data home."""
    return default_data_home() / "lan_token"


def load_lan_token() -> str | None:
    """Return the configured LAN token, or None if unset."""
    env = os.environ.get("NAVBE_LAN_TOKEN", "").strip()
    if env:
        return env
    path = lan_token_path()
    if not path.is_file():
        return None
    try:
        text = path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return text or None


def generate_lan_token() -> str:
    """Create a fresh URL-safe pairing token."""
    return secrets.token_urlsafe(24)


def write_lan_token(token: str) -> Path:
    """Persist ``token`` to the lan_token file; return its path."""
    path = lan_token_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(token.strip() + "\n", encoding="utf-8")
    return path


def clear_lan_token() -> None:
    """Remove the lan_token file if present."""
    path = lan_token_path()
    path.unlink(missing_ok=True)


def _client_is_loopback(request: Request) -> bool:
    """True when the TCP peer is localhost (desktop / MCP on same machine)."""
    client = request.client
    if client is None:
        return False
    host = (client.host or "").strip().lower()
    if host in _LOOPBACK:
        return True
    # IPv4-mapped IPv6 (::ffff:127.0.0.1)
    if host.startswith("::ffff:") and host.removeprefix("::ffff:") in _LOOPBACK:
        return True
    return False


def _bearer_token(request: Request) -> str | None:
    """Extract Bearer token from Authorization header."""
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header:
        return None
    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


class LanAuthMiddleware(BaseHTTPMiddleware):
    """Reject non-loopback requests without a matching Bearer pairing token.

    When no token is configured, non-loopback access is denied (LAN must be
    intentionally paired). Loopback is always allowed.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # CORS preflight has no Authorization — let CORSMiddleware answer it.
        if request.method == "OPTIONS":
            return await call_next(request)

        if _client_is_loopback(request):
            return await call_next(request)

        expected = load_lan_token()
        if expected is None:
            return JSONResponse(
                {"detail": "LAN remote is not paired (no token configured)"},
                status_code=401,
            )

        provided = _bearer_token(request)
        if (
            provided is None
            or len(provided) != len(expected)
            or not secrets.compare_digest(provided, expected)
        ):
            return JSONResponse(
                {"detail": "Invalid or missing LAN pairing token"},
                status_code=401,
            )
        return await call_next(request)
