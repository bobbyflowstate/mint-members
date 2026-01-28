import Papa from "papaparse";

export interface CSVParseResult {
  valid: string[];
  invalid: Array<{ value: string; reason: string }>;
}

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse CSV file containing emails
 * CSV must have an "email" header column
 */
export async function parseEmailCSV(file: File): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const valid: string[] = [];
        const invalid: Array<{ value: string; reason: string }> = [];

        // Check if results have an "email" column
        const hasEmailColumn = results.meta.fields?.includes("email");

        if (!hasEmailColumn) {
          reject(new Error('CSV must have an "email" header column'));
          return;
        }

        for (const row of results.data) {
          const emailValue = (row as Record<string, string>)["email"];

          if (!emailValue || typeof emailValue !== "string") {
            continue; // Skip empty rows
          }

          const trimmed = emailValue.trim();
          if (!trimmed) {
            continue; // Skip empty values
          }

          // Validate email format
          if (!EMAIL_REGEX.test(trimmed)) {
            invalid.push({
              value: trimmed,
              reason: "Invalid email format",
            });
            continue;
          }

          // Add to valid list (normalized to lowercase)
          valid.push(trimmed.toLowerCase());
        }

        // Remove duplicates from valid list
        const uniqueValid = [...new Set(valid)];

        resolve({
          valid: uniqueValid,
          invalid,
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}
