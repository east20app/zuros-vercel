import hashlib
import hmac
import json
import secrets
import time
from collections.abc import Mapping
from urllib.parse import urlencode


def secret_fingerprint(secret: str) -> str:
    """Return a safe identifier used to compare configured secrets."""
    return hashlib.sha256(secret.encode()).hexdigest()[:12]


def encode_body(body: Mapping[str, object] | None) -> bytes:
    if body is None:
        return b""
    return json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def canonical_query(query: Mapping[str, object] | None) -> str:
    if not query:
        return ""
    values = [(key, str(value)) for key, value in query.items() if value is not None]
    return urlencode(sorted(values))


def signed_headers(
    *,
    method: str,
    path: str,
    secret: str,
    bot_id: str,
    body: bytes = b"",
    query: Mapping[str, object] | None = None,
    timestamp: int | None = None,
    nonce: str | None = None,
    request_id: str | None = None,
) -> dict[str, str]:
    timestamp_value = str(timestamp or int(time.time()))
    nonce_value = nonce or secrets.token_urlsafe(24)
    query_string = canonical_query(query)
    relative = f"/{path.lstrip('/')}" + (f"?{query_string}" if query_string else "")
    body_hash = hashlib.sha256(body).hexdigest()
    payload = "\n".join((method.upper(), relative, timestamp_value, nonce_value, body_hash))
    signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Zuros-Bot-Id": bot_id,
        "X-Zuros-Timestamp": timestamp_value,
        "X-Zuros-Nonce": nonce_value,
        "X-Zuros-Signature": signature,
        "X-Request-ID": request_id or secrets.token_hex(16),
    }
