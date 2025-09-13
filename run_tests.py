#!/usr/bin/env python3
"""Run pytest programmatically to ensure output in environments where CLI output is suppressed."""

import sys
from pathlib import Path

def main() -> int:
    try:
        import pytest  # type: ignore
    except Exception as exc:  # noqa: BLE001
        print(f"❌ pytest not available: {exc}")
        return 2

    # Ensure project root and python_backend are on sys.path
    project_root = Path(__file__).parent
    sys.path.insert(0, str(project_root))

    # Default to run smoke first, then prices tests with verbose logs
    args = [
        "-vv",
        "-s",
        "-rA",
        str(project_root / "python_backend" / "tests" / "test_smoke.py"),
        str(project_root / "python_backend" / "tests" / "test_prices_api.py"),
    ]

    print("➡️ Running pytest with args:", " ".join(args))
    rc = pytest.main(args)
    print(f"➡️ pytest exit code: {rc}")
    return int(rc)


if __name__ == "__main__":
    raise SystemExit(main())


