"""Synthetic admission boundaries plus checks on every published Sprite Book pixel."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('intake', Path(__file__).with_name('admit-sprite-book.py'))
intake = importlib.util.module_from_spec(spec)
spec.loader.exec_module(intake)


class SpriteAdmission(unittest.TestCase):
    def source(self):
        a = np.zeros((100, 100, 4), np.uint8)
        a[:] = [255, 0, 255, 255]
        a[20:80, 20:80] = [40, 100, 20, 255]
        return a

    def inspect(self, a, ext='png', exempt=False):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/('test.'+ext)
            Image.fromarray(a).convert('RGB').save(p)
            return intake.inspect_image(p, exempt)

    def test_exact_border_threshold(self):
        a = self.source()
        a[0, :7] = [254, 0, 255, 255]  # 389/396 is above 98%.
        self.assertEqual(self.inspect(a)[2], [])
        a[0, 7] = [254, 0, 255, 255]  # 388/396 is below 98%.
        self.assertIn('border', self.inspect(a)[2][0])

    def test_interior_threshold_and_magenta_belly(self):
        a = self.source()
        a[30:36, 30:36] = [250, 20, 250, 255]  # Exactly 1%.
        self.assertEqual(self.inspect(a)[2], [])
        a[36, 30] = [255, 0, 255, 255]  # Enclosed key color must not bypass admission.
        self.assertIn('interior', self.inspect(a)[2][0])

    def test_jpg_and_scene_exemption(self):
        with self.assertRaisesRegex(ValueError, 'JPG'):
            self.inspect(self.source(), 'jpg')
        a = np.full((32, 32, 4), 255, np.uint8)
        self.assertEqual(self.inspect(a, exempt=True)[2], [])
        self.assertTrue(self.inspect(a)[2])
        a[10:15, 10:15] = [255, 0, 255, 255]
        self.assertIn('interior', self.inspect(a, exempt=True)[2][0], 'scene exemption applies only to the border check')

    def test_detected_gutters_and_reading_order(self):
        for cols, rows in [(3, 4), (2, 1), (4, 1), (3, 1)]:
            a = np.zeros((rows*30, cols*30, 4), np.uint8)
            for y in range(rows):
                for x in range(cols):
                    a[y*30+2:y*30+27, x*30+3:x*30+28] = [x+cols*y+1, 90, 40, 255]
            cells = intake.split(a, [cols, rows])
            self.assertEqual([int(c[0, 0, 0]) for c in cells], list(range(1, cols*rows+1)))
            sheet, frames = intake.pack(cells, [cols, rows], [32, 48])
            self.assertEqual(sheet.size, (cols*32, rows*48))
            self.assertEqual(set(np.unique(np.asarray(sheet)[:, :, 3])), {0, 255})
            for frame, cell in zip(frames, cells):
                colors = {tuple(c) for c in np.asarray(frame).reshape(-1, 4)} - {(0, 0, 0, 0)}
                self.assertTrue(colors <= {tuple(c) for c in cell.reshape(-1, 4)})

    def test_all_published_outputs(self):
        report = json.loads((intake.ROOT/'content/sprite-admission.json').read_text())
        registry = json.loads((intake.ROOT/'content/sprites.json').read_text())
        accepted = [e for e in report['files'] if e['status'] == 'ACCEPTED']
        self.assertEqual(len(accepted), 14)
        for e in accepted:
            p = intake.ROOT/'public/art'/e['source']
            with Image.open(p) as im:
                self.assertEqual(list(im.size), e['size'])
                a = np.asarray(im.convert('RGBA'))
                self.assertTrue(set(np.unique(a[:, :, 3])) <= {0, 255})
                self.assertFalse(np.any((a[:, :, 0] > 200) & (a[:, :, 1] < 60) & (a[:, :, 2] > 200) & (a[:, :, 3] != 0)), e['source'])
        for e in report['files']:
            if e['status'] == 'REJECTED':
                self.assertFalse((intake.ROOT/'public/art'/e['source']).exists())
        self.assertEqual(registry['assets']['hood-plot']['file'], 'hood-plot.png')
        for id in registry['houses']:
            self.assertTrue((intake.ROOT/'public/art/archive/wave1'/(id+'.png')).exists())
        camp = intake.REPO/'public/hubs/checkling/camp/assets'
        book = json.loads((camp/'sprite-book.json').read_text())
        self.assertEqual(set(book['species']), {'mochi', 'bolt', 'ember'})
        for poses in book['species'].values():
            for face in poses.values():
                with Image.open(camp/face['moving']) as im:
                    self.assertEqual(im.size, (32, 32))
                    self.assertEqual(im.n_frames, 2)
                    for i in range(im.n_frames):
                        im.seek(i)
                        self.assertTrue(set(np.unique(np.asarray(im.convert('RGBA'))[:, :, 3])) <= {0, 255})


if __name__ == '__main__':
    unittest.main()
