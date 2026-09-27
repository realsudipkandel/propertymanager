import { BANK_DIRECTION, type BankDirection } from "@/domain/constants";
import { parseIsoDate, type IsoDate } from "@/domain/dates";
import { parsePoundsToPence } from "@/domain/money";

export type BankCsvRow = {
  occurredOn: IsoDate;
  description: string;
  amountPence: number;
  direction: BankDirection;
  reference: string;
};

const FORMULA_PREFIX = /^[=+\-@]/;

export function csvCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) {
    return `"${safe.replaceAll('"', '""')}"`;
  }
  return safe;
}

export function serialiseCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `${lines.join("\n")}\n`;
}

export function parseBankCsv(text: string): { rows: BankCsvRow[] } | { errors: string[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { errors: ["The file needs a header and at least one transaction."] };
  }
  const header = splitCsvLine(lines[0] ?? "").map((cell) => cell.trim().toLowerCase());
  const expected = ["date", "description", "amount", "direction", "reference"];
  const missing = expected.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { errors: [`Missing columns: ${missing.join(", ")}`] };
  }
  const index = new Map(header.map((column, position) => [column, position]));
  const errors: string[] = [];
  const rows: BankCsvRow[] = [];
  for (let lineNumber = 1; lineNumber < lines.length; lineNumber += 1) {
    const cells = splitCsvLine(lines[lineNumber] ?? "");
    const dateValue = cellAt(cells, index.get("date"));
    const description = cellAt(cells, index.get("description"));
    const amountValue = cellAt(cells, index.get("amount"));
    const directionValue = cellAt(cells, index.get("direction")).toUpperCase();
    const reference = cellAt(cells, index.get("reference"));
    const occurredOn = parseIsoDate(dateValue) ? dateValue : null;
    const amountPence = parsePoundsToPence(amountValue.replace(/£/g, ""));
    const direction =
      directionValue === BANK_DIRECTION.CREDIT || directionValue === BANK_DIRECTION.DEBIT
        ? directionValue
        : null;
    const problems: string[] = [];
    if (!occurredOn) {
      problems.push("date");
    }
    if (description.trim().length === 0) {
      problems.push("description");
    }
    if (amountPence === null || amountPence === 0) {
      problems.push("amount");
    }
    if (!direction) {
      problems.push("direction");
    }
    if (problems.length > 0) {
      errors.push(`Row ${lineNumber + 1}: invalid ${problems.join(", ")}`);
      continue;
    }
    rows.push({
      occurredOn: occurredOn ?? dateValue,
      description: description.trim(),
      amountPence: amountPence ?? 0,
      direction: direction ?? BANK_DIRECTION.CREDIT,
      reference: reference.trim(),
    });
  }
  if (errors.length > 0) {
    return { errors };
  }
  return { rows };
}

function cellAt(cells: string[], index: number | undefined): string {
  if (index === undefined) {
    return "";
  }
  return cells[index] ?? "";
}

export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? "";
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (character === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current);
  return cells;
}
