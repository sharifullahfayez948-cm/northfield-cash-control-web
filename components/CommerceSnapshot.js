"use client";
import { useEffect, useState } from "react";
const money = (n) =>
  `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function CommerceSnapshot({
  date,
  access,
  onNavigate,
  refreshKey,
}) {
  const [state, setState] = useState({}),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setState({});
    setError("");
    const sources = [
      ["sales", "SALE"],
      ["purchases", "BUYING"],
    ].filter(([key]) => access?.[key]);
    Promise.all(
      sources.map(async ([key, kind]) => {
        const response = await fetch(
          `/api/commerce?kind=${kind}&from=${date}&to=${date}`,
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load commerce summary.");
        return [key, data];
      }),
    )
      .then((entries) => {
        if (active) setState(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [date, access?.sales, access?.purchases, refreshKey]);
  if (!access?.sales && !access?.purchases) return null;
  const received = state.sales?.payments.reduce(
    (n, p) => n + Number(p.amount),
    0,
  );
  return (
    <section className="spWorkspace spDashboardCommerce">
      <div className="spManagementHero">
        <div>
          <small>NORTHFIELD · CLINIC OPERATIONS</small>
          <h2>Sales, purchases & customer accounts</h2>
          <p>
            {date} · Invoice activity and actual collections alongside Cash
            Control.
          </p>
        </div>
        <div className="spActions">
          {access.sales && (
            <button
              className="btn btnPrimary"
              onClick={() => onNavigate("Sales")}
            >
              Sales & reports
            </button>
          )}
          {access.purchases && (
            <button
              className="btn btnSoft"
              onClick={() => onNavigate("Purchases & Expenses")}
            >
              Purchases & expenses
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className="spAlert" role="alert">
          {error}
        </p>
      ) : (
        <div className="spKpis">
          {access.sales && (
            <>
              <div>
                <span>Sales · invoice date</span>
                <strong>
                  {state.sales ? money(state.sales.totals.total) : "…"}
                </strong>
              </div>
              <div>
                <span>Collections · payment date</span>
                <strong>{state.sales ? money(received) : "…"}</strong>
              </div>
              <div>
                <span>Outstanding on these sales</span>
                <strong>
                  {state.sales
                    ? money(
                        Number(state.sales.totals.total) -
                          Number(state.sales.totals.paid),
                      )
                    : "…"}
                </strong>
              </div>
            </>
          )}
          {access.purchases && (
            <div>
              <span>Purchases & expenses · invoice date</span>
              <strong>
                {state.purchases ? money(state.purchases.totals.total) : "…"}
              </strong>
            </div>
          )}
        </div>
      )}
      <div className="spSearchContext">
        <span>
          Cash payments are already included in Cash Control. Receipts for
          earlier invoices do not increase today's sales.
        </span>
        <div className="spActions">
          {access.sales && (
            <button onClick={() => onNavigate("Customer Accounts")}>
              Customer accounts & statements
            </button>
          )}
          {access.purchases && (
            <button onClick={() => onNavigate("Supplier Accounts")}>
              Supplier accounts
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
