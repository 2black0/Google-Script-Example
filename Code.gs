  //source https://www.youtube.com/watch?v=r9uU_KwGgzQ
  
  //let firstName = "Linda";
  //let lastName = "Smith";
  //let amount = "$123.00";

  // doc id       1j3n2jXDtoeEXvP6yh8sDsdoFt0lUGQDY1aJzr7lslyw
  // temp folder  1w_U-vlLasmmiDC2RVaha34tc73r3cLyK
  // pdf folder   1az8dauGmpWGqDs90eb2FkEpCdEFkuxkT


function createBulkPDFs(){
  const docFile = DriveApp.getFileById("1j3n2jXDtoeEXvP6yh8sDsdoFt0lUGQDY1aJzr7lslyw");
  const tempFolder = DriveApp.getFolderById("1w_U-vlLasmmiDC2RVaha34tc73r3cLyK");
  const pdfFolder = DriveApp.getFolderById("1az8dauGmpWGqDs90eb2FkEpCdEFkuxkT");
  const currentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("people");
  
  const data = currentSheet.getRange(2, 1, currentSheet.getLastRow()-1, 4).getDisplayValues();

  let errors = [];

  data.forEach(row => {
    try{
      const pdfName = row[0]+ " " + row[1];
      createPDF(row[0],row[1],row[3],pdfName,docFile,tempFolder,pdfFolder);
      errors.push([""]);
    } catch(err){
      errors.push(["Failed"]);
    }
  });
  
  currentSheet.getRange(2, 5, currentSheet.getLastRow()-1, 1).setValues(errors);

}

function createPDF(firstName,lastName,amount,pdfName,docFile,tempFolder,pdfFolder){
  const tempFile = docFile.makeCopy(tempFolder);
  const tempDocFile = DocumentApp.openById(tempFile.getId());
  const body = tempDocFile.getBody()
  body.replaceText("{first}", firstName);
  body.replaceText("{last}", lastName);
  body.replaceText("{balance}", amount);
  tempDocFile.saveAndClose();
  const pdfContentBlob = tempFile.getAs(MimeType.PDF);
  pdfFolder.createFile(pdfContentBlob).setName(pdfName);
  tempFolder.removeFile(tempFile);
}