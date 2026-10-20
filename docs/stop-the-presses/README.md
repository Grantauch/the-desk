# Stop the Presses: host guide

A live review game for the Progressive Era unit in U.S. History 9. Every student runs a newspaper. Each story is a question about the unit, and students decide how big to print it before they answer. The page is `public/hubs/ush9-stop-the-presses.html`, and students reach it at **grant-desk.com/press**.

This file is for the teacher. Nothing in it appears on a student screen.

## One time setup

Live games use the same Firebase project as Robber Barons. Firebase only accepts Stop the Presses games after the updated rules are published:

1. Open <https://console.firebase.google.com>, pick the **robber-barons** project, then **Build > Realtime Database > Rules**.
2. Delete everything in the box, paste the whole of `docs/robber-barons-online/database.rules.json`, and click **Publish**.

Robber Barons keeps working exactly as before. Until the rules are published, solo play and the Morgue still work, and Host a live game shows an error.

## Running a game

1. On the projector computer, open grant-desk.com/press and choose **Host a live game**.
2. Pick the desks to include, the edition length and the clock. A Daily edition is 20 stories and takes about 15 minutes.
3. Press **Get a game code**. Students open grant-desk.com/press on their Chromebooks, choose **Join a game**, type the code and their first name, and get a newspaper name.
4. Tap any paper on the newsstand to pull it off. Use this for a bad first name. The student can rejoin with a real one.
5. **Start the presses.** The space bar or Enter presses the main button on every projector screen.

Each story runs like this: a three second read, then the clock. Students pick Inside Page, Front Page or EXTRA! and then an answer. When everyone has filed, or the clock runs out, the screen slams STOP THE PRESSES and shows the answer, the fact behind it, and how the room voted. **Stop the presses now** ends a story early when one student is stalling.

If the projector browser refreshes or crashes, open the page again, choose Host a live game, and press **Resume game**. If a Chromebook refreshes, the student joins again with the same code and lands back in the same paper with the same score.

## The scoring, in case a student argues

| | Correct | Wrong |
|---|---|---|
| Inside Page | 600 plus up to 400 for speed | nothing lost |
| Front Page | double | lose 300 |
| EXTRA! | triple | lose 700 |

- Every paper starts with 2,000 readers and can never fall below zero.
- Three or more correct in a row adds a streak bonus of 100 per story past the second, up to 500.
- Order rounds have no stakes. All four in place pays 1,000 plus speed. Otherwise each correct spot pays 150.
- Reform stories carry a law. If two thirds of the room gets one right, the law passes, gets stamped on the screen, and everyone who got it right gets 250 more. The final screen lists the reforms the class passed.
- Every five stories the **Editor's Desk** offers three advantages for the next three stories: Flash Powder crosses out one wrong answer, Rotary Press doubles the speed bonus, Libel Lawyer cancels losses, and Army of Newsboys adds 300 to each correct story.

## After the game

**Close the newsroom** deletes the game and every score in it. Games nobody closes are swept away a day later. Nothing is graded and no scores leave the game.

Students can keep studying on their own. **Play solo** runs the same stories against the Evening Rag with the fact after every story, then lists every missed story with a button to replay just those. **The Morgue** shows every question, answer and fact, grouped by desk and searchable.

## Editing questions

All 85 stories are in `public/hubs/ush9-stop-the-presses-bank.js`. Each one lists the correct answer first, and the game shuffles the choices on screen. The bank was built from the Drive materials used this year: the Progressive Era overview deck, the muckrakers week on Riis, Tarbell and Sinclair, the Spanish American War deck, the Populist Party notes, and the Progressivism and Imperialism test.

## What students send

A typed first name, a newspaper name from a fixed list, each answer and each Editor's Desk pick go to the teacher's Firebase project under `stp/`. No email, no Google account, no grades.

## Photo credits

Every photo is from the Library of Congress Prints and Photographs Division. All of them were made before 1929 and are in the public domain in the United States. The images were cropped and printed in two tones for the newspaper look.

| File | Photograph | Source |
|---|---|---|
| `home.webp` | Newsboys, Utica, New York, 1910, Lewis Hine | <https://www.loc.gov/item/2018675526/> |
| `city.webp` | Jane Addams of Hull House, 1913, Lewis Hine | <https://www.loc.gov/item/2018676451/> |
| `inv.webp` | Family in Poverty Gap, New York tenement room, 1889, Jacob Riis | <https://www.loc.gov/item/2002710281/> |
| `labor.webp` | Breaker boys, Hughestown Borough, Pennsylvania, 1911, Lewis Hine | <https://www.loc.gov/item/2018676232/> |
| `pol.webp` | Suffrage parade, 1913, Bain News Service | <https://www.loc.gov/item/2014691470/> |
| `wh.webp` | Theodore Roosevelt and reporters, Syracuse, 1915, Bain News Service | <https://www.loc.gov/item/2014699027/> |
| `farm.webp` | Democratic nominees William J. Bryan and Arthur Sewall, 1896 | <https://www.loc.gov/item/2001697077/> |
| `war.webp` | Wreck of the USS Maine, Havana, about 1900, Detroit Publishing Co. | <https://www.loc.gov/item/2016794068/> |
