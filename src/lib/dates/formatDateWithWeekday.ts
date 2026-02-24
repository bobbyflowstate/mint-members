export function formatDateWithWeekday(dateValue: string | undefined): string {
  if (!dateValue) {
    return "Not specified";
  }

  const parts = dateValue.split("-");
  if (parts.length !== 3) {
    return dateValue;
  }

  const [year, month, day] = parts.map(Number);
  if (![year, month, day].every(Number.isFinite)) {
    return dateValue;
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
