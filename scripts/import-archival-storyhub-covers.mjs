/**
 * One-time, license-reviewed archival cover import for Story Hub cover replacements.
 *
 * This writes local binaries and a checksum/provenance manifest. No hotlinks are
 * shipped in the published site. Run on an authoring branch only.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const source = [
  {
    slug: "ush9-l015-who-showed-up",
    destination: "public/storyhub/ush9/l015/assets/railroad-strike-1877-archival.jpg",
    title: "A Steeple-View of the Pittsburgh Conflagration",
    author: "M. B. Leiser, Harper's Weekly",
    date: "1877-08-11",
    commonsName: "Harpers 8 11 1877 Steeple View of Pittsburgh Conflagaration (cropped).jpg",
    maxWidth: 1600,
    rights: "Public domain in the United States (published 1877)",
    record: "https://commons.wikimedia.org/wiki/File:Harpers_8_11_1877_Steeple_View_of_Pittsburgh_Conflagaration_(cropped).jpg",
    description: "Historical engraving of railroad yards burning in Pittsburgh during the Great Railroad Strike of 1877.",
  },
  {
    slug: "bts-l03-not-in-the-room",
    destination: "public/storyhub/bts/l03/assets/chicago-white-stockings-1876-archival.jpg",
    title: "1876 Chicago White Stockings team photograph",
    author: "Unknown nineteenth-century photographer",
    date: "1876",
    commonsName: "1876 Chicago White Stockings.jpg",
    maxWidth: null,
    rights: "Public domain in the United States (published 1876)",
    record: "https://commons.wikimedia.org/wiki/File:1876_Chicago_White_Stockings.jpg",
    description: "1876 Chicago White Stockings club portrait; one of the original National League teams.",
  },
  {
    slug: "hh-bytesize-nuremberg",
    destination: "public/storyhub/hh/nuremberg/robert-jackson-nuremberg-archival.jpg",
    title: "U.S. Chief Prosecutor Robert H. Jackson at the Nuremberg Trials",
    author: "United States Army photographer",
    date: "1945–1946",
    commonsName: "Prosecutor Robert Jackson at Nuremberg Trials.jpg",
    maxWidth: 1200,
    rights: "Public domain in the United States (official U.S. Army work)",
    record: "https://commons.wikimedia.org/wiki/File:Prosecutor_Robert_Jackson_at_Nuremberg_Trials.jpg",
    description: "Chief U.S. Prosecutor Robert H. Jackson addresses the International Military Tribunal in Nuremberg.",
  },
];

function commonsUrl(name, width) {
  const canonical = name.replaceAll(" ", "_");
  const hash = createHash("md5").update(canonical).digest("hex");
  // Wikimedia requires RFC3986-escaped parentheses in upload paths.
  const path = encodeURIComponent(canonical).replace(/\\(/g, "%28").replace(/\\)/g, "%29");
  const base = "https://upload.wikimedia.org/wikipedia/commons/";
  return width
    ? base + "thumb/" + hash[0] + "/" + hash.slice(0, 2) + "/" + path + "/" + width + "px-" + path
    : base + hash[0] + "/" + hash.slice(0, 2) + "/" + path;
}

const report = [];
for (const item of source) {
  const url = commonsUrl(item.commonsName, item.maxWidth);
  const response = await fetch(url, {
    headers: { "User-Agent": "GrantDesk-Archival-Source-Review/1.0 (https://grant-desk.com)" },
    signal: AbortSignal.timeout(30000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(item.slug + ": download failed, HTTP " + response.status + " at " + url);
  const mime = response.headers.get("content-type") || "";
  if (!mime.toLowerCase().includes("image/jpeg")) {
    throw new Error(item.slug + ": expected JPEG, got " + mime);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 15000 || bytes.length > 1500000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    throw new Error(item.slug + ": rejected an empty, too-large or invalid JPEG (" + bytes.length + " bytes)");
  }
  await mkdir(dirname(item.destination), { recursive: true });
  await writeFile(item.destination, bytes);
  report.push({
    slug: item.slug,
    destination: item.destination,
    title: item.title,
    author: item.author,
    date: item.date,
    rights: item.rights,
    source: item.record,
    assetSource: url,
    description: item.description,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  console.log("Downloaded and verified", item.slug, bytes.length, "bytes");
}
await mkdir("docs/catalog", { recursive: true });
await writeFile("docs/catalog/ARCHIVAL-COVER-PROVENANCE.json", JSON.stringify(report, null, 2) + "\n");
console.log("Ready for human crop, historical-accuracy and classroom review before publication.");
