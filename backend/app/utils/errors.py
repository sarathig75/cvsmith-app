"""Application errors and the contract's error response format."""
from typing import Any, Dict


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def error_body(code: str, message: str) -> Dict[str, Any]:
    return {"error": {"code": code, "message": message}}


def validation_error(message: str) -> AppError:
    return AppError("VALIDATION_ERROR", message, 422)


def email_exists() -> AppError:
    return AppError("EMAIL_EXISTS", "An account with this email already exists.", 409)


def invalid_credentials() -> AppError:
    return AppError("INVALID_CREDENTIALS", "Invalid email or password.", 401)


def unauthorized(message: str = "Authentication required.") -> AppError:
    return AppError("UNAUTHORIZED", message, 401)


def invalid_token(message: str = "Invalid or expired token.") -> AppError:
    return AppError("INVALID_TOKEN", message, 400)


def unsupported_file_type(message: str) -> AppError:
    return AppError("UNSUPPORTED_FILE_TYPE", message, 415)


def file_too_large(message: str) -> AppError:
    return AppError("FILE_TOO_LARGE", message, 413)


def not_found(message: str = "Resource not found.") -> AppError:
    return AppError("NOT_FOUND", message, 404)


def quota_exceeded() -> AppError:
    return AppError(
        "QUOTA_EXCEEDED",
        "You've used your free suggestion for this month. Upgrade to Pro for 50 suggestions a month ($9.99/month).",
        402,
    )


def suggestion_failed() -> AppError:
    return AppError("SUGGESTION_FAILED", "We couldn't write a suggestion right now. Please try again in a moment.", 503)


def pro_required() -> AppError:
    return AppError(
        "PRO_REQUIRED",
        "JSON export is part of Pro. Upgrade to Pro for JSON export and 50 suggestions a month ($9.99/month).",
        402,
    )


def pdf_failed() -> AppError:
    return AppError("PDF_FAILED", "We couldn't create your PDF right now. Please try again in a moment.", 503)


def google_auth_failed() -> AppError:
    return AppError("GOOGLE_AUTH_FAILED", "Google authentication failed.", 401)
