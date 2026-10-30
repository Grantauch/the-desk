# HEEL report project map

Owner: Codex. Source reviewed before implementation: main `2987b531beeba51b114a4947847eba5d17d94ea3`.

## Routes and student flow

The case-insensitive `heal` search found health and game matches, no HEAL assignment. The requested project is HEEL, America's Most Hated. `netlify.toml` redirects `/hubs/bts-americas-most-hated` to `/hubs/bts-americas-most-hated-research.html`. The research URL also works without `.html` through Netlify pretty URLs. The release-sealed original `/hubs/bts-americas-most-hated.html` and finished exemplar remain unchanged. The research page links from the StoryHub catalog and Beyond the Scoreboard course page.

Students read Watch, Headlines, Switch, The Card, Mission, Prove It, and Rules, then enter five research rounds. These reading interactions do not collect written answers. The Final Bell after the lab is discussion only, with no input. Source credits and the finished exemplar are reference reading. The lab uses `bts-americas-most-hated-lab.js`, `bts-americas-most-hated-originality.js`, its scoped CSS, and `desk-save.js`.

## Saving and completion

`desk-save.js` owns all existing answer saving. `sessionStorage['desk-save:v1:bts-americas-most-hated-research']` stores `state.values`. Text fields use `id:<id>` and radio groups use `r:<name>`. These same keys travel through existing PIN account recovery and personal backup files. There is no project localStorage answer key. The shared runtime also maintains device and teacher preferences in localStorage, neither is answer storage. No existing save path will change.

All five tabs and Previous/Next buttons can be used freely, with no gate on incomplete rounds. `go(n)` in lab.js toggles `hidden`, updates `aria-current`, focuses the round tab and scrolls to the lab. Draft completion is a character-count signal only. Required minimum lengths are listed below. Optional fields and the self-check do not affect draft completion. The final round currently ends with Previous and an exemplar link. Turn In is a separate server-acknowledged action and must remain separate from the personal report.

## 1. Who did the audience think they were seeing?

| Field id | Type | Form name | Exact answer prompt including help | Stored value |
| --- | --- | --- | --- | --- |
| lab-heel | text | lab_heel | Your wrestler Choose from the fight card below or type the name. | state.values["id:lab-heel"] |
| lab-identity | textarea | lab_identity | Q1 · Who was the heel? (10 points) Wrestling name, real name, hometown, years the character was famous, and two sentences about the character. | state.values["id:lab-identity"] |
| lab-initial-hypothesis | textarea | lab_initial_hypothesis | Your first idea One or two sentences: Why do you initially think audiences booed this wrestler? You will return to this idea later and say what you learned. | state.values["id:lab-initial-hypothesis"] |
| lab-character-clue | textarea | lab_character_clue | A clue about the character What was the most recognizable thing about the character: an entrance, outfit, manager, catchphrase, rivalry or flag? Explain why it caught your eye. | state.values["id:lab-character-clue"] |

## 2. Build the historical timeline.

| Field id | Type | Form name | Exact answer prompt including help | Stored value |
| --- | --- | --- | --- | --- |
| lab-history | textarea | lab_history | Q2 · What was happening in the world? (15 points) Name the event or issue. Who was involved? Where and when did it happen? Include a specific number, person or documented event. | state.values["id:lab-history"] |
| lab-event-date | text | lab_event_date | Historical event date YYYY or YYYY-MM-DD; use the date your evidence supports. | state.values["id:lab-event-date"] |
| lab-character-date | text | lab_character_date | Character known to be in use by Earliest year or date your research can verify. | state.values["id:lab-character-date"] |
| lab-match-date | text | lab_match_date | Date of a match or wrestling story The specific example you will use in your talk. | state.values["id:lab-match-date"] |
| lab-timeline-meaning | textarea | lab_timeline_meaning | What do these dates tell you? Did this news create the character, change it, or just happen at the same time? What facts support your answer? | state.values["id:lab-timeline-meaning"] |

## 3. Why did they boo?

| Field id | Type | Form name | Exact answer prompt including help | Stored value |
| --- | --- | --- | --- | --- |
| lab-wrestling | textarea | lab_wrestling | Q3 · How did wrestling use that history? (15 points) Give at least two specific examples: a named match, a speech, an entrance, costume, manager, flag, anthem or rivalry. Explain what each detail borrowed from real life. | state.values["id:lab-wrestling"] |
| lab-audience | textarea | lab_audience | Q4 · Why did the crowd hate this character then? (15 points) Connect the reaction to a belief, fear or conflict at that particular time. Who was the target audience? What evidence supports your interpretation? | state.values["id:lab-audience"] |
| lab-america | textarea | lab_america | Q5 · What does the character tell us about America? (15 points) Identify the stereotype or prejudice. Decide whether the portrayal was fair to the people it claimed to represent, and defend your position with a detail from your research. | state.values["id:lab-america"] |
| lab-revised-hypothesis | textarea | lab_revised_hypothesis | What did you learn? Look back at your starting theory. What would you now change or qualify? Point to one specific source, document or date that caused the change. | state.values["id:lab-revised-hypothesis"] |

## 4. Can another person check your claims?

| Field id | Type | Form name | Exact answer prompt including help | Stored value |
| --- | --- | --- | --- | --- |
| lab-source-one | textarea | lab_source_one | Source 1 · Where did you find it? Author, title, website or book, date, and link if available. | state.values["id:lab-source-one"] |
| lab-source-one-claim | textarea | lab_source_one_claim | What does source 1 prove? Give one fact from this source. Was it made at the time, or was it written later? | state.values["id:lab-source-one-claim"] |
| lab-source-two | textarea | lab_source_two | Source 2 · Where did you find it? Author, title, website or book, date, and link if available. | state.values["id:lab-source-two"] |
| lab-source-two-claim | textarea | lab_source_two_claim | What does source 2 prove? Find a fact that supports or disagrees with your first source. | state.values["id:lab-source-two-claim"] |
| lab-independent | textarea | lab_independent | Which source is NOT from WWE? Why do you trust it? A WWE clip is valuable evidence of a wrestling portrayal, but it may not independently establish what the public believed. | state.values["id:lab-independent"] |
| lab-visual | textarea | lab_visual | Your photo or video proof (5 points) Identify a historical photo or a wrestling clip of no more than 30 seconds. Include where it comes from, the image/link or clip timestamp, and exactly what it helps prove. | state.values["id:lab-visual"] |

## 5. Teach us in two to three minutes.

| Field id | Type | Form name | Exact answer prompt including help | Stored value |
| --- | --- | --- | --- | --- |
| lab-slide-one | textarea | lab_slide_one | Slide 1 · Meet the heel Which facts and image identify the wrestler and the character? | state.values["id:lab-slide-one"] |
| lab-slide-two | textarea | lab_slide_two | Slide 2 · The real headline Dates, the real historical event, and the connection to wrestling. | state.values["id:lab-slide-two"] |
| lab-slide-three | textarea | lab_slide_three | Slide 3 · Your conclusion (optional third slide) Why the crowd responded and what the portrayal tells us about America. Two slides are fine if they cover everything. | state.values["id:lab-slide-three"] |
| lab-talk | textarea | lab_talk | Speaking plan How will you explain all five questions in your own words without reading slides? What is your strongest piece of evidence? | state.values["id:lab-talk"] |
| lab-defense-answer | textarea | lab_defense_answer | Your answer Use one precise detail and a real source. This is a preparation tool, not a second grade. | state.values["id:lab-defense-answer"] |
| lab_check_1 | radio, Yes or Not yet | lab_check_1 | Q1 · Names, hometown, years, two-sentence gimmick 10 pts | state.values["r:lab_check_1"] |
| lab_check_2 | radio, Yes or Not yet | lab_check_2 | Q2 · Historical dates and a checkable fact 15 pts | state.values["r:lab_check_2"] |
| lab_check_3 | radio, Yes or Not yet | lab_check_3 | Q3 · Two specific wrestling details linked to history 15 pts | state.values["r:lab_check_3"] |
| lab_check_4 | radio, Yes or Not yet | lab_check_4 | Q4 · Explain why fans reacted that way then 15 pts | state.values["r:lab_check_4"] |
| lab_check_5 | radio, Yes or Not yet | lab_check_5 | Q5 · Explain whether the character was fair, using facts 15 pts | state.values["r:lab_check_5"] |
| lab_check_6 | radio, Yes or Not yet | lab_check_6 | Two trustworthy sources, at least one outside WWE 10 pts | state.values["r:lab_check_6"] |
| lab_check_7 | radio, Yes or Not yet | lab_check_7 | Complete your answers 10 pts | state.values["r:lab_check_7"] |
| lab_check_8 | radio, Yes or Not yet | lab_check_8 | Historical photo or clip no longer than 30 seconds 5 pts | state.values["r:lab_check_8"] |
| lab_check_9 | radio, Yes or Not yet | lab_check_9 | 2–3 minute delivery, three slides maximum 5 pts | state.values["r:lab_check_9"] |

## Draft thresholds

1. lab-heel 3, lab-identity 45, lab-character-clue 20, lab-initial-hypothesis 25.
2. lab-history 45, lab-event-date 4, lab-character-date 4, lab-timeline-meaning 35. lab-match-date optional.
3. lab-wrestling 45, lab-audience 45, lab-america 45, lab-revised-hypothesis 25.
4. lab-source-one 20, lab-source-one-claim 25, lab-source-two 20, lab-source-two-claim 25, lab-independent 25, lab-visual 25.
5. lab-slide-one 20, lab-slide-two 20, lab-talk 35, lab-defense-answer 25. lab-slide-three optional. All lengths are trimmed character counts.

The `lab-paste-override` checkbox is a session-only writing preference marked `data-desk-skip`. The practice timer is ephemeral lab.js state (`elapsed`, `started`, `ticker`). Neither is an answer. The generated source-defense prompt is selected by a deterministic wrestler-name hash across five questions in originality.js and is attached as `data-q` to lab-defense-answer. The report gives that answer the editorial heading Defending the evidence. The worksheet prompt remains in the existing round and in this map.

The exact generated prompts, with the selected wrestler substituted for `{name}`, are:

1. For {name}, find one source that disagrees with your idea. What would you say about it?
2. For {name}, which date might someone get wrong? What source shows the correct date?
3. For {name}, how was the real wrestler different from the character? Give one fact and a source.
4. For {name}, name one detail that fans in a different decade might see differently.
5. For {name}, what is your strongest fact? What does that fact NOT tell us?

## Report design and read path

Retain the existing arena black, bone paper, oxblood red, ring gold, Barlow Condensed, Barlow and Source Serif typography. Use an editorial dark cover and paper chapters with generous margins, numbered divisions and a restrained red rule. No new artwork or dependencies. Read current DOM values, including hidden rounds, on every report open and on restoration events. Use `textContent` for every student string. Keep five chapters in existing field order, and include self-check choices without a score. The final chapter is the closing presentation and source defense.

Cover quote: first sentence of lab-america (the student's supported main claim), otherwise first sentence of lab-identity, otherwise the first nonempty textarea in project order. Do not invent a quote. Persist only report name, hour and date in a separate sessionStorage key scoped to the existing account identity or tab. Report inputs carry data-desk-skip so they never join Turn In, backup answers, grading or cloud data. Reset report metadata when the shared runtime resets the student.

Add a reachable Report button in the existing sticky bar and a final Finish and view report action. This action opens the personal report and never calls Turn In. Reading mode includes quiet incomplete notes linking to the correct round and field. Printing and presenting omit incomplete notes and empty subsections. Presentation uses measured sentence pagination at a readable minimum size, word wrapping only for an oversized sentence or token. Print uses US Letter and browser pagination.
