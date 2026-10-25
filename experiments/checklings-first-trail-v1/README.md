# Checklings: First Trail — founder playtest

Open **START-CHECKLINGS.html** in Edge or Chrome. The release package includes this complete offline file; it needs no installation or running server. `index.html` and the neighboring scripts are the editable source. The four founders and original artwork are Mochi, Bolt, Zee and Ember.

## A useful first five minutes

1. Pick a founder. Play together, then give them a quiet rest. Check the new memory at the side.
2. Choose **Take the trail**. Visit the seed gate, waterwheel and star pond, using your companion’s discovery action at each stop.
3. Three discoveries unlock the **Moonbean planter**. Choose **Make it yours** to put it in your clearing. You do not need to battle, and stamps are never spent.
4. Try the same trail with another founder. All four discover something different at every stop: twelve distinct findings in total.
5. In **Friendly practice**, watch the dummy’s announced move. Guard a heavy swing; recover when the dummy rests. Each founder’s signature behaves differently. You can switch companions or leave safely.
6. Open **Your field journal**. Then choose **Your saves & settings → Download your save** to keep a portable copy.

## What works here

- Four selectable founders, nicknames, original animated portraits and still frames.
- Care changes food, energy, comfort, spirits and familiarity. A full companion refuses another ordinary meal; exhausted companions can always rest for free.
- Memories are created by actual actions in this playtest. The beginning does not invent previous relationships or founder history.
- Three trail stops, twelve species-specific discoveries and three keeper decoration milestones.
- Nonlethal turn-based practice: telegraphed enemy attacks, stamina, guard/recover, founder switching and distinct signatures. Bolt stores blocked-hit charges; Ember banks heat through recovery; Zee alternates orbit effects; Mochi shields while attacking.
- A first practice badge gives one stamp; rematches do not farm rewards. A keeper can unlock every decoration through discovery alone.
- Save/reload, downloaded JSON, validated import preview and a recoverable pre-import safety copy.
- Quiet mode and the system’s reduced-motion setting use PNG stills. All outcomes remain available. Native dialogs, keyboard focus and compact-screen layouts are included.

No food, energy or health drains with time. Closing a browser, missing school, losing a connection or leaving the page open cannot harm these sample companions. Care costs occur only when you choose an activity.

## Saving and moving between browsers

The playtest saves locally under its own namespace, separate from older Checklings demos. A different browser, device or file location may have a different save area. Export JSON from the old location and import it in the new one. A Drive ZIP does not synchronize saves automatically. Browser storage may be cleared or denied; the interface reports session-only progress if saving is unavailable. Keep an exported copy when progress matters.

Import reads at most 100 KB, checks format/version and all four founders, bounds numbers/arrays/text, ignores unknown fields, and displays imported text without interpreting markup. Loading requires an explicit confirmation and a browser safety copy. This is data hygiene for an editable local sample; it is not secure authority for classroom rewards.

## Scope and evidence

This is an isolated gameplay experiment using sample founders. It is not wired to the school PIN bridge, database, Daily Check-In, attendance, points, Hall Pass, or real student records. It makes no HTTP(S) requests. Its state format is not a proposed replacement for the service’s authoritative contracts. No source, legacy progress or deployed classroom service is replaced.

Only four founders are playable here. The remaining eight pilot species, recruitment, multiplayer, breeding, permanent consequences and the 300-species charter remain separate work. This local playtest does not satisfy the full First12 or school-device gates. Source review, hosting, real saves, teacher controls, staging and actual Chromebook acceptance remain distinct.

Original founder PNG/GIF files were reused byte-for-byte from the pinned repository baseline. The habitat is a new lightweight SVG composition. Emoji/typographic decoration markers are temporary playtest presentation, and the practice dummy is not a new collectible species. Weather is a selectable visual setting in this version; it does not imply a simulated ecology or learned behavior.

## Reproducing the checks

The source folder includes a local `package.json` only to declare CommonJS for the engine tests; no dependency installation is needed for those tests.

```
node --test engine.test.cjs
node build.cjs NEW-STANDALONE.html
```

The builder refuses to overwrite an existing artifact. Browser checks require Playwright and installed Edge (or `BROWSER_CHANNEL=chrome` for Chrome). From the repository, its existing dev dependencies supply Playwright:

```
node experiments/checklings-first-trail-v1/browser.test.cjs NEW-STANDALONE.html NEW-EVIDENCE-DIRECTORY
```

Use the actual path to the built file. Every evidence directory must be new. Browser scenarios cover care, discovery, decoration, reload, plain-text nicknames, keyboard dialogs, still art, actual downloads, rejected import, import/undo, practice victory, 390/320px layout and denied storage. These checks exercise a desktop browser, not an actual school Chromebook or class session.
