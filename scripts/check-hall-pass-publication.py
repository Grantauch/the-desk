#!/usr/bin/env python3
"""Read-only Hall Pass publication gate. No approval is inferred or written."""
import json
import re
from pathlib import Path
from zipfile import BadZipFile, ZipFile

ROOT = Path(__file__).resolve().parent.parent
POLICY = Path("distribution/hall-pass-teacher-kit/VERSION.json")


def public_files(directory: Path):
    # iterdir propagates unreadable-directory errors rather than silently skipping.
    for entry in directory.iterdir():
        if entry.is_symlink():
            raise ValueError("Symlinks under public/ cannot be checked safely.")
        if entry.is_dir():
            yield from public_files(entry)
        elif entry.is_file():
            yield entry
        else:
            raise ValueError("Unsupported file type under public/.")


def check_publication(root: Path) -> None:
    policy = json.loads((root / POLICY).read_text(encoding="utf-8"))
    if not isinstance(policy, dict):
        raise ValueError("Approval metadata must be an object.")
    approved = policy.get("distributionApproved")
    if type(approved) is not bool:
        raise ValueError("distributionApproved must be an explicit boolean.")
    public = root / "public"
    if not public.is_dir() or public.is_symlink():
        raise ValueError("Missing or symlinked public/ tree.")
    blocked = []
    for entry in public_files(public):
        if entry.suffix.lower() != ".zip":
            continue
        hall_pass = bool(re.search(r"hall[\s_-]*pass", entry.relative_to(public).as_posix(), re.I))
        if not hall_pass:
            try:
                with ZipFile(entry) as archive:
                    for member in archive.infolist():
                        if Path(member.filename).name.lower() != "version.json":
                            continue
                        if member.file_size > 65536:
                            raise ValueError("ZIP version metadata is too large to check safely.")
                        version = json.loads(archive.read(member))
                        if re.search(r"hall[\s_-]*pass", str(version.get("name", "")), re.I):
                            hall_pass = True
            except (BadZipFile, json.JSONDecodeError, UnicodeError, RuntimeError, AttributeError) as error:
                raise ValueError("Public ZIP metadata cannot be checked safely.") from error
        if hall_pass and not approved:
            blocked.append(entry.relative_to(root).as_posix())
    if blocked:
        raise ValueError("Hall Pass ZIP publication blocked: distributionApproved is false: " + ", ".join(sorted(blocked)))


if __name__ == "__main__":
    try:
        check_publication(ROOT)
        print("Hall Pass publication guard: PASS")
    except (OSError, ValueError) as error:
        raise SystemExit("Hall Pass publication guard: FAIL CLOSED: " + str(error))
