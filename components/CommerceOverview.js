"use client";
const money = (n) =>
  `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function CommerceOverview({
  data,
  sales,
  onStaff,
  onCategory,
  onDay,
  onInvoice,
}) {
  const receipts = data.payments.reduce((n, p) => n + Number(p.amount), 0);
  const cash = data.payments
    .filter((p) => p.method === "Cash")
    .reduce((n, p) => n + Number(p.amount), 0);
  const top = data.doctors[0];
  const bars = (rows, key, handler) => (
    <div className="spRankings">
      {rows.slice(0, 8).map((r, i) => (
        <button key={r[key]} type="button" onClick={() => handler(r[key])}>
          <span>
            <b>{r[key] || "Unassigned"}</b>
            <strong>{money(r.total)}</strong>
          </span>
          <i
            style={{
              width: `${Math.max(1, (Number(r.total) / Math.max(...rows.map((x) => Number(x.total)), 1)) * 100)}%`,
            }}
          />
          <small>{r.entries} invoices · click to filter</small>
        </button>
      ))}
      {!rows.length && (
        <p className="spEmpty">Your first entry will appear here.</p>
      )}
    </div>
  );
  return (
    <div className="spOverview">
      <section className="spManagementHero">
        <div>
          <small>
            NORTHFIELD · {sales ? "SALES INTELLIGENCE" : "PURCHASING CONTROL"}
          </small>
          <h2>
            {sales
              ? "Every invoice. Every collection."
              : "Every purchase. Every payment."}
          </h2>
          <p>
            {sales
              ? "Sales follow the invoice date. Collections follow the payment date, including older invoices."
              : "Purchases follow the invoice date. Payments follow the date money was paid."}
          </p>
        </div>
        <div>
          <small>{sales ? "TOP DOCTOR / STAFF" : "TOP CATEGORY"}</small>
          <b>
            {sales
              ? top?.staff_name || "No activity yet"
              : data.categories[0]?.category || "No activity yet"}
          </b>
          <span>{money(sales ? top?.total : data.categories[0]?.total)}</span>
        </div>
      </section>
      <div className="spKpis spReceiptKpis">
        {[
          [sales ? "Received in period" : "Paid in period", receipts],
          [sales ? "Cash received" : "Cash paid", cash],
          ["Non-cash payments", receipts - cash],
          ["Collected on these invoices · all dates", data.totals.paid],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{money(value)}</strong>
          </div>
        ))}
      </div>
      <div className="spInsightGrid">
        <section className="spPanel">
          <div className="spPanelTitle">
            <h3>
              {sales ? "Doctor / staff performance" : "Spending by category"}
            </h3>
            <span>Invoice dates</span>
          </div>
          {sales
            ? bars(data.doctors, "staff_name", onStaff)
            : bars(data.categories, "category", onCategory)}
        </section>
        <section className="spPanel">
          <div className="spPanelTitle">
            <h3>Payment mix</h3>
            <span>Payment dates</span>
          </div>
          <div className="spMethodGrid">
            {data.payments.map((p) => (
              <div key={p.method}>
                <span>{p.method}</span>
                <b>{money(p.amount)}</b>
                <small>
                  {receipts
                    ? Math.round((Number(p.amount) / receipts) * 100)
                    : 0}
                  % of payments
                </small>
              </div>
            ))}
            {!data.payments.length && (
              <p className="spEmpty">No payments in this period.</p>
            )}
          </div>
        </section>
      </div>
      <section className="spPanel">
        <div className="spPanelTitle">
          <h3>Daily performance</h3>
          <span>Select a date to open its register</span>
        </div>
        <div className="spScroll">
          <table>
            <thead>
              <tr>
                {[
                  "Date",
                  "Invoices",
                  sales ? "Sales" : "Purchases / expenses",
                  "Collected to date",
                  "Outstanding",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.daily?.map((d) => (
                <tr key={d.date}>
                  <td>
                    <button
                      className="spTextButton"
                      onClick={() => onDay(d.date)}
                    >
                      {d.date}
                    </button>
                  </td>
                  <td>{d.entries}</td>
                  <td>
                    <b>{money(d.total)}</b>
                  </td>
                  <td>{money(d.paid)}</td>
                  <td>{money(d.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.daily?.length && (
            <p className="spEmpty">No posted invoices in this period.</p>
          )}
        </div>
      </section>
      <section className="spPanel">
        <div className="spPanelTitle">
          <h3>{sales ? "Collections" : "Payments"} journal</h3>
          <span>Sale date and payment date shown separately</span>
        </div>
        {data.receiptsTruncated && (
          <p className="spAlert">
            Showing the first 10,000 payments. Narrow the period for a complete
            export.
          </p>
        )}
        <div className="spScroll">
          <table>
            <thead>
              <tr>
                {[
                  "Payment date",
                  "Invoice date",
                  "Invoice / account",
                  "Method",
                  "Reference",
                  "Amount",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.receipts?.slice(0, 50).map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>
                    {p.invoice_date}
                    {p.invoice_date < p.date && <small>Earlier invoice</small>}
                  </td>
                  <td>
                    <button
                      className="spTextButton"
                      onClick={() => onInvoice({ id: p.document_id })}
                    >
                      {p.invoice_no}
                    </button>
                    <small>{p.party}</small>
                  </td>
                  <td>{p.method}</td>
                  <td>{p.reference_no || "—"}</td>
                  <td>
                    <b>{money(p.amount)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.receipts?.length && (
            <p className="spEmpty">No posted payments in this period.</p>
          )}
        </div>
        {data.receipts?.length > 50 && (
          <p className="spNote">
            Latest 50 shown. Export PDF or Excel for the full filtered payment
            journal.
          </p>
        )}
      </section>
    </div>
  );
}
