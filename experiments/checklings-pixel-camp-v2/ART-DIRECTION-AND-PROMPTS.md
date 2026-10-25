# Pixel Camp v2 — art direction and prompt recipes

Generation used the built-in image tool, with local copies of the four original founder PNGs as image references. No external image service/API key was used. The founders themselves were never edit targets. These normalized prompt recipes preserve the final generation requirements; they are not recovered Grok prompts.

## Common style reference

Use the attached Mochi, Bolt, Zee and Ember sprites as style references only. Match their chunky square pixel clusters, dark navy/purple outlines, rich bright color, stepped highlights and shadows, chibi proportions and expressive shapes. Make polished usable RPG assets. No smooth vector illustration, website/product styling, photorealism, text, logos, labels or watermarks. Preserve every existing founder file exactly.

## 1. Willowbank camp — willowbank-pixel.png

Create a wide16:9 actual playable pixel-art background. Slightly top-down three-quarter view. A cozy grassy clearing surrounded by thick trees, timber-and-moss shelter upper left, stream and stone-edged pond to the right, dirt path through a wooden gate at upper center, flowers and mushrooms at the borders. Leave the central65percent of the foreground clear for existing character sprites. Dark outline and stepped highlights match the founders. Fill the image edge to edge. No creatures, people, interface, typography or framing. Crisp square pixel art, not a concept painting or smooth diorama. Opaque background.

## 2. Friendly practice stump — practice-stump-sheet.png

One squat round honey-brown training log with root feet, branch arms, padded leaf mitts, carved expressive eyes, teal leaf crest and moss. It must be appealing enough to stand beside the founders. It is a training prop, not another collectible species. Four states of the same design: idle ready, raised-mitt brace, wind-up, startled hit reaction with yellow impact pixels. Front three-quarter view, consistent scale and foot baseline. True alpha transparency, complete full bodies, no scene/text/labels.

Final layout repair: edit only packing/spacing. Keep design, colors, poses and pixel style. Wide3:1 sheet, four equal-width cells. Each cell is543x724px in the result. Shrink the sprites, with large transparent gutters on all sides. Centers at12.5/37.5/62.5/87.5percent of full width. No branch, leaf, impact pixel or outline may cross a cell boundary. The final CSS uses the measured3/4 cell aspect ratio rather than assuming square frames.

## 3. Items — object-atlas.png

A true-alpha4-column by3-row sprite atlas. Each icon is a complete pixel-art object, not an emoji or flat UI symbol. Row1: red berries in a wooden bowl; striped play ball with a star; wooden grooming brush; blue bedroll and pillow. Row2: folded route map with green path/red marker and no letters; brown leather backpack/gold clasp; open illustrated leaf journal/no text; wooden practice sword/teal wrap. Row3: terracotta moonbean planter; glowing amber clay lantern/teal top; three colorful camp pennants; gold trail badge with a green leaf/paw motif.

Final spacing repair: preserve every design and color. Regular equal square-cell grid; make objects smaller within the central60percent of each cell, with generous transparent padding between all rows/columns. Center every complete object, including the tall ones. Map/backpack must not touch planter/lantern. No cropping, shadows or pixels across cell boundaries, and no visible grid lines. Final atlas1448x1086px,362px cells.

## 4. Trail landmarks — trail-props.png

Three complete freestanding props in a transparent3:1 row: an open timber garden gate with bean vines/red berries; an old wooden waterwheel on stone supports with a short trough and teal drops; a small oval stone-edged blue-green pond with reeds, golden star reflections and a blue mushroom. Same chunky outlined pixel style and ground baseline. No founders, scene, text, labels or numbers.

Final spacing repair: preserve designs and colors, shrink into the central70percent of three equal square cells. Centers one-sixth/one-half/five-sixths of width. At least15percent margin on every side. Separate the gate leaves and wheel droplets so nothing crosses cell edges. Final sheet2172x724px,724px cells.

## 5. Game window skin — window-skin.png

A single square front-view pixel-art nine-slice UI frame. Symmetrical straight edges, chunky dark purple/navy outline, warm golden timber bevel, crisp stepped highlights, thin moss-teal inner trim, dark blue-green empty center. Frame fills the square apart from tiny alpha corner cutouts. Flat edge sections can stretch. No perspective, external shadow, title bar, symbols, typography, ornaments or icons. No smooth gradients. The implementation uses the border image with a plain dark HTML center so text remains actual readable text.

## Inspection and use

All generated assets were visually inspected. The first atlases were rejected for cell overlaps; the revised sheets have measured visible-alpha gutters in every cell. All three final sprite sheets preserve true alpha. The habitat is opaque. No Python painting, vector replacement, emoji substitution or code-drawn practice opponent was used. Sprite selection/positioning and UI text remain native HTML/CSS for interaction and accessibility.

Asset recipes describe intended visual style; they do not establish that the complete game, species charter, hosting or school integration is finished. Founder files are the fixed reference, and Grant's visual review remains the acceptance for the new interface.
