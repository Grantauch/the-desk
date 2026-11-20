/** Intentionally author the static model image using the student's real tools. */
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage();
  await page.setContent('<html><head></head><body><canvas id="screen"></canvas></body></html>');
  // Use local fonts as data so authoring needs no network or student services.
  const fonts = [
    ['Barlow Condensed', 'barlow-condensed-600.woff2', 600],
    ['Barlow Condensed', 'barlow-condensed-800.woff2', 800],
    ['Barlow', 'barlow-400.woff2', 400],
    ['Barlow', 'barlow-600.woff2', 600],
    ['Source Serif 4', 'source-serif-4.woff2', 400],
    ['Source Serif 4', 'source-serif-4-italic.woff2', 400, 'italic'],
  ];
  for (const [family, file, weight, style = 'normal'] of fonts) {
    const bytes = await readFile(new URL(`public/storyhub/bts/americas-most-hated/assets/${file}`, root));
    await page.addStyleTag({ content: `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${bytes.toString('base64')})}` });
  }
  await page.addScriptTag({ content: await readFile(new URL('public/hubs/moh/art.js', root), 'utf8') });
  const data = await page.evaluate(async () => {
    await Promise.all(['600 26px "Barlow Condensed"', '800 76px "Barlow Condensed"', '400 24px Barlow', '600 30px Barlow', 'italic 400 32px "Source Serif 4"'].map(font => document.fonts.load(font)));
    const path = points => points.map(([x, y]) => x.toString(16).padStart(2, '0') + y.toString(16).padStart(2, '0')).join('');
    const design = {
      v: 1, bg: 'night', lay: 'left',
      ink: [
        [5, 1, path([[6, 221], [30, 208], [62, 194], [90, 178], [126, 153], [160, 134], [198, 115], [247, 98]])],
        [5, 0, path([[8, 225], [32, 211], [65, 199], [92, 181], [127, 159], [162, 138], [200, 119], [247, 103]])],
        [6, 2, path([[172, 124], [183, 116], [194, 120], [205, 111], [219, 115]])],
        [6, 2, path([[201, 86], [211, 78], [221, 82], [231, 74], [244, 79]])],
        [0, 1, path([[115, 164], [128, 151], [139, 144], [154, 141]])],
        [0, 1, path([[127, 151], [137, 167], [149, 170]])],
        [0, 1, path([[80, 185], [94, 172], [107, 165], [120, 161]])],
        [0, 1, path([[94, 172], [103, 186], [116, 190]])],
        [0, 1, path([[45, 207], [58, 194], [70, 185], [86, 181]])],
        [0, 1, path([[58, 194], [68, 208], [80, 210]])],
      ],
      st: [['helmet', 140, 123, 74], ['helmet', 114, 138, 66], ['helmet', 87, 152, 62], ['poppy', 191, 167, 80]],
    };
    return window.MOHArt.image(design, {
      name: 'Freddie Stowers', rank: 'Corporal', title: 'He kept them moving',
      date: 'September 28, 1918', place: 'Hill 188, France',
      quote: 'he inspired his men to follow him in the attack',
      caption: 'Stowers leads his squad toward the trenches on Hill 188.', by: 'Sample Partner B · teacher-created model',
    }).replace(/^data:image\/png;base64,/, '');
  });
  // The renderer returns PNG; encode its exact output as an optimized WebP.
  await page.setContent(`<img id="image" src="data:image/png;base64,${data}">`);
  const webp = await page.evaluate(async () => {
    const image = document.getElementById('image'); await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.toDataURL('image/webp', .93).split(',')[1];
  });
  await writeFile(new URL('public/hubs/moh/exemplar-screen.webp', root), Buffer.from(webp, 'base64'));
  console.log('Authored static memorial model using MOHArt; no student save was created.');
} finally { await browser.close(); }
