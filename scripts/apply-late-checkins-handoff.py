from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'scripts/validate-grantdesk-handoff.mjs'
text = path.read_text()

old = "  'teacherVoidPass',\n  'teacherApplyUnmatchedEmail',"
new = "  'teacherVoidPass',\n  'teacherSetCheckInWindow',\n  'teacherReviewLateCheckIn',\n  'teacherApplyUnmatchedEmail',"
if text.count(old) != 1:
    raise SystemExit(f'critical-function map: expected one match, found {text.count(old)}')
text = text.replace(old, new, 1)

old = "  /const\\s+GD_SCHEMA_VERSION\\s*=\\s*['\"]2026-09-05-session-a['\"]/.test(code),\n  'tracked workbook schema is 2026-09-05-session-a'"
new = "  /const\\s+GD_SCHEMA_VERSION\\s*=\\s*['\"]2026-09-09-late-checkins['\"]/.test(code),\n  'tracked workbook schema is 2026-09-09-late-checkins'"
if text.count(old) != 1:
    raise SystemExit(f'schema handoff map: expected one match, found {text.count(old)}')
text = text.replace(old, new, 1)

path.write_text(text)
print('hall-pass handoff map aligned')
