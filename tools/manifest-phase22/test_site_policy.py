import tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from staging_gate import ARCHIVE_SHA, build, payload, verify, NoRedirect
from site_policy import authorize_dedicated, SITE_ID, HOST, ORIGIN

class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.doc = dict(archive_sha256=ARCHIVE_SHA, purpose="STAGING_ONLY",
            production_approved=False, owner_approval_ref="fixture-only",
            rollback_ref="fixture-only", source_commit="a"*40, staging_site_id=SITE_ID,
            isolated_origin_confirmed=True, access_controls_confirmed=True,
            team_login_all_deploys_confirmed=True, origin=ORIGIN, authorized_host=HOST)
    def test_exact_site(self):
        self.assertEqual(authorize_dedicated(self.doc), ORIGIN)
    def test_fail_closed(self):
        for delta in (
            {"staging_site_id":"wrong-site"}, {"origin":"https://grant-desk.com/","authorized_host":"grant-desk.com"},
            {"origin":"https://other-preview.netlify.app/","authorized_host":"other-preview.netlify.app"},
            {"origin":ORIGIN+"other"}, {"origin":ORIGIN.replace("https","http")},
            {"origin":ORIGIN.replace(HOST,HOST+".evil.com"),"authorized_host":HOST+".evil.com"},
            {"team_login_all_deploys_confirmed":False}, {"access_controls_confirmed":False},
            {"isolated_origin_confirmed":False}, {"production_approved":True}, {"owner_approval_ref":"PENDING"},
            {"rollback_ref":""}, {"archive_sha256":"0"*64}, {"source_commit":"main"}):
            with self.subTest(delta=delta), self.assertRaises(ValueError):
                authorize_dedicated({**self.doc, **delta})
    def test_invalid_site_before_io(self):
        with patch("staging_gate.payload") as read, patch("staging_gate.build_opener") as network:
            with self.assertRaises(ValueError):
                verify("not-a-file", {**self.doc,"staging_site_id":"wrong"})
            read.assert_not_called()
            network.assert_not_called()
    def test_bad_archive(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"fake.zip"; p.write_bytes(b"tampered")
            with self.assertRaises(ValueError): payload(p)
    def test_protected_output(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)
            for out in (p,p/"public"/"stage",p/"production"/"stage"):
                with self.assertRaises(ValueError): build("not-a-file",out)
    def test_no_redirect(self):
        self.assertIsNone(NoRedirect().redirect_request(None,None,302,"Found",{},ORIGIN))
if __name__ == "__main__":
    unittest.main(verbosity=2)
