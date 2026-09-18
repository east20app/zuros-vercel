import hashlib
import hmac

from zuros_client.security import canonical_query, encode_body, secret_fingerprint, signed_headers


def test_secret_fingerprint_is_stable_and_safe() -> None:
    assert secret_fingerprint("a" * 32) == "3ba3f5f43b92"
    assert "a" * 32 not in secret_fingerprint("a" * 32)


def test_body_is_compact_and_stable() -> None:
    assert (
        encode_body({"discord_user_id": "123", "name": "Olá"})
        == b'{"discord_user_id":"123","name":"Ol\xc3\xa1"}'
    )


def test_query_is_sorted() -> None:
    assert canonical_query({"z": "2", "a": "1", "none": None}) == "a=1&z=2"


def test_signature_matches_api_contract() -> None:
    body = encode_body({"discord_user_id": "123"})
    headers = signed_headers(
        method="POST",
        path="applications/abc/start",
        secret="s" * 32,
        bot_id="bot",
        body=body,
        timestamp=1_700_000_000,
        nonce="nonce",
        request_id="request",
    )
    body_hash = hashlib.sha256(body).hexdigest()
    payload = f"POST\n/applications/abc/start\n1700000000\nnonce\n{body_hash}"
    expected = hmac.new(("s" * 32).encode(), payload.encode(), hashlib.sha256).hexdigest()
    assert headers["X-Zuros-Signature"] == expected
    assert headers["X-Zuros-Nonce"] == "nonce"
    assert headers["X-Request-ID"] == "request"
