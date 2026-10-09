/** Native, private workbook review. IDs and school data are supplied at installation. */
export function reviewFormula(roster = 'Review Roster', progress = 'Progress') {
  const r = "'" + roster.replaceAll("'", "''") + "'";
  const p = "'" + progress.replaceAll("'", "''") + "'";
  return `=IF(OR($B$4="",$B$5=""),"Choose a class and lesson above.",IFNA(ARRAYFORMULA(LET(people,SORT(FILTER(${r}!A2:B,${r}!C2:C=$B$4),1,TRUE),keys,LOWER(INDEX(people,0,2))&CHAR(31)&$B$5&CHAR(31)&$B$4,data,{LOWER(${p}!D2:D)&CHAR(31)&${p}!E2:E&CHAR(31)&${p}!B2:B,${p}!M2:M,${p}!A2:A,${p}!G2:G,${p}!N2:N,${p}!I2:I},status,IFNA(VLOOKUP(keys,data,2,FALSE),"No saved work received"),saved,IFNA(VLOOKUP(keys,data,3,FALSE),""),finished,IFNA(VLOOKUP(keys,data,5,FALSE),""),result,{INDEX(people,0,1),status,IF(saved=0,"",saved),IFNA(VLOOKUP(keys,data,4,FALSE),""),IF(finished=0,"",finished),IFNA(VLOOKUP(keys,data,6,FALSE),"")},IF($B$7="All",result,FILTER(result,INDEX(result,0,2)=$B$7)))),"No students match these filters."))`;
}

export function reviewRequests({ reviewId, rosterId, linksId, rosterRows = [], hubs = [], defaultClass = '', defaultHub = '', finishedId, title = 'Review', rosterTitle = 'Review Roster', progressTitle = 'Progress', includeSupportTabs = true, hidden = false }) {
  const range = (sheetId, sr, er, sc = 0, ec = 6) => ({ sheetId, startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec });
  const value = text => ({ userEnteredValue: typeof text === 'number' ? { numberValue: text } : { stringValue: String(text ?? '') } });
  const write = (sheetId, row, col, values) => ({ updateCells: { start: { sheetId, rowIndex: row, columnIndex: col }, rows: values.map(v => ({ values: v.map(value) })), fields: 'userEnteredValue' } });
  const formula = (sheetId, row, col, text) => ({ updateCells: { start: { sheetId, rowIndex: row, columnIndex: col }, rows: [{ values: [{ userEnteredValue: { formulaValue: text } }] }], fields: 'userEnteredValue' } });
  const requests = [{ addSheet: { properties: { sheetId: reviewId, title, hidden, gridProperties: { rowCount: 1500, columnCount: 8, frozenRowCount: 11, hideGridlines: true } } } }];
  if (includeSupportTabs) {
    requests.push({ addSheet: { properties: { sheetId: rosterId, title: rosterTitle, hidden: true, gridProperties: { rowCount: 1500, columnCount: 8, frozenRowCount: 1 } } } });
    requests.push({ addSheet: { properties: { sheetId: linksId, title: 'Classroom Links', gridProperties: { rowCount: 1500, columnCount: 5, frozenRowCount: 1 } } } });
    requests.push(write(rosterId, 0, 0, [['Student Name', 'Student Email', 'Class / Period']]));
    if (rosterRows.length) requests.push(write(rosterId, 1, 0, rosterRows));
    requests.push(write(rosterId, 0, 4, [['Classes', 'Hub', 'Hub Title']]));
    requests.push(formula(rosterId, 1, 4, `=SORT(UNIQUE(FILTER(C2:C,C2:C<>"")))`));
    if (hubs.length) requests.push(write(rosterId, 1, 5, hubs.map(h => [h.hub, h.title])));
    requests.push(write(linksId, 0, 0, [['Class / Period', 'Hub', 'Classroom Assignment URL', 'Hub Title']]));
    requests.push({ updateCells: { start: { sheetId: linksId, rowIndex: 0, columnIndex: 2 }, rows: [{ values: [{ note: 'Paste the student assignment link: https://classroom.google.com/c/.../a/.../details. One row per class and hub. Leave blank to open Classroom home. Never paste a PIN, student email, or a sharing link.' }] }], fields: 'note' } });
    requests.push({ setDataValidation: { range: range(linksId, 1, 1500, 0, 1), rule: { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: `='${rosterTitle}'!E2:E` }] }, strict: true, showCustomUi: true } } });
    requests.push({ setDataValidation: { range: range(linksId, 1, 1500, 1, 2), rule: { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: `='${rosterTitle}'!F2:F` }] }, strict: true, showCustomUi: true } } });
    requests.push({ updateDimensionProperties: { range: { sheetId: linksId, dimension: 'COLUMNS', startIndex: 0, endIndex: 2 }, properties: { pixelSize: 260 }, fields: 'pixelSize' } });
    requests.push({ updateDimensionProperties: { range: { sheetId: linksId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 560 }, fields: 'pixelSize' } });
    requests.push({ updateDimensionProperties: { range: { sheetId: linksId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 260 }, fields: 'pixelSize' } });
    requests.push({ repeatCell: { range: range(linksId, 0, 1, 0, 4), cell: { userEnteredFormat: { backgroundColor: { red: 0.94, green: 0.94, blue: 0.94 }, textFormat: { bold: true }, wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat' } });
  }
  requests.push(write(reviewId, 0, 0, [['the desk · student work review']]));
  requests.push(write(reviewId, 1, 0, [['Choose a class and lesson. Current answers update from saved Progress; finished copies stay in Turn Ins.']]));
  requests.push(write(reviewId, 3, 0, [['Class / period', defaultClass], ['Lesson / hub', defaultHub], ['Lesson title', ''], ['Show status', 'All']]));
  requests.push(formula(reviewId, 5, 1, `=IF(B5="","",IFNA(VLOOKUP(B5,'${rosterTitle}'!F2:G,2,FALSE),B5))`));
  requests.push({ setDataValidation: { range: range(reviewId, 3, 4, 1, 2), rule: { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: `='${rosterTitle}'!E2:E` }] }, strict: true, showCustomUi: true } } });
  requests.push({ setDataValidation: { range: range(reviewId, 4, 5, 1, 2), rule: { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: `='${rosterTitle}'!F2:F` }] }, strict: true, showCustomUi: true } } });
  requests.push({ setDataValidation: { range: range(reviewId, 6, 7, 1, 2), rule: { condition: { type: 'ONE_OF_LIST', values: ['All', 'Finished', 'In progress', 'No saved work received'].map(userEnteredValue => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } });
  requests.push(write(reviewId, 8, 0, [['Students shown', '', 'Finished', '', 'In progress', '']]));
  requests.push(formula(reviewId, 8, 1, '=COUNTIF(B12:B,"Finished")+COUNTIF(B12:B,"In progress")+COUNTIF(B12:B,"No saved work received")'));
  requests.push(formula(reviewId, 8, 3, '=COUNTIF(B12:B,"Finished")'));
  requests.push(formula(reviewId, 8, 5, '=COUNTIF(B12:B,"In progress")'));
  requests.push(write(reviewId, 9, 0, [['No saved work received', '']]));
  requests.push(formula(reviewId, 9, 1, '=COUNTIF(B12:B,"No saved work received")'));
  if (finishedId !== undefined) requests.push(formula(reviewId, 9, 3, `=HYPERLINK("#gid=${finishedId}","Open finished copies")`));
  requests.push(write(reviewId, 10, 0, [['Student', 'Status', 'Last saved', 'Answered', 'Last finished', 'Current answers']]));
  requests.push(formula(reviewId, 11, 0, reviewFormula(rosterTitle, progressTitle)));
  for (const row of [0, 1]) requests.push({ mergeCells: { range: range(reviewId, row, row + 1), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(reviewId, 5, 6, 1, 6), mergeType: 'MERGE_ALL' } });
  for (const [start, end, size] of [[0, 1, 180], [1, 2, 205], [2, 3, 120], [3, 4, 85], [4, 5, 120], [5, 6, 450]]) requests.push({ updateDimensionProperties: { range: { sheetId: reviewId, dimension: 'COLUMNS', startIndex: start, endIndex: end }, properties: { pixelSize: size }, fields: 'pixelSize' } });
  for (const [start, end, size] of [[0, 1, 36], [1, 2, 34], [3, 7, 34], [10, 11, 32]]) requests.push({ updateDimensionProperties: { range: { sheetId: reviewId, dimension: 'ROWS', startIndex: start, endIndex: end }, properties: { pixelSize: size }, fields: 'pixelSize' } });
  requests.push({ repeatCell: { range: range(reviewId, 0, 1500), cell: { userEnteredFormat: { textFormat: { fontFamily: 'Arial', fontSize: 11 }, verticalAlignment: 'TOP', wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)' } });
  requests.push({ repeatCell: { range: range(reviewId, 0, 1), cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 18 } } }, fields: 'userEnteredFormat.textFormat' } });
  requests.push({ repeatCell: { range: range(reviewId, 10, 11), cell: { userEnteredFormat: { backgroundColor: { red: 0.94, green: 0.94, blue: 0.94 }, textFormat: { bold: true } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } });
  for (const col of [2, 4]) requests.push({ repeatCell: { range: range(reviewId, 11, 1500, col, col + 1), cell: { userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'mmm d, h:mm am/pm' } } }, fields: 'userEnteredFormat.numberFormat' } });
  for (const [text, color] of [['Finished', { red: 0.9, green: 0.97, blue: 0.91 }], ['In progress', { red: 1, green: 0.97, blue: 0.87 }], ['No saved work received', { red: 0.97, green: 0.94, blue: 0.94 }]]) requests.push({ addConditionalFormatRule: { index: 0, rule: { ranges: [range(reviewId, 11, 1500, 1, 2)], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: text }] }, format: { backgroundColor: color } } } } });
  requests.push({ addProtectedRange: { protectedRange: { range: range(reviewId, 10, 1500), warningOnly: true, description: 'Live review formulas. Edit only the class, lesson and status controls above.' } } });
  return requests;
}
