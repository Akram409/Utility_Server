const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function combinePDFs(firstPdfPath, secondPdfPath, outputPath) {
    try {
        const firstPdfBytes = fs.readFileSync(firstPdfPath);
        const firstPdfDoc = await PDFDocument.load(firstPdfBytes);
        
        const secondPdfBytes = fs.readFileSync(secondPdfPath);
        const secondPdfDoc = await PDFDocument.load(secondPdfBytes);
        
        const combinedPdfDoc = await PDFDocument.create();
        
        const copiedPages = await combinedPdfDoc.copyPages(firstPdfDoc, [0]);
        copiedPages.forEach((page) => {
            combinedPdfDoc.addPage(page);
        });
        
        const copiedPagesFromSecond = await combinedPdfDoc.copyPages(secondPdfDoc, [0]);
        copiedPagesFromSecond.forEach((page) => {
            combinedPdfDoc.addPage(page);
        });
        
        
        const combinedPdfBytes = await combinedPdfDoc.save();
        fs.writeFileSync(outputPath, combinedPdfBytes);
        
        console.log("PDFs combined successfully. Combined PDF saved.");
    } catch (error) {
        console.error("Error combining PDFs:", error);
        throw error;
    }
}

module.exports = { combinePDFs };
