/**
 * Guided first-run setup for a teacher's own copy of Hall Pass.
 *
 * This file ships only in the classroom template (see
 * scripts/publish-hall-pass-template.mjs); the production project never
 * receives it. It uses no service Code.gs does not already use, so it adds
 * no Google permission a teacher has to approve.
 *
 * Flow: opening-page setup button → classroom questions → guided Google
 * publishing → find and verify this copy’s app → dashboard and kiosk links.
 * The Sheets menu remains a fallback, never the primary entry.
 */

const GD_SETUP_START_HERE_SHEET = 'Start here';
const GD_SETUP_TITLE_MAX = 60;
// Local UI button; no remote image request or tracking. Copied with the workbook.
const GD_SETUP_BUTTON_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAbgAAABACAIAAADnHvUkAAARwklEQVR42u2deXxMV__Hz72z75nJIgkJWZFEqDURSxBCRbqQto-l_bVF6VOq9avSRaue0qq2nla1fSz1_KiHR5ESooIiYokKCWIJQSSyT2bf597fH3dyczPZZkaiKd_3H153Jnc553vO-Zzv93vOHVjCxCIEAAAAtAwOJgAAAAChBAAAAKEEAAAAoQQAAAChBAAAAKEEAAAAoQQAAAChBAAAAKEEAAAAQCgBAABAKAEAAEAoAQAAQCgBAABAKAEAAEAoAQAAQCgBAABAKAEAAAAQSgAAABBKAAAAEEoAAAAQSgAAgM4Bu0PvzmJh4xLFY4ZLwkO5MinLbkcarV2tsd-9Z7l-y5x_xVR43QRt8JfjiT6Cb1d2RQi9sbjs4mXjA95NLMIP7giljk0mImlKMVi4vWzYXraFNupAoZRJWKs_CewdwaO_4bARn8f282FHhPKSRkoKr5tmLyxlXrLqo4Chg0TU8YcrK37P0XVo5R_y4_6iRWrKiHgRQkittRcUGhEAQOj9ICxZ4MdUSeCRYdgQEULoVK6BIMAYAHiUD4CfD5saTgghgkDrfqo5mq2rU9mlUlbfaP6EMdL4gUKw_l-R8BBeQBcOQujEaR1Yo5Oj0xPDUm6CHTqvUIaHNPiSJ8_qt-9RUce1StvRbN3RbF2vCN7EsdJmQ06K5Uv86eMf_l27dWcdpb9xA4VD-gvDQng-CjaHjQxGsqzceuGScc8B9f0KK31J06zK2ETJM0_KQrtzxSK88Lopqie_zce1mFWQstJSZYP7C4MCuUIBptMT1bW2OyWWvEvGk2f0SpW9kdOOoYQhonGjJFGRfLmMZSfI8krb6XP67emqOsaZrligVwRvw9dB1DclpZapc0roE96e4_tsiow6_mZ9zX9_VTVrhBHxorRUr4hQHpuNFd81785QHzyqdatlh8eJEEJmC3nugqGN3Is7VmIypL_w-We8oiL5XA527741PVO9Z7_aORTC0Mih4rGJkl4RPLmMZSdQrdJ2-app3yENM20qlbAytoXgGEII3SmxTH_dYbGQYO6WdcHU8Zofq3_Z57j_W3N8J9eb8f0VFcdPtTgZKOSsvVtCmLadmCR9NkXWI5irNxDn8gzrt9ZWVNlwDD31pOyp8dKgrlyTmbhQYFy_RXm31EJdOGu64qUXFNTx-q3Kf29XMh-xaJ5farJjjKz8Z9X-LI27w9D13KUrNm-2idd-1jUkmEt9PHVO__6KCquV9LjpHzuhZLEYz2juIdeKzNeKqt297YY1QQovFvMbiRjrFcHrFcF7NkW27IuKE6f1zV7I1JEHd5Z__LKbrzeb2V1kUlZ4CC9ppGTCaNPcRaXMPy1f7N8_VsC4ARbanRvanfvUBNn7K8rP53uY5iPdv-SNmT4vPO1Ff4yK5Ee9zY-NFqz6tspdoTx3wWAyk-1lJSazX_R-8Tk5_TGsB3fhXF9_X_b3m2sbRMqL9el7AX2iGqY6DkJdAzhdAzjJoyUHj2o__6bKaiMRQhqt_WaxOTKMhxDqHsSVSVhqrR0hFBvd0CJ9owW0UPaNdtyTJNHFS240zf_-3ffpCY4OxuOykkdL4gYKZy8snT_LJ2GwiP4-MUE8sJ9w5oJ7peVWhFB6pmZ6mpzFwhBCE5Mk_7dDSdYbFcfRiDgRrWVHszvQf3fF5k2RiPE1_wikVTL7jH7pZxVWG-lx03dmOipHeeeehT4eOki0aJ5fTC8-h411XE14XGzpwi4yKavpn_h83FklH6AgM56TMztBq7MFtmppQGOVbDTbf740sEd9P3NbKN1USj4fZ6okTWqylOnat04XXzYlOtktTEgeWMmpkMwRS_O3yfIuvuz6eRdb9VEgUyWdGD9asvB1X_pjXr3eYRiir6IFkRJKukVCezgioVt3zJSkulhsWiWZ6rBxTRCtksx2n_2iN3VcXWvLPuOwZKA_54k-DV2lX4zAS-bozEdP6oymjsoHu2LzpoiE-FfLu0aEOsx1JFv3wcoKanLyrOkfU4_yXpn17HnDkAFCejSmJkvtdrKkzFp43XTmvCEnV2-xNIz1RcvKkQtrviWllt0ZxtwLhppaW53KLhDg0T15b8_1pbJmfD6eNEK8K6OZkMFqJddvVR45oa2stjUb7bq-xBxZ3zlUavvi5eU3is0cNubnw-4RxI0fJBQJG-aeJ5Mk0b0cA5Ig0Q-baw8c1vB52JuzfSm_jM_D5s30Wbj0vusW8FgoEUJ1KvvKf1ZdvGzsFsh5d55fz3BHRV7-myLzsIZw4YZUsQkCnczVt5eVnDAYic-_qTqbZ4jpzV-2yJ86E8fQkAHCvQc1CKGUsdJe9YuENhv53abarONaLgebOlk-ZZJDrVLGSdMz1deKzAihvAIjPUPERvFPntUzxZEKorsFcErLrbFRArx-Bs0rcM_Tr1XaPlpVWVRsful5-dTJcloT9Qbik9WVFy8bn54gm_uyQx_jBwlxDFEG35WhTkwQU99PHCuln5s4VEzffH-WtkNVgLZ5VCR_-ZJmbO6EgI-vXtawoeW3o9pP11TSK3seN_3j6FEihD5ZXekUV7JYWEgwd-JY6fLF_js3dKd2mbgXPC4u27xdWXjdVFVjs9pIjdZ--g_Dz7-o6BPowe_E5h1123bVMVXSY6hpEyFksZI6PWGxkHoDcbvE8nuObsWaqvdXVNBnjkuU0Mf7Dqq37apTqe0VVbZPVleqNXY6H-fn48l05cGK89qNNafO6Q1G4sYt89LPK-g7-Puxw0Nd2p8wPE6MECooNNLlf3ArObF-i_JItk6nJ878YTjCiDe7-nOog6SRDQqy75Bm516VSm2vqrGt-bH6apGZ_tOY4Q7j51820jWl9NHPh035SvT51PdMN9NdoVz3U-3Fy0a9gXCap7fsrMvJ1esNxI5fVVYrSQuNV30G6cIl4-0SR_iVmCAWi3DK-R0x1DE6Su9b86907DYs2ua5F5q3eSPJwLEvPg7o09thq4xDmk-_rmT2Ro-b_nH0KBFCaq39zffLhgwQjh8l6R8r8FY0epa3gv2PJQHzlpS51QkkYjx1vGxIf2FwN45UzOJysabxTrMXZh7WtFe9zp439ItxjLet3wcbjETpfWtJqaXwhjn7jL68smFBKYKhPlnHG_qf0URcvWGOq1_379Obf8T9DBTpvkuZw3ADy8qtJWWWHkGOwD-kO_fGLXPrl4tFeL8YPpWNakcrOXEku8F7qqm1MSNE6oC5TpjT2LE9fU5PuznhIY6q6Q3EtZumqEg-NY_yuFjfGIc7ue2XumXv-uM4io3h7z-soROXBInc3Uh_5g_H0payzu5UJNr5VWnsdEwq4OMIOc7cnaGmcgU8LpY0QpKeqY7pzfepHy8erOG4S5s2Z8LlYv3qDbjngPqr76udeqLHTf-YCiVttbPnDVSA0zuCPyJeNH60hMpe4zh6_mkv14UyuBv32xWBToLrXJ_m0qBWG1lda2uvGm1PV0WG8UYNc_g1QgEeGcaLDOMljZTMm-mzI121dmMNncdp8OY-69rSDVuvUUtgWKOacjhtpF3tdlKnJ5wi8R5BqGlRWyJhsIhqOFeE0nUrMbHZSOZOANoFY2aVmUWta7x-WssQKbG4Ycq8UGCkhJLNxnpH8inPkSBR7gVDUbG5Zzivb7SAx8XoiP7GTbOTrdp0n-mEJu1P1Wchm3e9ma118Kh2zv94U_WaOE6anqmm426CQJlHOjbudsXmrWThm87XnjX94y6UNMo6e06uPidXX1ZupZPZ3YM4rt9h_kwfWlP2_qbZ8t-6ymorQaAnk6TvLfBrTSNsHrhfLY8KK_nhZxUhwdyhg0QRYbxAf3ZQIFcidkRMLzzjde6iY27QGwgqkmodAd_VpSVmLTiNm87Pl91mnxaLcOb4l8sapERvaFsXhsWJEEK37liY27Ae3EpOg5ZZx2YbjWlVeeMtEMwdETqdnRlHT5viyBv2jRFQgXbxHbPeQORfMfYM53UL4AyPE9GLjXkFBre6hN1GtmKHNi83mojMI1oqwdo7ghfWgzuyXihz8ww1SltHC2WbNneacY0mkmqC1GSpwUA4CZ9nTf-YCmVEKG9yimzjz8qmrlxljY3RSC0KAd5EYfox1gQ3_qysre9AA1pYVnZLd3A3s7W3Syx0agkhlJbq9eZsH-q4f6yA6gdFxWZ6HXPhR_dd6RytF8nM2JHjrWDTCwJyL9YTMW0bIX6QKOuYwz0J9OcEd2tYcL9919L6tRwOFjdAiBDKPqNrXyu5y83bZjr0SxgkomNehFD8ICHjtIbn5heabDaSijaGDRFRCYf8Kybq3-eeQgihGc8pGoT10sN-NXP3fvXkFBkVJLw1x9ff7-HF3R44CouXl3-9PJAKYl54xktvIH76j_IhNP2fSEct5rBYKGWcdOfG7ssX-yeNEPv7sTkcTCzC4wcKZ033pk-7dcfs5CwwR7VTPMjcm5k2SSYW4Qov1itTFcmjJZ4VsvXHtcSbs32Wves_LlESHsKTe7HYbMzXmx3C2OVDxacIoazjDUHTB291SR4lUchZbDYm92KFh_CSRoiXLPD715fdXC9SRZWVzpqLhPisF70lYjy0O3fFewFN07VNmfeqT9xAoVCAh4fwqNycY-qqtt283UaCclA_oYCPI4ROnNa3r5Xc5TAj2zspWTplkkwmZfn5sOfP8qHi66Z5N5OJuHrDUcHeETxKjwquGBFC9OvqYT24tMeUf_lh_1ZLSanlfL5DO-hpQK2xU2v0nY2Ll40ff1FJb5N4dZoiLdXrITT9Ixt6s9nYqGFiOlvRFKfNB0XFZnqlePxoyfh6BUx79W55pfXyVRPtoE1Pk09Pkz9g8Vp_XEtXiUWsMcPFY4a3WKkrV0317oA2ZZyUGr1yL9aHC7s0PdnJ4269SCYzmVdgGNjP4TfNSJPPcMcICjlr9ceBTb_fvF3Z5ho6FXdX1djaXPNx10rusj9LkzpeSm3nZLOxBa_5LnjN1-mcA4c114oalTOvwOC09bKg0ERlOUtKLUzn-mqRueM2LbbCrgw13bIUh45prTaycwrH8VO6L9dVv_N3h-Xnz_IxGIj9hzUd2vSPoEdptZKtjz2CQGs31DitLR46pmslif7dppqmb4MYTcTOvSrPCtn64zzuQMfq33uz28l3Pnbv3Zs2i7Tup9qmRigqNrf55obJRGxPVzWrO_t-ayO-wzA0bLAIubaM466V3O5aNvKdZeVXrplatqH2i--cX_pyiqbLK630FEXF4MyE5p8yFHNy9U7b1zIOaTqzdvyaqd60TUn3kHfn-41KEHdo0z-CHuWtO5ZJ02_HDxT2jRaEhXD9_TgSEY7jyGAk71dY868Y9_2mYaYwKGqVttcXlb4yVdE3WiCTspySdNeKzLPeuvfKNEX_WIFIgNep7efzjZu2KaMieWmpnhSy9ce1xNc_VJ84rRvcX9gznOejYMu9WCSBlCr7jVvmrOPaYzk6Zp5RrbEv-KAsfpBoXKIkKpKnkLNZOKpT2-tU9uK7lj_yDecvGt0q0o1b5tcXlc6cpoiNFvC4WFm5Neu49j97VG-84tNmydduqLlUaJoySRYRyuNwsOK7lj371Qdc2DgV3ZOvkLOQOz-E4ZaVPGi4uYtKRyWIk0ZKekXwvKQsgkS1Stulq6b9WZpmle7SVZPVStJ7AwoY4ph_xTgpWfqnCyVBoPQD6tdeciSmrt8037pj6eTysWmbUiFnUW8l4Tha-k4Xo5no0Kb_s8ASJhYh4BGlvX5vde7L3tMmy7U6ImXabbudBMN2EFGR_H995chZf_VD9e4MNdjkEfcogUeJ4dQPUJ7Tg0p2lMOCIV9v9swZjpV3s4U89LsWzAJCCfyVYP6eG9DuNP2Fvb0H1e2ePQceBPjPxQCgc1FWbt34sxLsAB4lAADOECSqrLKeOW_YtE0J7mRnAxZzAAAAIPQGAAAAoQQAAAChBAAAAKEEAAAAoQQAAAChBAAAAKEEAAAAoQQAAABAKAEAAEAoAQAAQCgBAABAKAEAAEAoAQAAQCgBAABAKAEAAEAoAQAAABBKAAAAEEoAAAAQSgAAgIfF_wNDC6SjcXwLZgAAAABJRU5ErkJggg==';
const GD_SETUP_WEB_APP_PATTERN = /^https:\/\/script\.google\.com\/(?:a\/macros\/[a-z0-9.-]+\/|a\/[a-z0-9.-]+\/macros\/|macros\/)s\/[A-Za-z0-9_-]{20,}\/exec$/;
const GD_SETUP_DEPLOYMENT_RECEIPT = 'SETUP_VERIFIED_DEPLOYMENT';

/** Menu item: open the setup window right away and let it do the slow work. */
function hallPassStartSetup() {
  const html = HtmlService.createHtmlOutputFromFile('SetupWizard').setWidth(640).setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, 'Set up your Hall Pass');
}

/** Keep a visible front door, including when Sheets menus are collapsed. */
function hallPassShowStartHere_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) return;
  let sheet = spreadsheet.getSheetByName(GD_SETUP_START_HERE_SHEET);
  if (!sheet) {
    // Do not repurpose any existing teacher's data tab.
    if (spreadsheet.getSheetByName(GD_SHEETS.SETTINGS)) return;
    const sheets = spreadsheet.getSheets();
    const first = sheets.length === 1 ? sheets[0] : null;
    if (!first || first.getLastRow() > 0) return;
    sheet = first.setName(GD_SETUP_START_HERE_SHEET);
  }
  sheet.getRange(1, 1, 12, 1).setValues([
    ['Welcome to Hall Pass'],
    ['Your classroom app. This page keeps your setup and app links together.'],
    ['Click the large Start setup / show my links button below. No menu needed.'],
    [''], [''], [''],
    ['First time? Google asks you to approve access for your school account.'],
    ['After approving, click the same button again to continue.'],
    ['Setup is for a computer web browser. Daily use works from your app links.'],
    ['Already set up? The button shows your teacher and door kiosk links.'],
    ['If the button is missing, reload once. Backup: Hall Pass → Start setup in the top menu.'],
    ['Your records stay in this private workbook. You use the app for daily tasks.'],
  ]);
  sheet.setHiddenGridlines(true);
  sheet.setColumnWidth(1, 680);
  sheet.getRange(1, 1, 12, 1).setWrap(true).setFontSize(13).setFontColor('#1c2230');
  sheet.getRange(1, 1).setFontSize(26).setFontWeight('bold');
  sheet.setRowHeight(1, 54);
  [2, 3, 7, 8, 9, 10, 11, 12].forEach((row) => sheet.setRowHeight(row, 42));
  sheet.setRowHeight(5, 76);
  const existing = sheet.getImages().find((image) => image.getAltTextTitle() === 'Hall Pass setup');
  if (!existing) {
    sheet.insertImage(Utilities.newBlob(Utilities.base64DecodeWebSafe(GD_SETUP_BUTTON_PNG), 'image/png', 'hall-pass-setup.png'), 1, 5, 12, 4)
      .setAltTextTitle('Hall Pass setup')
      .setAltTextDescription('Start setup or show your Hall Pass app links')
      .assignScript('hallPassStartSetup');
  }
  sheet.activate();
}

/** Only writes verified app links into this copy's front door. */
function setupUpdateHomeLinks_(links) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GD_SETUP_START_HERE_SHEET);
  if (!sheet) return;
  const rows = links ? [
    [`=HYPERLINK("${links.teacher}","Open teacher dashboard ↗")`],
    [`=HYPERLINK("${links.kiosk}","Open door kiosk ↗")`],
    ['Bookmark the teacher dashboard. Add students there, then test the door device before class.'],
  ] : [[''], [''], ['Finish setup to get your classroom app links.']];
  sheet.getRange(14, 1, 3, 1).setValues(rows).setWrap(true).setFontSize(16);
  [14, 15, 16].forEach((row) => sheet.setRowHeight(row, 48));
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
    studentEmailDomain: classroom.studentEmailDomain || (ownerDomain === 'mtmorrisschools.org' ? 'students.mtmorrisschools.org' : ''),
    periods: classroom.periods,
    reducedPeriods: classroom.reducedPeriods,
    reducedDates: classroom.reducedDates,
    bellsReady: classroom.bellsReady,
    yearStart: classroom.yearStart,
    yearEnd: classroom.yearEnd,
    studentCount: classroom.studentCount,
    links: setupVerifiedSavedLinks_(savedLink, settings),
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
  hallPassShowStartHere_();
  if (!setupWorkbookIsCurrent_()) setupProject({ quiet: true });
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const startHere = spreadsheet && spreadsheet.getSheetByName(GD_SETUP_START_HERE_SHEET);
  // Keep the front door after initialization; teachers should never need data tabs.
  if (startHere) hallPassShowStartHere_();
  const state = setupWizardState_();
  setupUpdateHomeLinks_(state.links);
  return state;
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
  const state = setupWizardState_();
  setupUpdateHomeLinks_(state.links);
  return state;
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
  // getService() uses a legacy school path which Google may not serve. Match
  // the school URL shape shown by the Deploy dialog, preserving deployment ID.
  return text.replace(/^https:\/\/script\.google\.com\/a\/([a-z0-9.-]+)\/macros\//,
    'https://script.google.com/a/macros/$1/');
}

/** Only offer a link proved by this copy's published app, never editor metadata. */
function setupWizardFindLink() {
  setupAssertOwner_();
  // Editor metadata can report /dev or an unusable /exec after deployment.
  // Only the owner's visit to the published app supplies this receipt. Binding
  // it to the script ID prevents inherited properties from another copy.
  try {
    const receipt = JSON.parse(PropertiesService.getScriptProperties().getProperty(GD_SETUP_DEPLOYMENT_RECEIPT) || 'null');
    if (receipt && receipt.scriptId === ScriptApp.getScriptId()) {
      return { link: normalizeSetupWebAppLink_(receipt.url) };
    }
  } catch (error) { /* No valid receipt: leave this copy unverified. */ }
  return { link: '' };
}

/** Prepare a visit, without accepting or saving the teacher's pasted URL. */
function setupWizardPrepareLink(value) {
  setupAssertOwner_();
  const link = normalizeSetupWebAppLink_(value);
  return { verifyUrl: `${link}?mode=setup-link` };
}

/** Runs only in a template's deployed web app, as its authenticated owner. */
function setupVerifyPublishedApp_() {
  setupAssertOwner_();
  // Unlike the editor, this execution belongs to the published /exec app.
  // Record Google's own URL, never a query parameter or a pasted address.
  const url = normalizeSetupWebAppLink_(ScriptApp.getService().getUrl());
  PropertiesService.getScriptProperties().setProperty(GD_SETUP_DEPLOYMENT_RECEIPT,
    JSON.stringify({ scriptId: ScriptApp.getScriptId(), url }));
  return HtmlService.createHtmlOutput('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hall Pass link verified</title></head><body style="font:18px/1.5 Arial,sans-serif;max-width:640px;margin:48px auto;padding:0 20px"><h1>Your app link is verified</h1><p>Return to the setup window and click <strong>Finish setup</strong>. You can close this tab.</p><p>This confirms the app belongs to your copy. Student enrollment and the door-device test still come next.</p></body></html>')
    .setTitle('Hall Pass link verified');
}

function setupWizardSaveLink(value) {
  setupAssertOwner_();
  const pasted = normalizeSetupWebAppLink_(value);
  const own = setupWizardFindLink().link;
  if (!own) throw new Error('Google has not confirmed a published link for this copy yet. Open the link-check page below, then return and click Finish setup.');
  // School-domain and ordinary URLs can identify the same deployment.
  if (pasted.match(/\/s\/([^/]+)\/exec$/)[1] !== own.match(/\/s\/([^/]+)\/exec$/)[1]) {
    throw new Error('That link belongs to a different Hall Pass copy. Return to the program opened by this setup window and publish your own copy.');
  }
  const link = own;
  PropertiesService.getScriptProperties().setProperty(GD_WEB_APP_URL_PROPERTY, link);
  auditTeacherAction_(getActiveEmail_(), { email: '', name: 'Classroom setup', classPeriod: 'All classes' },
    'WEB_APP_LINK_SAVED', [], 'Student link saved from the setup window', '');
  const state = setupWizardState_();
  setupUpdateHomeLinks_(state.links);
  return state;
}

/** Do not offer an inherited or unverified teacher's app as this copy's link. */
function setupVerifiedSavedLinks_(savedLink, settings) {
  if (!savedLink) return null;
  const own = setupWizardFindLink().link;
  if (!own || savedLink !== own) return null;
  return setupLinks_(own, settings);
}
