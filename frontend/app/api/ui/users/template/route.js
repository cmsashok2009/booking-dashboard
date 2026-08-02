import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { backendUrl } from "../../../../lib/backend-url";

export const runtime = "nodejs";

export async function GET(request) {
  const templateResponse = await fetch(backendUrl("api/admin/users/template"), {
    cache: "no-store",
    headers: { cookie: request.headers.get("cookie") || "" }
  });
  if (!templateResponse.ok) {
    return Response.json({ error: "Unable to load the user template." }, { status: 502 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Booking Dashboard";
  workbook.created = new Date();
  await workbook.csv.read(Readable.from([await templateResponse.text()]));

  const worksheet = workbook.worksheets[0];
  worksheet.name = "User Upload";
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: "A1", to: "I51" };
  worksheet.properties.defaultRowHeight = 20;

  const header = worksheet.getRow(1);
  header.height = 28;
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Aptos", size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1769E0" } };
  header.alignment = { vertical: "middle", horizontal: "left" };

  const widths = [24, 32, 16, 22, 16, 16, 32, 14, 22];
  worksheet.columns.forEach((column, index) => {
    column.width = widths[index];
    column.font = { name: "Aptos", size: 10 };
    column.alignment = { vertical: "top", wrapText: false };
  });

  for (let row = 2; row <= 500; row += 1) {
    worksheet.getCell(`D${row}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Admin,Area Manager,Regional Manager,All India I,All India II,All India"']
    };
    worksheet.getCell(`H${row}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"active,inactive,locked"']
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="user-upload-template.xlsx"',
      "cache-control": "no-store"
    }
  });
}
