#!/usr/bin/env python3
"""Synthetic negative checks for the exact-archive school IT verifier."""
import importlib.util
import json
import tempfile
import unittest
import warnings
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded

builder = module('kit_builder', ROOT / 'scripts/build-hall-pass-teacher-kit.py')
verifier = module('kit_verifier', ROOT / 'distribution/hall-pass-teacher-kit/verify.py')

class CandidateSafetyTests(unittest.TestCase):
    def test_archive_mutations_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = builder.build(Path(temp) / 'candidate.zip')
            self.assertEqual(verifier.verify(archive)['fieldEvidence'], 'NOT_SUPPLIED')
            with ZipFile(archive) as original:
                files = {name: original.read(name) for name in original.namelist()}
            for mutation in ['missing','changed','extra','duplicate','path_escape','broken_manifest']:
                with self.subTest(mutation=mutation):
                    altered = dict(files)
                    if mutation == 'missing': del altered['source/Code.gs']
                    if mutation == 'changed': altered['source/Code.gs'] = b'SYNTHETIC TAMPERING'
                    if mutation == 'extra': altered['not-approved.txt'] = b'SYNTHETIC'
                    if mutation == 'path_escape': altered['../not-approved.txt'] = b'SYNTHETIC'
                    if mutation == 'broken_manifest': altered['MANIFEST.sha256'] = b'invalid'
                    bad = Path(temp) / 'bad.zip'
                    with warnings.catch_warnings():
                        warnings.simplefilter('ignore', UserWarning)
                        with ZipFile(bad, 'w', compression=ZIP_DEFLATED) as out:
                            for name, data in altered.items(): out.writestr(name, data)
                            if mutation == 'duplicate': out.writestr('source/Code.gs', files['source/Code.gs'])
                    with self.assertRaises(ValueError): verifier.verify(bad)

    def test_evidence_cannot_change_approval(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = builder.build(Path(temp) / 'candidate.zip')
            checked = verifier.verify(archive)
            evidence = {'evidenceSchema': 1, 'packageVersion': builder.VERSION,
                'applicationVersion': '1.0.0-rc.1', 'zipSha256': checked['zipSha256'],
                'manifestSha256': checked['manifestSha256'], 'integrity': 'PASS',
                'evidenceType': 'OPERATOR_RECORDED_NOT_INDEPENDENTLY_VERIFIED',
                'distributionApproved': False, 'productionCutoverAuthorized': False,
                'results': [{'id': name, 'result': 'PASS'} for name in verifier.CASES]}
            record = Path(temp) / 'record.json'
            record.write_text(json.dumps(evidence))
            self.assertFalse(verifier.verify(archive, record)['distributionApproved'])
            for mutation in ['distributionApproved','productionCutoverAuthorized','fingerprint','duplicate_case']:
                changed = json.loads(json.dumps(evidence))
                if mutation in ['distributionApproved','productionCutoverAuthorized']: changed[mutation] = True
                if mutation == 'fingerprint': changed['zipSha256'] = '0' * 64
                if mutation == 'duplicate_case': changed['results'][0] = changed['results'][1]
                record.write_text(json.dumps(changed))
                with self.assertRaises(ValueError): verifier.verify(archive, record)

if __name__ == '__main__': unittest.main()
