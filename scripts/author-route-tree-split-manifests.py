"""Intentional authoring companion. Run after building Route Tree A/B pages."""
import json
from copy import deepcopy
from pathlib import Path
from hashlib import sha256
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'public/storyhub/bts/route-tree/assets'
STORIES=ROOT/'storyhub/stories/BTS'
BASE='/storyhub/bts/route-tree/assets/'
def read(p):return json.loads(p.read_text())
def write(p,j):p.write_text(json.dumps(j,indent=2,ensure_ascii=False)+'\n')
rights=read(ASSETS/'ci-rights.json')
rights['checkedAt']='2026-11-18'
rights['scope']='Six Cinematic Ink scenes, ten authentic player anchors and dated historical context photography across two balanced alternative assignments and the preserved full edition.'
review={'anatomy':'Reviewed source and final optimized frame: plausible posture, hands and directed attention. Generated small detail remains interpretation.','lighting':'Ordinary diffuse outdoor light; monochrome Lane source retains its tonal structure.','style':'Selective hand ink, localized halftone and controlled dimensional rendering; the source photograph remains independently available.','accuracyLimit':'Exact young likeness, gestures and surface details are interpretive. No generated detail becomes new historical evidence.'}
newart=[{'id':'C05','stem':'unitas-sandlot','classification':'artistic reconstruction','sourceIds':['P05'],'license':'CC BY-SA 2.0; adapted from the John Mathew Smith / Kingkongphoto likeness photograph. This derivative is shared under CC BY-SA 2.0.','licenseUrl':'https://creativecommons.org/licenses/by-sa/2.0/','modifications':'AI-assisted younger likeness and imagined Pittsburgh sideline, 1955. Pose, clothing, teammate, bench and field are reconstructed. Resized WebP variants.','historicalReview':'Packers historian Cliff Christl and the Unitas family biography support Steelers release, construction work, Bloomfield Rams and a February 1956 Colts invitation. Accounts differ on sandlot pay, so no exact wage is asserted here. A 1996 portrait is a likeness reference, not proof of the imagined 1955 moment.','deployPaths':[BASE+f'ci-unitas-sandlot-{w}.webp' for w in [640,1024,1536]],'review':review,'commercialStatus':'Source license permits commercial reuse with attribution and share-alike. No blanket personality, endorsement or merchandise clearance claimed.'},
{'id':'C06','stem':'lane-recovery-ink','classification':'source-derived overpainting','sourceIds':['P04'],'license':'Public domain in the United States: Los Angeles Daily News publication without copyright notice. AI-assisted ink interpretation of that source.','modifications':'AI-assisted monochrome ink rendering of the September 3, 1953 composition. Fine face, hand and ball details are interpreted; unmodified resized source is separately available.','historicalReview':'Original caption identifies Lane as number 81 at center right in Rams–49ers preseason play, September 3, 1953, Los Angeles Coliseum. This is not the 1952 office visit. Original source governs inference; illustration cannot establish new detail.','deployPaths':[BASE+f'ci-lane-recovery-ink-{w}.webp' for w in [640,1024,1536]],'review':review,'commercialStatus':'US public-domain basis recorded. International commercial redistribution requires territorial review; no blanket worldwide clearance claimed.'}]
rights['artworks']=[x for x in rights['artworks'] if x['id'] not in ['C05','C06']]+newart
for x in rights['sources']:
    if x.get('key')=='lane':x['deployPaths']=list(dict.fromkeys(x['deployPaths']+[BASE+f'ci-lane-photo-{w}.webp' for w in [640,1024]]))
for x in rights['artworks']:
    if x['id'] in ['C05','C06']:
        x['optimizedSha256']={p:sha256((ROOT/'public'/p.lstrip('/')).read_bytes()).hexdigest() for p in x['deployPaths']}
rights['historicalSources']=[x for x in rights.get('historicalSources',[]) if not isinstance(x,dict) or x.get('id') not in ['UNITAS-CHRISTL','UNITAS-FAMILY']]+[
 {'id':'UNITAS-CHRISTL','url':'https://www.packers.com/news/1955-nfl-draft-oral-history-end-of-around-the-clock-marathon-drafts','role':'Packers historian oral history: 1955 draft/cut, sandlot work, February 1956 Colts signing.'},
 {'id':'UNITAS-FAMILY','url':'https://www.johnnyunitas.com/about','role':'Family biography: construction work, Bloomfield Rams and the Colts invitation; pay differs from the earlier page, so the split edition avoids an exact amount.'}]
write(ASSETS/'ci-rights.json',rights)

catalog=read(STORIES/'ROUTETREE/assets.json')
catalog['assets']=[x for x in catalog['assets'] if x['id'] not in ['C05','C06'] and not x['id'].startswith('N')]
for art in newart:
    catalog['assets'].append({'id':art['id'],'status':'shipped','type':'illustration','role':art['stem'],'sourceMode':art['classification'],'subject':art['historicalReview'],'rightsStatus':art['license'],'provenance':'Source IDs, original checksums, artistic modifications, review and optimized hashes in /storyhub/bts/route-tree/assets/ci-rights.json.','htmlSafeZone':'Dates, captions, labels and controls remain HTML.','responsiveCrop':'Complete frame in responsive 640, 1024 and 1536px WebP variants.','deployPath':art['deployPaths'][-1]})
for source in rights['retainedContextSources']:
    if 'naturalDeployPaths' not in source:continue
    catalog['assets'].append({'id':'N'+source['id'][1:],'status':'shipped','type':'photograph','role':'Natural photographic context: '+source['name'],'sourceMode':'source-first-archival','subject':source['name']+'; historical context, not a photograph of the player.','rightsStatus':source['license'],'provenance':source['sourceUrl']+'; original SHA256 '+source['originalSha256']+'. Original attribution and territorial limits retained in ci-rights.json.','htmlSafeZone':'Full source, dated context and license in the caption.','responsiveCrop':'Full frame, natural photographic color or monochrome, 640 and 1100px WebP.','deployPath':source['naturalDeployPaths'][-1]})
write(STORIES/'ROUTETREE/assets.json',catalog)

balance=read(STORIES/'ROUTETREE/assignment-balance.json')
people=read(ROOT/'public/storyhub/bts/route-tree/people/people.json')
for letter in ['A','B']:
    directory=STORIES/('ROUTETREE'+letter);storyid='BTS-ROUTETREE'+letter
    dna=read(directory/'story-dna.json')
    dna['identity']['interactionSignature']=['Read five Start / Door / Result route strips','Compare original photographic evidence with labeled illustration','Explore the approximate 1,000-player funnel','Check five evidence claims with explanation','Write three responses using shared account saving and Turn In']
    dna['assignmentContract']['players']=balance['variants'][letter]['players'];write(directory/'story-dna.json',dna)
    page=BeautifulSoup((ROOT/f'public/hubs/bts-route-tree-{letter.lower()}.html').read_text(),'html.parser')
    used={BASE+p.split(BASE)[-1] for p in __import__('re').findall(r'/storyhub/bts/route-tree/assets/[A-Za-z0-9._-]+',str(page))}
    selected=[deepcopy(x) for x in catalog['assets'] if x.get('deployPath') in used or any(x.get('deployPath','')==p.replace('-640.webp','-1536.webp').replace('-1024.webp','-1536.webp') for p in used)]
    ids={x['id'] for x in selected}
    chapters=[]
    for key in balance['variants'][letter]['players']:
        p=people[key];anchor=next(x['id'] for x in rights['sources'] if x.get('key')==key)
        chapters.append({'id':'case-'+key,'title':p['name'] if 'name' in p else key.title(),'claim':page.select_one('#case-'+key+' .route-metaphor').get_text(' ',strip=True),'namedPeople':[{'name':p.get('name',key.title()),'role':'NFL case','anchorStatus':'anchored','visualAnchorId':anchor}],'visualAnchorIds':[anchor],'interactionIds':[]})
    for ident,title,claim,i in [('odds','Keep the odds in view','Selected successful careers are not a representative sample.','S1'),('image-evidence','Read the picture like a historian','A dated photograph, a documented account and an illustrated interpretation support different kinds of inference.','S2'),('evidence-calls','Does the evidence support it?','Claims need dates, chronology and scope.','S3'),('other-sport','One cross-sport connection','Readiness and an opportunity both matter outside football.','S4'),('responses','Three responses, about 300 words','Use historical evidence to explain an unexpected route.','S5')]:
        chapters.append({'id':ident,'title':title,'claim':claim,'namedPeople':[],'visualAnchorIds':[],'interactionIds':[i]})
    write(directory/'story.json',{'schemaVersion':1,'storyId':storyid,'course':'BTS','lessonCode':'ROUTETREE'+letter,'title':'The Route Tree — Assignment '+letter,'audience':'students','narrativeQuestion':balance['commonQuestion'],'chapters':chapters,'assignmentContract':dna['assignmentContract']})
    write(directory/'assets.json',{'schemaVersion':1,'storyId':storyid,'assets':selected})
    ints=[]
    for i,ch,kind,teach,action,feedback,fallback in [
      ('S1','odds','cohort-funnel','Put exceptional careers beside an approximate opportunity denominator.','Select high school, college or draft.','Highlight the relevant dots and explain the cohort limitation.','The dated numerical comparison and its caveat remain readable.'),
      ('S2','image-evidence','source-comparison','Distinguish source observation from visual interpretation.','Use source disclosures and the photographic comparison when present.','Dates, untouched source and explicit reconstruction limits.','Native details and source captions; B begins with the authentic Lane photograph.'),
      ('S3','evidence-calls','claim-check','Match five claims to the record and its limits.','Choose Supported, Contradicted or Needs context.','Explain the evidence and permit revision.','Native Read the evidence check disclosures.'),
      ('S4','other-sport','cross-sport-comparison','Transfer an explanation beyond the NFL sample.','Read the case and the dated context image.','A connection statement links preparation and opportunity.','All prose and the context image are visible.'),
      ('S5','responses','written-response','Build '+('guided comparisons' if letter=='A' else 'independent arguments with source criticism')+'.','Write three 90–110 word responses.','Word counts and shared account saving / Turn In.','Native labeled textareas; A includes optional scaffolding.')]:
        ints.append({'id':i,'chapterId':ch,'type':kind,'teaches':teach,'studentAction':action,'feedback':feedback,'staticFallback':fallback,'identityFit':'Readable documentary evidence and playbook route language.','status':'implemented'})
    write(directory/'interactions.json',{'schemaVersion':1,'storyId':storyid,'interactions':ints})
    (directory/'sources.md').write_text('# Route Tree Assignment '+letter+' sources\n\nHistorical prose is partitioned from the published full edition at commit 705f56d139ab925203c70e8bbb7f628ff4511b74. The original edition and answer identity remain at `/hubs/bts-route-tree-full-reference.html`.\n\nSee `../ROUTETREE/sources.md` for the primary historical records and `../ROUTETREE/split-production.md` for the exact grouping and workload. Every source photograph, contextual date, creator, license and source hash is recorded in `/storyhub/bts/route-tree/assets/ci-rights.json` and linked inline. No generated scene is an archival photograph. Unitas’s 1955 scene is a reconstruction using a later CC BY-SA 2.0 likeness; Lane’s 1953 ink frame is an interpretation of a public-domain-in-the-US photograph. Territorial and endorsement limits remain explicit.\n')

release=read(ROOT/'storyhub/releases/BTS-ROUTETREE.json')
release['derivedFrom']['note']='Two equal alternative assignments, guided A and more independent B; the complete earlier assignment keeps its original account identity. Six labeled Cinematic Ink scenes and natural source photography.'
paths={x['path']:x for x in release['files']}
for file in list(ASSETS.glob('ci-context-*.webp'))+list(ASSETS.glob('ci-unitas-sandlot-*.webp'))+list(ASSETS.glob('ci-lane-photo-*.webp'))+list(ASSETS.glob('ci-lane-recovery-ink-*.webp'))+list(ASSETS.glob('assignments.*'))+list((ROOT/'public/hubs').glob('bts-route-tree-*.html')):
    p='/'+file.relative_to(ROOT/'public').as_posix();paths.setdefault(p,{'path':p})
for asset in catalog['assets']:
    if asset.get('deployPath') in paths:paths[asset['deployPath']]['assetId']=asset['id']
release['files']=list(paths.values());release['assignmentRoutes']=['/hubs/bts-route-tree-a.html','/hubs/bts-route-tree-b.html'];release['preservedRoute']='/hubs/bts-route-tree-full-reference.html'
write(ROOT/'storyhub/releases/BTS-ROUTETREE.json',release)
print('Authored A/B story manifests, explicit image rights and collection release paths.')
