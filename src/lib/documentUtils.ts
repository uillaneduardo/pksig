/**
 * Document formatting and helper utilities.
 */

export function formatCurrency(val: number | string | null | undefined): string {
  const num = typeof val === "number" ? val : parseFloat(String(val || 0));
  if (isNaN(num)) return "R$ 0,00";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDatePtBr(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return "Não informada";
  const str = String(dateVal).trim();
  if (!str || str === "null" || str === "undefined") return "Não informada";

  // If string is YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yyyy, mm, dd] = str.split("-");
    return `${dd}/${mm}/${yyyy}`;
  }

  // If ISO string with T or space
  const datePart = str.split("T")[0].split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [yyyy, mm, dd] = datePart.split("-");
    return `${dd}/${mm}/${yyyy}`;
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch (e) {
    // ignore
  }

  return str;
}

export function formatDateTimePtBr(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return "Não informada";
  const str = String(dateVal).trim();
  if (!str || str === "null" || str === "undefined") return "Não informada";

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
    }
  } catch (e) {
    // ignore
  }

  return formatDatePtBr(dateVal);
}

export function getClientSignatureInfo(client: any): { name: string; role: string } {
  if (!client) {
    return { name: "CLIENTE", role: "Cliente" };
  }

  const isPJ = String(client.type).toUpperCase() === "PJ";
  let name = "";

  if (isPJ) {
    name = client.responsible?.trim() || client.name?.trim() || "RESPONSÁVEL LEGAL";
    return { name, role: "Responsável pelo cliente (PJ)" };
  }

  name = client.name?.trim() || "CLIENTE";
  return { name, role: "Cliente" };
}
