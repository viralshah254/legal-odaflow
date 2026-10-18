"""Resume state for long JustDial city sweeps."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def progress_path(data_dir: Path) -> Path:
    return data_dir / "checkpoints" / "justdial.progress.json"


def load_progress(data_dir: Path) -> dict[str, Any]:
    path = progress_path(data_dir)
    if not path.exists():
        return {"city_index": 0, "path_index": 0, "page": 1}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"city_index": 0, "path_index": 0, "page": 1}


def save_progress(
    data_dir: Path,
    *,
    city_index: int,
    path_index: int,
    page: int,
    city: str | None = None,
    records: int = 0,
) -> None:
    path = progress_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "city_index": city_index,
        "path_index": path_index,
        "page": page,
        "city": city,
        "records": records,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def clear_progress(data_dir: Path) -> None:
    progress_path(data_dir).unlink(missing_ok=True)
