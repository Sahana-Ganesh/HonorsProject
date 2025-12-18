import os
from pathlib import Path

def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)

def get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()

def is_image_file(filename: str) -> bool:
    from .config import settings
    return get_file_extension(filename) in settings.SUPPORTED_FORMATS

def safe_filename(filename: str) -> str:
    import re
    safe_name = re.sub(r'[^\w\-_\.]', '_', filename)
    return safe_name