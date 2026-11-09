import { createLuxuryReport, aed, dayLabel, loadBrand } from "./luxuryPdf";
const amount = (n) => `AED ${aed(n)}`;
function section(r, title, head, body) {
  r.newPage();
  r.heading(title, "", 45);
  r.table({
    startY: 51,
    head: [head],
    body: body.length
      ? body
      : [[{ content: "No entries", colSpan: head.length }]],
  });
}
export function invoiceReport(data, brand) {
  const d = data.document,
    p = data.payments.filter((p) => p.status === "POSTED");
  const r = createLuxuryReport({
    brand,
    title: d.kind === "SALE" ? "INVOICE" : "PURCHASE RECORD",
    subtitle: d.invoice_no,
    from: d.date,
    to: d.date,
  });
  let y = r.cards([
    { label: "INVOICE TOTAL", value: amount(d.total), color: r.C.NAVY2 },
    { label: "PAID", value: amount(d.paid), color: r.C.GREEN },
    {
      label: "BALANCE DUE",
      value: amount(d.status === "VOID" ? 0 : d.balance),
      color: r.C.GOLD,
    },
  ]);
  y = r.heading(
    d.kind === "SALE" ? "BILL TO" : "SUPPLIER",
    `ACCOUNT ${d.party_id || ""}`,
    y + 10,
  );
  y = r.table({
    startY: y,
    head: [["NAME / CONTACT", "INVOICE DETAILS"]],
    body: [
      [
        `${d.party}\n${d.phone || ""}\n${d.address || ""}${d.tax_no ? "\nTax number: " + d.tax_no : ""}`,
        `Invoice: ${d.invoice_no}\nDate: ${dayLabel(d.date)}\n${d.staff_name ? "Doctor / Staff: " + d.staff_name + "\n" : ""}Status: ${d.status === "VOID" ? "VOID" : Number(d.balance) === 0 ? "PAID" : Number(d.paid) > 0 ? "PART PAID" : "UNPAID"}`,
      ],
    ],
    columnStyles: { 0: { cellWidth: 98 } },
  });
  y = r.table({
    startY: y + 8,
    head: [["DESCRIPTION", "BEFORE VAT", "VAT", "TOTAL (AED)"]],
    body: [
      [
        d.category + (d.remarks ? "\n" + d.remarks : ""),
        aed(d.before_vat),
        aed(d.vat),
        aed(d.total),
      ],
    ],
    columnStyles: {
      0: { cellWidth: 90 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    foot: [["TOTAL", aed(d.before_vat), aed(d.vat), aed(d.total)]],
  });
  if (p.length) {
    if (y > r.H - 75) {
      r.newPage();
      y = 42;
    }
    r.table({
      startY: y + 8,
      head: [["PAYMENT DATE", "METHOD", "REFERENCE", "AMOUNT (AED)"]],
      body: p.map((x) => [
        dayLabel(x.date),
        x.method,
        x.reference_no || "",
        aed(x.amount),
      ]),
      columnStyles: { 3: { halign: "right" } },
    });
  }
  r.signatures(["PREPARED BY", "RECEIVED BY"]);
  return r;
}
export async function outputInvoice(id, kind, print = false) {
  const popup = print ? window.open("", "_blank") : null;
  if (popup) popup.opener = null;
  try {
    const response = await fetch(`/api/commerce?kind=${kind}&id=${id}`),
      data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const report = invoiceReport(data, await loadBrand());
    if (print) {
      if (!popup)
        throw new Error("Allow pop-ups to print, or use Download PDF.");
      report.doc.autoPrint();
      const url = URL.createObjectURL(report.doc.output("blob"));
      popup.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } else
      report.save(
        `Northfield-Invoice-${String(data.document.invoice_no).replace(/[^a-z0-9_-]/gi, "-")}.pdf`,
      );
  } catch (e) {
    popup?.close();
    throw e;
  }
}
export function registerReport(
  data,
  brand,
  { sales, from, to, staff = "", search = "" },
) {
  const r = createLuxuryReport({
      brand,
      title: sales ? "SALES REPORT" : "PURCHASES & EXPENSES",
      subtitle: staff || "FINANCIAL REGISTER",
      from,
      to,
      orientation: "landscape",
    }),
    t = data.totals;
  const y = r.cards([
    { label: "BEFORE VAT", value: amount(t.before_vat) },
    { label: "VAT", value: amount(t.vat), color: r.C.GOLD },
    { label: "TOTAL", value: amount(t.total) },
    {
      label: "OUTSTANDING",
      value: amount(Number(t.total) - Number(t.paid)),
      color: r.C.RED,
    },
  ]);
  r.heading(
    "INVOICE REGISTER",
    search
      ? `Search: ${search.slice(0, 60)}`
      : "All figures in AED · voided invoices excluded from totals",
    y + 10,
  );
  r.table({
    startY: y + 16,
    head: [
      [
        "DATE",
        "INVOICE",
        "CLIENT / SUPPLIER",
        sales ? "DOCTOR / STAFF" : "TYPE",
        "CATEGORY",
        "NET",
        "VAT",
        "TOTAL",
        "PAID",
        "DUE",
        "STATUS",
      ],
    ],
    body: data.rows.map((d) => [
      dayLabel(d.date),
      d.invoice_no,
      d.party,
      sales ? d.staff_name : d.kind,
      d.category,
      aed(d.before_vat),
      aed(d.vat),
      aed(d.total),
      aed(d.paid),
      d.status === "VOID" ? "—" : aed(d.balance),
      d.status,
    ]),
    styles: { fontSize: 7 },
    headStyles: { fontSize: 7 },
  });
  if (sales)
    section(
      r,
      "DOCTOR & STAFF PERFORMANCE",
      ["DOCTOR / STAFF", "INVOICES", "BEFORE VAT", "VAT", "TOTAL", "COLLECTED"],
      data.doctors.map((d) => [
        d.staff_name,
        d.entries,
        aed(d.before_vat),
        aed(d.vat),
        aed(d.total),
        aed(d.paid),
      ]),
    );
  section(
    r,
    "CATEGORY SUMMARY",
    ["CATEGORY", "ENTRIES", "BEFORE VAT", "VAT", "TOTAL"],
    data.categories.map((d) => [
      d.category,
      d.entries,
      aed(d.before_vat),
      aed(d.vat),
      aed(d.total),
    ]),
  );
  section(
    r,
    "PAYMENTS BY PAYMENT DATE",
    ["METHOD", "AMOUNT (AED)"],
    data.payments.map((p) => [p.method, aed(p.amount)]),
  );
  r.signatures();
  return r;
}
export function accountReport(data, brand, sales) {
  const r = createLuxuryReport({
    brand,
    title: "ACCOUNT STATEMENT",
    subtitle: data.account.name,
    from: data.period?.from,
    to: data.period?.to,
    orientation: "landscape",
  });
  const y = r.cards([
    {
      label: sales ? "CUSTOMER" : "SUPPLIER",
      value: data.account.name,
      note: data.account.phone || "",
    },
    {
      label: sales ? "RECEIVABLE" : "PAYABLE",
      value: amount(data.balance),
      color: r.C.RED,
    },
    {
      label: "ACCOUNT",
      value: `${sales ? "CUS" : "SUP"}-${String(data.account.id).padStart(6, "0")}`,
      note:
        data.period?.from || data.period?.to
          ? "Selected period"
          : "All history",
    },
  ]);
  r.heading(
    "ACCOUNT ACTIVITY",
    "Debit / credit in AED · voided records excluded",
    y + 10,
  );
  r.table({
    startY: y + 16,
    head: [
      [
        "DATE",
        "TYPE / METHOD",
        "INVOICE",
        "DEBIT",
        "CREDIT",
        sales ? "CUSTOMER OWES" : "CLINIC OWES",
      ],
    ],
    body: data.ledger.map((l) => [
      dayLabel(l.date),
      l.type,
      l.reference,
      aed(l.debit),
      aed(l.credit),
      aed(l.balance),
    ]),
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
  });
  r.signatures();
  return r;
}
