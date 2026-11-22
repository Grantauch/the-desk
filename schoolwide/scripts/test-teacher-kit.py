#!/usr/bin/env python3
"""SW-177 offline teacher-kit packaging and privacy-contract checks."""
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
BUILDER = ROOT / "scripts" / "build-teacher-kit.py"
HTML = ROOT / "teacher-kit" / "START-HERE.html"


class DocumentTags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def run(*args):
    return subprocess.run([sys.executable, str(BUILDER), *map(str, args)],
                          check=True, capture_output=True, text=True)


class TeacherKitTests(unittest.TestCase):
    def test_auditable_offline_html(self):
        source = HTML.read_text(encoding="utf-8")
        parser = DocumentTags()
        parser.feed(source)
        steps = [x for tag, x in parser.tags if x.get("data-step-button") is not None]
        pages = [x for tag, x in parser.tags if x.get("data-page") is not None]
        inputs = [x for tag, x in parser.tags if tag == "input"]
        self.assertEqual(sorted(x["data-step-button"] for x in steps), list("012345"))
        self.assertEqual(sorted(x["data-page"] for x in pages), list("012345"))
        self.assertEqual(len([x for x in inputs if x.get("type") == "checkbox"]), 5)
        self.assertFalse([x for tag, x in parser.tags if tag in {"iframe", "form"}])
        self.assertFalse([x for tag, x in parser.tags if tag in {"img", "link"} and (x.get("src") or x.get("href"))])
        self.assertIn("default-src 'none'", source)
        self.assertIn("connect-src 'none'", source)
        self.assertIn("SW-REAL-001", source)
        self.assertIn("SW-REAL-003", source)
        self.assertIn("Run offline device self-check", source)
        self.assertIn("15 seconds after starting", source)
        self.assertIn("window.print()", source)
        self.assertIn("visibilitychange", source)
        self.assertIn("pagehide", source)
        self.assertIn("window.addEventListener('blur',resetDemo)", source)
        self.assertIn("setTimeout(resetDemo,15000)", source)
        self.assertIn("PRE-LAUNCH", source)
        self.assertIn("TRAINING ONLY", source)
        self.assertIn("five- and six-digit", source.lower())
        for forbidden in ("fetch(", "XMLHttpRequest", "localStorage",
                          "sessionStorage", "sendBeacon", "http://",
                          "https://", "studentToken", "PIN_SALT"):
            self.assertNotIn(forbidden.lower(), source.lower())

    def test_deterministic_zip_and_sha_manifest(self):
        with tempfile.TemporaryDirectory(prefix="sw177-kit-") as tmp:
            first, second = Path(tmp) / "kit-a.zip", Path(tmp) / "kit-b.zip"
            run("--out", first)
            run("--out", second)
            self.assertEqual(sha256(first.read_bytes()).hexdigest(),
                             sha256(second.read_bytes()).hexdigest())
            run("--out", first, "--verify")
            with ZipFile(first) as archive:
                self.assertEqual(archive.namelist(),
                                 ["PACKAGE-MANIFEST.json", "START-HERE.html", "START-HERE.txt"])
                manifest = json.loads(archive.read("PACKAGE-MANIFEST.json"))
                self.assertEqual(manifest["kit_version"], "0.2.0-prelaunch")
                self.assertEqual(manifest["release_authority"], "TRAINING_ONLY_NOT_STUDENT_FACING")
                self.assertFalse(manifest["student_data"])
                self.assertFalse(manifest["live_credentials"])
                self.assertFalse(manifest["network_access"])
                for entry in manifest["assets"]:
                    data = archive.read(entry["file"])
                    self.assertEqual(entry["size"], len(data))
                    self.assertEqual(entry["sha256"], sha256(data).hexdigest())

    def test_modified_archive_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix="sw177-kit-") as tmp:
            original = Path(tmp) / "good.zip"
            altered = Path(tmp) / "bad.zip"
            run("--out", original)
            with ZipFile(original) as src, ZipFile(altered, "w", compression=ZIP_DEFLATED) as dst:
                for info in src.infolist():
                    data = src.read(info.filename)
                    if info.filename == "START-HERE.txt":
                        data += b"UNEXPECTED CHANGE"
                    dst.writestr(info, data)
            result = subprocess.run(
                [sys.executable, str(BUILDER), "--out", str(altered), "--verify"],
                capture_output=True, text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("verification failed", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
