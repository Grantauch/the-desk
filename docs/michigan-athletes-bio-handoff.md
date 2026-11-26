# Michigan Athlete Report: writing the athlete bios

The project is live without bios. Every athlete page shows "This story is still being written" until its record has text. Your job is to fill in the records. Do not touch any other file.

**The one file to edit:** `public/hubs/mia/athletes.js`

Each athlete is one object in `window.MI_ATHLETES`. Name, sport, hometown, map point (`lat`, `lon`) and filter tags are already set. Check the hometown and the map point, then fill in every empty field. Keep the order of the list and keep every `slug` exactly as it is, because student teams are saved under the slug.

## Fields

| Field | What goes in it | Example |
|---|---|---|
| `known` | Position or event, short | `"Pitcher"` |
| `teams` | Main teams or schools, short | `"California Angels, New York Yankees"` |
| `hometown` | Michigan town shown on the card and map. Already filled; fix if wrong | `"Flint"` |
| `michiganTie` | One sentence: the athlete's connection to Michigan | `"Grew up in Flint and pitched for Flint Central High School."` |
| `born` | ISO date | `"1967-09-19"` |
| `bornPlace` | City and state | `"Flint, Michigan"` |
| `died` / `diedPlace` | ISO date and place, or `""` if living | `""` |
| `hook` | One sentence that makes a student want to click. Shows on the card | |
| `numbers` | Three `[value, label]` pairs. Real numbers only | `[["1993", "No hitter for the Yankees"], ["1988", "Olympic gold medal"], ["87", "Big league wins"]]` |
| `bigMomentLabel` | The date or event of the big moment | `"September 4, 1993"` |
| `growingUp` | 2 or 3 paragraphs: family, town, how the sport started, who helped | |
| `bigMoment` | 2 or 3 paragraphs: the single biggest moment, told in order with date, place, what was at stake | |
| `beyond` | 2 or 3 paragraphs: what the athlete faced away from the game (race, money, injury, disability, gender, the city), how people reacted at the time, what the story shows about Michigan or America | |
| `legacy` | 2 or 3 paragraphs: the rest of the career, records and honors with numbers, how Michigan remembers them now | |
| `quote` | Optional. `{ "text": "...", "who": "Name", "when": "year" }`. Only a quote you can source exactly. Use `null` if unsure | |
| `links` | 2 to 4 `[title, url]` pairs for the sources you used | `[["Jim Abbott, Society for American Baseball Research", "https://sabr.org/..."]]` |
| `photo` | Leave `null`. The site does not pull photos of people from the web | `null` |

The page turns `growingUp`, `bigMoment`, `beyond` and `legacy` into the four chapters students read. The student questions line up with them:

* Partner A, Growing Up: where they grew up and who was in the family, what the town was like, how they got started and who helped.
* Partner B, The Big Moment: set the scene and what was on the line, what made it hard, what they did in order.
* Partner A, Beyond the Scoreboard: what they faced away from the game, how people reacted at the time, what the story shows about Michigan or America.
* Partner B, Legacy: what happened after the big moment, records or honors with at least one number, how Michigan remembers them.

Every one of those questions must be answerable from the chapter it points to. Students are told they do not need any other website.

## Writing rules

* Reading level: below grade level high schoolers. Short sentences, plain words, concrete facts.
* Every paragraph carries a date, a name, a number or a story. No filler.
* 3 to 5 sentences per paragraph. 2 or 3 paragraphs per chapter.
* No hyphens, no semicolons, no dashes, no parentheses.
* No lists of three, no slogans, no dramatic flourishes. Plain and specific.
* Use the athlete's own pronouns. The Davis and White entry is about the pair.
* Facts must come from credible sources you list in `links`: Hall of Fame pages, SABR, Olympics.com, team sites, newspapers, Wikipedia as a starting point.

## The 24 athletes

| slug | name | sport | hometown on file |
|---|---|---|---|
| joe-louis | Joe Louis | Boxing | Detroit |
| claressa-shields | Claressa Shields | Boxing | Flint |
| thomas-hearns | Thomas Hearns | Boxing | Detroit |
| serena-williams | Serena Williams | Tennis | Saginaw |
| magic-johnson | Magic Johnson | Basketball | Lansing |
| draymond-green | Draymond Green | Basketball | Saginaw |
| chris-webber | Chris Webber | Basketball | Detroit |
| george-gervin | George Gervin | Basketball | Detroit |
| mateen-cleaves | Mateen Cleaves | Basketball | Flint |
| jim-abbott | Jim Abbott | Baseball | Flint |
| derek-jeter | Derek Jeter | Baseball | Kalamazoo |
| willie-horton | Willie Horton | Baseball | Detroit |
| kirk-gibson | Kirk Gibson | Baseball and football | Waterford |
| jerome-bettis | Jerome Bettis | Football | Detroit |
| hayes-jones | Hayes Jones | Track and field | Pontiac |
| eddie-tolan | Eddie Tolan | Track and field | Detroit |
| sheila-young | Sheila Young | Speed skating and cycling | Birmingham |
| jordyn-wieber | Jordyn Wieber | Gymnastics | DeWitt |
| davis-and-white | Meryl Davis and Charlie White | Ice dance | West Bloomfield and Royal Oak |
| allison-schmitt | Allison Schmitt | Swimming | Canton |
| mike-modano | Mike Modano | Hockey | Livonia |
| dylan-larkin | Dylan Larkin | Hockey | Waterford |
| brad-keselowski | Brad Keselowski | Auto racing | Rochester Hills |
| the-sheik | The Sheik (Ed Farhat) | Pro wrestling | Lansing |

Several were born outside Michigan and grew up here, or the reverse. Joe Louis, Derek Jeter, Willie Horton, Thomas Hearns, Eddie Tolan and Allison Schmitt grew up in Michigan after being born elsewhere. Serena Williams was born in Saginaw and grew up in California. Say which in `michiganTie`.

## Check before handing back

* `node -e "global.window=global;require('./public/hubs/mia/athletes.js');console.log(window.MI_ATHLETES.filter(a=>!a.growingUp.length).map(a=>a.slug))"` prints `[]` when every bio is written.
* `npm run mia:browser` passes.
