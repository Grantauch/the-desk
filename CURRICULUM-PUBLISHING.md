# Curriculum publishing rules

The website has two curriculum routes with different structures.

## Classroom-ready course route

The current public courses use:

`course -> unit -> student materials + learning hub`

- Course and unit copy lives in the three course pages under `src/pages/`.
- Approved Drive resources live in `src/data/resources.json`.
- The full teacher inventory and original unit mappings belong only in the ignored `src/data/resources.private.json` and `src/data/unit-materials.private.json`; never commit either file to this public repository.
- Unit assignments live in `src/data/unit-materials.json`.
- Interactive practice lives in `src/data/learningHubs.ts`.
- Every unit uses an explicit `hubSlug`; do not link hubs by array position.

Public eligibility for a catalog resource is one contract:

- `onWebsite: true`
- `status` is not `restricted`
- either a non-empty `href`, or `status: 'coming-soon'` with no `href`

A `coming-soon` record is a deliberate placeholder. It appears on the site as announced but not yet linked, and it has no `href` on purpose. Anything with content and sharing permissions that are not student-safe stays `restricted` and never reaches the public catalog.

Resource sync, the local editor, and the public validator use the shared eligibility contract in `src/lib/public-resources.js`. Coming-soon entries remain available for unit assignment. Authoring sync validates both public outputs before writing and leaves the private source files unchanged.

`resources:sync` is an explicit authoring step that rewrites the public catalog from the ignored private inventory. Run it only when you intend to republish the catalog, then inspect the resulting catalog and assignment changes. Ordinary verification and publishing never run sync and do not need the private inventory.

Hand-wired unit materials must set `materialsAudience: 'student'`. Unclassified fallbacks stay private by default.

## Three-Course Lecture Remix route

The remix must use:

`course -> block -> day/lecture`

`unit/arc` is a tag, not a parent, because several blocks cross unit boundaries.

When a remix block is ready for the website, export one current record per day with:

- `courseSlug`
- `block`
- `courseDay`
- `week`
- `weekday`
- `role`
- `lectureNumber`
- `title`
- `unitArc`
- `courseQuestion`
- `productionStatus`
- `audience`
- `access`
- `rightsStatus`
- `href`
- `version`
- `isCurrent`

Keep `localSourcePath` only in the ignored private production manifest. Never place a Windows or OneDrive path in the public export.

Do not publish roadmap-only, rough-scripted, locally complete, or Drive-deferred files. A public remix record requires:

1. content and source QA passed;
2. the student artifact exists in Google Drive;
3. image and redistribution rights are cleared;
4. the intended student/school account can open it;
5. the record points to the current additive version;
6. the local build, static check, preview, and link audit pass.

## Never place on the public static site

- teacher keys, scoring editions, confidential guides, or refresh ledgers;
- pretests, tests, cumulative finals, or timed quiz links before intentional release;
- Forms-builder scripts;
- internal QA reports, source registers, sidecars, or production scripts;
- licensed teacher copies or resources without redistribution clearance;
- superseded or archive versions in the normal student route.

Google Drive permissions are the access-control boundary. An unlisted site route, `noindex`, or a hidden menu is not security.

## Version rule

Never delete or overwrite a curriculum baseline. Upload and catalog corrections as clearly labeled additive versions, mark exactly one version current, and retain the predecessor in the private archive.
