const { generateCenterURIs } = require("./centers");
const { downloads, download, downloadBatch } = require("./downloads");
const { generateReportURIs } = require("./reports");

module.exports = {
  downloads,
  download,
  downloadBatch,
  generateCenterURIs,
  generateReportURIs,
};
