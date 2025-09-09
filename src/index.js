const { generateCenterURIs } = require("./centers");
const { downloads, download, downloadBatch } = require("./downloads");
const { generateNoticeURIs } = require("./notices");
const { generateReportURIs } = require("./reports");

module.exports = {
  downloads,
  download,
  downloadBatch,
  generateCenterURIs,
  generateNoticeURIs,
  generateReportURIs,
};
