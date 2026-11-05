#!/usr/bin/env python3
"""Build a deterministic Hall Pass teacher setup ZIP with the complete program.

Only explicitly listed public source files and teacher instructions are packaged.
Private directory data, deployment credentials and runtime settings are excluded.
"""
from __future__ import annotations
import hashlib
import json
import tempfile
import argparse
import re
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / "distribution" / "hall-pass-teacher-kit"
WHITELIST = ("Start Here.html", "Preflight.html", "preflight.js", "Smoke-Test.md", "README.md", "School-IT-Checklist.md", "VERSION.json", "Recovery.md", "verify.py")
VERSION = "1.0.0-rc.2"
DESTINATION = Path(tempfile.gettempdir()) / f"HallPass-Teacher-Installer-v{VERSION}.zip"

SOURCE_PATHS = {
    "Code.gs": "apps-script/hall-pass/Code.gs", "Index.html": "apps-script/hall-pass/Index.html",
    "ReleaseChecks.gs": "apps-script/hall-pass/ReleaseChecks.gs", "ReleaseCheck.html": "apps-script/hall-pass/ReleaseCheck.html",
    "appsscript.json": "apps-script/hall-pass/appsscript.json", "Setup.gs": "apps-script/hall-pass-template/Setup.gs",
    "SetupWizard.html": "apps-script/hall-pass-template/SetupWizard.html",
}

def build(destination: Path = DESTINATION) -> Path:
    destination = destination.resolve()
    # This builder only produces review candidates. Publishing is a separate gate.
    public = (ROOT / "public").resolve()
    if destination == public or public in destination.parents:
        raise SystemExit("Candidate output must stay outside public/. Field acceptance and release approval are pending.")
    if not PACKAGE.is_dir():
        raise SystemExit("Missing teacher-kit source folder.")
    actual = tuple(sorted(p.name for p in PACKAGE.iterdir()))
    if actual != tuple(sorted(WHITELIST)):
        raise SystemExit("Refusing to package unknown files in the teacher-kit source folder.")
    data = json.loads((PACKAGE / "VERSION.json").read_text(encoding="utf-8"))
    if data.get("version") != VERSION or data.get("status") != "RELEASE_CANDIDATE" or data.get("distributionApproved") is not False or data.get("productionCutoverAuthorized") is not False:
        raise SystemExit("Version metadata is not the expected preview release.")
    if any((PACKAGE / name).is_symlink() for name in WHITELIST) or any((ROOT / name).is_symlink() for name in SOURCE_PATHS.values()):
        raise SystemExit("Refusing symlinked package inputs.")
    files = {name: (PACKAGE / name).read_bytes() for name in WHITELIST}
    files.update({"source/" + name: (ROOT / relative).read_bytes() for name, relative in SOURCE_PATHS.items()})
    manifest = json.loads(files["source/appsscript.json"])
    if manifest.get("webapp") != {"executeAs": "USER_DEPLOYING", "access": "DOMAIN"}:
        raise SystemExit("Refusing a package without school-domain / deploying-owner access.")
    for value in files.values():
        if re.search(rb"https://script\.google\.com/(?:a/macros/[a-z0-9.-]+/|macros/)s/[A-Za-z0-9_-]{20,}/exec|ya29\.[A-Za-z0-9_-]{20,}|1//[A-Za-z0-9_-]{40,}", value):
            raise SystemExit("Refusing an embedded deployment endpoint or Google credential in package input.")
    app_version = re.search(r"const GD_HALL_PASS_VERSION = '([^']+)';", files["source/Code.gs"].decode())[1]
    if data.get("applicationVersion") != app_version:
        raise SystemExit("Application version does not match the packaged program.")
    source_manifest = {"packageVersion": VERSION, "applicationVersion": app_version,
        "files": {name: hashlib.sha256(value).hexdigest() for name, value in files.items() if name.startswith("source/")},
        "normalization": "UTF-8, CRLF to LF, remove trailing LF characters; editor comparison only",
        "normalizedFiles": {name: hashlib.sha256(value.replace(b"\r\n", b"\n").rstrip(b"\n")).hexdigest() for name, value in files.items() if name.startswith("source/")}}
    files["SOURCE-MANIFEST.json"] = (json.dumps(source_manifest, indent=2) + "\n").encode()
    sha_lines = [f"{hashlib.sha256(value).hexdigest()}  {name}" for name, value in files.items()]
    files["MANIFEST.sha256"] = ("\n".join(sha_lines) + "\n").encode("utf-8")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name, value in files.items():
            info = ZipInfo(name, date_time=(2026, 11, 4, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, value, compress_type=ZIP_DEFLATED, compresslevel=9)
    with ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise SystemExit("ZIP integrity check failed.")
        if tuple(archive.namelist()) != tuple(files):
            raise SystemExit("ZIP contents differ from approved file list.")
        for name, value in files.items():
            if archive.read(name) != value:
                raise SystemExit("ZIP round-trip check failed: " + name)
    return destination

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DESTINATION, help="Private candidate output; never public/.")
    args = parser.parse_args()
    destination = build(args.output)
    print("BUILT: " + str(destination))
    print("SHA256: " + hashlib.sha256(destination.read_bytes()).hexdigest())
    print("STATUS: RELEASE_CANDIDATE — NOT APPROVED FOR DISTRIBUTION OR PRODUCTION CUTOVER")

if __name__ == "__main__":
    main()
