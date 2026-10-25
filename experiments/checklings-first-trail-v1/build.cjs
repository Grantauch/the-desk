// Creates a new, portable artifact. Refuses to overwrite an existing output.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,target=process.argv[2];if(!target)throw Error('Supply a NEW output HTML path.');if(fs.existsSync(target))throw Error('Output already exists; choose a new version.');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');const art={};for(const id of ['mochi','bolt','zee','ember'])for(const ext of ['png','gif'])art[id+'.'+ext]='data:image/'+ext+';base64,'+fs.readFileSync(path.join(root,'assets',id+'.'+ext)).toString('base64');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+fs.readFileSync(path.join(root,'style.css'),'utf8')+'</style>');
for(const f of ['engine.js','app.js'])html=html.replace('<script src="'+f+'"></script>',()=>'<script>'+(f==='app.js'?'globalThis.FIRST_TRAIL_ART='+JSON.stringify(art)+';\n':'')+fs.readFileSync(path.join(root,f),'utf8')+'</script>');
fs.writeFileSync(target,html,{flag:'wx'});console.log(JSON.stringify({output:target,bytes:Buffer.byteLength(html)}));
