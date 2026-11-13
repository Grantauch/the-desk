#!/usr/bin/env python3
"""School IT: python verify.py /private/path/candidate.zip [--evidence /private/path/record.json].

Read-only, standard-library-only. Prints no filenames supplied by users, student data,
Google URLs or credentials. Integrity is not release approval or an origin signature.
"""
import argparse
import hashlib
import json
import re
import sys
from zipfile import ZipFile

VERSION = '1.0.0-rc.2'
PAYLOAD = {'Start Here.html','Preflight.html','preflight.js','Smoke-Test.md','README.md',
    'School-IT-Checklist.md','VERSION.json','Recovery.md','verify.py','SOURCE-MANIFEST.json',
    'source/Code.gs','source/Index.html','source/ReleaseChecks.gs','source/ReleaseCheck.html',
    'source/appsscript.json','source/Setup.gs','source/SetupWizard.html'}
CASES = {'clean_environment','two_school_accounts','source_integrity','domain_policy','directory_privacy',
    'inactive_default','exact_shared_pin','teacher_boundaries','pass_return','screen_privacy','throttling',
    'revocation','network_recovery','rollback_history','district_authorization','update_model'}

def require(value):
    if not value:
        raise ValueError('Invalid candidate')

def verify(archive_path, evidence_path=None):
    with open(archive_path, 'rb') as stream:
        zip_hash = hashlib.sha256(stream.read()).hexdigest()
    with ZipFile(archive_path) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        require(len(names) == len(set(names)) and set(names) == PAYLOAD | {'MANIFEST.sha256'})
        require(all(entry.file_size < 4_000_000 and not entry.flag_bits & 1 for entry in entries))
        require(sum(entry.file_size for entry in entries) < 12_000_000)
        require(archive.testzip() is None)
        files = {name: archive.read(name) for name in names}
    hashes = {}
    for line in files['MANIFEST.sha256'].decode('utf-8').splitlines():
        match = re.fullmatch(r'([a-f0-9]{64})  (.+)', line)
        require(match and match[2] in PAYLOAD and match[2] not in hashes)
        hashes[match[2]] = match[1]
    require(set(hashes) == PAYLOAD)
    require(all(hashlib.sha256(files[name]).hexdigest() == digest for name, digest in hashes.items()))
    version = json.loads(files['VERSION.json'])
    require(version['version'] == VERSION and version['applicationVersion'] == '1.0.0-rc.1')
    require(version['status'] == 'RELEASE_CANDIDATE' and version['studentDataIncluded'] is False)
    require(version['distributionApproved'] is False and version['productionCutoverAuthorized'] is False)
    source = json.loads(files['SOURCE-MANIFEST.json'])
    require(source['packageVersion'] == VERSION and source['applicationVersion'] == version['applicationVersion'])
    require(source['files'] == {name: value for name, value in hashes.items() if name.startswith('source/')})
    require(source['normalizedFiles'] == {name: hashlib.sha256(files[name].replace(b'\r\n', b'\n').rstrip(b'\n')).hexdigest() for name in hashes if name.startswith('source/')})
    summary = {'integrity': 'PASS', 'packageVersion': VERSION, 'zipSha256': zip_hash,
        'manifestSha256': hashlib.sha256(files['MANIFEST.sha256']).hexdigest(),
        'fieldEvidence': 'NOT_SUPPLIED', 'distributionApproved': False, 'productionCutoverAuthorized': False}
    if evidence_path:
        with open(evidence_path, encoding='utf-8') as stream:
            evidence = json.load(stream)
        require(evidence.get('evidenceSchema') == 1 and evidence.get('packageVersion') == VERSION)
        require(evidence.get('zipSha256') == zip_hash and evidence.get('manifestSha256') == summary['manifestSha256'])
        require(evidence.get('integrity') == 'PASS' and evidence.get('applicationVersion') == version['applicationVersion'])
        require(evidence.get('distributionApproved') is False and evidence.get('productionCutoverAuthorized') is False)
        require(evidence.get('evidenceType') == 'OPERATOR_RECORDED_NOT_INDEPENDENTLY_VERIFIED')
        results = evidence.get('results', [])
        require(len(results) == len(CASES) and {row['id'] for row in results} == CASES)
        require(all(row['result'] in {'NOT_RUN','PASS','FAIL','BLOCKED'} for row in results))
        summary['fieldEvidence'] = 'OPERATOR_REPORT_ALL_PASS' if all(row['result'] == 'PASS' for row in results) else 'INCOMPLETE_OR_BLOCKED'
        summary['checksNeedingAttention'] = sum(row['result'] != 'PASS' for row in results)
    # A checksum/report cannot override the outstanding update architecture or approve a release.
    summary['automaticSoftwareUpdates'] = version['automaticSoftwareUpdates']
    return summary

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('--evidence')
    args = parser.parse_args()
    try:
        summary = verify(args.archive, args.evidence)
    except Exception:
        print('FAILED: package or evidence could not be verified. Re-extract the trusted candidate; do not use it.', file=sys.stderr)
        return 1
    print(json.dumps(summary, indent=2))
    return 2 if args.evidence and summary['fieldEvidence'] != 'OPERATOR_REPORT_ALL_PASS' else 0

if __name__ == '__main__':
    sys.exit(main())
