"""OC image perceptual fingerprint — pHash for anti-plagiarism."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image

PHASH_SIZE = 8
SIMILARITY_THRESHOLD = 0.9


def compute_phash(image_path: Path, *, size: int = PHASH_SIZE) -> str:
    """Average-hash perceptual fingerprint (hex)."""
    with Image.open(image_path) as img:
        gray = img.convert("L").resize((size, size), Image.Resampling.LANCZOS)
        pixels = list(gray.getdata())
    if not pixels:
        return "0" * (size * size // 4)
    avg = sum(pixels) / len(pixels)
    bits = "".join("1" if p >= avg else "0" for p in pixels)
    return f"{int(bits, 2):0{(size * size + 3) // 4}x}"


def phash_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    length = min(len(a), len(b))
    if length == 0:
        return 0.0
    matches = sum(1 for i in range(length) if a[i] == b[i])
    return matches / max(len(a), len(b))


class ImageFingerprintStore:
    def __init__(self, data_dir: Path) -> None:
        self.root = data_dir / "image_fingerprints"
        self.root.mkdir(parents=True, exist_ok=True)
        self.index_path = self.root / "index.jsonl"

    def register(
        self,
        *,
        character_id: str,
        owner_id: str,
        image_path: Path,
        source: str = "upload",
    ) -> dict[str, Any]:
        phash = compute_phash(image_path)
        content_hash = hashlib.sha256(phash.encode()).hexdigest()[:32]
        record = {
            "character_id": character_id,
            "owner_id": owner_id,
            "phash": phash,
            "content_hash": content_hash,
            "source": source,
            "image_name": image_path.name,
        }
        out_path = self.root / f"{content_hash}.json"
        out_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        with self.index_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        collision = self.find_similar_phash(phash, exclude_owner=owner_id)
        return {
            "ok": True,
            "phash": phash,
            "content_hash": content_hash,
            "collision": collision,
            "blocked": collision is not None,
        }

    def find_similar_phash(
        self,
        phash: str,
        *,
        exclude_owner: str | None = None,
    ) -> dict[str, Any] | None:
        if not self.index_path.is_file():
            return None
        for line in self.index_path.read_text(encoding="utf-8").strip().splitlines():
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if exclude_owner and record.get("owner_id") == exclude_owner:
                continue
            other = str(record.get("phash", ""))
            if phash_similarity(phash, other) >= SIMILARITY_THRESHOLD:
                return record
        return None

    def check_before_generation(
        self,
        image_path: Path,
        *,
        owner_id: str = "local",
    ) -> dict[str, Any]:
        phash = compute_phash(image_path)
        collision = self.find_similar_phash(phash, exclude_owner=owner_id)
        return {
            "ok": collision is None,
            "phash": phash,
            "blocked": collision is not None,
            "collision": collision,
            "threshold": SIMILARITY_THRESHOLD,
        }