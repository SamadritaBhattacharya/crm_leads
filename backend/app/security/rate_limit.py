"""In-process, per-IP rate limiting on the public endpoint (Engineering Rules
§2). Escalation to a Redis-backed limiter is a scaling-posture trigger
(System Architecture §9), not a v1 concern — don't add it preemptively.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
