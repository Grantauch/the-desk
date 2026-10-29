# Writing Timeline and Read aloud

Added October 26, 2026. Client `desk-save.js` v3, Turn In service v10.

## What students see

Every assignment page tells students in the work panel that it keeps a timeline of how their answers were written and that the teacher receives it with Turn In. Telling them is part of the design. It discourages copying and keeps the record defensible with parents and administrators.

Every StoryHub, including reading pages, also has a Read aloud button at the bottom left. A student selects text and presses it, or presses it with nothing selected to hear the passage in the middle of the screen. It can read a student's own selected writing back for proofreading. Pause, Stop and three speeds are available. It uses the Chromebook's built in voice and sends nothing anywhere.

## What gets recorded

The timeline covers one browser tab, from the moment the page opens until Turn In.

| Recorded | How |
| --- | --- |
| Typing | Changes are saved in short batches about every 15 seconds, so the replay shows the answer growing. Individual keys are not stored, only a count of characters and a rhythm summary of the gaps between keys. |
| Pastes | Every paste with its size and position. Blocked long pastes are noted. Turning on Allow full paste is noted. |
| Text that appeared at once | Any single addition larger than a keystroke that was not a paste. Dictation, autocomplete, browser extensions and auto typing programs do this. |
| Changes with no input at all | Text that changed without the student typing, usually the page itself or an extension. |
| Loads | Work brought back from the account, a backup file or a refresh is marked as loaded so it never looks like a paste. |
| Time away | Each time the student left the tab or window for two seconds or more. Watching an embedded video does not count as leaving. |

The clipboard is never read. Nothing is recorded on reading pages. Signing out or the idle sign out on a shared Chromebook starts a fresh timeline for the next student.

## Where it goes

Turn In writes one row to the **Writing Timeline** tab of the private Turn In workbook:

- **Writing Minutes**: time spent actively editing, counting gaps under one minute
- **Typed** and **Pasted**: characters
- **Largest Single Add**: the biggest chunk that arrived in one event
- **Times Away**: absences of 10 seconds or more
- **Flags**: plain sentences, or None
- **Replay Data**: paste this cell into `grant-desk.com/teacher/writing-replay.html` to watch each answer get written

A Turn In never fails because of the timeline. If a timeline is missing or unreadable, the Turn In still lands and no timeline row is written.

## Reading the flags

| Flag | What it can mean | What else can cause it |
| --- | --- | --- |
| Pasted N characters | Text came from somewhere else | The student's own draft from a document, or their notes |
| N characters appeared at once without typing or pasting | Dictation, autocomplete, an extension or an auto typing program | Chromebook dictation is a legitimate accommodation |
| Typed straight through with almost no corrections or pauses | Copying by hand from another screen | A fast, confident writer with a short answer planned in their head |
| Typed at about N words a minute | Same as above | Strong typists reach 60 words a minute on familiar material |
| Left the page for N seconds, then added N characters within 90 seconds | Looked something up or generated it, then retyped | Checked the reading, then wrote what they had already planned |
| Most of an answer has no recorded writing in this tab | Work was written on another device or before the page opened | Work saved on another Chromebook and loaded here, or the student refreshed in a way that lost history |
| Allow full paste was turned on | Student chose to paste longer text | Pasting their own draft, which the option exists for |

None of these establish who wrote the words. The strongest next step is a two minute conversation: ask the student to explain one sentence, define a word they used, or say what they would add next. The conversation is the evidence.

## Limits

- The timeline sees one tab. Work on another device, on paper or before the page opened is invisible to it.
- A determined student can retype generated text at a natural pace. Assignment design that ties answers to things only the page shows is the stronger defense.
- Editors of the private workbook can change rows. These are operational records, not a forensic log.
- No grade, discipline decision or cheating finding is automated.

## Release

1. Merge the website pull request so `desk-save.js` v3 is live. A v9 service ignores the timeline, so order does not matter.
2. Paste `apps-script/turn-in/Code.gs` into the existing Turn In project and edit the existing deployment to a new version. Health should report `2026-10-26-turn-in-v10 or later`.
3. Optional: run `addWritingTimelineSheet` once to see the tab before the first Turn In creates it.
