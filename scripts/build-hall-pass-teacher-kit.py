#!/usr/bin/env python3
"""Build a deterministic, PII-free Hall Pass teacher preview ZIP.

The schoolwide credential installer is not yet implemented. This builder
packages only the approved standalone setup launcher and documentation.
"""
from __future__ import annotations
import hashlib
import json
import tempfile
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / "distribution" / "hall-pass-teacher-kit"
WHITELIST = ("Start Here.html", "README.md", "School-IT-Checklist.md", "VERSION.json")
VERSION = "0.1.0-preview"
DESTINATION = Path(tempfile.gettempdir()) / f"HallPass-Teacher-Installer-v{VERSION}.zip"

def main() -> None:
    if not PACKAGE.is_dir():
        raise SystemExit("Missing teacher-kit source folder.")
    actual = tuple(sorted(p.name for p in PACKAGE.iterdir()))
    if actual != tuple(sorted(WHITELIST)):
        raise SystemExit(f"Refusing to package unknown files: {actual!r}")
    data = json.loads((PACKAGE / "VERSION.json").read_text(encoding="utf-8"))
    if data.get("version") != VERSION or data.get("status") != "NOT_PRODUCTION_READY":
        raise SystemExit("Version metadata is not the expected preview release.")
    files = {name: (PACKAGE / name).read_bytes() for name in WHITELIST}
    sha_lines = [f"{hashlib.sha256(value).hexdigest()}  {name}" for name, value in files.items()]
    files["MANIFEST.sha256"] = ("\n".join(sha_lines) + "\n").encode("utf-8")
    with ZipFile(DESTINATION, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name, value in files.items():
            info = ZipInfo(name, date_time=(2026, 11, 4, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, value, compress_type=ZIP_DEFLATED, compresslevel=9)
    with ZipFile(DESTINATION) as archive:
        if archive.testzip() is not None:
            raise SystemExit("ZIP integrity check failed.")
        if tuple(archive.namelist()) != tuple(files):
            raise SystemExit("ZIP contents differ from approved file list.")
        for name, value in files.items():
            if archive.read(name) != value:
                raise SystemExit("ZIP round-trip check failed: " + name)
    print("BUILT: " + str(DESTINATION))
    print("FILES: " + ", ".join(files.keys()))
    print("SHA256: " + hashlib.sha256(DESTINATION.read_bytes()).hexdigest())
    print("STATUS: NOT_PRODUCTION_READY")

if __name__ == "__main__":
    main()
