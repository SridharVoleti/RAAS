import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

import portalocker


@dataclass(frozen=True)
class JsonStore:
    data_dir: str

    def _path(self, name: str) -> str:
        return os.path.join(self.data_dir, name)

    def read(self, name: str, default: Dict[str, Any]) -> Dict[str, Any]:
        os.makedirs(self.data_dir, exist_ok=True)
        path = self._path(name)
        parent_dir = os.path.dirname(path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)

        if not os.path.exists(path):
            self.write(name, default)
            return default

        with portalocker.Lock(path, mode="r", timeout=5, encoding="utf-8") as f:
            raw = f.read().strip()
            if not raw:
                return default
            return json.loads(raw)

    def read_optional(self, name: str) -> Optional[Dict[str, Any]]:
        os.makedirs(self.data_dir, exist_ok=True)
        path = self._path(name)
        parent_dir = os.path.dirname(path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)

        if not os.path.exists(path):
            return None

        with portalocker.Lock(path, mode="r", timeout=5, encoding="utf-8") as f:
            raw = f.read().strip()
            if not raw:
                return None
            return json.loads(raw)

    def write(self, name: str, data: Dict[str, Any]) -> None:
        os.makedirs(self.data_dir, exist_ok=True)
        path = self._path(name)
        parent_dir = os.path.dirname(path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        tmp_path = f"{path}.tmp"

        encoded = json.dumps(data, ensure_ascii=False, indent=2)

        with portalocker.Lock(tmp_path, mode="w", timeout=5, encoding="utf-8") as f:
            f.write(encoded)

        os.replace(tmp_path, path)
