from __future__ import annotations

import hashlib
import os
import secrets
import struct
import time
import uuid


def generate_uuid7() -> uuid.UUID:
    """
    Generate an RFC 9562 compliant UUIDv7.
    - 48 bits: Unix timestamp in milliseconds
    - 4 bits: Version 7 (0b0111)
    - 12 bits: pseudo-random sequence (rand_a)
    - 2 bits: Variant (0b10)
    - 62 bits: pseudo-random sequence (rand_b)
    Guarantees monotonic chronological ordering and high-entropy server-side uniqueness.
    """
    ns = time.time_ns()
    timestamp_ms = ns // 1_000_000
    rand_bytes = os.urandom(10)

    # 48-bit timestamp in big-endian
    b = timestamp_ms.to_bytes(6, byteorder="big")

    # 4-bit version (0x7000) | 12-bit rand_a
    rand_a = (rand_bytes[0] << 8 | rand_bytes[1]) & 0x0FFF
    b += struct.pack(">H", 0x7000 | rand_a)

    # 2-bit variant (0b10 = 0x80) | 62-bit rand_b
    rand_b = struct.unpack(">Q", rand_bytes[2:])[0] & 0x3FFFFFFFFFFFFFFF
    b += struct.pack(">Q", 0x8000000000000000 | rand_b)

    return uuid.UUID(bytes=b)


def generate_user_uid() -> str:
    """
    Public, server-generated, immutable User UID.
    Prefixed with 'usr_' followed by 32 hex characters of UUIDv7.
    Example: usr_019163b28b7a70189b88a918f6c4d081
    """
    return f"usr_{generate_uuid7().hex}"


def generate_session_jti() -> str:
    """
    Unique, cryptographically unpredictable JWT ID (JTI) representing a single authenticated session.
    """
    return f"jti_{secrets.token_urlsafe(24)}"


def generate_verification_token() -> str:
    """
    High-entropy single-use token for email verification and password reset.
    """
    return secrets.token_urlsafe(36)


def hash_token(token: str) -> str:
    """
    SHA-256 digest for storing verification and refresh tokens securely in database.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
