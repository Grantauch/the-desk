#!/usr/bin/env python3
"""SW-177 deterministic, allowlisted, synthetic-only teacher preview ZIP.

No student records or real access credentials can be passed as inputs.
The package is NOT a live Hall Pass installer.
"""
from __future__ import annotations
import argparse
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

VERSION = "0.1.0-prelaunch"
FILE_NAME = "Schoolwide_Teacher_Prelaunch_v0.1.0.zip"
ASSETS = ("START-HERE.html", "START-HERE.txt")
ARCHIVE_ASSETS = (*ASSETS, "PACKAGE-MANIFEST.json")
FIXED_DATE = (2026, 1, 1, 0, 0, 0)


def source_root() -> Path:
    return Path(__file__).resolve().parent.parent / "teacher-kit"


def manifest_for(assets: dict[str, bytes]) -> bytes:
    return (json.dumps({
        "format": 1,
        "kit_version": VERSION,
        "release_authority": "TRAINING_ONLY_NOT_STUDENT_FACING",
        "network_access": False,
        "live_credentials": False,
        "student_data": False,
        "assets": [
            {"file": name, "size": len(assets[name]),
             "sha256": sha256(assets[name]).hexdigest()}
            for name in sorted(assets)
        ],
    }, sort_keys=True, indent=2) + "\n").encode("utf-8")


def build(destination: Path) -> None:
    assets: dict[str, bytes] = {}
    for name in ASSETS:
        source = source_root() / name
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Required teacher preview source missing or unsafe: {name}")
        data = source.read_bytes()
        if not data or len(data) > 250_000:
            raise ValueError(f"Unsafe preview source size: {name}")
        assets[name] = data
    html = assets["START-HERE.html"].decode("utf-8")
    for forbidden in ("fetch(", "XMLHttpRequest", "navigator.sendBeacon",
                      "localStorage", "sessionStorage", "http://", "https://",
                      "<iframe", "<form", "<script src="):
        if forbidden.lower() in html.lower():
            raise ValueError(f"Forbidden network/credential pattern: {forbidden}")
    if "PRE-LAUNCH" not in html or "TRAINING ONLY" not in html:
        raise ValueError("Preview must visibly warn against student use")
    assets["PACKAGE-MANIFEST.json"] = manifest_for(assets)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, mode="w", compression=ZIP_DEFLATED, compresslevel=9) as z:
        for name in sorted(assets):
            info = ZipInfo(name, FIXED_DATE)
            info.compress_type = ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            z.writestr(info, assets[name], compress_type=ZIP_DEFLATED, compresslevel=9)
    verify(destination)


def verify(destination: Path) -> None:
    with ZipFile(destination, "r") as archive:
        names = archive.namelist()
        if names != sorted(ARCHIVE_ASSETS):
            raise ValueError(f"Unexpected archive members: {names}")
        if any(info.is_dir() or info.date_time != FIXED_DATE
               or info.file_size > 250_000 for info in archive.infolist()):
            raise ValueError("Invalid teacher preview archive member")
        manifest = json.loads(archive.read("PACKAGE-MANIFEST.json"))
        if (manifest.get("kit_version") != VERSION
            or manifest.get("release_authority") != "TRAINING_ONLY_NOT_STUDENT_FACING"
            or manifest.get("network_access") is not False
            or manifest.get("live_credentials") is not False
            or manifest.get("student_data") is not False):
            raise ValueError("Invalid prelaunch safety manifest")
        actual = []
        for name in sorted(ASSETS):
            data = archive.read(name)
            actual.append({"file": name, "size": len(data),
                           "sha256": sha256(data).hexdigest()})
        if manifest.get("assets") != actual:
            raise ValueError("Preview file SHA-256 verification failed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path,
                        default=Path(__file__).resolve().parent.parent / "out" / FILE_NAME)
    parser.add_argument("--verify", action="store_true",
                        help="Verify the existing archive without modifying it")
    args = parser.parse_args()
    if args.verify:
        verify(args.out)
    else:
        build(args.out)
    print(f"TEACHER_PRELAUNCH_KIT_PASS: {args.out.name}, SHA256={sha256(args.out.read_bytes()).hexdigest()}, training_only=true")


if __name__ == "__main__":
    main()
