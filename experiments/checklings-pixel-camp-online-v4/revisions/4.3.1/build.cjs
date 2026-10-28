// Offline build: all art and the font are embedded. Existing outputs are preserved.
const fs = require("node:fs");
const path = require("node:path");
const root = __dirname;
const target = process.argv[2];
if (!target) throw Error("Supply a NEW output HTML path.");
if (fs.existsSync(target)) throw Error("Output exists; choose a new version.");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const data = (file) => {
  const ext = path.extname(file).slice(1);
  const mime = ext === "ttf" ? "font/ttf" : "image/" + ext;
  return (
    "data:" +
    mime +
    ";base64," +
    fs.readFileSync(path.join(root, file)).toString("base64")
  );
};
let html = read("index.html");
let css = read("game.css").replace(
  /url\((['"])([^'"]+)\1\)/g,
  (_, quote, file) => 'url("' + data(file) + '")',
);
html = html.replace(
  /<link\s+rel=["']stylesheet["']\s+href=["']game\.css["']\s*\/?>/,
  () => "<style>" + css + "</style>",
);
html = html.replace(
  /src="(assets\/[^\"]+)"/g,
  (_, file) => 'src="' + data(file) + '"',
);
const art = {};
for (const id of ["mochi", "bolt", "zee", "ember"]) {
  for (const ext of ["png", "gif"])
    art[id + "." + ext] = data("assets/" + id + "." + ext);
}
for (const file of ["engine.js", "camp-goals.js", "game.js"]) {
  const expression = new RegExp(
    "<script\\s+src=[\"']" + file.replace(".", "\\.") + "[\"']\\s*><\\/script>",
  );
  html = html.replace(
    expression,
    () =>
      "<script>" +
      (file === "game.js"
        ? "globalThis.PIXEL_CAMP_ART=" + JSON.stringify(art) + ";\n"
        : "") +
      read(file) +
      "</script>",
  );
}
if (
  /<(?:link|script)[^>]+(?:href|src)=["'](?:game\.css|engine\.js|game\.js)/.test(
    html,
  )
)
  throw Error("Unembedded local code reference.");
if (/src="assets\//.test(html) || /url\(["']?assets\//.test(html))
  throw Error("Unembedded art reference.");
fs.writeFileSync(target, html, { flag: "wx" });
console.log(
  JSON.stringify({
    file: target,
    bytes: Buffer.byteLength(html),
    embedded: true,
  }),
);
