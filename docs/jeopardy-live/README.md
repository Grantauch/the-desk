# Progressive Era Jeopardy V3: host guide

The game is `public/hubs/ush9-progressive-era-jeopardy-v3.html`. The Chromebook buzzer and phone remote page is `public/hubs/jeopardy-buzz.html`, and students reach it at **grant-desk.com/buzz**.

This file is for the teacher. Nothing in it appears on a student screen.

## One time setup for live play

Live play uses the same Firebase project as Robber Barons and Stop the Presses. Firebase refuses Jeopardy rooms until the updated rules are published:

1. Open <https://console.firebase.google.com>, pick the **robber-barons** project, then **Build > Realtime Database > Rules**.
2. Delete everything in the box, paste the whole of `docs/robber-barons-online/database.rules.json`, and click **Publish**.

Robber Barons and Stop the Presses keep working exactly as before. Until the rules are published, the whole game still works on one screen and **Go live** shows an error.

## Running a game on one screen

1. Open the game on your laptop and press **Projector window**. Drag the new window onto the classroom screen and click it once for full screen.
2. Name the teams, choose a look, and press **Start game**.
3. Click any tile in any order. When a team answers, press the check or the X under that team's name. Keys 1 to 8 mark a team right, and Shift with the number marks it wrong.
4. **Pick a Number** settles steals and ties like a sticky note. Type each team's guess and your secret number, which shows as dots, then reveal.

While the projector window is open, the answer shows on your laptop only. With one mirrored screen the answer stays hidden until you reveal it.

## Running a live game

1. Press **Go live** on the start screen or in the top bar. The panel shows a four letter code, and the projector shows it with the web address.
2. Students open grant-desk.com/buzz on their Chromebooks, type the code and their first name, and pick a team. Their names appear under each team in the Live panel. Tap the × beside a name to remove it.
3. **Buzzers.** With "Open buzzers after the read" on, buzzers open a few seconds after a clue appears, based on its length. Turn it off to open them yourself with **Open buzzers** or B. The first buzz by server time wins. The game waits a third of a second so a slower Chromebook still counts by when it pressed, then the projector shows the team, the student and how far ahead they were. A team that misses is locked out and the buzzers reopen for steals.
4. **Room calls.** While a team answers, everyone else predicts right or wrong on their Chromebook. Each team whose majority calls it earns half the lowest tile value on the board. Turn it off in the Live panel.
5. **Pick a Number.** Each team locks one guess on a Chromebook. Nobody can see another team's number, and the projector shows only a check until the reveal.
6. **Final Jeopardy.** Teams type a wager, capped at their score, and then an answer. Anyone on the team can save, and the last save counts until you press Pencils down. When you judge a team, its wager fills in on your screen and its answer appears on the projector.

You can still judge any team by hand at any time. A buzz only tells you who was first.

## Phone remote

In the Live panel, scan the code with your phone or type the link under **Phone remote**. The link carries a PIN, so open the panel only on your laptop, not on the projector. The phone shows the board to pick tiles, the clue with its answer and your notes, a check and X for every team, and the buttons for buzzers, reveal, hint, timer, Pick a Number and Final Jeopardy.

## After the game

**End live play** in the Live panel deletes the room and every name and answer in it. If you forget, nobody can read the room once it is a day old, and the next room you open from the same computer deletes it. If the laptop refreshes during a game, the room reconnects by itself. If a Chromebook refreshes, the student lands back on the same team.

## What students send

A typed first name, the team they picked, their buzzes, room calls, Pick a Number guesses and Final Jeopardy wagers and answers go to the teacher's Firebase project under `jep/`. No email, no Google account, no grades. The rules stop players from reading another team's guesses or Final answer, from buzzing before the buzzers open, from faking a buzz time, and from sending remote commands.

## Cloud boards

Edits normally live in the browser where you made them. To edit at home and play at school, open **Boards** and press **Cloud** on a board. You get a link. From then on every edit saves to the cloud a moment after you type it, including fixes made in the middle of a game.

Open the link on another computer and the board appears there, ready to play. When either computer loads the game, it pulls any newer edits made on the other one. **Open a cloud link** in Boards does the same thing when you paste a link.

Anyone with the link can open and change the board, so share it only with teachers you trust and keep it off the projector. A built in board saved to the cloud becomes your own copy, and the original stays untouched. Cloud boards live in the same Firebase project under `jepBoards/`, hold no student information, and nobody can list them without the link.

## Editing questions

Press **Edit** in the top bar, or **Edit questions** on the start screen. Every category, clue, answer, hint, teacher note, point value, Daily Double and Final Jeopardy clue can be changed, and edits save as you type. **Boards** holds copies, imports, exports and **Paste from a spreadsheet**, which builds a board from six columns: Round, Category, Clue, Answer, Explanation, Hint.
