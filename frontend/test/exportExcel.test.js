import { beforeEach, describe, expect, it, vi } from "vitest";
const excel = vi.hoisted(() => ({ workbooks: [] }));
vi.mock("exceljs", () => {
  class Worksheet {
    constructor(name) {
      this.name = name;
      this.rows = [];
      this.properties = {};
      this.firstRow = { getCell: (number) => ({ address: "C" + number }) };
    }
    addRow(row) {
      this.rows.push(row);
    }
    getRow(number) {
      if (number === 1)
        return {
          getCell: (column) => ({ address: String.fromCharCode(64 + column) + "1" }),
          height: 0,
          font: null,
          fill: null,
          alignment: null
        };
      return { alignment: null };
    }
    eachRow(callback) {
      callback({}, 1);
      callback({}, 2);
    }
  }
  class Workbook {
    constructor() {
      this.worksheets = [];
      this.xlsx = { writeBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };
      excel.workbooks.push(this);
    }
    addWorksheet(name) {
      const sheet = new Worksheet(name);
      this.worksheets.push(sheet);
      return sheet;
    }
  }
  return { default: { Workbook } };
});
import { downloadBookingsExcel, downloadUsersExcel } from "../app/utils/exportExcel";

beforeEach(() => {
  excel.workbooks.length = 0;
  vi.restoreAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:export");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("Excel exports", () => {
  it("builds, styles, sanitizes, and downloads booking workbooks", async () => {
    await downloadBookingsExcel([
      { id: "b1", salesOrderId: "=FORMULA", dealerCode: "D1", regionalInputs: { wholesaleInput: "Ready" } }
    ]);
    const workbook = excel.workbooks[0];
    const sheet = workbook.worksheets[0];
    expect(workbook.creator).toBe("Booking Dashboard");
    expect(sheet.name).toBe("Bookings");
    expect(sheet.columns.length).toBeGreaterThan(20);
    expect(sheet.rows[0].salesOrderId).toBe("'=FORMULA");
    expect(sheet.views).toEqual([{ state: "frozen", ySplit: 1 }]);
    expect(sheet.autoFilter.from).toBe("A1");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:export");
  });

  it("exports user columns with safe empty and formula values", async () => {
    await downloadUsersExcel([{ name: "+Injected", email: "user@example.com", role: "Dealer", status: "active" }]);
    const sheet = excel.workbooks[0].worksheets[0];
    expect(sheet.name).toBe("Users");
    expect(sheet.columns.map((column) => column.key)).toContain("reportingManagerEmail");
    expect(sheet.rows[0].name).toBe("'+Injected");
    expect(sheet.rows[0].region).toBe("");
    expect(document.querySelector("a")).toBeNull();
  });
});
