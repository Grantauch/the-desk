#!/usr/bin/env python3
"""Phase 22 staging-only preflight, payload builder and deployed-byte verification.
No deploy, no production credential access, no promotion. Python 3.10+.
"""
import argparse, hashlib, ipaddress, json, re, sys, zipfile
from pathlib import Path
from urllib.parse import urlsplit, urljoin
from urllib.request import Request, build_opener, HTTPRedirectHandler
from concurrent.futures import ThreadPoolExecutor

ARCHIVE_SHA = '8dbfcded2940a03849c95ebed6c986940d865bbd495e0217dbe9251af4f980e7'
ROOT = 'ManifestDeck1848_Phase22/'
PRODUCTION = ('grant-desk.com', 'www.grant-desk.com')
HEADERS = b'/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\' data:; connect-src \'self\'; object-src \'none\'; base-uri \'self\'; frame-ancestors \'none\'\n'
ROBOTS = b'User-agent: *\nDisallow: /\n'

def digest(b): return hashlib.sha256(b).hexdigest()
def require(test, msg):
    if not test: raise ValueError(msg)

def candidate(path):
    path=Path(path)
    require(digest(path.read_bytes())==ARCHIVE_SHA,'Candidate ZIP does not match Phase 22 issue #585')
    with zipfile.ZipFile(path) as z:
        require(len(z.namelist())==677 and len(set(z.namelist()))==677 and z.testzip() is None,'Archive inventory or CRC failed')
        baseline=json.loads(z.read(ROOT+'PHASE22_FROZEN_BASELINE.json'))
        files=baseline['files']
        require(len(files)==211 and sum(k.endswith('.webp') for k in files)==198,'Frozen file count mismatch')
        require(all(re.fullmatch(r'game/(?:[a-zA-Z0-9_]+\.(?:js|html)|art/[a-zA-Z0-9_]+\.webp)',k) for k in files),'Unexpected frozen path')
        result={k.removeprefix('game/'):z.read(ROOT+k) for k in files}
        require(all(digest(result[k.removeprefix('game/')])==v for k,v in files.items()),'Frozen gameplay/art mismatch')
    # Pilot observation tools and every raw evidence / source file stay out of public payload.
    return result

def payload(path):
    game=candidate(path)
    manifest={'schema':'manifest-phase22-stage-v1','archive_sha256':ARCHIVE_SHA,'files':{k:digest(v) for k,v in sorted(game.items())}}
    return {**game,'_headers':HEADERS,'robots.txt':ROBOTS,'phase22-build.json':(json.dumps(manifest,sort_keys=True,indent=2)+'\n').encode()}

def build(path,out):
    out=Path(out); require(not out.exists(),'Output must be new; no overwrite')
    require(not any(p.lower() in {'public','dist','production','manifest-1848','manifest-expanse-1848'} for p in out.resolve().parts),'Do not build into a production or shared web tree')
    data=payload(path); out.mkdir(parents=True)
    for name,content in data.items():
        p=out/name; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(content)
    return {'status':'PAYLOAD_READY_NOT_DEPLOYED','game_files':211,'total_files':len(data),'archive_sha256':ARCHIVE_SHA,'manifest_sha256':digest(data['phase22-build.json'])}

def authorize(doc):
    require(doc.get('archive_sha256')==ARCHIVE_SHA,'Authorization is not for this candidate')
    require(doc.get('purpose')=='STAGING_ONLY' and doc.get('production_approved') is False,'No production authorization accepted')
    for k in ('owner_approval_ref','rollback_ref','staging_site_id','source_commit'):
        require(isinstance(doc.get(k),str) and doc[k].strip() and doc[k]!='PENDING',f'Missing {k}')
    require(re.fullmatch(r'[0-9a-f]{40}',doc['source_commit']) is not None,'Source commit must be a full SHA')
    require(doc.get('isolated_origin_confirmed') is True and doc.get('access_controls_confirmed') is True,'Separate origin and protected access must be confirmed by operator')
    u=urlsplit(doc['origin']); host=u.hostname or ''
    require(u.scheme=='https' and u.netloc==host and u.path in ('','/') and not u.query and not u.fragment,'Use exact HTTPS DNS origin, no port, path, credentials or parameters')
    require(host==doc.get('authorized_host') and '.' in host and re.fullmatch(r'[a-z0-9.-]+',host),'Exact approved DNS hostname required')
    require(not any(host==x or host.endswith('.'+x) for x in PRODUCTION) and not host.endswith(('.localhost','.local','.internal','.test','.invalid')),'Production/local hostname prohibited')
    try: ipaddress.ip_address(host)
    except ValueError: pass
    else: raise ValueError('IP address prohibited')
    require('staging' in host or 'preview' in host or 'phase22' in host,'Dedicated staging hostname must be identifiable')
    return 'https://'+host+'/'

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

def verify(path,approval):
    base=authorize(approval); expected=payload(path)
    def one(item):
        name,content=item; url=urljoin(base,name)
        req=Request(url,headers={'Cache-Control':'no-cache','User-Agent':'ManifestPhase22StagingGate/1'})
        with build_opener(NoRedirect()).open(req,timeout=15) as response:
            require(response.status==200 and response.geturl()==url,'Response is not exact authorized resource')
            observed=response.read(len(content)+1)
            require(digest(observed)==digest(content),f'Deployed bytes differ: {name}')
            if name=='index.html':
                require('noindex' in response.headers.get('X-Robots-Tag','').lower(),'Missing noindex header')
                require('no-store' in response.headers.get('Cache-Control','').lower(),'Missing no-store header')
                require("frame-ancestors 'none'" in response.headers.get('Content-Security-Policy',''),'Missing frame protection')
        return name
    files={k:v for k,v in expected.items() if k!='_headers'} # platform config, not a public resource
    with ThreadPoolExecutor(max_workers=6) as pool: checked=list(pool.map(one,sorted(files.items())))
    return {'status':'DEPLOYED_BYTES_PASS_NOT_RELEASE_APPROVAL','origin':base,'source_commit':approval['source_commit'],'archive_sha256':ARCHIVE_SHA,'verified_files':len(checked),'native_browser':'NOT_RUN','adult_playtest':'NOT_RUN','production':'BLOCKED'}

def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('command',choices=['build','verify']); p.add_argument('--zip',required=True); p.add_argument('--out'); p.add_argument('--approval'); p.add_argument('--report',required=True); a=p.parse_args()
    try:
        if a.command=='build': require(a.out,'--out required'); result=build(a.zip,a.out)
        else: require(a.approval,'--approval required'); result=verify(a.zip,json.loads(Path(a.approval).read_text()))
        rc=0
    except Exception as e: result={'status':'BLOCKED_OR_FAILED','error':str(e),'production':'BLOCKED'}; rc=1
    report=Path(a.report); report.write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps(result,indent=2)); return rc
if __name__=='__main__': sys.exit(main())
