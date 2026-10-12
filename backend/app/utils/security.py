"""Password hashing and input sanitising helpers."""
import re
import unicodedata

import bcrypt

# Hash compared against when the user does not exist, so that login takes
# roughly the same time for known and unknown emails.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password-1", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


def burn_password_check(password: str) -> None:
    """Spend the same time as a real check (unknown user / no password)."""
    verify_password(password, _DUMMY_HASH)


def sanitize_filename_stem(filename: str, max_len: int = 100) -> str:
    """Return a safe, display-only name derived from a client filename.

    Never use the result (or the raw filename) to build a filesystem path.
    """
    name = filename.replace("\\", "/").split("/")[-1]
    stem = name.rsplit(".", 1)[0] if "." in name else name
    stem = unicodedata.normalize("NFKC", stem)
    stem = re.sub(r"[^\w\- ]+", "", stem).strip()
    return stem[:max_len]
