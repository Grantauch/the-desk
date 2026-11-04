# Hall Pass — teacher kiosk kit

1. Extract the ZIP and open **Start Here.html** in Chrome.
2. Make a copy of the blank Hall Pass template using your school account.
3. Choose **Hall Pass → Start setup**. The setup window creates your private workbook and asks for your title, schedule, and pass rules.
4. Follow the Google web app deployment steps. Google requires the owner to approve permissions and publish the web app. Choose **Execute as Me** and access **within your school**.
5. Paste the /exec link into Start Here to get your kiosk and teacher links.
6. In the teacher dashboard, open **Settings → school directory / enroll by number**. Connect the private school directory provided by the school coordinator. The owner must give your school account Viewer access to that directory only. Never share your pass-history workbook.
7. Enroll each student by their exact school number and class period. A directory entry alone never grants access. Students use their existing lunch number, including five digits or a leading zero, in every connected classroom.
8. On the door Chromebook use a school kiosk account, open the kiosk link, and select **fullscreen / keep awake**. District Chromebook settings may control these features. Keep the teacher dashboard on your own device.

Your copy starts without students. This ZIP contains no roster, lunch numbers, tokens, or deployment credentials. The source/ folder contains the full versioned application for school IT and recovery; teachers normally use the template rather than editing code.

## School directory coordinator

In your teacher dashboard, import the school list as alternating number/name lines, or tab-separated number/name/email. Optional verified email mappings use `number,school_email`. Verify identities from school records; do not infer emails from names. Preview and type the displayed confirmation before applying. Imports merge by exact student number and create no classroom memberships.

The coordinator owns a separate private directory spreadsheet. Share only that spreadsheet with individually authorized participating teachers as Viewers. Keep public/link sharing off. Each teacher connects its link from their own dashboard. Connecting an existing classroom is refused until every active student has a verified email mapping, so incomplete imports cannot strand students. Read-only lookup keeps the exact lunch number consistent across rooms. Disabled directory entries lose access in connected rooms; teacher removal disables just that classroom membership. Pass/check-in history stays in each teacher's workbook.

## Before students use it

Run the protected release check at your app's `?mode=releasecheck` while signed in as the teacher. Use synthetic identities for pass/return tests. Check that the kiosk clears the PIN and student details, an unassigned number is refused, another school account cannot open teacher controls, and a Wi-Fi interruption does not leave an uncertain pass unreviewed. Use the teacher dashboard to check the result before retrying an interrupted sign-out.

This is release candidate 1.0.0-rc.1. Automated tests cover independent classroom workbooks, exact number preservation, membership restrictions, corrections, revocation, and rate limits. A second real teacher account and managed school Chromebook still require field acceptance. Google permissions and deployment cannot be approved by extracting a ZIP.

See Recovery.md and School-IT-Checklist.md.
