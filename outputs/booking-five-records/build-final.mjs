import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "file:///C:/Users/ashok/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const base = "D:/2026/booking-dashboard/outputs/booking-five-records";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(`${base}/source-bookings.xlsx`));
const sheet = workbook.worksheets.getItem("Bookings");
const rows = sheet.getRange("A1:AD6").values;

for (let index = 1; index < rows.length; index += 1) {
  rows[index][0] = "1001";
  rows[index][8] = "ashok";
  rows[index][9] = "test";
}

sheet.getRange("A7:AD101").clear({ applyTo: "all" });
sheet.getRange("A1:AD6").values = rows;
sheet.freezePanes.freezeRows(1);

const outputPath = `${base}/bookings-5-records-ashok.xlsx`;
await (await SpreadsheetFile.exportXlsx(workbook)).save(outputPath);

const preview = await workbook.render({
  sheetName: "Bookings",
  range: "A1:AD6",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${base}/bookings-5-records-ashok-preview.png`, new Uint8Array(await preview.arrayBuffer()));

const values = await workbook.inspect({
  kind: "table",
  range: "Bookings!A1:J6",
  include: "values,formulas",
  tableMaxRows: 6,
  tableMaxCols: 10,
  maxChars: 6000,
});
console.log(values.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);
console.log(`OUTPUT=${outputPath}`);
