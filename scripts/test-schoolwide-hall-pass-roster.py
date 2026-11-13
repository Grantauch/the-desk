#!/usr/bin/env python3
"""Synthetic-only regression tests for the private schoolwide directory validator."""
import importlib.util
from pathlib import Path
import unittest
import json

MODULE = Path(__file__).with_name("validate-schoolwide-hall-pass-roster.py")
SPEC = importlib.util.spec_from_file_location("hall_pass_roster_validator", MODULE)
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)

SYNTHETIC = "41234\nExample, Anna\n012345\nExample, Ben\n"
COMPLETE = "cafeteria_number,school_email\n41234,anna@students.example.edu\n012345,ben@students.example.edu\n"


class DirectorySafetyTests(unittest.TestCase):
    def test_exact_5_and_leading_zero_6(self):
        data = VALIDATOR.validate_directory(SYNTHETIC)
        self.assertEqual(data["five_digit_records"], 1)
        self.assertEqual(data["six_digit_records"], 1)
        self.assertEqual(data["leading_zero_six_digit_records"], 1)
        self.assertEqual(data["default_activation"], "INACTIVE")
        self.assertFalse(data["ready_for_authorized_staging"])

    def test_mapping_requires_exact_identity(self):
        data = VALIDATOR.validate_directory(SYNTHETIC, COMPLETE, "students.example.edu")
        self.assertTrue(data["ready_for_authorized_staging"])
        self.assertEqual(data["verified_email_mappings"], 2)
        self.assertEqual(data["unverified_students"], 0)

    def test_missing_mapping_keeps_everything_inactive(self):
        partial = "cafeteria_number,school_email\n41234,anna@students.example.edu\n"
        data = VALIDATOR.validate_directory(SYNTHETIC, partial, "students.example.edu")
        self.assertEqual(data["unverified_students"], 1)
        self.assertFalse(data["ready_for_authorized_staging"])

    def test_duplicates_and_malformed_identifiers_fail_closed(self):
        repeated = VALIDATOR.validate_directory("41234\nExample, Anna\n41234\nExample, Ben\n")
        self.assertGreater(repeated["issue_count"], 0)
        invalid = VALIDATOR.validate_directory("1234\nExample, Anna\n")
        self.assertGreater(invalid["issue_count"], 0)

    def test_bad_domain_and_privacy(self):
        data = VALIDATOR.validate_directory(SYNTHETIC, COMPLETE, "other.example.edu")
        self.assertFalse(data["ready_for_authorized_staging"])
        output = json.dumps(data)
        for secret in ("41234", "012345", "Anna", "Ben", "anna@", "ben@"):
            self.assertNotIn(secret, output)


if __name__ == "__main__":
    unittest.main(verbosity=2)
