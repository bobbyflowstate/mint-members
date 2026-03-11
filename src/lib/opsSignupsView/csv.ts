export interface CsvColumn<T> {
  key: string;
  header: string;
  getValue: (row: T) => string;
}

function escapeCsvCell(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  if (!needsQuotes) {
    return value;
  }
  return `"${value.replace(/"/g, "\"\"")}"`;
}

export function buildSignupCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerRow = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const valueRows = rows.map((row) =>
    columns
      .map((column) => {
        const value = column.getValue(row) ?? "";
        return escapeCsvCell(value);
      })
      .join(",")
  );

  return [headerRow, ...valueRows].join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
