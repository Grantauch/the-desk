#!/usr/bin/env python3
"""Dry-run validation of schoolwide cafeteria IDs; never publishes student records.

Input is the school's alternating two-line layout: lunch number, student name.
Optional verified mapping is a private CSV with cafeteria_number, school_email.
Matching is exact by cafeteria number, never by a guessed student name.
No student names, lunch codes, or emails are printed or persisted by this tool.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

PIN = re.compile(r"^[0-9]{5,6}$")
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_directory(text: str, mapping: str | None = None, domain: str = "") -> dict:
    lines = [(n, line.strip()) for n, line in enumerate(text.splitlines(), 1) if line.strip()]
    if len(lines) % 2:
        raise ValueError("The list has an odd number of non-empty lines. Expect number/name pairs.")
    items = []
    issues = []
    for i in range(0, len(lines), 2):
        number_line, number = lines[i]
        name_line, name = lines[i + 1]
        if not PIN.fullmatch(number):
            issues.append(f"Line {number_line}: expected an exact five- or six-digit cafeteria number")
        if not name or "," not in name or len(name) > 160:
            issues.append(f"Line {name_line}: missing or invalid comma-separated student name")
        if PIN.fullmatch(number) and name and "," in name:
            items.append((number, name))
    duplicates = [n for n, count in Counter(number for number, _ in items).items() if count > 1]
    if duplicates:
        issues.append(f"{len(duplicates)} cafeteria numbers appear more than once")
    names = Counter(" ".join(name.lower().split()) for _, name in items)
    repeated_names = sum(1 for count in names.values() if count > 1)
    if repeated_names:
        issues.append(f"{repeated_names} names appear more than once; resolve identities separately")

    verified_emails = set()
    map_entries = 0
    if mapping is not None:
        reader = csv.DictReader(mapping.splitlines())
        required = {"cafeteria_number", "school_email"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            raise ValueError("Verified mapping CSV requires cafeteria_number and school_email headers.")
        mapped_numbers = {}
        for line_no, row in enumerate(reader, 2):
            number = str(row.get("cafeteria_number") or "").strip()
            email = str(row.get("school_email") or "").strip().lower()
            if not PIN.fullmatch(number) or not EMAIL.fullmatch(email):
                issues.append(f"Mapping line {line_no}: malformed cafeteria number or school email")
                continue
            if domain and email.split("@")[-1] != domain.lower().lstrip("@"):
                issues.append(f"Mapping line {line_no}: school email domain mismatch")
                continue
            if number in mapped_numbers and mapped_numbers[number] != email:
                issues.append(f"Mapping line {line_no}: conflicting school-email mapping")
                continue
            mapped_numbers[number] = email
        if len(set(mapped_numbers.values())) != len(mapped_numbers):
            issues.append("One school email is mapped to multiple cafeteria numbers")
        available = {num for num, _ in items}
        verified_emails = available.intersection(mapped_numbers)
        map_entries = len(mapped_numbers)
        if set(mapped_numbers) - available:
            issues.append("Verified mapping contains cafeteria IDs absent from the schoolwide list")
    can_provision = not issues and mapping is not None and len(verified_emails) == len(items)
    return {
        "total_pair_rows": len(lines) // 2,
        "valid_student_records": len(items),
        "five_digit_records": sum(len(num) == 5 for num, _ in items),
        "six_digit_records": sum(len(num) == 6 for num, _ in items),
        "leading_zero_six_digit_records": sum(len(num) == 6 and num.startswith("0") for num, _ in items),
        "verified_email_mappings": len(verified_emails),
        "mapping_csv_entries": map_entries,
        "unverified_students": len(items) - len(verified_emails),
        "default_activation": "INACTIVE",
        "ready_for_authorized_staging": bool(can_provision),
        "issue_count": len(issues),
        "issues": issues[:30],
        "privacy": "Student names, cafeteria numbers and emails are not printed or written",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Private alternating number/name text file")
    parser.add_argument("--verified-mapping", type=Path, help="Private CSV: cafeteria_number,school_email")
    parser.add_argument("--student-email-domain", default="", help="Expected student email domain")
    args = parser.parse_args()
    text = args.source.read_text(encoding="utf-8-sig")
    mapping = args.verified_mapping.read_text(encoding="utf-8-sig") if args.verified_mapping else None
    print(json.dumps(validate_directory(text, mapping, args.student_email_domain), indent=2))


if __name__ == "__main__":
    main()
