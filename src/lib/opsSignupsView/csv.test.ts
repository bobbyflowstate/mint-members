import { describe, expect, it } from "vitest";
import { buildSignupCsv, CsvColumn } from "./csv";

interface Row {
  name: string;
  phone: string;
  notes: string;
}

const COLUMNS: CsvColumn<Row>[] = [
  { key: "name", header: "Name", getValue: (row) => row.name },
  { key: "phone", header: "Phone", getValue: (row) => row.phone },
  { key: "notes", header: "Notes", getValue: (row) => row.notes },
];

describe("buildSignupCsv", () => {
  it("uses selected column order for header and values", () => {
    const csv = buildSignupCsv(
      [{ name: "Alex Rivera", phone: "+1555123", notes: "" }],
      [COLUMNS[1], COLUMNS[0]]
    );

    expect(csv).toBe("Phone,Name\n+1555123,Alex Rivera");
  });

  it("escapes commas, quotes, and newlines", () => {
    const csv = buildSignupCsv(
      [
        {
          name: 'Alex "A"',
          phone: "+1,555,123",
          notes: "Line 1\nLine 2",
        },
      ],
      COLUMNS
    );

    expect(csv).toBe(
      'Name,Phone,Notes\n"Alex ""A""","+1,555,123","Line 1\nLine 2"'
    );
  });

  it("serializes empty values as blank cells", () => {
    const csv = buildSignupCsv(
      [{ name: "Jordan", phone: "", notes: "" }],
      COLUMNS
    );

    expect(csv).toBe("Name,Phone,Notes\nJordan,,");
  });
});
