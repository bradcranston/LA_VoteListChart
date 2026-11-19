// Uploads the stacked-bar vote chart (bar/index.html -> dist-bar/index.html)
// into its own HTML record so it doesn't overwrite the pie chart ("VoteListChart").
const config = require("../widget.config");
const { uploadScript, file, server } = config;
const open = require("open");
const path = require("path");

const widgetName = "VoteListBarChart";
const fileUrl = `fmp://${server}/${file}?script=${uploadScript}&param=`;
const thePath = path.join(__dirname, "../", "dist-bar", "index.html");
const params = { widgetName, thePath };
console.log(widgetName, uploadScript, file, server);
open(fileUrl + encodeURIComponent(JSON.stringify(params)));
