"""File storage interface; local disk now, S3 later."""
import uuid
from pathlib import Path
from typing import Protocol

from app.config import get_settings


class StorageService(Protocol):
    def save(self, user_id: uuid.UUID, data: bytes, extension: str) -> str:
        """Persist bytes and return an opaque storage key."""

    def read(self, key: str) -> bytes: ...

    def delete(self, key: str) -> None: ...


class LocalStorage:
    def __init__(self, base_dir: str):
        self.base = Path(base_dir).resolve()

    def save(self, user_id: uuid.UUID, data: bytes, extension: str) -> str:
        # Name is server-generated; the client filename is never used.
        key = f"{user_id}/{uuid.uuid4().hex}{extension}"
        target = (self.base / key).resolve()
        if self.base not in target.parents:
            raise ValueError("Invalid storage path")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return key

    def read(self, key: str) -> bytes:
        target = (self.base / key).resolve()
        if self.base not in target.parents:
            raise ValueError("Invalid storage path")
        return target.read_bytes()

    def delete(self, key: str) -> None:
        target = (self.base / key).resolve()
        if self.base in target.parents:
            target.unlink(missing_ok=True)


def get_storage() -> StorageService:
    return LocalStorage(get_settings().UPLOAD_DIR)
