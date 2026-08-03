import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { backendUrl } from "../../../../lib/backend-url";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsx", ".csv"];

function csvEscape(value) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function excelToCsv(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()));
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("The workbook does not contain a worksheet.");

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values.slice(1).map((value) => {
      if (value && typeof value === "object" && "text" in value) return value.text;
      if (value && typeof value === "object" && "result" in value) return value.result;
      return value;
    });
    rows.push(values.map(csvEscape).join(","));
  });
  return rows.join("\n");
}

function errorResponse(message, status = 400, details = []) {
  return NextResponse.json({ error: message, errors: details }, { status });
}

export async function POST(request) {
  const formData = await request.formData();
  const useSample = formData.get("sample") === "1";
  const uploadFile = formData.get("userFile");

  try {
    let content = "";
    let fileName = "sample-user-upload.csv";

    if (useSample) {
      const templateResponse = await fetch(backendUrl("api/admin/users/template"), {
        cache: "no-store",
        headers: { cookie: request.headers.get("cookie") || "" }
      });
      if (!templateResponse.ok) throw new Error("Unable to load the sample user template.");
      content = await templateResponse.text();
    } else {
      if (!uploadFile || typeof uploadFile.arrayBuffer !== "function" || uploadFile.size <= 0) {
        return errorResponse("Choose an Excel or CSV file before uploading.");
      }
      if (uploadFile.size > MAX_FILE_SIZE) return errorResponse("The upload must be 5 MB or smaller.");
      fileName = uploadFile.name || "user-upload.xlsx";
      const extension = ALLOWED_EXTENSIONS.find((item) => fileName.toLowerCase().endsWith(item));
      if (!extension) return errorResponse("Use an .xlsx or .csv user-upload file.");
      content = extension === ".csv" ? await uploadFile.text() : await excelToCsv(uploadFile);
    }

    const response = await fetch(backendUrl("api/admin/onboarding/validate"), {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", cookie: request.headers.get("cookie") || "" },
      body: JSON.stringify({ fileName, content })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const firstError = result.errors?.[0];
      const message = firstError
        ? `Row ${firstError.rowNumber}, ${firstError.columnName}: ${firstError.errorMessage}`
        : result.error || "User upload failed.";
      return errorResponse(message, response.status, result.errors || []);
    }
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error.message || "Unable to read the user-upload file.");
  }
}
