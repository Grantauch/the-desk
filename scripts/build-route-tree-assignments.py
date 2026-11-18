"""Author the two alternative Route Tree assignments from the preserved full edition.

Run intentionally after editing this file. Verification never rebuilds authored pages.
Original student account identity stays on the preserved complete edition.
"""
from pathlib import Path
from copy import deepcopy
import html
import json
import re
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / 'public'
ASSETS = PUB / 'storyhub/bts/route-tree/assets'
BASE = '/storyhub/bts/route-tree/assets/'
STORIES = ROOT / 'storyhub/stories/BTS'
REFERENCE = PUB / 'hubs/bts-route-tree-full-reference.html'
ENTRY = PUB / 'hubs/bts-the-route-tree.html'
if not REFERENCE.exists():
    REFERENCE.write_text(ENTRY.read_text())
original = BeautifulSoup(REFERENCE.read_text(), 'html.parser')
people = json.loads((PUB/'storyhub/bts/route-tree/people/people.json').read_text())
rights = json.loads((ASSETS/'ci-rights.json').read_text())
root_assets = json.loads((STORIES/'ROUTETREE/assets.json').read_text())
root_story = json.loads((STORIES/'ROUTETREE/story.json').read_text())

NAMES = {'unitas':'Johnny Unitas','papale':'Vince Papale','lewis':'Michael Lewis','gates':'Antonio Gates','mailata':'Jordan Mailata','lane':'Night Train Lane','bleier':'Rocky Bleier','warner':'Kurt Warner','neal':'Stephen Neal','aubrey':'Brandon Aubrey'}
META = {'unitas':(1955,0,'Hitch','Cut by his hometown team','An invitation from Baltimore','1958 NFL champion'), 'papale':(1976,9,'Go','Teacher, track athlete and WFL receiver','An invited Eagles workout','Special teams captain'), 'lewis':(2001,1,'Flat','Delivery driver, no college','A hometown Saints tryout','Record return yardage'), 'gates':(2003,6,'Dig','Kent State basketball player','An NFL scouting workout','Hall of Fame, 2025'), 'mailata':(2018,8,'Post','Australian rugby league prospect','International Player Pathway','Super Bowl LIX champion'), 'lane':(1952,2,'Slant','Army veteran at an aircraft plant','A scrapbook and a walk-in','14 interceptions as a rookie'), 'bleier':(1969,3,'Comeback','NFL rookie, then wounded soldier','A team willing to wait','Four Super Bowl rings'), 'warner':(1994,4,'Curl','Cut quarterback stocking shelves','Arena football and NFL Europe','NFL and Super Bowl MVP'), 'neal':(2001,5,'Out','World champion wrestler','A private football workout','Three Super Bowl rings'), 'aubrey':(2023,7,'Corner','Soccer player, then software engineer','Practice and the USFL','First 35 NFL field goals made')}
CONTEXT = {'papale':'A03','unitas':'A07','gates':'A11','mailata':'A12','lane':'A05','bleier':'A08','warner':'A09','neal':'A10','aubrey':'A13','morris':'A15','ayres':'A14'}
PICKS = {'unitas':'102 · 1955','papale':'Not drafted','lewis':'Not drafted','gates':'Not drafted','mailata':'233 · 2018','lane':'Not drafted','bleier':'417 · 1968','warner':'Not drafted','neal':'Not drafted','aubrey':'Not drafted'}
GROUPS = {'A':['unitas','papale','lewis','gates','mailata'],'B':['lane','bleier','warner','neal','aubrey']}
TITLES = {'A':'Find the open door','B':'Test the explanation'}
CLAIMS = {
 'A':[
  ('Papale never played college football.','Supported','He attended Saint Joseph’s on a track scholarship; the university had no football team. His later WFL experience still matters.'),
  ('Being cut by the Steelers ended Unitas’s football career.','Contradicted','He kept playing sandlot football, joined Baltimore in 1956 and led the Colts to the 1958 title.'),
  ('Michael Lewis took the usual college-football route into the NFL.','Contradicted','He never went to college. His path included delivery work, semipro and arena football, NFL Europe and a Saints tryout.'),
  ('Papale’s route can be described simply as teacher to NFL player.','Needs context','Those endpoints are real, but the shorthand hides semipro football and two Philadelphia Bell seasons before the invited 1976 Eagles workout.'),
  ('Mailata was drafted before he had played a down of American football.','Supported','The Eagles selected him in 2018 through a route involving the International Player Pathway; he then spent two years learning to block.')],
 'B':[
  ('The draft always identified which of these players would become successful.','Contradicted','Lane, Warner, Neal and Aubrey were not drafted into the NFL. Their cases are counterexamples to the word always.'),
  ('Lane’s rookie season provides evidence of immediate NFL success.','Supported','He intercepted 14 passes in 12 games in 1952. That dated performance supports the limited claim about his rookie season.'),
  ('Warner went from a grocery store to Super Bowl MVP.','Needs context','The compressed arc omits Arena Football, NFL Europe, a Rams backup season and Trent Green’s injury. Chronology alone does not explain causation.'),
  ('Neal’s wrestling titles meant he had no football skills left to learn.','Contradicted','He had to learn guard play, was cut, spent time on Philadelphia’s practice squad and returned to New England. Athletic transfer did not erase the learning.'),
  ('Aubrey was an athlete before he became an NFL kicker.','Supported','His Notre Dame soccer championship and later professional soccer career establish that. His 2018 photograph records soccer, not an NFL kicking appearance.')]
}
PROMPTS = {
 'A':[
  ('Compare two doors.','Choose two of your five NFL players. For each, identify the obstacle, the person or program that opened a door, and one fact with a date or number. Explain one similarity and one difference between their routes.','Start: “For ___, the obstacle was ___. The door opened when ___ in ___. By contrast, ___.” Use the Start / Door / Result strips to find your evidence.'),
  ('Separate the movie, the record and the picture.','Papale’s route was more complicated than “teacher gets a tryout.” Explain what that shorthand leaves out, using two written facts. Then explain one thing the imagined camp illustration cannot prove.','Include the Philadelphia Bell and the invitation to work out. A reconstruction can help you picture a setting, but it cannot authenticate the coach’s words or that particular exchange.'),
  ('Draw your next step in words.','Choose a realistic goal of your own and one player as a comparison. Describe an obstacle, a door that could help, and what you would do after a setback. Connect your plan to two real facts from the player’s story.','Use four moves: my goal; the obstacle; the door and who might open it; my next step if I get cut. Explain the historical connection instead of only saying “never give up.”')],
 'B':[
  ('Defend an explanation.','Which better explains unexpected NFL entry: individual preparation, institutional opportunity, or contingency? Make a claim using two of your five players, include two dated or numerical facts, and address a plausible counterargument.',''),
  ('Audit the visual evidence.','Compare Lane’s original photograph and ink interpretation with Warner’s reconstructed night shift. Explain what each visual can establish and what needs written evidence. Use two specific dated details and explain why a convincing image is not automatically proof.',''),
  ('Challenge the sample.','Do these exceptional careers show that NFL opportunity is fair? Use the odds panel and two of your cases to make an argument. Acknowledge a limit of this five-player sample, then propose one concrete improvement to how teams discover or develop talent.','')]
}

def esc(text): return html.escape(str(text), quote=True)
def image(path, alt, lazy=True, cls=''):
    local=PUB/path.lstrip('/')
    w,h=Image.open(local).size
    variants=[]
    m=re.search(r'-(640|1024|1100|1536)\.webp$',path)
    if m:
        prefix=path[:m.start()]
        for width in [640,1024,1100,1536]:
            candidate=prefix+f'-{width}.webp'
            if (PUB/candidate.lstrip('/')).exists(): variants.append(f'{candidate} {width}w')
    srcset=f' srcset="{esc(", ".join(variants))}" sizes="(max-width: 900px) 100vw, 1100px"' if len(variants)>1 else ''
    return f'<img src="{path}"{srcset} width="{w}" height="{h}" alt="{esc(alt)}" class="{cls}" '+('loading="lazy" decoding="async"' if lazy else 'fetchpriority="high" decoding="async"')+'>'

def credit(key):
    p=people[key]
    out=esc(p['credit'])+f' <a href="{esc(p["creditUrl"])}">Source</a> · <a href="{esc(p["licenseUrl"])}">License</a>'
    if key=='papale':out+=' · <a href="https://philipnelson.org">Philip Nelson</a>'
    return out

def portrait(key):
    p=people[key];path=BASE+Path(p['file']).name
    return '<figure class="portrait">'+image(path,p.get('alt') or p['caption'])+f'<figcaption>{esc(p["caption"])}<p class="source-credit">{credit(key)}</p></figcaption></figure>'

def context(key):
    if key not in CONTEXT:
        return '''<figure class="context-packet"><svg viewBox="0 0 600 180" role="img" aria-label="Lewis’s symbolic career route: delivery work, hometown tryout, record returns."><path d="M60 90H540" stroke="#526f64" stroke-width="5" fill="none"/><g fill="#e4bf78" stroke="#172a24" stroke-width="3"><circle cx="60" cy="90" r="18"/><circle cx="300" cy="90" r="18"/><circle cx="540" cy="90" r="18"/></g><g font-family="Arial" font-size="17" fill="#172a24" text-anchor="middle"><text x="80" y="145">Delivery work</text><text x="300" y="55">Hometown tryout</text><text x="515" y="145">Record returns</text></g></svg><figcaption><span class="context-label">Career diagram · not a street map</span>Lewis’s delivery route passed near the Superdome. The diagram shows stages of his career, not a measured New Orleans route.</figcaption></figure>'''
    item=next(x for x in rights['retainedContextSources'] if x['id']==CONTEXT[key])
    path=(item.get('naturalDeployPaths') or item.get('deployPaths') or [item.get('deployPath', BASE+'ci-gates-arena-1100.webp')])[-1]
    caption=item.get('caption',item['name']).split('Photo:')[0].split('Postcard by')[0].strip()
    caption=re.sub(r'\s+',' ',caption)
    author=(item.get('author','')+' · ' if item.get('author') else '')+item.get('license','Source record governs reuse')
    alt=item['name']+'. Historical context image, not a photograph of the player.'
    return '<details class="context-packet"><summary>Open the historical context image</summary><figure>'+image(path,alt)+f'<figcaption><span class="context-label">Historical context · check its date</span>{esc(caption)}<p class="source-credit">{esc(author)}. Original photographic color or monochrome retained; resized as WebP. <a href="{esc(item["sourceUrl"])}">Source</a> · <a href="{esc(item.get("licenseUrl",item["sourceUrl"]))}">License record</a>.</p></figcaption></figure></details>'

def figure(key, hero=False):
    if key in ['papale','warner','bleier']:
        sec=original.select_one('#reel' if key=='papale' else '#u-'+key)
        fig=BeautifulSoup(str(sec.select_one('.cinema-scene')),'html.parser').figure
        fig['class']=['film-frame']
        for badge in fig.select('.art-kind'):badge['class']=['figure-kind']
        for oldid in fig.select('[id]'):oldid['id']='split-'+oldid['id']
        for label in fig.select('label[for]'):label['for']='split-'+label['for']
        return str(fig)
    if key=='unitas':
        pic=image(BASE+'ci-unitas-sandlot-1024.webp','Artistic reconstruction of young Johnny Unitas changing from work boots into cleats beside a teammate in Pittsburgh, 1955.',not hero)
        return '<figure class="'+('hero-art' if hero else 'film-frame')+'">'+pic+'''<figcaption><div><span class="figure-kind">Artistic reconstruction · 1955</span><h3>The job did not end the game.</h3></div><div><p>An imagined sideline moment after construction work, during Unitas’s sandlot season. The pose, young likeness, teammate, clothing and field are interpreted, not an authenticated event.</p><p class="source-credit">Likeness reference: John Mathew Smith / Kingkongphoto’s 1996 portrait, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a>. AI-assisted reconstruction shared under that license. <a href="https://commons.wikimedia.org/wiki/File:Johnny_Unitas.jpg">Photo record</a> · <a href="https://www.packers.com/news/1955-nfl-draft-oral-history-end-of-around-the-clock-marathon-drafts">Historical account</a>.</p></div></figcaption></figure>'''
    if key=='lane':
        if hero:
            return '<figure class="hero-art">'+image(BASE+'ci-lane-recovery-ink-1024.webp','Ink interpretation of the authentic 1953 fumble-recovery photograph; Lane is number 81, center right.',False)+'''<figcaption><span class="figure-kind">Source-derived overpainting · 1953</span>A documented fumble recovery, September 3, 1953—not the 1952 tryout. Source: Los Angeles Daily News, public domain in the US. AI-assisted ink interpretation; small face, hand and ball details are interpreted. <a href="https://commons.wikimedia.org/wiki/File:Night_Train_Lane_fumble_recovery_1953.jpg">Source and territorial limits</a>.</figcaption></figure>'''
        photo=image(BASE+'ci-lane-photo-1024.webp','Original September 3, 1953 photograph. Lane is number 81 at center right, reaching toward the fumble.')
        ink=image(BASE+'ci-lane-recovery-ink-1024.webp','Cinematic Ink interpretation of the same 1953 frame. Generated fine details remain interpretations.')
        return '<figure class="film-frame" data-ink-compare><div class="ink-stage" style="--ink-reveal:0%">'+photo+'<div class="ink-layer">'+ink+'''</div></div><figcaption><div><span class="figure-kind">Photograph / ink interpretation · 1953</span><h3>The source gets the first word.</h3></div><div><p>Lane is number 81, center right, in the September 3, 1953 Rams–49ers preseason photograph. The ink version interprets its surfaces and small details; generated faces, hands and ball detail do not add evidence.</p><p class="source-credit">Unknown photographer / Los Angeles Daily News. Public domain in the United States; international commercial redistribution requires territorial review. <a href="https://commons.wikimedia.org/wiki/File:Night_Train_Lane_fumble_recovery_1953.jpg">Original record and rights</a>.</p></div></figcaption><div class="ink-controls" hidden data-desk-skip><label for="split-lane-reveal">Compare the source photograph with its ink interpretation</label><input id="split-lane-reveal" type="range" min="0" max="100" value="0" aria-valuetext="0% ink interpretation, 100% source photograph" data-desk-skip><span class="compare-ends"><span>Source photograph</span><span>Ink interpretation</span></span></div><details class="source-note"><summary>Read the source limits</summary><p>The date and identity come from the original caption. A football photograph records one moment, not Lane’s entire career or his 1952 office visit. The overpainting can help direct attention, but the untouched photograph governs factual inference.</p></details></figure>'''
    return ''

def case(key):
    sec=original.select_one('#reel' if key=='papale' else '#u-'+key)
    story=sec.select_one('.story')
    paras=[str(p) for p in story.find_all('p',recursive=False)]
    if key=='unitas':paras=[p.replace('for $6 a game','for only a few dollars a game') for p in paras]
    if key=='papale':paras.append('<p><em>Invincible</em> compresses this route. The movie omits the Philadelphia Bell seasons and turns an invited workout into an open-tryout story. A clearer underdog plot is not the same thing as a complete historical account.</p>')
    quote=sec.select_one('blockquote.quote')
    if quote:
        quote=deepcopy(quote);quote['class']=['reading-quote']
    else:quote=''
    year,num,route,start,door,result=META[key]
    why=sec.select_one('.why') or sec.select_one('.intro')
    why_text=why.get_text(' ',strip=True) if why else ''
    art=figure(key) if key in ['papale','unitas','lane','bleier','warner'] else ''
    beats=''.join(f'<li><svg viewBox="0 0 80 40" aria-hidden="true"><path d="M5 34H38V10H73" fill="none" stroke="#526f64" stroke-width="3"/><circle cx="5" cy="34" r="4" fill="#172a24"/><path d="M66 4l8 6-8 6" fill="none" stroke="#846326" stroke-width="3"/></svg><b>{label}</b><span>{esc(text)}</span></li>' for label,text in [('Start',start),('Door',door),('Result',result)])
    return f'<section class="case-section" id="case-{key}" aria-labelledby="h-{key}"><div class="shell"><header class="case-head"><span class="route-number" aria-hidden="true">{num}</span><div><span class="kicker">{year} · Route {num}: {route}</span><h2 id="h-{key}">{NAMES[key]}</h2></div></header><p class="route-metaphor">{esc(why_text)}</p>{art}<div class="case-grid"><div class="case-copy">'+''.join(paras)+str(quote)+f'</div><aside aria-label="Photographic evidence for {NAMES[key]}">{portrait(key)}{context(key)}</aside></div><ol class="route-beats" aria-label="{NAMES[key]}: start, door and result">{beats}</ol></div></section>'

def directory(letter):
    out=[]
    for key in GROUPS[letter]:
        y,n,r,*_=META[key];p=people[key];path=BASE+Path(p['file']).name
        out.append(f'<li><a href="#case-{key}">{image(path,"",True)}<b>{NAMES[key]}</b><small>{y} · {n} {r}</small></a></li>')
    return '<nav aria-label="Your five NFL cases"><ul class="route-directory">'+''.join(out)+'</ul></nav>'

def funnel(letter):
    dots=''.join(f'<circle class="dot'+(' college' if i<73 else '')+(' draft' if i==0 else '')+f'" cx="{5+(i%40)*10}" cy="{5+(i//40)*10}" r="2.4"/>' for i in range(1000))
    rows=''.join(f'<tr><th scope="row">{NAMES[k]}</th><td>{PICKS[k]}</td><td>{META[k][0]}</td></tr>' for k in GROUPS[letter])
    return f'''<section class="evidence-section" id="odds" aria-labelledby="odds-h"><div class="shell"><span class="kicker">The denominator matters</span><h2 id="odds-h">Keep the odds in view.</h2><div class="evidence-grid"><div class="funnel" data-step="all" data-desk-skip><div class="funnel-buttons" aria-label="Explore the approximate odds"><button type="button" data-step="all" aria-pressed="true">1,000 high school</button><button type="button" data-step="college" aria-pressed="false">73 NCAA</button><button type="button" data-step="draft" aria-pressed="false">1 drafted</button></div><output aria-live="polite">1,000 high school players: begin with the size of the opportunity.</output><svg viewBox="0 0 400 250" role="img" aria-label="A grid of 1,000 dots. The controls highlight about 73 NCAA players or one drafted senior.">{dots}</svg><p class="data-note">NCAA 2018–2019 comparisons, rounded: about 73 of 1,000 high school players reach NCAA football, and about one senior in 1,000 is drafted. These compare cohort totals; they do not follow one group of 1,000 individuals. NFL success is not guaranteed by persistence.</p></div><div><div class="draft-region" role="region" aria-label="Draft information for your five cases" tabindex="0"><table><caption>Your five cases: how the draft saw them</caption><thead><tr><th scope="col">Player</th><th scope="col">NFL draft</th><th scope="col">Route year</th></tr></thead><tbody>{rows}</tbody></table></div><p>The route year marks the story’s turning point, not necessarily a draft, debut or photograph date. The five people are selected exceptions, not a representative sample of everyone who tried.</p><p>{'Use the table to find a concrete comparison, then use the case text to explain what happened after the door opened.' if letter=='A' else 'Distinguish an example from a general rule. A successful outlier can disprove “the draft always gets it right,” but five selected successes cannot tell us the success rate of everyone who was overlooked.'}</p></div></div></div></section>'''

def evidence(letter):
    if letter=='A':
        body=f'''<div>{portrait('unitas')}</div><div><h3>A later portrait is not a photograph of the earlier struggle.</h3><p>The Unitas portrait was made in 1996. The sandlot illustration imagines 1955. The biography supports construction work and semipro football, but the exact pose, clothes, field and young likeness are interpreted.</p><details class="source-test"><summary>What can each image actually establish?</summary><p>The photograph provides a reliable later likeness. It does not record his construction shift or the 1955 practice. The reconstruction visualizes a researched possibility; it cannot prove that this particular bench, teammate or moment existed.</p></details><div class="note"><h3>Use this evidence move.</h3><p>“The source establishes ___. The storyteller has added ___. To confirm ___, I would need ___.” Use dates and the image label before drawing a conclusion.</p></div></div>'''
    else:
        body='''<div><h3>Keep three different claims separate.</h3><ol><li><strong>Observed:</strong> what is visible in a particular source photograph.</li><li><strong>Documented:</strong> what a dated written account establishes beyond that frame.</li><li><strong>Interpreted:</strong> what an overpainting or reconstruction supplies to make the story vivid.</li></ol><p>Return to Lane’s source-to-ink control and Warner’s grocery scene. A matching uniform number can help identify a person when the original caption supports it. A convincing young face, pose or grocery aisle does not establish that the depicted moment occurred.</p></div><div><details class="source-test"><summary>Does the ink version create more historical evidence?</summary><p>No. It changes how we attend to the source. Generated face, glove and ball details remain interpretations. The original Lane photograph records a 1953 moment, while the written account explains the 1952 office visit. Warner’s 1994 work is documented, but his illustrated shift is reconstructed from a later likeness reference and researched context.</p></details><div class="note"><h3>Build a bounded argument.</h3><p>Acknowledge what your evidence cannot establish. Distinguish “this helped him” from “this always works.” Consider a rival explanation, then explain why your claim survives it—or revise the claim.</p></div></div>'''
    return '<section class="evidence-section" id="image-evidence" aria-labelledby="image-evidence-h"><div class="shell"><span class="kicker">Read the picture like a historian</span><h2 id="image-evidence-h">Look beyond the surface.</h2><div class="evidence-grid">'+body+'</div></div></section>'

def claim_section(letter):
    bank=[{'text':a,'verdict':b,'explanation':c} for a,b,c in CLAIMS[letter]]
    cards=[]
    for i,c in enumerate(bank):
        buttons=''.join(f'<button type="button" data-call="{v}" aria-pressed="false">{v}</button>' for v in ['Supported','Contradicted','Needs context'])
        cards.append(f'<li class="claim-card"><h3>{i+1}. {esc(c["text"])}</h3><div class="claim-options" role="group" aria-label="Your evidence call for claim {i+1}" data-desk-skip>{buttons}</div><p class="claim-feedback" role="status" hidden></p><details class="writing-support"><summary>Read the evidence check</summary><p><strong>{c["verdict"]}.</strong> {esc(c["explanation"])}</p></details></li>')
    return '<section class="claims-section" id="evidence-calls" aria-labelledby="calls-h"><div class="shell"><span class="kicker">Five calls · same task in both assignments</span><h2 id="calls-h">Does the evidence support it?</h2><p>Supported means the claim is established by your readings. Contradicted means the record conflicts with it. Needs context means a compressed statement omits steps or limits that matter. Make a call, check the evidence and revise if needed. These calls prepare your writing; they are not a separate Turn In.</p><p class="check-progress" id="claim-progress" aria-live="polite">0 of 5 evidence calls checked.</p><ol class="claim-list">'+''.join(cards)+'</ol><script type="application/json" id="claim-bank">'+json.dumps(bank,ensure_ascii=False)+'</script></div></section>'

def bonus(letter):
    key='morris' if letter=='A' else 'ayres'
    title='Jim Morris: the science teacher' if key=='morris' else 'Dave Ayres: the emergency goalie'
    article=original.select_one('#h-'+key).find_parent('article')
    paras=[str(p) for p in article.find_all('p') if not p.find_parent('figure') and not any('mug' in a.get('class',[]) for a in p.parents)]
    pic=context(key)
    # This context panel stays visible in the short cross-sport case.
    pic=pic.replace('<details class="context-packet">','<div class="context-packet">').replace('<summary>Open the historical context image</summary>','').replace('</details>','</div>')
    return f'<section class="bonus-case" id="other-sport" aria-labelledby="other-h"><div class="shell"><span class="kicker">One cross-sport connection</span><h2 id="other-h">{title}</h2><div class="bonus-grid"><div class="case-copy">'+''.join(paras)+f'<p><strong>Connection:</strong> {"Like Papale, Morris was a teacher. An agreement with his players opened a chance, but he still had to demonstrate the skill." if letter=="A" else "Like the NFL cases, Ayres needed both readiness and an opportunity he could not schedule. The emergency created the door; it did not make the saves for him."}</p></div><div>{pic}</div></div></div></section>'

def responses(letter):
    cards=[]
    for i,(title,prompt,hint) in enumerate(PROMPTS[letter],1):
        ident=f'rt-{letter.lower()}-{i}';support=f'<details class="writing-support"><summary>Build your answer</summary><p>{esc(hint)}</p></details>' if hint else ''
        cards.append(f'<div class="response-card"><span class="question-number">{letter}{i} · 90–110 words</span><label for="{ident}">{esc(title)} {esc(prompt)}</label>{support}<textarea id="{ident}" name="Route Tree {letter}: {title}" aria-describedby="{ident}-count" data-word-target="100" maxlength="7000"></textarea><span class="word-count" id="{ident}-count">0 words · target 90–110 words</span></div>')
    return f'<section class="responses" id="responses" aria-labelledby="responses-h"><div class="shell"><span class="kicker">Assignment {letter} · your only Turn In</span><h2 id="responses-h">Three responses. About 300 words.</h2><p>Complete all three. Each targets 90–110 words. Use the readings and image labels as evidence. You do not need to complete the other assignment.</p>'+''.join(cards)+f'<p class="turnin-note">Assignment {letter} saves and turns in separately. Use your usual Hall Pass PIN. Work already started in the earlier full edition remains in the <a href="/hubs/bts-route-tree-full-reference.html">preserved original assignment</a>.</p><div data-desk-turnin aria-label="Turn in Assignment {letter}"></div></div></section>'

def sources():
    return '''<footer class="sources"><div class="shell"><h2>Sources, images and limits</h2><ul><li>The historical accounts and dated statistics come from the preserved <a href="/hubs/bts-route-tree-full-reference.html#sources">full documentary source notes</a>: NFL/Pro Football Hall of Fame records, team histories, NCAA research and the sources identified there.</li><li>Every person photograph and historical context image has an inline source and license. A later portrait, a venue or another unit’s photograph does not authenticate the player’s earlier experience.</li><li>Artistic reconstructions are labeled. In source-derived overpaintings, generated surfaces and small details do not create additional evidence. <a href="/storyhub/bts/route-tree/assets/ci-rights.json">Read the complete image and rights manifest</a>.</li><li>These alternatives preserve the same central question and workload. Read the <a href="/hubs/bts-route-tree-full-reference.html#making-of">story behind the original Cinematic Ink edition</a> if you want more background; it is optional reading.</li></ul><p><a href="/hubs/bts-the-route-tree.html">Assignment chooser</a> · <a href="/storyhubs/">All StoryHubs</a></p></div></footer>'''

def document(title,description,route,body,letter=None):
    hero='ci-unitas-sandlot-1024.webp' if letter!='B' else 'ci-lane-recovery-ink-1024.webp'
    assignment=f' data-desk-assignment="bts-route-tree-{letter.lower()}" data-variant="{letter}"' if letter else ''
    scripts=(f'<script src="{BASE}assignments.js" defer></script><script src="{BASE}ci-cinematic.js" defer></script>' if letter else '')+'<script src="/hubs/desk-save.js" defer></script>'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#10251f"><title>{esc(title)} | Beyond the Scoreboard</title><meta name="description" content="{esc(description)}"><link rel="canonical" href="https://grant-desk.com{route}"><meta property="og:type" content="article"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="https://grant-desk.com{route}"><meta property="og:image" content="https://grant-desk.com{BASE}{hero}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="{BASE}assignments.css"><style>@media(prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}}}</style></head><body{assignment}><a class="skip" href="#main-content">Skip to the assignment</a>{body}{scripts}</body></html>'''

metrics={}
for letter in ['A','B']:
    group=GROUPS[letter]
    nav='<nav class="topbar" aria-label="Assignment chapters"><div class="shell"><a class="brand" href="/hubs/bts-the-route-tree.html">THE ROUTE TREE · '+letter+'</a><a href="#cases">Five cases</a><a href="#odds">The odds</a><a href="#image-evidence">Image evidence</a><a href="#evidence-calls">Five calls</a><a href="#other-sport">Other sport</a><a href="#responses">Your three responses</a></div></nav>'
    header=f'''<header class="masthead"><div class="shell"><div class="hero-grid"><div><span class="eyebrow">Beyond the Scoreboard · Cinematic Ink · Assignment {letter}</span><h1>{TITLES[letter]}</h1><p class="lede">{'Trace the obstacle, the door and the work that followed. Use dates, photographs and clear comparisons to explain five unexpected NFL routes.' if letter=='A' else 'Compare preparation, opportunity and chance. Test explanations against five unexpected NFL routes, then defend a bounded argument.'}</p><div class="work-badges"><span>5 NFL cases + 1 other sport</span><span>3 responses · about 300 words</span><span>35–45 minutes</span></div><a class="button" href="#cases">Start your five cases</a><p class="micro">Complete Assignment {letter} only. A and B are alternative assignments, not two required parts.</p></div>{figure('unitas' if letter=='A' else 'lane',True)}</div><ol class="workflow"><li><b>01</b>Read your five cases.</li><li><b>02</b>Explore the odds and image evidence.</li><li><b>03</b>Check five claims and one other sport.</li><li><b>04</b>Write three responses and Turn In.</li></ol></div></header>'''
    introduction=f'''<section class="intro-band" id="cases" aria-labelledby="cases-h"><div class="shell"><span class="kicker">Same central question · a different evidence set</span><h2 id="cases-h">Who opened the door?</h2><div class="intro-grid"><p>Talent does not arrive neatly labeled. These five cases ask how someone reached a roster when the usual route did not work—or did not exist for them. Look for what the person could control and what depended on somebody else.</p><aside class="note"><h3>Your evidence rule</h3><p>Record a date or number for every case. A photograph’s date may be later than the career turning point. Read the label before treating a visual as proof.</p></aside></div>{directory(letter)}</div></section>'''
    body=nav+'<main id="main-content">'+header+introduction+''.join(case(k) for k in group)+funnel(letter)+evidence(letter)+claim_section(letter)+bonus(letter)+responses(letter)+'</main>'+sources()
    route=f'/hubs/bts-route-tree-{letter.lower()}.html';page=document('The Route Tree — Assignment '+letter, f'Five NFL cases, one cross-sport connection and three 90–110 word responses. {TITLES[letter]}.',route,body,letter)
    (PUB/route.lstrip('/')).write_text(page)
    soup=BeautifulSoup(page,'html.parser')
    metrics[letter]={'players':group,'nflCases':len(soup.select('.case-section')),'otherSportCases':len(soup.select('.bonus-case')),'writtenResponses':len(soup.select('textarea')),'writingTargetWords':[270,330],'estimatedMinutes':[35,45],'caseReadingWords':sum(len(x.get_text(' ',strip=True).split()) for x in soup.select('.case-section .case-copy, .bonus-case .case-copy')),'mainTextWords':len(soup.main.get_text(' ',strip=True).split())}

cards=[]
for letter in ['A','B']:
    desc='A more guided evidence trail, with answer-building supports.' if letter=='A' else 'A more independent case file, with synthesis, source criticism and counterargument.'
    names=', '.join(NAMES[k] for k in GROUPS[letter])
    cards.append(f'<article class="assignment-card">{figure("unitas" if letter=="A" else "lane",True)}<div class="card-body"><span class="big-letter">{letter}</span><h2>{TITLES[letter]}</h2><p>{desc}</p><p><strong>Your five NFL cases:</strong> {names}.</p><div class="work-badges"><span>5 NFL + 1 other sport</span><span>3 responses · about 300 words</span><span>35–45 minutes</span></div><a class="button" href="/hubs/bts-route-tree-{letter.lower()}.html">Open Assignment {letter}</a></div></article>')
gateway='''<nav class="topbar" aria-label="Site navigation"><div class="shell"><a class="brand" href="/storyhubs/">THE DESK · STORYHUBS</a><a href="/beyond-the-scoreboard/">Beyond the Scoreboard</a></div></nav><main id="main-content"><header class="masthead"><div class="shell"><span class="eyebrow">Beyond the Scoreboard · Cinematic Ink</span><h1>The Route Tree</h1><p class="lede">One historical question. Two alternative assignments. Complete the version your teacher assigns—you do not need to do both.</p><div class="work-badges"><span>Two balanced evidence sets</span><span>Separate saving and Turn In</span><span>Same writing target</span></div></div></header><section class="intro-band" aria-labelledby="choose-h"><div class="shell"><h2 id="choose-h">Choose your assignment.</h2><aside class="chooser-note"><h3>For the class</h3><p>Your teacher can alternate seats A, B, A, B. Both assignments have five NFL cases, one other-sport connection, five evidence calls and three 90–110 word responses. Assignment A provides more scaffolding; Assignment B asks for more independent analysis.</p><p><strong>Already started the earlier full assignment?</strong> <a href="/hubs/bts-route-tree-full-reference.html">Continue your existing work here</a>. Its original account identity and answer fields are preserved.</p></aside><div class="chooser-grid">'''+''.join(cards)+'''</div><div class="chooser-note"><h3>Balanced workload, different thinking.</h3><table class="balance-table"><thead><tr><th scope="col">Task</th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody><tr><th scope="row">NFL cases</th><td>5</td><td>5</td></tr><tr><th scope="row">Other sport</th><td>1</td><td>1</td></tr><tr><th scope="row">Evidence calls</th><td>5</td><td>5</td></tr><tr><th scope="row">Written responses</th><td>3 × 90–110 words</td><td>3 × 90–110 words</td></tr><tr><th scope="row">Approach</th><td>Guided comparison</td><td>Independent argument</td></tr></tbody></table><p>Both investigate how preparation, opportunity and setbacks shape an unexpected route. The reading and writing loads are matched; B raises the reasoning demand rather than adding more pages.</p></div></div></section></main>'''+sources()
ENTRY.write_text(document('The Route Tree — Choose Assignment A or B','Two balanced alternative sports-history assignments. Five NFL cases and three written responses each, with guided and more independent evidence routes.','/hubs/bts-the-route-tree.html',gateway))

# Preserve the original field definitions and script markup without serializing JS.
archive=REFERENCE.read_text()
archive=re.sub(r'<body(?:\s[^>]*)?>','<body data-desk-assignment="bts-the-route-tree">',archive,count=1)
archive=re.sub(r'<title>.*?</title>','<title>The Route Tree — Preserved Full Assignment | Beyond the Scoreboard</title>',archive,count=1)
archive=archive.replace('https://grant-desk.com/hubs/bts-the-route-tree.html','https://grant-desk.com/hubs/bts-route-tree-full-reference.html')
if 'id="preserved-edition-note"' not in archive:
    banner='<aside id="preserved-edition-note" class="edition-note" style="padding:1rem;background:#e4bf78;color:#172a24"><strong>Preserved full assignment.</strong> Continue work you already started here. For the two shorter alternatives, <a style="color:#172a24" href="/hubs/bts-the-route-tree.html">choose Assignment A or B</a>. This full edition is optional reference reading for the split assignments.</aside>'
    archive=re.sub(r'(<main(?:\s[^>]*)?>)',lambda m:m[1]+banner,archive,count=1)
REFERENCE.write_text(archive)

(STORIES/'ROUTETREE/assignment-balance.json').write_text(json.dumps({'schemaVersion':1,'sourceEditionCommit':'705f56d139ab925203c70e8bbb7f628ff4511b74','commonQuestion':'How do preparation, opportunity and setbacks shape unexpected routes, and what can the evidence establish?','distribution':'Alternating A/B groups; complete one alternative only.','variants':metrics,'comparisonNote':'Word counts include the authored case prose, not an estimate of individual student reading speed. Both have 5 NFL cases, 1 other-sport case, 5 evidence calls and 3 equal-length responses; B increases cognitive demand.'},indent=2)+'\n')
assert len(set(GROUPS['A'])&set(GROUPS['B']))==0
assert set(GROUPS['A']+GROUPS['B'])==set(NAMES)
assert abs(metrics['A']['caseReadingWords']-metrics['B']['caseReadingWords'])/max(metrics['A']['caseReadingWords'],metrics['B']['caseReadingWords'])<.12,metrics
print(json.dumps(metrics,indent=2))
