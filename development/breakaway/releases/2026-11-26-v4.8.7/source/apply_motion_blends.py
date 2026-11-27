#!/usr/bin/env python3
"""Rebuild V4.8.7 from the exact V4.8.6 source using the checked-in patch."""
from pathlib import Path
import hashlib, subprocess, shutil
root=Path(__file__).resolve().parent.parent
base=root/'source'/'baseline-v4.8.6.html'
patch=root/'source'/'renderer.patch'
out=root/'source'/'reproduced-v4.8.7.html'
if shutil.which('patch') is None:
    raise SystemExit('Install the standard patch utility first.')
subprocess.run(['patch','--batch','-o',str(out),str(base),'-i',str(patch)],check=True)
sha=hashlib.sha256(out.read_bytes()).hexdigest()
expected='81ed2080bbe91473c8c003f4a178fa4297e8bd057fd8459a7905739cfd4571ce'
if sha!=expected:
    raise SystemExit(f'Wrong output hash {sha}; expected {expected}')
print('Rebuilt exact V4.8.7 from V4.8.6:',out,sha)
