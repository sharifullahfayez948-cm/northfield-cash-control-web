"use client";
import CommerceOverlay from "./CommerceOverlay";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Wallet,
  Printer,
  FileText,
  PlusCircle,
  X,
  RefreshCw,
  Users,
  CheckCircle2,
} from "lucide-react";
import { PaymentParts, CatalogEditor } from "./CommerceFields";
import { businessToday } from "@/lib/commerce-model.mjs";
import { outputInvoice, accountReport } from "@/lib/commerce-pdf";
import { loadBrand } from "@/lib/luxuryPdf";
import * as XLSX from "xlsx";
const money = (v) =>
  `AED ${Number(v || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
async function api(url, body) {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}
export default function AccountCenter({
  kind = "SALE",
  user,
  outstandingOnly = false,
}) {
  const sales = kind === "SALE",
    canWrite = user.role !== "Viewer";
  const [filters, setFilters] = useState({
      search: "",
      age: "ALL",
      sort: "BALANCE",
      outstanding: outstandingOnly ? "1" : "0",
      page: 1,
    }),
    [list, setList] = useState(null),
    [selected, setSelected] = useState(null),
    [detail, setDetail] = useState(null),
    [view, setView] = useState("bills"),
    [activitySearch, setActivitySearch] = useState(""),
    [activityStatus, setActivityStatus] = useState("ALL"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [checked, setChecked] = useState([]),
    [payment, setPayment] = useState(null),
    [adding, setAdding] = useState(false),
    [accountEditor, setAccountEditor] = useState({}),
    [catalog, setCatalog] = useState([]),
    [expanded, setExpanded] = useState(null),
    [period, setPeriod] = useState({ from: "", to: "" });
  const seq = useRef(0),
    detailSeq = useRef(0),
    submitting = useRef(false);
  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const timer = setTimeout(
      () =>
        api(
          `/api/commerce?${new URLSearchParams({ kind, accounts: "1", ...filters })}`,
        )
          .then((d) => {
            if (n === seq.current) {
              setList(d);
              setError("");
            }
          })
          .catch((e) => {
            if (n === seq.current) setError(e.message);
          })
          .finally(() => {
            if (n === seq.current) setLoading(false);
          }),
      160,
    );
    return () => {
      clearTimeout(timer);
      seq.current++;
    };
  }, [kind, filters, refresh]);
  useEffect(() => {
    setActivitySearch("");
    setActivityStatus("ALL");
    if (!selected) {
      setDetail(null);
      return;
    }
    const n = ++detailSeq.current;
    setDetail(null);
    setChecked([]);
    setPayment(null);
    api(`/api/commerce?kind=${kind}&accountId=${selected}`)
      .then((d) => {
        if (n === detailSeq.current) {
          setDetail(d);
        }
      })
      .catch((e) => {
        if (n === detailSeq.current) setError(e.message);
      });
    return () => {
      detailSeq.current++;
    };
  }, [selected, kind, refresh]);
  function filter(k, v) {
    setFilters((f) => ({ ...f, [k]: v, page: 1 }));
  }
  const open = (detail?.documents || []).filter(
    (d) => d.status === "POSTED" && Number(d.balance) > 0,
  );
  const chosen = open.filter((d) => checked.includes(String(d.id))),
    chosenTotal = chosen.reduce((n, d) => n + Number(d.balance), 0);
  const ledger = (detail?.ledger || []).filter(
    (r) =>
      (!period.from || r.date >= period.from) &&
      (!period.to || r.date <= period.to),
  );
  const opening = period.from
    ? (detail?.ledger || []).filter((r) => r.date < period.from).at(-1)
        ?.balance || 0
    : 0;
  async function printInvoice(id, print = true) {
    try {
      await outputInvoice(id, kind, print);
    } catch (e) {
      setError(e.message);
    }
  }
  async function statement() {
    setBusy(true);
    try {
      accountReport(
        {
          ...detail,
          ledger,
          balance: ledger.at(-1)?.balance ?? opening,
          period,
          opening,
        },
        await loadBrand(),
        sales,
      ).save(`Northfield-Statement-${detail.account.id}.pdf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function excel() {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(
        ledger.map((r) => ({
          Date: r.date,
          Type: r.type,
          Invoice: r.reference,
          Debit: Number(r.debit),
          Credit: Number(r.credit),
          Balance: Number(r.balance),
        })),
      ),
      "Statement",
    );
    XLSX.writeFile(book, `Northfield-Account-${detail.account.id}.xlsx`);
  }
  function startPayment(ids) {
    const docs = open.filter((d) => ids.includes(String(d.id)));
    if (!docs.length) return;
    const amount = docs.reduce((n, d) => n + Number(d.balance), 0);
    setError("");
    setPayment({
      ids: docs.map((d) => String(d.id)),
      date: businessToday(),
      total: amount,
      payments: [{ method: "Cash", amount: amount.toFixed(2), reference: "" }],
      requestKey: crypto.randomUUID(),
    });
  }
  async function savePayment(e) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/api/commerce", {
        action: "settle",
        kind,
        accountId: selected,
        documentIds: payment.ids,
        date: payment.date,
        payments: payment.payments,
        requestKey: payment.requestKey,
      });
      setPayment(null);
      setMessage("Payment recorded. The account and cash ledger are updated.");
      setRefresh((x) => x + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function editAccount() {
    try {
      const d = await api(`/api/commerce?kind=${kind}&catalog=1`);
      setCatalog(d.catalog);
      setAccountEditor(
        d.catalog.find((r) => String(r.id) === String(selected)) ||
          detail.account,
      );
      setAdding(true);
    } catch (e) {
      setError(e.message);
    }
  }
  const activityMatches = (d) => {
    const q = activitySearch.trim().toLowerCase();
    const status =
      d.status === "VOID"
        ? "VOID"
        : Number(d.balance) === 0
          ? "PAID"
          : Number(d.paid) > 0
            ? "PARTIAL"
            : "UNPAID";
    const payments = detail?.payments
      .filter((p) => String(p.document_id) === String(d.id))
      .map((p) => `${p.method} ${p.reference_no || ""}`)
      .join(" ");
    return (
      (!q ||
        `${d.invoice_no} TX-${d.id} ${d.date} ${d.staff_name} ${d.category} ${d.remarks} ${d.total} ${payments}`
          .toLowerCase()
          .includes(q)) &&
      (view === "bills" ||
        activityStatus === "ALL" ||
        status === activityStatus)
    );
  };
  const visibleBills = open.filter(activityMatches);
  const total = list?.totals || {};
  return (
    <div className="spWorkspace spAccounts">
      <div className="spHeading">
        <div>
          <small>NORTHFIELD · ACCOUNTS & COLLECTIONS</small>
          <h1>
            {outstandingOnly
              ? sales
                ? "Receive outstanding payments"
                : "Outstanding supplier bills"
              : sales
                ? "Customer accounts"
                : "Supplier accounts"}
          </h1>
          <p>
            Find an account, review its statement and settle one or more
            invoices.
          </p>
        </div>
        <div className="spActions">
          <button
            className="btn btnSoft"
            onClick={() => setRefresh((x) => x + 1)}
            aria-label="Refresh accounts"
          >
            <RefreshCw size={17} />
          </button>
          {canWrite && (
            <button
              className="btn btnPrimary"
              onClick={() => {
                setCatalog([]);
                setAccountEditor({});
                setAdding(true);
                  api(`/api/commerce?kind=${kind}&catalog=1`)
                    .then((d) => setCatalog(d.catalog))
                    .catch((e) => setError(e.message));
              }}
            >
              <PlusCircle size={17} />
              New {sales ? "customer" : "supplier"}
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
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
      <div className="spKpis">
        <div className="spDebtCard">
          <span>Total outstanding</span>
          <strong>{money(total.balance)}</strong>
          <small>
            {total.open_invoices || 0} open invoices · {list?.count || 0}{" "}
            accounts
          </small>
        </div>
        <div>
          <span>Up to 30 days</span>
          <strong>{money(total.age30)}</strong>
        </div>
        <div>
          <span>31–60 days</span>
          <strong>{money(total.age60)}</strong>
        </div>
        <div>
          <span>Over 60 days</span>
          <strong>{money(total.age_over60)}</strong>
        </div>
      </div>
      <div className="spAccountGrid">
        <aside className="spAccountList">
          <label className="spAccountSearch">
            <Search size={18} />
            <input
              aria-label="Search accounts"
              placeholder="Name, phone, invoice or transaction ID"
              value={filters.search}
              onChange={(e) => filter("search", e.target.value)}
            />
          </label>
          <div className="spAccountFilters">
            <button
              className={filters.outstanding === "0" ? "active" : ""}
              onClick={() => filter("outstanding", "0")}
            >
              {sales ? "All customers" : "All suppliers"}
            </button>
            <button
              className={filters.outstanding === "1" ? "active" : ""}
              onClick={() => filter("outstanding", "1")}
            >
              Outstanding
            </button>
            <select
              aria-label="Age filter"
              value={filters.age}
              onChange={(e) => filter("age", e.target.value)}
            >
              <option value="ALL">All ages</option>
              <option value="OVER30">Over 30 days</option>
              <option value="NO_PHONE">No phone</option>
            </select>
            <select
              aria-label="Sort accounts"
              value={filters.sort}
              onChange={(e) => filter("sort", e.target.value)}
            >
              <option value="BALANCE">Highest balance</option>
              <option value="NAME">Name A–Z</option>
              <option value="OLDEST">Oldest outstanding</option>
            </select>
          </div>
          <div className="spAccountRows" aria-busy={loading}>
            {list?.accounts.map((a) => (
              <button
                key={a.id}
                className={`spAccountRow ${String(selected) === String(a.id) ? "selected" : ""}`}
                onClick={() => {
                  setSelected(a.id);
                  setView("bills");
                  setAdding(false);
                }}
              >
                <span className="spAvatar">
                  {a.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span>
                  <b>{a.name}</b>
                  <small>
                    {a.open_invoices} bills · oldest {a.oldest_days} days
                  </small>
                  <small>{a.phone || "No phone"}</small>
                </span>
                <strong>{money(a.balance)}</strong>
              </button>
            ))}
            {!loading && !list?.accounts.length && (
              <p className="spEmpty">No matching accounts.</p>
            )}
          </div>
          <div className="spPagination">
            <button
              className="btn btnSoft"
              disabled={filters.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            >
              Previous
            </button>
            <span>
              {filters.page} / {Math.max(1, Math.ceil((list?.count || 0) / 50))}
            </span>
            <button
              className="btn btnSoft"
              disabled={filters.page * 50 >= (list?.count || 0)}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            >
              Next
            </button>
          </div>
        </aside>
        <section className="spAccountDetail">
          {adding && (
            <CatalogEditor
              label={sales ? "Customer" : "Supplier"}
              initial={accountEditor}
              items={catalog}
              catalogKind={sales ? "CUSTOMER" : "SUPPLIER"}
              kind={kind}
              onClose={() => setAdding(false)}
              onSaved={(row) => {
                setAdding(false);
                setSelected(row.id);
                setFilters((f) => ({
                  ...f,
                  search: "",
                  outstanding: "0",
                  age: "ALL",
                  page: 1,
                }));
                setView("bills");
                setRefresh((x) => x + 1);
              }}
            />
          )}
          {!detail ? (
            <div className="spChooseAccount">
              <Wallet size={44} />
              <h3>
                {selected
                  ? "Loading account…"
                  : `Choose a ${sales ? "customer" : "supplier"}`}
              </h3>
              <p>Open invoices, full history and statements appear here.</p>
            </div>
          ) : (
            <>
              <div className="spAccountIdentity">
                <span className="spAvatar large">
                  {detail.account.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h2>{detail.account.name}</h2>
                  <small>
                    {sales ? "CUS" : "SUP"}-
                    {String(detail.account.id).padStart(6, "0")} ·{" "}
                    {detail.account.phone || "No phone recorded"}
                  </small>
                </div>
              </div>
              <div className="spActions">
                {canWrite && (
                  <button className="btn btnSoft" onClick={editAccount}>
                    Edit account / add phone
                  </button>
                )}
                <button
                  className="btn btnSoft"
                  disabled={busy}
                  onClick={statement}
                >
                  <FileText size={16} /> Statement PDF
                </button>
                <button className="btn btnSoft" onClick={excel}>
                  Excel
                </button>
              </div>
              <div className="spAccountTotals">
                <div>
                  <small>{sales ? "Customer owes" : "Clinic owes"}</small>
                  <strong>{money(detail.balance)}</strong>
                </div>
                <div>
                  <small>Invoiced · all history</small>
                  <strong>
                    {money(
                      detail.documents
                        .filter((d) => d.status === "POSTED")
                        .reduce((n, d) => n + Number(d.total), 0),
                    )}
                  </strong>
                </div>
                <div>
                  <small>Paid · all history</small>
                  <strong>
                    {money(
                      detail.payments
                        .filter((p) => p.status === "POSTED")
                        .reduce((n, p) => n + Number(p.amount), 0),
                    )}
                  </strong>
                </div>
              </div>
              <div
                className="spTabs"
                role="tablist"
                aria-label="Account activity"
              >
                {[
                  ["bills", `Open bills · ${open.length}`],
                  ["history", "All invoices"],
                  ["statement", "Account statement"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={view === key}
                    onClick={() => setView(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {view !== "statement" && (
                <div className="spAccountActivitySearch">
                  <label className="spField">
                    <span>Search this account</span>
                    <input
                      placeholder="Invoice, date, doctor, category, payment or reference…"
                      value={activitySearch}
                      onChange={(e) => {
                        setActivitySearch(e.target.value);
                        setChecked([]);
                      }}
                    />
                  </label>
                  {view === "history" && (
                    <label className="spField">
                      <span>Invoice status</span>
                      <select
                        value={activityStatus}
                        onChange={(e) => setActivityStatus(e.target.value)}
                      >
                        <option value="ALL">All statuses</option>
                        <option value="PAID">Paid</option>
                        <option value="PARTIAL">Partly paid</option>
                        <option value="UNPAID">Unpaid</option>
                        <option value="VOID">Voided</option>
                      </select>
                    </label>
                  )}
                </div>
              )}
              {view === "bills" && (
                <div className="spAccountPayBar">
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        visibleBills.length > 0 &&
                        visibleBills.every((d) =>
                          checked.includes(String(d.id)),
                        )
                      }
                      onChange={(e) =>
                        setChecked(
                          e.target.checked
                            ? visibleBills.map((d) => String(d.id))
                            : [],
                        )
                      }
                    />{" "}
                    Select visible
                  </label>
                  {canWrite && (
                    <>
                      <button
                        className="btn btnSoft"
                        disabled={!checked.length || checked.length > 200}
                        onClick={() => startPayment(checked)}
                      >
                        Pay selected · {money(chosenTotal)}
                      </button>
                      <button
                        className="btn btnPrimary"
                        disabled={!open.length || open.length > 200}
                        onClick={() =>
                          startPayment(open.map((d) => String(d.id)))
                        }
                      >
                        Pay entire account · {money(detail.balance)}
                      </button>
                    </>
                  )}
                </div>
              )}
              {view !== "statement" &&
                (view === "bills"
                  ? visibleBills
                  : [...detail.documents].reverse().filter(activityMatches)
                ).map((d) => (
                  <article className="spBill" key={d.id}>
                    <div className="spBillMain">
                      {view === "bills" && (
                        <input
                          aria-label={`Select invoice ${d.invoice_no}`}
                          type="checkbox"
                          checked={checked.includes(String(d.id))}
                          onChange={(e) =>
                            setChecked((ids) =>
                              e.target.checked
                                ? [...ids, String(d.id)]
                                : ids.filter((id) => id !== String(d.id)),
                            )
                          }
                        />
                      )}
                      <button
                        className="spBillText"
                        onClick={() =>
                          setExpanded(expanded === d.id ? null : d.id)
                        }
                      >
                        <b>
                          {d.invoice_no} · {d.category}
                        </b>
                        <small>
                          {d.date} · {d.staff_name || d.kind}
                        </small>
                      </button>
                      <div>
                        <strong>
                          {money(d.status === "VOID" ? 0 : d.balance)}
                        </strong>
                        <span
                          className={`spBadge ${Number(d.balance) === 0 ? "paid" : ""}`}
                        >
                          {d.status === "VOID"
                            ? "Void"
                            : Number(d.balance) === 0
                              ? "Paid"
                              : Number(d.paid) > 0
                                ? "Part paid"
                                : "Unpaid"}
                        </span>
                      </div>
                      {canWrite &&
                        d.status === "POSTED" &&
                        Number(d.balance) > 0 && (
                          <button
                            className="btn btnPrimary"
                            onClick={() => startPayment([String(d.id)])}
                          >
                            Pay
                          </button>
                        )}
                      <button
                        className="btn btnSoft"
                        aria-label={`Print invoice ${d.invoice_no}`}
                        onClick={() => printInvoice(d.id)}
                      >
                        <Printer size={17} />
                      </button>
                    </div>
                    {expanded === d.id && (
                      <div className="spBillExpanded">
                        <p>
                          Before VAT {money(d.before_vat)} · VAT {money(d.vat)}{" "}
                          · Total {money(d.total)} · Paid {money(d.paid)}
                        </p>
                        <p>{d.remarks || "No remarks."}</p>
                        <button
                          className="btn btnSoft"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent("northfield:open-invoice", {
                                detail: { id: d.id, kind: d.kind },
                              }),
                            );
                          }}
                        >
                          Open invoice & payments
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              {view === "bills" && !open.length && (
                <p className="spEmpty">
                  This account has no outstanding invoices.
                </p>
              )}
              {view === "statement" && (
                <>
                  <div className="spFilters">
                    <label className="spField">
                      <span>From (optional)</span>
                      <input
                        type="date"
                        value={period.from}
                        onChange={(e) =>
                          setPeriod({ ...period, from: e.target.value })
                        }
                      />
                    </label>
                    <label className="spField">
                      <span>To (optional)</span>
                      <input
                        type="date"
                        value={period.to}
                        onChange={(e) =>
                          setPeriod({ ...period, to: e.target.value })
                        }
                      />
                    </label>
                    <button
                      className="btn btnSoft"
                      onClick={() => setPeriod({ from: "", to: "" })}
                    >
                      All history
                    </button>
                  </div>
                  <p className="spNote">
                    Opening balance: {money(opening)} · Closing balance:{" "}
                    {money(ledger.at(-1)?.balance ?? opening)}
                  </p>
                  <div className="spScroll">
                    <table>
                      <thead>
                        <tr>
                          {[
                            "Date",
                            "Type / Method",
                            "Invoice",
                            "Debit",
                            "Credit",
                            "Balance",
                          ].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((l, i) => (
                          <tr key={i}>
                            <td>{l.date}</td>
                            <td>{l.type}</td>
                            <td>{l.reference}</td>
                            <td>{money(l.debit)}</td>
                            <td>{money(l.credit)}</td>
                            <td>
                              <b>{money(l.balance)}</b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
      {payment && (
        <CommerceOverlay payment busy={busy} onClose={() => setPayment(null)}>
          <section
            className="spModal"
            role="dialog"
            aria-modal="true"
            aria-label="Record account payment"
          >
            <header>
              <div>
                <small>ACCOUNT SETTLEMENT</small>
                <h2>{sales ? "Receive payment" : "Record supplier payment"}</h2>
                <p>
                  {detail?.account.name} · {payment.ids.length} invoice(s)
                </p>
              </div>
              <button
                className="btn btnSoft"
                disabled={busy}
                onClick={() => setPayment(null)}
                aria-label="Close payment"
              >
                <X />
              </button>
            </header>
            {error && (
              <div className="spAlert" role="alert">
                {error}
              </div>
            )}
            <form onSubmit={savePayment}>
              <div className="spInvoiceTotal">
                <span>Selected outstanding</span>
                <strong>{money(payment.total)}</strong>
              </div>
              <label className="spField">
                <span>Actual payment date</span>
                <input
                  required
                  type="date"
                  value={payment.date}
                  onChange={(e) =>
                    setPayment({ ...payment, date: e.target.value })
                  }
                />
              </label>
              <PaymentParts
                values={payment.payments}
                onChange={(payments) => setPayment({ ...payment, payments })}
              />
              <p className="spNote">
                Paying{" "}
                {money(
                  payment.payments.reduce(
                    (n, p) => n + Number(p.amount || 0),
                    0,
                  ),
                )}
                . Payments are allocated to the oldest selected invoices first.
                Original invoice dates stay unchanged. Only cash updates Cash
                Control.
              </p>
              <div className="spFormActions">
                <button
                  type="button"
                  className="btn btnSoft"
                  disabled={busy}
                  onClick={() => setPayment(null)}
                >
                  Cancel
                </button>
                <button className="btn btnPrimary" disabled={busy}>
                  {busy ? "Saving…" : "Save payment"}
                </button>
              </div>
            </form>
          </section>
        </CommerceOverlay>
      )}
    </div>
  );
}
