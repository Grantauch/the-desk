# GrantDesk Ready V1

## Product promise

GrantDesk Ready answers one teacher question before class starts:

**Is tomorrow actually ready?**

Ready is a read-only classroom preflight module. It does not create lessons, grade students, change due dates, alter Drive sharing, submit work, or publish anything. V1 only reads a sanitized readiness snapshot and turns it into a short exception list.

## Why this module exists

GoClassroom already has the difficult local capability: an authenticated teacher browser profile, bounded Classroom/Drive helpers, strict page recognition, fail-closed behavior, and teacher-safe error reporting. GrantDesk already provides the web shell and classroom operations surface.

Ready should reuse those capabilities instead of building a second Classroom automation stack.

## V1 architecture

```text
GoClassroom / local scanner
  -> read-only Classroom + Drive checks
  -> Ready Snapshot v1 JSON
  -> GrantDesk Ready page
       -> browser-local validation
       -> overall status
       -> class-by-class exceptions
```

The GrantDesk Ready page never receives student submissions or grades. The V1 snapshot contains only teacher/course/assignment operational metadata and check results.

## Ready Snapshot v1

Required top-level fields:

- `schemaVersion`: exactly `1`
- `generatedAt`: ISO timestamp
- `source`: short source name such as `GoClassroom`
- `sourceVersion`: source app version
- `courses`: one or more course readiness records

Each course contains:

- `courseName`
- optional `windowLabel` such as `tomorrow`
- `checks`

Each check contains:

- `id`: stable machine-readable identifier
- `label`: teacher-facing check name
- `status`: `pass`, `warning`, or `block`
- `detail`: short factual explanation
- optional `assignmentTitle`
- optional `suggestedAction`

No student names, emails, IDs, submissions, grades, PINs, browser cookies, Drive IDs, Classroom course IDs, or private URLs belong in this snapshot.

## Initial check families

V1 is intentionally narrow:

1. **Classroom access** — selected class opens and the expected Classwork area is readable.
2. **Due-date clarity** — an upcoming assignment has one readable due date, or is explicitly marked with no due date.
3. **Attachment readiness** — expected attachments are present and teacher-accessible.
4. **Instruction completeness** — the assignment has readable directions or is explicitly allowed to omit them.
5. **Section coverage** — the teacher's selected classes have the expected upcoming work represented.
6. **Broken/ambiguous state** — any condition GoClassroom cannot prove becomes a warning or block, never a guessed pass.

The recent AT-CLS-110 due-date failure is exactly the kind of problem Ready should surface before it becomes a submission-time failure.

## Status rules

- **READY** — every check passes.
- **NEEDS ATTENTION** — no blocks exist, but at least one warning exists.
- **BLOCKED** — at least one blocking check exists.

Ready does not calculate a score or percentage. The goal is an exception queue, not another dashboard metric.

## V1 safety boundary

- Read-only.
- No automatic repairs.
- No student-level data.
- No hidden network upload from the Ready page.
- Imported JSON is parsed in the browser only.
- Invalid or unknown snapshot shapes fail closed.
- V1 may show a sample snapshot for product preview, but sample data must be visibly labeled.

## Next implementation step in GoClassroom

Once the current GoClassroom v0.9.23 source is synced to its repository, add a read-only `ready-scan` helper that reuses the existing teacher browser profile and Classroom discovery utilities, emits Ready Snapshot v1, and exposes it through the GoClassroom UI.

Do not build the scanner against the older v0.9.22 branch and then merge blindly. The current installed v0.9.23 patch is the implementation baseline.
