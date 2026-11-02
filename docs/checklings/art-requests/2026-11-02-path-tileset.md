# Art request for Gemini: Kettle Creek dirt path tileset

Paste this into the Gemini app together with two pictures from the Checklings Sprite Book: `prop-fence.png` and one Kettle Creek building (the store or the clinic). They set the style. Return one PNG.

## What to draw

One sprite sheet of a dirt footpath for a top down village, in the same pixel art style, palette and light as the attached Checklings art. The light comes from the upper left. The path is warm packed earth with a few small pebbles. Its edges are soft and uneven, with short grass tufts growing over the border. It must match the grass tile the game already uses, so every piece shows the path on a transparent background. Do not paint any grass fill.

## Layout

- The canvas is 256 pixels wide and 320 pixels tall, on a solid magenta (#FF00FF) background.
- It holds a grid of 64 by 64 pixel cells, 4 cells across and 5 rows down, with no gaps and no labels.
- Each cell is one map tile. A path arm that touches a cell edge must cross that edge at full lane width (40 pixels wide, centered), so pieces join seamlessly.
- In every cell the path lane is 40 pixels wide and centered.

Rows 1 to 4 are the 16 neighbour pieces. Read the cell number left to right, top to bottom, starting at 0. A cell's number says which sides the path leaves through: add 1 for north, 2 for east, 4 for south and 8 for west.

| Cell | Path leaves through | Looks like |
| --- | --- | --- |
| 0 | nowhere | a single round patch of dirt |
| 1 | north | a lane end, open at the top |
| 2 | east | a lane end, open at the right |
| 3 | north, east | a bend from top to right |
| 4 | south | a lane end, open at the bottom |
| 5 | north, south | a straight vertical lane |
| 6 | east, south | a bend from right to bottom |
| 7 | north, east, south | a T opening right |
| 8 | west | a lane end, open at the left |
| 9 | north, west | a bend from top to left |
| 10 | east, west | a straight horizontal lane |
| 11 | north, east, west | a T opening up |
| 12 | south, west | a bend from bottom to left |
| 13 | north, south, west | a T opening left |
| 14 | east, south, west | a T opening down |
| 15 | all four | a crossroads |

Row 5 holds the pieces for wide dirt areas, where paths meet in a block:

| Cell | Looks like |
| --- | --- |
| 16 | solid dirt filling the whole cell, no edges |
| 17 | solid dirt with a small grass notch in the top right corner |
| 18 | solid dirt with a small grass notch in the bottom right corner |
| 19 | solid dirt with a small grass notch in the bottom left corner, mirrored for top left by the game |

## Rules

- Every piece uses the same dirt colours, the same edge thickness and the same pebble style.
- Draw no shadows from objects, no footprints, no puddles and no text.
- Keep it flat, seen straight from above like the attached art. No perspective tilt.
- Pixels should be the same size as in the attached fence art. One art pixel is 2 by 2 screen pixels in a 64 pixel cell.

## When it comes back

Save it to the Checklings Sprite Book folder as `tile-path-autotile.png`. Claude will cut it, check that every seam lines up, and switch the game from the drawn-by-code paths to this sheet. The cell layout above is fixed, so no code needs to change if the art is redrawn later.
