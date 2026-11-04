# Hall Pass teacher setup — development preview

This preview is a **guided setup launcher**, not a completed one-click schoolwide installer.

1. Extract the ZIP to a folder.
2. Open **Start Here.html** in Chrome or Edge on the teacher's own computer.
3. Sign in with a school Google account and click **Copy Hall Pass template**.
4. In the newly created spreadsheet, select **Hall Pass → Start setup**, complete the configuration, and deploy the Google web app when prompted.
5. Paste the resulting **/exec** URL into Start Here to generate the two links.
6. Open the kiosk link on the Chromebook by the door and the teacher link on the teacher's private device. Test only with synthetic students during pilot review.

**Schoolwide identity synchronization is not included yet.** Separate teacher copies don't currently guarantee consistent cafeteria-number PINs without centralized provisioning. Do not add real schoolwide roster data or rotate existing student PINs using this preview.

The final release must import each school-issued lunch number exactly (five or six digits, preserving leading zeros), keep unassigned students inactive, and synchronize the same credential across all participating teachers. It must protect the credential used for cafeteria purchases and meet district approval requirements.

This preview requires Google Apps Script availability and school administrator approval where applicable. The ZIP never contains student records, PINs, access tokens, or the current production workbook.
