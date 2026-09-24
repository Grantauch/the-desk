/**
 * Guided first-run setup for a teacher's own copy of Hall Pass.
 *
 * This file ships only in the classroom template (see
 * scripts/publish-hall-pass-template.mjs); the production project never
 * receives it. It uses no service Code.gs does not already use, so it adds
 * no Google permission a teacher has to approve.
 *
 * Flow: Hall Pass menu → Start setup → a few plain questions (title, where
 * students go, student email ending, bell times) → guided "turn it on" →
 * the teacher pastes the Web app link Google shows → links to share.
 */

const GD_SETUP_START_HERE_SHEET = 'Start here';
const GD_SETUP_TITLE_MAX = 60;
const GD_SETUP_WEB_APP_PATTERN = /^https:\/\/script\.google\.com\/(?:a\/macros\/[a-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]{20,}\/exec$/;

/** Menu item: open the setup window right away and let it do the slow work. */
function hallPassStartSetup() {
  const html = HtmlService.createHtmlOutputFromFile('SetupWizard').setWidth(640).setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, 'Set up your Hall Pass');
}

/**
 * On open (a simple trigger, so no permissions): a brand-new copy has only an
 * empty first tab. Turn it into a note that points at the Hall Pass menu.
 */
function hallPassShowStartHere_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || spreadsheet.getSheetByName(GD_SHEETS.SETTINGS)) return;
  let sheet = spreadsheet.getSheetByName(GD_SETUP_START_HERE_SHEET);
  if (!sheet) {
    const sheets = spreadsheet.getSheets();
    const first = sheets.length === 1 ? sheets[0] : null;
    if (!first || first.getLastRow() > 0) return;
    sheet = first.setName(GD_SETUP_START_HERE_SHEET);
  }
  sheet.getRange(1, 1, 7, 1).setValues([
    ['Welcome to Hall Pass'],
    [''],
    ['1.  Click  Hall Pass  in the menu bar above (to the right of Help), then click  ▶ Start setup.'],
    ['2.  The first time, Google asks for permission: click Continue, choose your school account, then Allow.'],
    ['     If it says Google hasn’t verified the app, click Advanced → Go to Hall Pass. It is your own copy.'],
    ['3.  Click  Hall Pass → ▶ Start setup  again. A few questions, then your student link. About five minutes.'],
    ['The Hall Pass menu can take a few seconds to appear after this page opens.'],
  ]);
  sheet.getRange(1, 1).setFontSize(24).setFontWeight('bold');
  sheet.getRange(3, 1, 4, 1).setFontSize(14);
  sheet.getRange(7, 1).setFontSize(11);
  sheet.setColumnWidth(1, 900);
}

/** The teacher check, usable before the Settings tab exists. */
function setupAssertOwner_() {
  assertTeacher_(getActiveEmail_(), settingsForAuth_());
}

function setupWorkbookIsCurrent_() {
  const properties = PropertiesService.getScriptProperties();
  const active = SpreadsheetApp.getActiveSpreadsheet();
  return Boolean(active) &&
    properties.getProperty('SPREADSHEET_ID') === active.getId() &&
    properties.getProperty('WORKBOOK_SCHEMA') === GD_SCHEMA_VERSION;
}

/** Everything the setup window shows, with sensible first answers filled in. */
function setupWizardState_() {
  const settings = getSettings_();
  const classroom = classroomSetupView_(settings);
  const owner = workbookOwnerEmail_();
  const ownerDomain = owner.split('@').pop() || '';
  const savedLink = PropertiesService.getScriptProperties().getProperty(GD_WEB_APP_URL_PROPERTY) || '';
  return {
    ok: true,
    ownerEmail: owner,
    ownerDomain,
    scriptEditorUrl: `https://script.google.com/d/${ScriptApp.getScriptId()}/edit`,
    appTitle: settings.APP_TITLE || 'Hall Pass',
    destination: settings.DESTINATION || 'Restroom',
    maxActivePasses: numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1),
    studentEmailDomain: classroom.studentEmailDomain,
    periods: classroom.periods,
    reducedPeriods: classroom.reducedPeriods,
    reducedDates: classroom.reducedDates,
    bellsReady: classroom.bellsReady,
    yearStart: classroom.yearStart,
    yearEnd: classroom.yearEnd,
    studentCount: classroom.studentCount,
    links: savedLink ? setupLinks_(savedLink, settings) : null,
  };
}

function setupLinks_(base, settings) {
  const title = String(settings.APP_TITLE || 'Hall Pass');
  return {
    student: base,
    kiosk: `${base}?mode=kiosk`,
    teacher: `${base}?mode=teacher`,
    releaseCheck: `${base}?mode=releasecheck`,
    classroomShare: `https://classroom.google.com/share?url=${encodeURIComponent(base)}&title=${encodeURIComponent(title)}`,
  };
}

/**
 * First call from the setup window. Builds the workbook tabs on a brand-new
 * copy (quietly, with no alert over the window), then reports what is set.
 */
function setupWizardLoad() {
  setupAssertOwner_();
  if (!setupWorkbookIsCurrent_()) setupProject({ quiet: true });
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const startHere = spreadsheet && spreadsheet.getSheetByName(GD_SETUP_START_HERE_SHEET);
  if (startHere && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(startHere);
  return setupWizardState_();
}

function normalizeSetupAbout_(answers) {
  const source = answers && typeof answers === 'object' ? answers : {};
  const clean = (value) => String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  const appTitle = clean(source.appTitle);
  const destination = clean(source.destination) || 'Restroom';
  if (!appTitle) throw new Error('Type what the top of the pass should say, like “Mrs. Smith’s Hall Pass”.');
  if (appTitle.length > GD_SETUP_TITLE_MAX) throw new Error(`Keep the pass title under ${GD_SETUP_TITLE_MAX} letters.`);
  if (destination.length > 40) throw new Error('Keep “where students go” under 40 letters.');
  assertPlainSheetText_(appTitle, 'Pass title');
  assertPlainSheetText_(destination, 'Where students go');
  const maxActivePasses = Number(source.maxActivePasses);
  if (!Number.isInteger(maxActivePasses) || maxActivePasses < 1 || maxActivePasses > 5) {
    throw new Error('Choose how many students may be out at once (1 to 5).');
  }
  return { appTitle, destination, maxActivePasses };
}

/**
 * Save the answers from the question screens. Everything is checked before
 * anything is written, so a bad bell time never leaves a half-saved setup.
 */
function setupWizardSave(answers) {
  setupAssertOwner_();
  const about = normalizeSetupAbout_(answers);
  const classroom = normalizeClassroomSetup_({
    periods: answers && answers.periods,
    studentEmailDomain: answers && answers.studentEmailDomain,
    yearStart: answers && answers.yearStart,
    yearEnd: answers && answers.yearEnd,
    reducedPeriods: answers && answers.reducedPeriods,
    reducedDates: answers && answers.reducedDates,
    noSchoolDates: classroomSetupView_(getSettings_()).noSchoolDates,
  });
  if (!classroom.studentEmailDomain) {
    throw new Error('Enter how student emails end, like students.yourschool.org. Look at any student’s address in Google Classroom.');
  }
  const teacher = getActiveEmail_();
  saveClassroomSetup_(teacher, classroom);
  withLock_(() => {
    setSettingValue_('APP_TITLE', about.appTitle);
    setSettingValue_('DESTINATION', about.destination);
    setSettingValue_('MAX_ACTIVE_PASSES', String(about.maxActivePasses));
    // A copy must never send its students to Mr. Auch's site.
    const settings = getSettings_();
    ['PASS_URL', 'CHECKIN_URL'].forEach((key) => {
      if (!hallPassSiteBranded_() && /grant-desk\.com/i.test(String(settings[key] || ''))) setSettingValue_(key, '');
    });
    if (!hallPassSiteBranded_() && /GrantDesk/.test(String(settings.PIN_EMAIL_SUBJECT || ''))) {
      setSettingValue_('PIN_EMAIL_SUBJECT', 'Your private Hall Pass PIN');
    }
  }, 30000, 'classroom setup');
  return setupWizardState_();
}

/** Turn whatever the teacher pasted into the bare Web app link, or explain what is wrong. */
function normalizeSetupWebAppLink_(value) {
  let text = String(value || '').trim();
  if (!text) throw new Error('Paste the Web app link Google showed you. It ends in /exec.');
  text = text.split('#')[0].split('?')[0].replace(/\/+$/, '');
  if (/\/dev$/.test(text)) {
    throw new Error('That is the test link (it ends in /dev), which students cannot open. Copy the Web app link from Deploy → Manage deployments instead. It ends in /exec.');
  }
  if (/docs\.google\.com\/spreadsheets/.test(text)) {
    throw new Error('That is the spreadsheet’s link. Paste the Web app link from the Deploy window instead. It starts with https://script.google.com and ends in /exec.');
  }
  if (!GD_SETUP_WEB_APP_PATTERN.test(text)) {
    throw new Error('That does not look like a Web app link. It starts with https://script.google.com and ends in /exec.');
  }
  return text;
}

/** Google sometimes knows the link already; offer it so the teacher can skip pasting. */
function setupWizardFindLink() {
  setupAssertOwner_();
  try {
    return { link: normalizeSetupWebAppLink_(ScriptApp.getService().getUrl()) };
  } catch (error) {
    return { link: '' };
  }
}

function setupWizardSaveLink(value) {
  setupAssertOwner_();
  const link = normalizeSetupWebAppLink_(value);
  PropertiesService.getScriptProperties().setProperty(GD_WEB_APP_URL_PROPERTY, link);
  auditTeacherAction_(getActiveEmail_(), { email: '', name: 'Classroom setup', classPeriod: 'All classes' },
    'WEB_APP_LINK_SAVED', [], 'Student link saved from the setup window', '');
  return setupWizardState_();
}
