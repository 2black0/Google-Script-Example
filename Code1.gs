/**
 * @license MIT
 * 
 * © 2020 xfanatical.com. All Rights Reserved.
 * 
 * @since 1.3.4 Add retrying for printing many sheets
 * @since 1.3.3 Add an option to save PDF files in the same folder
 * @since 1.3.2 Fix time changed issue
 * @since 1.3.1 Fix a landscape problem
 * @since 1.3.0 Support printing the entire spreadsheet as separate pdf files
 * @since 1.2.3 Add formatting for a single predefined area
 * @since 1.2.2 Add formatting for a single selected area
 * @since 1.2.1 Fix a reference issue of printing current sheet
 * @since 1.2.0 Support printing current sheet as pdf
 * @since 1.1.1 Fix an error for multi-language
 * @since 1.1.0 Support printing predefined areas as a pdf
 * @since 1.0.0 Support printing the entire spreadsheet as a pdf
 *              Support printing the selected areas as a pdf
 */

// source https://xfanatical.com/blog/print-google-sheet-as-pdf-using-apps-script/#source-code

// By default, PDFs are saved in your Drive Root folder
// To save in the same folder as the spreadsheet, change the value to 'false' without the single quote pair
// You must have EDIT permission to the same folder
var saveToRootFolder = true

function onOpen() {
  SpreadsheetApp.getUi()
    .createAddonMenu()
    .addItem('Export all sheets', 'exportAsPDF')
    .addItem('Export all sheets as separate files', 'exportAllSheetsAsSeparatePDFs')
    .addItem('Export current sheet', 'exportCurrentSheetAsPDF')
    .addItem('Export selected area', 'exportPartAsPDF')
    .addItem('Export predefined area', 'exportNamedRangesAsPDF')
    .addToUi()
}

function _exportBlob(blob, fileName, spreadsheet) {
  blob = blob.setName(fileName)
  var folder = saveToRootFolder ? DriveApp : DriveApp.getFileById(spreadsheet.getId()).getParents().next()
  var pdfFile = folder.createFile(blob)
  
  // Display a modal dialog box with custom HtmlService content.
  const htmlOutput = HtmlService
    .createHtmlOutput('<p>Click to open <a href="' + pdfFile.getUrl() + '" target="_blank">' + fileName + '</a></p>')
    .setWidth(300)
    .setHeight(80)
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Export Successful')
}

function exportAsPDF() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  var blob = _getAsBlob(spreadsheet.getUrl())
  _exportBlob(blob, spreadsheet.getName(), spreadsheet)
}

function _getAsBlob(url, sheet, range) {
  var rangeParam = ''
  var sheetParam = ''
  if (range) {
    rangeParam =
      '&r1=' + (range.getRow() - 1)
      + '&r2=' + range.getLastRow()
      + '&c1=' + (range.getColumn() - 1)
      + '&c2=' + range.getLastColumn()
  }
  if (sheet) {
    sheetParam = '&gid=' + sheet.getSheetId()
  }
  // A credit to https://gist.github.com/Spencer-Easton/78f9867a691e549c9c70
  // these parameters are reverse-engineered (not officially documented by Google)
  // they may break overtime.
  var exportUrl = url.replace(/\/edit.*$/, '')
      + '/export?exportFormat=pdf&format=pdf'
      + '&size=LETTER'
      + '&portrait=true'
      + '&fitw=true'       
      + '&top_margin=0.75'              
      + '&bottom_margin=0.75'          
      + '&left_margin=0.7'             
      + '&right_margin=0.7'           
      + '&sheetnames=false&printtitle=false'
      + '&pagenum=UNDEFINED' // change it to CENTER to print page numbers
      + '&gridlines=true'
      + '&fzr=FALSE'      
      + sheetParam
      + rangeParam
      
  Logger.log('exportUrl=' + exportUrl)
  var response
  var i = 0
  for (; i < 5; i += 1) {
    response = UrlFetchApp.fetch(exportUrl, {
      muteHttpExceptions: true,
      headers: { 
        Authorization: 'Bearer ' +  ScriptApp.getOAuthToken(),
      },
    })
    if (response.getResponseCode() === 429) {
      // printing too fast, retrying
      Utilities.sleep(3000)
    } else {
      break
    }
  }
  
  if (i === 5) {
    throw new Error('Printing failed. Too many sheets to print.')
  }
  
  return response.getBlob()
}

function exportAllSheetsAsSeparatePDFs() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  var files = []
  var folder = saveToRootFolder ? DriveApp : DriveApp.getFileById(spreadsheet.getId()).getParents().next()
  spreadsheet.getSheets().forEach(function (sheet) {
    spreadsheet.setActiveSheet(sheet)
    
    var blob = _getAsBlob(spreadsheet.getUrl(), sheet)
    var fileName = sheet.getName()
    blob = blob.setName(fileName)
    var pdfFile = folder.createFile(blob)
    
    files.push({
      url: pdfFile.getUrl(),
      name: fileName,
    })
  })
  
  const htmlOutput = HtmlService
    .createHtmlOutput('<p>Click to open PDF files</p>'
      + '<ul>'
      + files.reduce(function (prev, file) {
        prev += '<li><a href="' + file.url + '" target="_blank">' + file.name + '</a></li>'
        return prev
      }, '')
      + '</ul>')
    .setWidth(300)
    .setHeight(150)
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Export Successful')
}

function exportCurrentSheetAsPDF() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  var currentSheet = SpreadsheetApp.getActiveSheet()
  
  var blob = _getAsBlob(spreadsheet.getUrl(), currentSheet)
  _exportBlob(blob, currentSheet.getName(), spreadsheet)
}

function exportPartAsPDF(predefinedRanges) {
  var ui = SpreadsheetApp.getUi()
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  
  var selectedRanges
  var fileSuffix
  if (predefinedRanges) {
    selectedRanges = predefinedRanges
    fileSuffix = '-predefined'
  } else {
    var activeRangeList = spreadsheet.getActiveRangeList()
    if (!activeRangeList) {
      ui.alert('Please select at least one range to export')
      return
    }
    selectedRanges = activeRangeList.getRanges()
    fileSuffix = '-selected'
  }
  
  if (selectedRanges.length === 1) {
    // special export with formatting
    var currentSheet = selectedRanges[0].getSheet()
    var blob = _getAsBlob(spreadsheet.getUrl(), currentSheet, selectedRanges[0])
    
    var fileName = spreadsheet.getName() + fileSuffix
    _exportBlob(blob, fileName, spreadsheet)
    return
  }
  
  var tempSpreadsheet = SpreadsheetApp.create(spreadsheet.getName() + fileSuffix)
  if (!saveToRootFolder) {
    DriveApp.getFileById(tempSpreadsheet.getId()).moveTo(DriveApp.getFileById(spreadsheet.getId()).getParents().next())
  }
  var tempSheets = tempSpreadsheet.getSheets()
  var sheet1 = tempSheets.length > 0 ? tempSheets[0] : undefined
  SpreadsheetApp.setActiveSpreadsheet(tempSpreadsheet)
  tempSpreadsheet.setSpreadsheetTimeZone(spreadsheet.getSpreadsheetTimeZone())
  tempSpreadsheet.setSpreadsheetLocale(spreadsheet.getSpreadsheetLocale())
  
  for (var i = 0; i < selectedRanges.length; i++) {
    var selectedRange = selectedRanges[i]
    var originalSheet = selectedRange.getSheet()
    var originalSheetName = originalSheet.getName()
    
    var destSheet = tempSpreadsheet.getSheetByName(originalSheetName)
    if (!destSheet) {
      destSheet = tempSpreadsheet.insertSheet(originalSheetName)
    }
    
    Logger.log('a1notation=' + selectedRange.getA1Notation())
    var destRange = destSheet.getRange(selectedRange.getA1Notation())
    destRange.setValues(selectedRange.getValues())
    destRange.setTextStyles(selectedRange.getTextStyles())
    destRange.setBackgrounds(selectedRange.getBackgrounds())
    destRange.setFontColors(selectedRange.getFontColors())
    destRange.setFontFamilies(selectedRange.getFontFamilies())
    destRange.setFontLines(selectedRange.getFontLines())
    destRange.setFontStyles(selectedRange.getFontStyles())
    destRange.setFontWeights(selectedRange.getFontWeights())
    destRange.setHorizontalAlignments(selectedRange.getHorizontalAlignments())
    destRange.setNumberFormats(selectedRange.getNumberFormats())
    destRange.setTextDirections(selectedRange.getTextDirections())
    destRange.setTextRotations(selectedRange.getTextRotations())
    destRange.setVerticalAlignments(selectedRange.getVerticalAlignments())
    destRange.setWrapStrategies(selectedRange.getWrapStrategies())
  }
  
  // remove empty Sheet1
  if (sheet1) {
    Logger.log('lastcol = ' + sheet1.getLastColumn() + ',lastrow=' + sheet1.getLastRow())
    if (sheet1 && sheet1.getLastColumn() === 0 && sheet1.getLastRow() === 0) {
      tempSpreadsheet.deleteSheet(sheet1)
    }
  }
  
  exportAsPDF()
  SpreadsheetApp.setActiveSpreadsheet(spreadsheet)
  DriveApp.getFileById(tempSpreadsheet.getId()).setTrashed(true)
}

function exportNamedRangesAsPDF() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  var allNamedRanges = spreadsheet.getNamedRanges()
  var toPrintNamedRanges = []
  for (var i = 0; i < allNamedRanges.length; i++) {
    var namedRange = allNamedRanges[i]
    if (/^print_area_.*$/.test(namedRange.getName())) {
      Logger.log('found named range ' + namedRange.getName())
      toPrintNamedRanges.push(namedRange.getRange())
    }
  }
  if (toPrintNamedRanges.length === 0) {
    SpreadsheetApp.getUi().alert('No print areas found. Please add at least one \'print_area_1\' named range in the menu Data > Named ranges.')
    return
  } else {
    toPrintNamedRanges.sort(function (a, b) {
      return a.getSheet().getIndex() - b.getSheet().getIndex()
    })
    exportPartAsPDF(toPrintNamedRanges)
  }
}