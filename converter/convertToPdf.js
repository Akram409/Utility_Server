const fs = require("fs");
const CloudmersiveConvertApiClient = require("cloudmersive-convert-api-client");

const defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
const Apikey = defaultClient.authentications["Apikey"];
Apikey.apiKey = "2a8c0692-95dc-44f5-b3c2-80ab8dc9001b";

const convertToPdf = (inputFilePath) => {
  return new Promise((resolve, reject) => {
    const apiInstance = new CloudmersiveConvertApiClient.ConvertDocumentApi();
    const inputFileBuffer = fs.readFileSync(inputFilePath);
    apiInstance.convertDocumentDocxToPdf(
      inputFileBuffer,
      (error, data, response) => {
      if (error) {
          console.error(error);
          reject("Conversion failed");
        } else {
          console.log(data);
          const pdfFileName = "outputfile.pdf"; // Generate PDF file name
          fs.writeFileSync(pdfFileName, data); // Write PDF data to file
          console.log("Conversion successful. PDF file saved.");
          resolve(pdfFileName); // Resolve with the PDF file name
        }
      }
    );
  });
};

module.exports = { convertToPdf };
