"use client";
import { useEffect, useRef, useState } from "react";
import {
  PlusCircle,
  Download,
  RefreshCw,
  X,
  Receipt,
  Wallet,
  Users,
  CheckCircle2,
  Printer,
  FileText,
} from "lucide-react";
import * as XLSX from "xlsx";
import { businessToday, PAYMENT_METHODS } from "@/lib/commerce-model.mjs";
import { CatalogPicker, PaymentParts } from "./CommerceFields";
import CommerceOverlay from "./CommerceOverlay";
import AccountCenter from "./AccountCenter";
import { outputInvoice, registerReport } from "@/lib/commerce-pdf";
import { loadBrand } from "@/lib/luxuryPdf";

const money = (value) =>
  `AED ${Number(value || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
async function request(url, body) {
  const response = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to complete this request.");
  return data;
}
function Field({ label, children, wide = false }) {
  return (
    <label className={`spField ${wide ? "spWide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Modal({ title, children, onClose, busy }) {
  return (
    <CommerceOverlay onClose={onClose} busy={busy}>
      <section
        className="spModal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header>
          <div>
            <small>NORTHFIELD · FINANCIAL CONTROL</small>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="btn btnSoft"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </CommerceOverlay>
  );
}
function SummaryTable({ title, rows, columns }) {
  return (
    <section className="spPanel">
      <h3>{title}</h3>
      <div className="spScroll">
        <table>
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map(([key, , currency]) => (
                  <td key={key}>
                    {currency ? money(row[key]) : row[key] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="spEmpty">No posted entries in this period.</p>
        )}
      </div>
    </section>
  );
}
export default function CommerceCenter({ kind, user, invoiceRequest }) {
  const sales = kind === "SALE",
    today = businessToday();
  const [filters, setFilters] = useState({
    from: `${today.slice(0, 7)}-01`,
    to: today,
    staff: "",
    search: "",
    page: 1,
  });
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [view, setView] = useState("register"),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [history, setHistory] = useState(null),
    [savedInvoice, setSavedInvoice] = useState(null),
    [portal, setPortal] = useState(false),
    [refresh, setRefresh] = useState(0);
  const sequence = useRef(0),
    submitting = useRef(false),
    defaults = useRef({});
  const url = () =>
    `/api/commerce?${new URLSearchParams({ kind, ...filters })}`;
  useEffect(() => {
    if (invoiceRequest?.id) {
      setPortal(false);
      details({ id: invoiceRequest.id });
    }
  }, [invoiceRequest]);
  useEffect(() => {
    const seq = ++sequence.current;
    setLoading(true);
    setError("");
    const timer = setTimeout(
      () =>
        request(`/api/commerce?${new URLSearchParams({ kind, ...filters })}`)
          .then((d) => {
            if (sequence.current === seq) setData(d);
          })
          .catch((e) => {
            if (sequence.current === seq) {
              setError(e.message);
              setData(null);
            }
          })
          .finally(() => {
            if (sequence.current === seq) setLoading(false);
          }),
      180,
    );
    return () => {
      clearTimeout(timer);
      sequence.current++;
    };
  }, [kind, filters, refresh]);
  const setFilter = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  function openNew() {
    setFormError("");
    setModal({
      action: "create",
      kind: sales ? "SALE" : "PURCHASE",
      date: defaults.current.date || today,
      paymentDate: defaults.current.paymentDate || today,
      invoice: "",
      party: "",
      staff: defaults.current.staff || "",
      staffId: defaults.current.staffId || null,
      category: defaults.current.category || "",
      categoryId: defaults.current.categoryId || null,
      before: "",
      vatMode: defaults.current.vatMode || "STANDARD",
      vat: "",
      remarks: "",
      paymentMode: "FULL",
      method: defaults.current.method || "Cash",
      payments: [
        { method: "Cash", amount: "", reference: "" },
        { method: "Card", amount: "", reference: "" },
      ],
      paid: "",
      requestKey: crypto.randomUUID(),
    });
  }
  function editInvoice(row) {
    setFormError("");
    setModal({
      action: "edit",
      kind: row.kind,
      id: row.id,
      revision: row.revision,
      date: row.date,
      invoice: row.invoice_no,
      party: row.party,
      partyId: row.party_id,
      staff: row.staff_name,
      staffId: row.staff_id,
      category: row.category,
      categoryId: row.category_id,
      before: String(row.before_vat),
      vatMode: "CUSTOM",
      vat: String(row.vat),
      remarks: row.remarks,
      reason: "",
      paid: "0",
      paymentMode: "CREDIT",
      requestKey: crypto.randomUUID(),
    });
  }
  async function printInvoice(id, print = true) {
    setFormError("");
    try {
      await outputInvoice(id, kind, print);
    } catch (e) {
      setFormError(e.message);
      setError(e.message);
    }
  }
  async function pdf() {
    setBusy(true);
    try {
      const d = await request(`${url()}&export=1`);
      registerReport(d, await loadBrand(), {
        sales,
        from: filters.all === "1" ? undefined : filters.from,
        to: filters.all === "1" ? undefined : filters.to,
        staff: filters.staff,
        search: filters.search,
      }).save(`Northfield-${sales ? "Sales" : "Purchases"}-Report.pdf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const before = Number(modal?.before || 0),
    vat =
      modal?.vatMode === "NONE"
        ? 0
        : modal?.vatMode === "CUSTOM"
          ? Number(modal.vat || 0)
          : Math.round(before * 100 * 0.05) / 100,
    total = Math.round((before + vat) * 100) / 100;
  function change(key, value) {
    setModal((m) => ({ ...m, [key]: value }));
  }
  async function save(e) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setFormError("");
    try {
      const body = { ...modal };
      if (body.action === "create") {
        body.paid =
          body.paymentMode === "CREDIT"
            ? "0"
            : body.paymentMode === "FULL"
              ? total.toFixed(2)
              : body.paid;
        if (body.paymentMode !== "SPLIT") delete body.payments;
      }
      const result = await request("/api/commerce", body);
      if (body.action === "create") {
        defaults.current = {
          date: body.date,
          paymentDate: body.paymentDate,
          staff: body.staff,
          staffId: body.staffId,
          category: body.category,
          categoryId: body.categoryId,
          vatMode: body.vatMode,
          method: body.method,
        };
        setSavedInvoice({ id: result.id, invoice: body.invoice });
        if (e.nativeEvent?.submitter?.value === "next") {
          openNew();
          requestAnimationFrame(() =>
            document.getElementById("spInvoiceInput")?.focus(),
          );
        } else
          setModal({ action: "saved", id: result.id, invoice: body.invoice });
      } else setModal(null);
      setMessage(
        body.action === "void"
          ? "Invoice and linked payments voided."
          : body.action === "pay"
            ? "Payment recorded. Cash payments are linked to Cash Control."
            : "Entry saved. Cash payments are linked to Cash Control.",
      );
      setRefresh((x) => x + 1);
    } catch (e) {
      setFormError(e.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function details(row) {
    setFormError("");
    setHistory(null);
    setModal({ action: "details", row });
    try {
      const d = await request(`/api/commerce?kind=${kind}&id=${row.id}`);
      setHistory(d.payments);
      setModal((m) =>
        m?.action === "details" && m.row.id === row.id
          ? { ...m, row: d.document }
          : m,
      );
    } catch (e) {
      setFormError(e.message);
    }
  }
  async function excel() {
    setBusy(true);
    setError("");
    try {
      const d = await request(`${url()}&export=1`),
        book = XLSX.utils.book_new();
      const rows = d.rows.map((r) => ({
        Date: r.date,
        Type: r.kind,
        "Invoice No.": r.invoice_no,
        "Client / Supplier": r.party,
        ...(sales ? { "Doctor / Staff": r.staff_name } : {}),
        Category: r.category,
        "Before VAT": Number(r.before_vat),
        VAT: Number(r.vat),
        Total: Number(r.total),
        Paid: Number(r.paid),
        "Balance Due": r.status === "VOID" ? 0 : Number(r.balance),
        Status: r.status,
        Remarks: r.remarks,
      }));
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(rows),
        "Register",
      );
      if (sales)
        XLSX.utils.book_append_sheet(
          book,
          XLSX.utils.json_to_sheet(
            d.doctors.map((r) => ({
              ...r,
              before_vat: Number(r.before_vat),
              vat: Number(r.vat),
              total: Number(r.total),
              paid: Number(r.paid),
            })),
          ),
          "Doctor Summary",
        );
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(
          d.categories.map((r) => ({
            ...r,
            before_vat: Number(r.before_vat),
            vat: Number(r.vat),
            total: Number(r.total),
          })),
        ),
        "Category Summary",
      );
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(
          d.payments.map((r) => ({ ...r, amount: Number(r.amount) })),
        ),
        "Payments by Payment Date",
      );
      XLSX.writeFile(
        book,
        `Northfield-${sales ? "Sales" : "Purchases"}-${filters.from}-${filters.to}.xlsx`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const totals = data?.totals || {},
    canWrite = user.role !== "Viewer";
  return (
    <div className="spWorkspace">
      <div className="spHeading">
        <div>
          <small>NORTHFIELD VETERINARY CLINIC</small>
          <h1>{sales ? "Sales" : "Purchases & Expenses"}</h1>
          <p>
            {sales
              ? "Record invoices, track each doctor’s sales and collect payments."
              : "Record supplier invoices, operating expenses and payments."}
          </p>
        </div>
        <div className="spActions">
          <button
            className="btn btnSoft"
            onClick={() => setRefresh((x) => x + 1)}
            disabled={loading || busy}
            aria-label="Refresh"
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="btn btnSoft"
            onClick={excel}
            disabled={!data || loading || busy}
          >
            <Download size={17} /> Excel
          </button>
          <button
            className="btn btnSoft"
            disabled={!data || loading || busy}
            onClick={pdf}
          >
            <FileText size={17} /> PDF report
          </button>
          {canWrite && (
            <button className="btn btnPrimary" onClick={openNew}>
              <PlusCircle size={17} />{" "}
              {sales ? "New sale" : "New purchase / expense"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="spAlert" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="spSuccess" role="status">
          <CheckCircle2 size={17} />
          {message}
          <button onClick={() => setMessage("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      <div className="spFilters">
        <Field label="From">
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilter("from", e.target.value)}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilter("to", e.target.value)}
          />
        </Field>
        {sales && (
          <Field label="Doctor / staff">
            <select
              value={filters.staff}
              onChange={(e) => setFilter("staff", e.target.value)}
            >
              <option value="">All staff</option>
              {data?.staff.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Find an invoice">
          <input
            placeholder="Invoice, account, phone, doctor, amount, payment or remarks"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
        </Field>
        <button
          className="btn btnSoft"
          onClick={() =>
            setFilters({ ...filters, from: today, to: today, page: 1 })
          }
        >
          Today
        </button>
        <button
          className="btn btnSoft"
          onClick={() =>
            setFilters({
              ...filters,
              from: `${today.slice(0, 7)}-01`,
              to: today,
              page: 1,
            })
          }
        >
          This month
        </button>
        <button
          className="btn btnSoft"
          onClick={() =>
            setFilters((f) => ({
              ...f,
              all: f.all === "1" ? "0" : "1",
              page: 1,
            }))
          }
        >
          {filters.all === "1" ? "Use date range" : "All history"}
        </button>
      </div>
      <button className="spOutstanding" onClick={() => setPortal(true)}>
        <Wallet size={20} />
        {sales
          ? "Receive outstanding payments"
          : "Pay outstanding supplier bills"}
        <span>All dates · accounts & statements</span>
      </button>
      <div className="spKpis" aria-busy={loading}>
        {[
          ["Invoice total", totals.total, Receipt],
          ["Before VAT", totals.before_vat, Receipt],
          ["VAT", totals.vat, Receipt],
          [
            "Outstanding",
            Number(totals.total || 0) - Number(totals.paid || 0),
            Wallet,
          ],
        ].map(([label, value, Icon]) => (
          <div key={label}>
            <span>
              <Icon size={18} />
              {label}
            </span>
            <strong>{loading ? "…" : money(value)}</strong>
          </div>
        ))}
      </div>
      <div className="spTabs" role="tablist" aria-label="Register views">
        {[
          ["register", "Register", Receipt],
          ...(sales ? [["doctors", "Doctor performance", Users]] : []),
          ["reports", "Categories & payments", Wallet],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="spEmpty" role="status">
          Loading register…
        </div>
      ) : (
        data && (
          <>
            {view === "register" && (
              <section className="spPanel">
                <div className="spPanelTitle">
                  <h3>
                    {sales ? "Sales register" : "Purchase & expense register"}
                  </h3>
                  <span>
                    {totals.count} entries · {totals.posted_count} posted
                  </span>
                </div>
                <div className="spScroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Date",
                          "Invoice / Client",
                          ...(sales ? ["Doctor / Staff"] : ["Type"]),
                          "Category",
                          "Before VAT",
                          "VAT",
                          "Total",
                          "Paid / Balance",
                          "Status",
                          "Actions",
                        ].map((s) => (
                          <th key={s}>{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr
                          key={row.id}
                          className={row.status === "VOID" ? "spVoided" : ""}
                        >
                          <td>{row.date}</td>
                          <td>
                            <b>{row.invoice_no}</b>
                            <small>{row.party}</small>
                          </td>
                          <td>
                            {sales
                              ? row.staff_name
                              : row.kind === "EXPENSE"
                                ? "Expense"
                                : "Purchase"}
                          </td>
                          <td>{row.category}</td>
                          <td>{money(row.before_vat)}</td>
                          <td>{money(row.vat)}</td>
                          <td>
                            <b>{money(row.total)}</b>
                          </td>
                          <td>
                            {row.status === "VOID" ? (
                              "—"
                            ) : (
                              <>
                                {money(row.paid)}
                                <small>Due {money(row.balance)}</small>
                              </>
                            )}
                          </td>
                          <td>
                            <span
                              className={`spBadge ${row.status === "VOID" ? "void" : Number(row.balance) === 0 ? "paid" : ""}`}
                            >
                              {row.status === "VOID"
                                ? "Void"
                                : Number(row.balance) === 0
                                  ? "Paid"
                                  : Number(row.paid) > 0
                                    ? "Partial"
                                    : "Unpaid"}
                            </span>
                          </td>
                          <td>
                            <div className="spRowActions">
                              <button onClick={() => details(row)}>
                                Details
                              </button>
                              {canWrite && row.status === "POSTED" && (
                                <button onClick={() => editInvoice(row)}>
                                  Edit invoice
                                </button>
                              )}
                              <button onClick={() => printInvoice(row.id)}>
                                Print invoice
                              </button>
                              {canWrite &&
                                row.status === "POSTED" &&
                                Number(row.balance) > 0 && (
                                  <button
                                    onClick={() => {
                                      setFormError("");
                                      setModal({
                                        action: "pay",
                                        kind: row.kind,
                                        id: row.id,
                                        invoice: row.invoice_no,
                                        date: today,
                                        amount: Number(row.balance).toFixed(2),
                                        balance: row.balance,
                                        method: "Cash",
                                        reference: "",
                                        requestKey: crypto.randomUUID(),
                                      });
                                    }}
                                  >
                                    Record payment
                                  </button>
                                )}
                              {user.role === "Super Admin" &&
                                row.status === "POSTED" && (
                                  <button
                                    onClick={() => {
                                      setFormError("");
                                      setModal({
                                        action: "void",
                                        kind: row.kind,
                                        id: row.id,
                                        invoice: row.invoice_no,
                                        reason: "",
                                      });
                                    }}
                                  >
                                    Void
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.rows.length && (
                    <div className="spEmpty">
                      <Receipt size={28} />
                      <h3>No entries in this period</h3>
                      <p>
                        {sales
                          ? "Create your first sales invoice."
                          : "Create a purchase or expense to get started."}
                      </p>
                      <p>Existing Excel records have not been imported.</p>
                    </div>
                  )}
                </div>
                <footer className="spPagination">
                  <span>
                    Page {data.page} of{" "}
                    {Math.max(
                      1,
                      Math.ceil(Number(totals.count) / data.pageSize),
                    )}
                  </span>
                  <button
                    className="btn btnSoft"
                    disabled={data.page <= 1}
                    onClick={() =>
                      setFilters((f) => ({ ...f, page: f.page - 1 }))
                    }
                  >
                    Previous
                  </button>
                  <button
                    className="btn btnSoft"
                    disabled={data.page * data.pageSize >= Number(totals.count)}
                    onClick={() =>
                      setFilters((f) => ({ ...f, page: f.page + 1 }))
                    }
                  >
                    Next
                  </button>
                </footer>
              </section>
            )}
            {view === "doctors" && (
              <>
                <p className="spNote">
                  Sales are grouped by the doctor / staff name on each invoice.
                  Voided invoices are excluded.
                </p>
                <SummaryTable
                  title="Doctor & staff sales"
                  rows={data.doctors}
                  columns={[
                    ["staff_name", "Doctor / Staff"],
                    ["entries", "Invoices"],
                    ["before_vat", "Before VAT", true],
                    ["vat", "VAT", true],
                    ["total", "Total sales", true],
                    ["paid", "Collected to date", true],
                  ]}
                />
              </>
            )}
            {view === "reports" && (
              <>
                <SummaryTable
                  title="By category · invoice dates"
                  rows={data.categories}
                  columns={[
                    ["category", "Category"],
                    ["entries", "Entries"],
                    ["before_vat", "Before VAT", true],
                    ["vat", "VAT", true],
                    ["total", "Total", true],
                  ]}
                />
                <SummaryTable
                  title={`${sales ? "Collections" : "Payments"} · payment dates`}
                  rows={data.payments}
                  columns={[
                    ["method", "Payment method"],
                    ["amount", "Amount", true],
                  ]}
                />
                <p className="spNote">
                  Cash payments automatically update Cash Control. Card, bank
                  transfer and other methods are recorded here without creating
                  cash or bank entries. Payments use their actual payment date,
                  including settlements of older invoices.
                </p>
              </>
            )}
          </>
        )
      )}
      {portal && (
        <CommerceOverlay
          onClose={() => {
            setPortal(false);
            setRefresh((x) => x + 1);
          }}
        >
          <section
            className="spPortal"
            role="dialog"
            aria-modal="true"
            aria-label="Outstanding accounts"
          >
            <button
              className="spPortalClose btn btnSoft"
              aria-label="Close outstanding accounts"
              onClick={() => {
                setPortal(false);
                setRefresh((x) => x + 1);
              }}
            >
              <X />
            </button>
            <AccountCenter kind={kind} user={user} outstandingOnly />
          </section>
        </CommerceOverlay>
      )}
      {modal && (
        <Modal
          title={
            modal.action === "saved"
              ? "Entry saved"
              : modal.action === "edit"
                ? `Edit invoice · ${modal.invoice}`
                : modal.action === "editPayment"
                  ? `Edit payment · ${modal.invoice}`
                  : modal.action === "create"
                    ? sales
                      ? "New sale"
                      : "New purchase / expense"
                    : modal.action === "pay"
                      ? `Payment · ${modal.invoice}`
                      : modal.action === "void"
                        ? `Void · ${modal.invoice}`
                        : `Invoice · ${modal.row.invoice_no}`
          }
          busy={busy}
          onClose={() => setModal(null)}
        >
          {formError && (
            <div className="spAlert" role="alert">
              {formError}
            </div>
          )}
          {modal.action === "saved" ? (
            <div className="spSaved">
              <CheckCircle2 size={44} />
              <h3>Invoice {modal.invoice} is saved.</h3>
              <p>Would you like to print the invoice?</p>
              <div className="spActions">
                <button
                  className="btn btnPrimary"
                  onClick={() => printInvoice(modal.id)}
                >
                  <Printer size={17} /> Print invoice
                </button>
                <button
                  className="btn btnSoft"
                  onClick={() => printInvoice(modal.id, false)}
                >
                  Download PDF
                </button>
                <button className="btn btnSoft" onClick={openNew}>
                  Add next entry
                </button>
                <button className="btn btnSoft" onClick={() => setModal(null)}>
                  Done
                </button>
              </div>
            </div>
          ) : modal.action === "details" ? (
            <>
              <div className="spActions">
                <button
                  className="btn btnPrimary"
                  onClick={() => printInvoice(modal.row.id)}
                >
                  <Printer size={16} /> Print invoice
                </button>
                <button
                  className="btn btnSoft"
                  onClick={() => printInvoice(modal.row.id, false)}
                >
                  Download PDF
                </button>
                {canWrite && modal.row.status === "POSTED" && (
                  <button
                    className="btn btnSoft"
                    onClick={() => editInvoice(modal.row)}
                  >
                    Edit invoice
                  </button>
                )}
              </div>
              <div className="spDetails">
                <p>
                  <b>{modal.row.party}</b> · {modal.row.date}
                </p>
                <p>
                  {modal.row.staff_name} {modal.row.category}
                </p>
                <p>
                  Total: <b>{money(modal.row.total)}</b>
                </p>
                <p className="spRemarks">
                  {modal.row.remarks || "No remarks."}
                </p>
                {modal.row.void_reason && (
                  <p>Void reason: {modal.row.void_reason}</p>
                )}
              </div>
              {history ? (
                <SummaryTable
                  title="Payment history"
                  rows={history}
                  columns={[
                    ["date", "Date"],
                    ["method", "Method"],
                    ["amount", "Amount", true],
                    ["reference_no", "Reference"],
                    ["cash_entry_id", "Cash entry"],
                    ["status", "Status"],
                  ]}
                />
              ) : (
                !formError && <p>Loading payments…</p>
              )}
              {canWrite &&
                modal.row.status === "POSTED" &&
                history
                  ?.filter((p) => p.status === "POSTED")
                  .map((p) => (
                    <button
                      key={p.id}
                      className="btn btnSoft"
                      onClick={() => {
                        setFormError("");
                        setModal({
                          action: "editPayment",
                          kind: modal.row.kind,
                          id: modal.row.id,
                          paymentId: p.id,
                          invoice: modal.row.invoice_no,
                          date: p.date,
                          amount: p.amount,
                          balance: Number(modal.row.balance) + Number(p.amount),
                          method: p.method,
                          reference: p.reference_no,
                          reason: "",
                          requestKey: crypto.randomUUID(),
                        });
                      }}
                    >
                      Edit {p.method} payment · {money(p.amount)}
                    </button>
                  ))}
              <p className="spNote">
                Invoice and payment corrections retain an audit history. All
                affected cash days must be open.
              </p>
            </>
          ) : (
            <form
              onSubmit={save}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  const button = e.currentTarget.querySelector(
                    e.shiftKey
                      ? 'button[value="next"]'
                      : 'button[value="save"]',
                  );
                  if (button && !busy) e.currentTarget.requestSubmit(button);
                }
              }}
            >
              {savedInvoice && modal.action === "create" && (
                <div className="spSuccess">
                  Invoice {savedInvoice.invoice} saved. Print it?
                  <button
                    type="button"
                    onClick={() => printInvoice(savedInvoice.id)}
                  >
                    Print invoice
                  </button>
                </div>
              )}
              {["create", "edit"].includes(modal.action) && (
                <>
                  <div className="spForm">
                    {!sales && (
                      <Field label="Entry type">
                        <select
                          disabled={modal.action === "edit"}
                          value={modal.kind}
                          onChange={(e) => change("kind", e.target.value)}
                        >
                          <option value="PURCHASE">Purchase</option>
                          <option value="EXPENSE">Expense</option>
                        </select>
                      </Field>
                    )}
                    <Field label="Invoice date">
                      <input
                        required
                        type="date"
                        value={modal.date}
                        onChange={(e) =>
                          setModal((m) => ({
                            ...m,
                            date: e.target.value,
                            paymentDate:
                              m.paymentDate === m.date
                                ? e.target.value
                                : m.paymentDate,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Invoice / reference number">
                      <input
                        id="spInvoiceInput"
                        autoFocus
                        required
                        maxLength={240}
                        value={modal.invoice}
                        onChange={(e) => change("invoice", e.target.value)}
                      />
                    </Field>
                    <CatalogPicker
                      label={sales ? "Customer" : "Supplier"}
                      items={data?.catalog}
                      catalogKind={sales ? "CUSTOMER" : "SUPPLIER"}
                      kind={kind}
                      value={modal.party}
                      id={modal.partyId}
                      onChange={(party, partyId) =>
                        setModal((m) => ({ ...m, party, partyId }))
                      }
                      onSaved={() => setRefresh((x) => x + 1)}
                    />
                    {sales && (
                      <CatalogPicker
                        label="Doctor / staff"
                        items={data?.catalog}
                        catalogKind="STAFF"
                        kind={kind}
                        value={modal.staff}
                        id={modal.staffId}
                        onChange={(staff, staffId) =>
                          setModal((m) => ({ ...m, staff, staffId }))
                        }
                        onSaved={() => setRefresh((x) => x + 1)}
                      />
                    )}
                    <CatalogPicker
                      label="Category"
                      items={data?.catalog}
                      catalogKind={sales ? "SALE_CATEGORY" : "BUY_CATEGORY"}
                      kind={kind}
                      value={modal.category}
                      id={modal.categoryId}
                      onChange={(category, categoryId) =>
                        setModal((m) => ({ ...m, category, categoryId }))
                      }
                      onSaved={() => setRefresh((x) => x + 1)}
                    />
                    <Field label="Amount before VAT (AED)">
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={modal.before}
                        onChange={(e) => change("before", e.target.value)}
                      />
                    </Field>
                    <Field label="VAT">
                      <select
                        value={modal.vatMode}
                        onChange={(e) => change("vatMode", e.target.value)}
                      >
                        <option value="STANDARD">5% · as in Excel</option>
                        <option value="NONE">No VAT</option>
                        <option value="CUSTOM">Enter invoice VAT amount</option>
                      </select>
                    </Field>
                    {modal.vatMode === "CUSTOM" && (
                      <Field label="VAT amount (AED)">
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={modal.vat}
                          onChange={(e) => change("vat", e.target.value)}
                        />
                      </Field>
                    )}
                    {modal.action === "create" && (
                      <>
                        <Field label="Payment status">
                          <select
                            value={modal.paymentMode}
                            onChange={(e) =>
                              change("paymentMode", e.target.value)
                            }
                          >
                            <option value="FULL">Paid in full</option>
                            <option value="PARTIAL">Part payment</option>
                            <option value="SPLIT">Split payment</option>
                            <option value="CREDIT">
                              Credit / not paid yet
                            </option>
                          </select>
                        </Field>
                        {!["CREDIT", "SPLIT"].includes(modal.paymentMode) && (
                          <>
                            <Field label="Payment method">
                              <select
                                value={modal.method}
                                onChange={(e) =>
                                  change("method", e.target.value)
                                }
                              >
                                {PAYMENT_METHODS.map((method) => (
                                  <option key={method}>{method}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Payment date">
                              <input
                                required
                                type="date"
                                min={modal.date}
                                value={modal.paymentDate}
                                onChange={(e) =>
                                  change("paymentDate", e.target.value)
                                }
                              />
                            </Field>
                            {modal.paymentMode === "PARTIAL" && (
                              <Field label="Amount paid now (AED)">
                                <input
                                  required
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  max={total || undefined}
                                  value={modal.paid}
                                  onChange={(e) =>
                                    change("paid", e.target.value)
                                  }
                                />
                              </Field>
                            )}
                          </>
                        )}
                        {modal.paymentMode === "SPLIT" && (
                          <div className="spWide">
                            <Field label="Payment date">
                              <input
                                required
                                type="date"
                                min={modal.date}
                                value={modal.paymentDate}
                                onChange={(e) =>
                                  change("paymentDate", e.target.value)
                                }
                              />
                            </Field>
                            <PaymentParts
                              values={modal.payments}
                              onChange={(v) => change("payments", v)}
                            />
                          </div>
                        )}
                      </>
                    )}
                    {modal.action === "edit" && (
                      <Field label="Reason for correction" wide>
                        <input
                          required
                          maxLength={1000}
                          value={modal.reason}
                          onChange={(e) => change("reason", e.target.value)}
                        />
                      </Field>
                    )}
                    <Field label="Remarks" wide>
                      <textarea
                        maxLength={2000}
                        rows={3}
                        value={modal.remarks}
                        onChange={(e) => change("remarks", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="spInvoiceTotal">
                    <span>VAT {money(vat)}</span>
                    <strong>Total {money(total)}</strong>
                  </div>
                  <p className="spNote">
                    {modal.action === "edit"
                      ? "Existing payments remain linked. Edit payments from invoice details when needed."
                      : modal.paymentMode === "SPLIT"
                        ? `Paid ${money(modal.payments.reduce((n, p) => n + Number(p.amount || 0), 0))} · Cash ${money(modal.payments.filter((p) => p.method === "Cash").reduce((n, p) => n + Number(p.amount || 0), 0))} · Remaining ${money(total - modal.payments.reduce((n, p) => n + Number(p.amount || 0), 0))}`
                        : modal.paymentMode === "CREDIT"
                          ? "No payment is recorded now. Record a payment when this invoice is settled."
                          : modal.method === "Cash"
                            ? `${sales ? "Cash In" : "Cash Out"} of ${money(modal.paymentMode === "FULL" ? total : modal.paid)} will be recorded automatically. Do not enter it again in Cash Control.`
                            : "This payment is recorded in the register only. It does not change the cash or bank ledger."}
                  </p>
                </>
              )}
              {["pay", "editPayment"].includes(modal.action) && (
                <>
                  <p>
                    {modal.action === "pay" ? "Outstanding" : "Maximum payment"}
                    : <b>{money(modal.balance)}</b>
                  </p>
                  <div className="spForm">
                    <Field label="Payment date">
                      <input
                        type="date"
                        required
                        value={modal.date}
                        onChange={(e) => change("date", e.target.value)}
                      />
                    </Field>
                    <Field label="Payment method">
                      <select
                        value={modal.method}
                        onChange={(e) => change("method", e.target.value)}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Amount (AED)">
                      <input
                        required
                        type="number"
                        min="0.01"
                        max={modal.balance}
                        step="0.01"
                        value={modal.amount}
                        onChange={(e) => change("amount", e.target.value)}
                      />
                    </Field>
                    <Field label="Payment reference">
                      <input
                        maxLength={240}
                        value={modal.reference}
                        onChange={(e) => change("reference", e.target.value)}
                      />
                    </Field>
                  </div>
                  <p className="spNote">
                    {modal.method === "Cash"
                      ? "This payment updates Cash Control automatically."
                      : "This payment does not change the cash or bank ledger."}
                  </p>
                </>
              )}
              {modal.action === "editPayment" && (
                <Field label="Reason for correction">
                  <input
                    required
                    maxLength={1000}
                    value={modal.reason}
                    onChange={(e) => change("reason", e.target.value)}
                  />
                </Field>
              )}
              {modal.action === "void" && (
                <>
                  <p>
                    This voids the invoice and all its linked payments,
                    including its cash entries. The history is retained. Use
                    this to correct an entry; do not use it to record an actual
                    refund.
                  </p>
                  <Field label="Reason">
                    <textarea
                      required
                      maxLength={1000}
                      rows={3}
                      value={modal.reason}
                      onChange={(e) => change("reason", e.target.value)}
                    />
                  </Field>
                </>
              )}
              <footer className="spFormActions">
                <button
                  type="button"
                  className="btn btnSoft"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                {modal.action === "create" && (
                  <button
                    type="submit"
                    value="next"
                    className="btn btnSoft"
                    disabled={busy}
                  >
                    Save & add next
                  </button>
                )}
                <button
                  type="submit"
                  value="save"
                  className="btn btnPrimary"
                  disabled={busy}
                >
                  {busy
                    ? "Saving…"
                    : modal.action === "void"
                      ? "Void invoice & payments"
                      : modal.action === "pay"
                        ? "Record payment"
                        : modal.action === "edit" ||
                            modal.action === "editPayment"
                          ? "Save correction"
                          : "Save entry"}
                </button>
              </footer>
              <p className="spNote">
                Ctrl + Enter: save · Ctrl + Shift + Enter: save & add next
              </p>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
