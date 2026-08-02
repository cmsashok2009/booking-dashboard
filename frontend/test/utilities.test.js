import { describe, expect, it } from "vitest";
import { parseCsvPreview } from "../app/utils/csv";
import { formValues } from "../app/utils/forms";
import { userInitials } from "../app/utils/users";

describe("CSV preview parsing", () => {
  it("supports commas, escaped quotes, CRLF, blank rows, and the ten-row preview limit", () => {
    const data = [
      "Name,Note",
      '"Ravi, Kumar","He said ""hello"""',
      "",
      ...Array.from({ length: 12 }, (_, index) => `User ${index},Note ${index}`)
    ].join("\r\n");
    const preview = parseCsvPreview(data);
    expect(preview.headers).toEqual(["Name", "Note"]);
    expect(preview.rows).toHaveLength(10);
    expect(preview.rows[0]).toEqual(["Ravi, Kumar", 'He said "hello"']);
  });

  it("returns an empty preview for empty input and preserves quoted newlines", () => {
    expect(parseCsvPreview("")).toEqual({ headers: [], rows: [] });
    expect(parseCsvPreview('Name,Note\nRavi,"Line one\nLine two"').rows).toEqual([["Ravi", "Line one\nLine two"]]);
  });
});

describe("form value mapping", () => {
  it("maps enabled named controls and checkbox booleans", () => {
    const form = document.createElement("form");
    form.innerHTML =
      '<input name="name" value="Ravi"><input name="active" type="checkbox" checked><input name="ignored" value="x" disabled><input value="unnamed">';
    expect(formValues(form)).toEqual({ name: "Ravi", active: true });
  });
});

describe("user initials", () => {
  it.each([
    [{ name: "ravi kumar singh" }, "RK"],
    [{ email: "agent@example.com" }, "A"],
    [{ name: "  " }, "U"],
    [null, "U"]
  ])("maps %j to %s", (user, expected) => {
    expect(userInitials(user)).toBe(expected);
  });
});
