// Build a new public-only static snapshot. Assets keep their original bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,target=process.argv[2],sourceRef=process.argv[3]||'uncommitted-candidate';
if(!target||fs.existsSync(target))throw Error('Supply a NEW public output folder.');
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex');
fs.mkdirSync(target,{recursive:true});fs.mkdirSync(path.join(target,'assets'));
const assetURLs={},manifest=[];
function writeAsset(name,raw){const ext=path.extname(name),stem=path.basename(name,ext),hash=digest(raw),file=stem+'.'+hash.slice(0,12)+ext;fs.writeFileSync(path.join(target,'assets',file),raw,{flag:'wx'});manifest.push({path:'assets/'+file,bytes:raw.length,sha256:hash});return '/assets/'+file;}
for(const entry of fs.readdirSync(path.join(root,'assets'),{withFileTypes:true})){if(!entry.isFile()||entry.name==='FONT-LICENSE.txt')continue;assetURLs['assets/'+entry.name]=writeAsset(entry.name,fs.readFileSync(path.join(root,'assets',entry.name)));}
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const css=read('game.css').replace(/url\((['"])(assets\/[^'"]+)\1\)/g,(_,q,file)=>{if(!assetURLs[file])throw Error('Unknown CSS asset '+file);return 'url("'+assetURLs[file]+'")';});
const cssURL=writeAsset('game.css',Buffer.from(css));
const art={};for(const id of ['mochi','bolt','zee','ember'])for(const ext of ['png','gif'])art[id+'.'+ext]=assetURLs['assets/'+id+'.'+ext];
const engineURL=writeAsset('engine.js',Buffer.from(read('engine.js')));
const goalsURL=writeAsset('camp-goals.js',Buffer.from(read('camp-goals.js')));
const gameURL=writeAsset('game.js',Buffer.from('globalThis.PIXEL_CAMP_ART='+JSON.stringify(art)+';\n'+read('game.js')));
let html=read('index.html').replace('href="game.css"','href="'+cssURL+'"').replace('src="engine.js"','src="'+engineURL+'"').replace('src="camp-goals.js"','src="'+goalsURL+'"').replace('src="game.js"','src="'+gameURL+'"').replace(/src="(assets\/[^\"]+)"/g,(_,file)=>{if(!assetURLs[file])throw Error('Unknown HTML asset '+file);return 'src="'+assetURLs[file]+'"';});
html=html.replace('</head>','<link rel="icon" type="image/png" href="'+art['mochi.png']+'"><link rel="preload" as="font" type="font/ttf" crossorigin href="'+assetURLs['assets/VT323-Regular.ttf']+'"><meta name="description" content="Care for four pixel friends, explore Willowbank and practice at camp."></head>');
if(/(?:src|href)="(?:assets\/|game\.|engine\.)/.test(html))throw Error('Unmapped source reference');
fs.writeFileSync(path.join(target,'index.html'),html,{flag:'wx'});
const headers=`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
/
  Cache-Control: public, max-age=0, must-revalidate
/index.html
  Cache-Control: public, max-age=0, must-revalidate
/release.json
  Cache-Control: no-store
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
fs.writeFileSync(path.join(target,'_headers'),headers,{flag:'wx'});
fs.writeFileSync(path.join(target,'FONT-LICENSE.txt'),fs.readFileSync(path.join(root,'assets/FONT-LICENSE.txt')),{flag:'wx'});
const release={version:'4.3.0',sourceRef,sourceBase:'71656d29529330a12d53fde2cf7141eb0ac68ef4',saveMode:'browser-local and portable files',foundersUnchanged:8,indexBytes:Buffer.byteLength(html),indexSha256:digest(Buffer.from(html)),assets:manifest};
fs.writeFileSync(path.join(target,'release.json'),JSON.stringify(release,null,2),{flag:'wx'});
console.log(JSON.stringify({folder:path.resolve(target),version:release.version,indexBytes:release.indexBytes,assets:manifest.length,totalAssetBytes:manifest.reduce((n,a)=>n+a.bytes,0),sourceRef}));
