const fs = require("fs");
const PDFDocument = require("pdfkit");
const sizeOf = require("image-size");

const ImageToPdf = (inputImagePath) => {
  return new Promise((resolve, reject) => {
    try {
      const inputImageBuffer = fs.readFileSync(inputImagePath);
      const dimensions = sizeOf(inputImageBuffer);
      const doc = new PDFDocument({ autoFirstPage: false });
      doc.addPage({ size: [dimensions.width, dimensions.height] });

      doc.image(inputImageBuffer, 0, 0, {
        fit: [dimensions.width, dimensions.height],
      });

      doc.end();

      const writeStream = fs.createWriteStream("outputfile.pdf");
      doc.pipe(writeStream);

      console.log("Conversion successful. PDF file saved.");
    } catch (error) {
      reject("Error converting image to PDF: " + error);
    }
  });
};

module.exports = { ImageToPdf };
