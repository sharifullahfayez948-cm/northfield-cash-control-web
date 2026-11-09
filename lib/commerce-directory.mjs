export function accountCode(row) {
  if (!row?.id) return "";
  const prefix =
    row.kind === "CUSTOMER" ? "CUS" : row.kind === "SUPPLIER" ? "SUP" : "REF";
  return `${prefix}-${String(row.id).padStart(6, "0")}`;
}

export function directoryMatches(rows, query) {
  const text = String(query || "")
    .trim()
    .toLocaleLowerCase();
  const digits = text.replace(/\D/g, "");
  return rows.filter(
    (row) =>
      !text ||
      `${row.name} ${row.phone || ""} ${accountCode(row)}`
        .toLocaleLowerCase()
        .includes(text) ||
      (digits.length >= 3 &&
        /^[+\d\s().-]+$/.test(text) &&
        String(row.phone || "")
          .replace(/\D/g, "")
          .includes(digits)),
  );
}
