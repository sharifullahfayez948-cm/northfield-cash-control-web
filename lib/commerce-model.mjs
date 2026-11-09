export const SALES_CATEGORIES = [
  "Food",
  "Medicine",
  "Test Kit",
  "Internal Laboratory Test",
  "External Laboratory Test",
  "Vaccine",
  "Consultation",
  "Surgery",
  "Hospitalization/Boarding",
  "Radiography/Ultrasound",
  "Retail Products",
  "Other Services",
  "Mixed",
  "Grooming",
  "Echocardiography",
  "Procedure",
  "Certification",
];
export const PURCHASE_CATEGORIES = [
  "Veterinary Diet Food",
  "Medicine",
  "Consumable",
  "Office Supply",
  "External Laboratory Payment",
  "Transportation Expenses",
  "Delivery Expenses",
  "Miscellaneous Expenses",
  "Internet and Phone",
  "General Maintenance",
  "Uniform Expenses",
  "Medicine/Vaccine",
  "Other expenses",
  "Test Kit",
  "Ultrasound Specialist",
  "Mixed",
  "License Fee",
  "Vaccine",
  "Consultation",
  "Instrument",
  "Reimbursement",
  "Facilities Maintenance",
  "Medical Equipment",
];
export const PAYMENT_METHODS = [
  "Cash",
  "Card",
  "Payment Link",
  "Bank Transfer",
  "Botim card",
  "Cheque",
  "Other",
];
export function businessToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error("Enter a valid date.");
  return value;
}
export function cents(value, label = "Amount") {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error(
      `${label} must be a non-negative amount with at most two decimals.`,
    );
  const [whole, fraction = ""] = text.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 99999999999)
    throw new Error(`${label} is too large.`);
  return result;
}
export const decimal = (value) => (value / 100).toFixed(2);
export function textField(value, label, required = false, max = 240) {
  const text = String(value ?? "").trim();
  if ((required && !text) || text.length > max)
    throw new Error(
      `${label} is required and must be at most ${max} characters.`,
    );
  return text;
}
export function requestKey(value) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value),
    )
  )
    throw new Error("Reload the form before saving.");
  return value;
}
export function normalizeDocument(body) {
  if (!["SALE", "PURCHASE", "EXPENSE"].includes(body.kind))
    throw new Error("Choose sale, purchase or expense.");
  const before = cents(body.before, "Amount before VAT");
  const vat =
    body.vatMode === "NONE"
      ? 0
      : body.vatMode === "CUSTOM"
        ? cents(body.vat, "VAT")
        : Math.round((before * 5) / 100);
  if (!["STANDARD", "NONE", "CUSTOM"].includes(body.vatMode))
    throw new Error("Choose a VAT option.");
  const total = before + vat;
  if (total <= 0 || total > 99999999999)
    throw new Error(
      "Invoice total must be positive and within the amount limit.",
    );
  const splits =
    body.payments == null ? null : normalizePayments(body.payments);
  const paid = splits
    ? splits.reduce((n, p) => n + p.amount, 0)
    : cents(body.paid ?? "0", "Payment");
  if (paid > total) throw new Error("Payment cannot exceed the invoice total.");
  if (!splits && paid > 0 && !PAYMENT_METHODS.includes(body.method))
    throw new Error("Choose a payment method.");
  const date = validDate(body.date);
  const paymentDate = paid > 0 ? validDate(body.paymentDate || date) : null;
  if (paymentDate && paymentDate < date)
    throw new Error("Payment date cannot precede the invoice date.");
  return {
    kind: body.kind,
    date,
    invoice: textField(body.invoice, "Invoice / reference", true),
    party: textField(body.party, "Client / supplier", true),
    staff: textField(body.staff, "Doctor / staff member", body.kind === "SALE"),
    category: textField(body.category, "Category", true),
    remarks: textField(body.remarks, "Remarks", false, 2000),
    before,
    vat,
    total,
    paid,
    payments:
      splits ||
      (paid ? [{ method: body.method, amount: paid, reference: "" }] : []),
    method: paid ? body.method : null,
    paymentDate,
    key: requestKey(body.requestKey),
    partyId: body.partyId || null,
    staffId: body.staffId || null,
    categoryId: body.categoryId || null,
  };
}
export function normalizePayments(values) {
  if (!Array.isArray(values) || values.length > 8)
    throw new Error("Use up to eight payment parts.");
  return values.map((p) => {
    const amount = cents(p.amount, "Payment");
    if (amount <= 0 || !PAYMENT_METHODS.includes(p.method))
      throw new Error(
        "Each payment part needs a method and a positive amount.",
      );
    return {
      method: p.method,
      amount,
      reference: textField(p.reference, "Payment reference", false),
    };
  });
}
