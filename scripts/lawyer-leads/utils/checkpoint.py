"""JSONL checkpoint read/write for resumable scrapes."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


def checkpoint_path(data_dir: Path, source: str) -> Path:
    return data_dir / "raw" / f"{source}.jsonl"


def record_count(data_dir: Path, source: str) -> int:
    return len(load_records(data_dir, source))


def is_complete(data_dir: Path, source: str) -> bool:
    """Source is done only if flag exists AND we saved at least one record."""
    flag = data_dir / "checkpoints" / f"{source}.done"
    if not flag.exists():
        return False
    return record_count(data_dir, source) > 0


def mark_complete(data_dir: Path, source: str) -> None:
    done_dir = data_dir / "checkpoints"
    done_dir.mkdir(parents=True, exist_ok=True)
    (done_dir / f"{source}.done").touch()


def clear_checkpoints(data_dir: Path, source: str | None = None) -> None:
    """Remove done flags and raw JSONL so scrapers re-run."""
    raw_dir = data_dir / "raw"
    done_dir = data_dir / "checkpoints"
    sources = [source] if source else None
    if raw_dir.exists():
        for path in raw_dir.glob("*.jsonl"):
            if sources is None or path.stem in sources:
                path.unlink(missing_ok=True)
    if done_dir.exists():
        for path in done_dir.glob("*.done"):
            if sources is None or path.stem in sources:
                path.unlink(missing_ok=True)


def append_record(data_dir: Path, source: str, record: dict[str, Any]) -> None:
    path = checkpoint_path(data_dir, source)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def load_records(data_dir: Path, source: str) -> list[dict[str, Any]]:
    path = checkpoint_path(data_dir, source)
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows
