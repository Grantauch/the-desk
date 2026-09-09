from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'scripts/validate-grantdesk-handoff.mjs'
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

page_path = root / 'src/pages/check-in.astro'
page = page_path.read_text()
old = 'Wait for the confirmation and check your school-day streak. On-time check-ins count automatically; if you are late, your teacher decides whether that day earns the point and joins the streak.'
new = 'Wait for the confirmation and check your school-day streak. On-time check-ins count automatically; if you are late, your teacher decides whether that day earns the point and joins the streak. Weekends and official no-school days never break it.'
if page.count(old) != 1:
    raise SystemExit(f'public streak guidance: expected one match, found {page.count(old)}')
page_path.write_text(page.replace(old, new, 1))

print('hall-pass handoff map and public guidance aligned')
