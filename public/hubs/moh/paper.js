/*
 * Medal of Honor project · the finished paper.
 * Turns a team's answer boxes into one report, in a fixed order, with each
 * part signed by the partner who wrote it. Used by the student preview and by
 * the teacher's print page. Everything is built with textContent.
 */
(function (root) {
  'use strict';
  var CSS = [
    '.mohp{background:#fff;color:#111;font:12pt/1.55 "Source Serif 4",Georgia,"Times New Roman",serif;max-width:7.5in;margin:0 auto;padding:.6in .7in;box-shadow:0 10px 30px rgba(0,0,0,.3)}',
    '.mohp h1,.mohp h2{font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif;text-transform:uppercase;letter-spacing:.03em;margin:0;color:#111}',
    '.mohp .cover{text-align:center;border-block:1px solid #a07d51;padding:.25in 0 .3in;page-break-after:always;break-after:page}',
    '.mohp .cover .kick{text-align:center;font:600 11pt "Barlow Condensed",Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#7a5512;margin:0 0 .15in}',
    '.mohp .cover h1{font:600 clamp(24pt, 5vw, 40pt)/1.05 "Source Serif 4",Georgia,serif;text-transform:none;letter-spacing:-.035em}',
    '.mohp .cover .sub{font:600 13pt "Barlow Condensed",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin:.12in 0 .25in;color:#333;text-align:center}',
    '.mohp .cover img{width:100%;border:1px solid #999;margin:.1in 0 .25in}',
    '.mohp .cover .noart{border:2px dashed #bbb;padding:.6in .3in;color:#777;margin:.1in 0 .25in}',
    '.mohp .cover .by{text-align:center;font-size:12pt;margin:.04in 0}',
    '.mohp h2{font-size:17pt;margin:.28in 0 .02in;border-bottom:1.5px solid #111;padding-bottom:.03in}',
    '.mohp .sign{font:italic 10.5pt "Source Serif 4",Georgia,serif;color:#555;margin:0 0 .1in}',
    '.mohp p{margin:0 0 .12in;text-align:left}',
    '.mohp table{width:100%;border-collapse:collapse;margin:.08in 0}',
    '.mohp td,.mohp th{border:1px solid #999;padding:.05in .08in;vertical-align:top;font-size:11pt;text-align:left}',
    '.mohp th{width:28%;background:#f1ece0;font-family:"Barlow Condensed",Arial,sans-serif;text-transform:uppercase;letter-spacing:.05em;font-size:10.5pt}',
    '.mohp blockquote{margin:.08in 0 .14in;padding:.1in .16in;background:#f6f1e4;border-left:3px solid #7a5512;font-size:11pt}',
    '.mohp .missing{color:#b0281c;font-style:italic}',
    '.mohp ol{margin:.04in 0 0 .2in;padding:0;font-size:11pt}',
    '.mohp .page-break{break-before:page;page-break-before:always}',
    '@media screen and (max-width:650px){.mohp{padding:.3in .2in}}',
    '@media print{.mohp{box-shadow:none;padding:0;max-width:none}.mohp .cover h1{font-size:40pt}@page{size:letter;margin:.8in}}'
  ].join('\n');
  function css() {
    if (document.getElementById('mohp-css')) return;
    var s = document.createElement('style'); s.id = 'mohp-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function el(tag, attrs, text) { var n = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (text != null) n.textContent = text; return n; }

  /*
   * v: veteran record. team: { mode, a, b, classPeriod }. values: id -> text, already
   * merged so each box holds its owner's words. opts.showMissing marks empty parts.
   */
  function build(v, team, values, opts) {
    css();
    opts = opts || {};
    var M = root.MOH, F = M.FIELDS, solo = team.mode === 'solo';
    var nameA = team.a || 'Partner A', nameB = solo ? nameA : (team.b || 'Partner B');
    function val(id) { return String(values[id] || '').trim(); }
    function missing(parent, what) { if (opts.showMissing) parent.appendChild(el('p', { class: 'missing' }, what + ' is not written yet.')); }
    var doc = el('article', { class: 'mohp' });

    // cover
    var cover = el('section', { class: 'cover' });
    cover.appendChild(el('p', { class: 'kick' }, 'Medal of Honor · World War I'));
    cover.appendChild(el('h1', {}, v.name));
    cover.appendChild(el('p', { class: 'sub' }, v.rank + ' · ' + v.unit));
    var design = val('moh-b-screen-data');
    if (design && root.MOHArt) {
      var parsed = root.MOHArt.parse(design);
      if (parsed.ink.length || parsed.st.length) {
        cover.appendChild(el('img', { alt: 'Memorial screen for ' + v.name, src: root.MOHArt.image(parsed, texts(v, values, nameB)) }));
      } else cover.appendChild(el('div', { class: 'noart' }, 'The memorial screen is not drawn yet.'));
    } else cover.appendChild(el('div', { class: 'noart' }, 'The memorial screen is not drawn yet.'));
    cover.appendChild(el('p', { class: 'by' }, solo ? 'A report by ' + nameA : 'A report by ' + nameA + ' and ' + nameB));
    cover.appendChild(el('p', { class: 'by' }, [team.classPeriod, opts.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })].filter(Boolean).join(' · ')));
    doc.appendChild(cover);

    // fact file
    doc.appendChild(el('h2', {}, 'Fact File'));
    if (!solo) doc.appendChild(el('p', { class: 'sign' }, 'Facts by ' + nameA + ' and ' + nameB));
    var table = el('table');
    F.filter(function (f) { return f.kind === 'fact'; }).forEach(function (f) {
      var tr = el('tr'); tr.appendChild(el('th', {}, f.paper)); var td = el('td', {}, val(f.id) || (opts.showMissing ? 'Not written yet' : ''));
      if (!val(f.id) && opts.showMissing) td.className = 'missing'; tr.appendChild(td); table.appendChild(tr);
    });
    doc.appendChild(table);

    function chapter(key, title, author, extra) {
      doc.appendChild(el('h2', {}, title));
      doc.appendChild(el('p', { class: 'sign' }, 'Written by ' + author));
      if (extra) extra();
      var boxes = F.filter(function (f) { return f.chapter === key; }).map(function (f) { return val(f.id); });
      var text = M.paragraph(boxes);
      if (text) {
        if (key === 'day' || key === 'after' || key === 'before') {
          // two paragraphs read better than one long block
          var first = M.paragraph(boxes.slice(0, 2)), second = M.paragraph(boxes.slice(2));
          if (first) doc.appendChild(el('p', {}, first));
          if (second) doc.appendChild(el('p', {}, second));
        } else doc.appendChild(el('p', {}, text));
      } else missing(doc, 'This chapter');
      if (text && boxes.some(function (b) { return !b; })) missing(doc, 'Part of this chapter');
    }
    chapter('before', 'Before the War', nameA);
    chapter('day', 'The Day He Earned the Medal', nameB);
    chapter('cite', 'The Citation in Plain English', nameA, function () {
      doc.appendChild(el('p', {}, 'The official citation reads:'));
      doc.appendChild(el('blockquote', {}, v.citation));
      doc.appendChild(el('p', {}, 'In our own words:'));
    });
    chapter('after', 'After the War', nameB);

    // words
    doc.appendChild(el('h2', {}, 'Words to Know'));
    var wt = el('table'), any = false;
    [1, 2, 3].forEach(function (n) { ['a', 'b'].forEach(function (o) {
      var w = val('moh-' + o + '-word-' + n), m = val('moh-' + o + '-mean-' + n);
      if (!w && !m) return; any = true;
      var tr = el('tr'); tr.appendChild(el('th', {}, w || 'Word missing')); tr.appendChild(el('td', {}, m || 'Meaning missing')); wt.appendChild(tr);
    }); });
    if (any) doc.appendChild(wt); else missing(doc, 'The word list');

    // reflections
    doc.appendChild(el('h2', {}, 'Why He Matters'));
    function reflection(owner, name) {
      var text = M.paragraph([val('moh-' + owner + '-why-1'), val('moh-' + owner + '-why-2')]);
      if (!solo) doc.appendChild(el('p', { class: 'sign' }, name + ' writes:'));
      if (text) doc.appendChild(el('p', {}, text)); else missing(doc, name + '’s reflection');
    }
    reflection('a', nameA);
    if (!solo) reflection('b', nameB);

    // sources
    doc.appendChild(el('h2', {}, 'Sources'));
    var ol = el('ol');
    ol.appendChild(el('li', {}, 'The Medal of Honor Project: ' + v.name + '. the desk, grant-desk.com/hubs/ush9-medal-of-honor-veteran.html?v=' + v.slug + '.'));
    ol.appendChild(el('li', {}, 'Medal of Honor citation for ' + v.name + ', ' + v.branch + ', as printed on the project page.'));
    v.links.forEach(function (l) { ol.appendChild(el('li', {}, l[0] + '. ' + l[1])); });
    doc.appendChild(ol);
    return doc;
  }

  function texts(v, values, by) {
    return { name: v.name, rank: v.rank, date: v.actionLabel, place: v.place, title: String(values['moh-b-screen-title'] || '').trim(),
      caption: String(values['moh-b-screen-caption'] || '').trim(), quote: String(values['moh-b-screen-quote'] || '').trim(), by: by ? 'Memorial screen by ' + by : '' };
  }

  // Merge two accounts' answers so each box holds its owner's words.
  function merge(mode, aAnswers, bAnswers) {
    var M = root.MOH, out = {}, a = {}, b = {};
    (aAnswers || []).forEach(function (e) { a[e.k.replace(/^id:/, '')] = e.a; });
    (bAnswers || []).forEach(function (e) { b[e.k.replace(/^id:/, '')] = e.a; });
    M.FIELDS.forEach(function (f) { out[f.id] = mode === 'solo' ? (a[f.id] || '') : f.owner === 'a' ? (a[f.id] || '') : (b[f.id] || ''); });
    return out;
  }

  // Poster blueprint: what to put on the wall poster, in the layout the student chose.
  function blueprint(v, values, name) {
    css();
    function val(id) { return String(values[id] || '').trim(); }
    var lay = val('moh-a-poster-layout') || 'Classic';
    var doc = el('article', { class: 'mohp' });
    doc.appendChild(el('p', { class: 'sign' }, 'Poster blueprint · ' + (name || '') + ' · ' + v.name));
    doc.appendChild(el('h1', { style: 'font-size:30pt' }, val('moh-a-poster-head') || 'Your headline goes here'));
    var t = el('table');
    [['Layout', lay], ['Name in big letters', v.name.toUpperCase()], ['Rank and unit', v.rank + ', ' + v.unit], ['Date and place', v.actionLabel + ', ' + v.place],
     ['Center drawing', val('moh-a-poster-scene')], ['Fact box 1', val('moh-a-poster-fact-1')], ['Fact box 2', val('moh-a-poster-fact-2')],
     ['Fact box 3', val('moh-a-poster-fact-3')], ['Fact box 4', val('moh-a-poster-fact-4')], ['Quote', val('moh-a-poster-quote') ? '“' + val('moh-a-poster-quote') + '”' : ''],
     ['Also draw', 'The Medal of Honor: a gold star on a light blue ribbon with white stars'], ['Sign it', 'Your name, small, in a bottom corner']].forEach(function (r) {
      var tr = el('tr'); tr.appendChild(el('th', {}, r[0])); tr.appendChild(el('td', {}, r[1] || 'Not filled in yet')); t.appendChild(tr);
    });
    doc.appendChild(t);
    doc.appendChild(el('h2', {}, 'Sketch it here first'));
    doc.appendChild(el('div', { style: 'border:2px dashed #888;height:4.2in;margin-top:.1in' }));
    return doc;
  }
  root.MOHPaper = { build: build, merge: merge, texts: texts, blueprint: blueprint, css: css };
})(typeof window !== 'undefined' ? window : globalThis);
