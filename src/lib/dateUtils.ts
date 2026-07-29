/**
 * Date utility helpers for normalizing and formatting DATE and DATETIME values across backend and frontend.
 */

export function normalizeDateForDb(val: any, fieldLabel = "data"): string | null {
  if (val === null || val === undefined) {
    return null;
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") {
      return null;
    }

    // Extract first 10 characters: YYYY-MM-DD
    const datePart = trimmed.slice(0, 10);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(datePart)) {
      const [year, month, day] = datePart.split("-").map(Number);
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        // Validate calendar date using UTC to avoid timezone shifts
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        if (
          utcDate.getUTCFullYear() === year &&
          utcDate.getUTCMonth() === month - 1 &&
          utcDate.getUTCDate() === day
        ) {
          return datePart;
        }
      }
    }

    // Fallback ISO parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getUTCFullYear();
      const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(parsed.getUTCDate()).padStart(2, "0");
      if (yyyy >= 1900 && yyyy <= 2100) {
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    const err: any = new Error(`Data inválida para ${fieldLabel}: "${val}". O formato correto é AAAA-MM-DD.`);
    err.status = 400;
    err.isValidationError = true;
    throw err;
  }

  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      const err: any = new Error(`Data inválida para ${fieldLabel}.`);
      err.status = 400;
      err.isValidationError = true;
      throw err;
    }
    const yyyy = val.getUTCFullYear();
    const mm = String(val.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(val.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const err: any = new Error(`Formato de data inválido para ${fieldLabel}. O formato correto é AAAA-MM-DD.`);
  err.status = 400;
  err.isValidationError = true;
  throw err;
}

export function normalizeDateTimeForDb(val: any, fieldLabel = "data e hora"): string | null {
  if (val === null || val === undefined) {
    return null;
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed} 00:00:00`;
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 19).replace("T", " ");
    }

    const err: any = new Error(`Data e hora inválida para ${fieldLabel}: "${val}".`);
    err.status = 400;
    err.isValidationError = true;
    throw err;
  }

  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      const err: any = new Error(`Data e hora inválida para ${fieldLabel}.`);
      err.status = 400;
      err.isValidationError = true;
      throw err;
    }
    return val.toISOString().slice(0, 19).replace("T", " ");
  }

  const err: any = new Error(`Formato de data e hora inválido para ${fieldLabel}.`);
  err.status = 400;
  err.isValidationError = true;
  throw err;
}

export function formatDateForInput(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    return val.trim().slice(0, 10);
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, "0");
    const dd = String(val.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}
