#!/usr/bin/env python3
from pathlib import Path
import hashlib,subprocess,shutil
root=Path(__file__).resolve().parent.parent
base=root/'source'/'baseline-v4.8.7.html'
patch=root/'source'/'renderer.patch'
out=root/'source'/'reproduced-v4.8.8.html'
assert shutil.which('patch'), 'Install the system patch command'
subprocess.run(['patch','--batch','-o',str(out),str(base),'-i',str(patch)],check=True)
expect='1f9bcc89d94f96b1265ff0678272c9c33e354564f09c20e29b96bdf6cea2a9a9'
actual=hashlib.sha256(out.read_bytes()).hexdigest()
assert actual==expect,f'Build differs: {actual}'
print('PASS exact V4.8.8',actual)
