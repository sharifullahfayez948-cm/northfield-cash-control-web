"use client";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  ArrowLeftRight,
  CheckCircle2,
  Landmark,
  Globe2,
  FileText,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Bell,
  ShieldCheck,
  Wifi,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Info,
  Sparkles,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  Pencil,
  Undo2,
  Ban,
  Save,
  LockOpen,
  RotateCcw,
  Clock3,
  QrCode,
  ScanLine,
  Coffee,
  UserCheck,
  CalendarCheck,
  Timer,
  Target,
  Plane,
  Trash2,
  UserX,
} from "lucide-react";
import FayezSignature from "@/components/FayezSignature";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CompanyBrand from "@/components/CompanyBrand";

const money = (v) =>
  `AED ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
async function imageData(url, opacity = 1) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}
const actionMessage = (url) =>
  url.includes("/transactions")
    ? "Transaction posted and dashboard updated."
    : url.includes("/close")
      ? "Daily closing saved successfully."
      : url.includes("/bank")
        ? "Bank entry posted successfully."
        : url.includes("/iran-dubai")
          ? "Transfer saved successfully."
          : url.includes("/directory")
            ? "Directory updated successfully."
            : url.includes("/settings")
              ? "Company settings saved successfully."
              : "Changes saved successfully.";
function pushToast(message, type = "success") {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("northfield:toast", { detail: { message, type } }),
    );
}
async function api(url, opt) {
  const r = await fetch(url, { cache: "no-store", ...opt });
  if (r.status === 401) {
    location.href = "/login";
    throw new Error("Login required");
  }
  const d = await r.json();
  if (!r.ok) {
    const message = d.error || "Request failed";
    pushToast(message, "error");
    throw new Error(message);
  }
  if (opt?.method && opt.method !== "GET") pushToast(actionMessage(url));
  return d;
}
function Loading() {
  return (
    <div className="loading loadingBranded">
      <span className="spinner" />
      <span>Loading…</span>
      <FayezSignature compact />
    </div>
  );
}
function NotificationHub() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, ...e.detail }].slice(-4));
      setTimeout(() => setItems((x) => x.filter((n) => n.id !== id)), 4200);
    };
    window.addEventListener("northfield:toast", handler);
    return () => window.removeEventListener("northfield:toast", handler);
  }, []);
  return (
    <div className="toastStack" aria-live="polite">
      {items.map((n) => (
        <div className={`toast ${n.type || "success"}`} key={n.id}>
          {n.type === "error" ? (
            <AlertTriangle size={18} />
          ) : n.type === "info" ? (
            <Info size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <div>
            <b>
              {n.type === "error" ? "Action required" : "Northfield updated"}
            </b>
            <span>{n.message}</span>
          </div>
          <button
            onClick={() => setItems((x) => x.filter((i) => i.id !== n.id))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
function displayCell(key, value) {
  if (key === "business_date" || key === "date") {
    const raw = String(value ?? "").slice(0, 10);
    const parsed = new Date(`${raw}T00:00:00`);
    return (
      <span className="dateCell">
        <CalendarDays size={12} />
        {Number.isNaN(parsed.getTime())
          ? raw
          : parsed.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
      </span>
    );
  }
  if (key === "entry_time" || key === "time")
    return <span className="timeCell">{String(value ?? "").slice(0, 8)}</span>;
  if (key === "direction" || key === "type")
    return (
      <span className={`directionBadge ${String(value).toLowerCase()}`}>
        {value}
      </span>
    );
  if (key === "status")
    return (
      <span className={`statusBadge ${String(value).toLowerCase()}`}>
        <i />
        {value}
      </span>
    );
  if (
    key.includes("amount") ||
    ["cash_in", "cash_out", "balance", "opening_cash"].includes(key)
  )
    return (
      <b className="amountCell">
        {Number(value || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </b>
    );
  return String(value ?? "");
}
function pdfDate(value) {
  const raw = String(value ?? "").slice(0, 10),
    m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${m[1]}-${months[Number(m[2]) - 1]}-${m[3]}`;
}
function pdfTime(value) {
  const m = String(value ?? "").match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return String(value ?? "");
  const hour24 = Number(m[1]),
    hour12 = hour24 % 12 || 12,
    period = hour24 >= 12 ? "PM" : "AM";
  return `${hour12}:${m[2]}:${m[3] || "00"} ${period}`;
}
function pdfCell(key, value) {
  if (key === "business_date" || key === "date") return pdfDate(value);
  if (key === "entry_time" || key === "time") return pdfTime(value);
  return value ?? "";
}
function Table({ rows = [], actions }) {
  if (!rows.length)
    return (
      <div className="notice emptyState">
        <FileText size={18} />
        <span>No records yet.</span>
      </div>
    );
  const hidden = new Set(["category_id", "transfer_group"]),
    keys = Object.keys(rows[0]).filter((k) => !hidden.has(k));
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k.replaceAll("_", " ")}</th>
            ))}
            {actions && <th>ACTIONS</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              className={r.status === "VOID" ? "voidRow" : ""}
              key={r.id || i}
            >
              {keys.map((k) => (
                <td key={k} data-label={k.replaceAll("_", " ")}>
                  {displayCell(k, r[k])}
                </td>
              ))}
              {actions && (
                <td data-label="actions" className="actionCell">
                  {actions(r)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CashEntryActions({ row, categories, onChanged }) {
  const [mode, setMode] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const [form, setForm] = useState({});
  function edit() {
    setForm({
      date: String(row.business_date || "").slice(0, 10),
      time: String(row.entry_time || "").slice(0, 8),
      direction: row.direction,
      categoryId: String(row.category_id || ""),
      amount: String(row.amount || ""),
      counterparty: row.counterparty || "",
      reference: row.reference_no || "",
      description: row.description || "",
    });
    setMode("edit");
  }
  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/transactions/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          categoryId: Number(form.categoryId),
          amount: Number(form.amount),
        }),
      });
      setMode("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }
  async function statusAction() {
    setBusy(true);
    try {
      if (mode === "restore")
        await api(`/api/transactions/${row.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "restore" }),
        });
      else
        await api(
          `/api/transactions/${row.id}?reason=${encodeURIComponent(reason || "Voided by administrator")}`,
          { method: "DELETE" },
        );
      setMode("");
      setReason("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }
  const cashCats = categories.filter(
    (c) =>
      [form.direction, "BOTH"].includes(c.direction) &&
      ["CASH", "BOTH"].includes(c.account_scope),
  );
  return (
    <>
      <div className="luxActions">
        {row.status !== "VOID" && (
          <button
            className="luxAction edit"
            onClick={edit}
            title="Edit transaction"
          >
            <Pencil size={13} />
            <span>Edit</span>
          </button>
        )}
        {row.status === "VOID" ? (
          <button
            className="luxAction restore"
            onClick={() => setMode("restore")}
          >
            <Undo2 size={13} />
            <span>Restore</span>
          </button>
        ) : (
          <button className="luxAction void" onClick={() => setMode("void")}>
            <Ban size={13} />
            <span>Void</span>
          </button>
        )}
      </div>
      {mode && (
        <div
          className="modalShade"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setMode("");
          }}
        >
          <div className="luxModal">
            {mode === "edit" ? (
              <form onSubmit={saveEdit}>
                <div className="modalHead">
                  <div>
                    <small>TRANSACTION #{row.id}</small>
                    <h3>Edit Transaction</h3>
                  </div>
                  <button type="button" onClick={() => setMode("")}>
                    <X size={18} />
                  </button>
                </div>
                {row.transfer_group && (
                  <div className="notice error">
                    This is a linked bank transfer. Void it and post it again to
                    keep both ledgers balanced.
                  </div>
                )}
                <div className="formGrid">
                  <div className="field">
                    <label>Business Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Entry Time</label>
                    <input
                      type="time"
                      step="1"
                      value={form.time}
                      onChange={(e) =>
                        setForm({ ...form, time: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Direction</label>
                    <select
                      value={form.direction}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          direction: e.target.value,
                          categoryId: "",
                        })
                      }
                    >
                      <option>IN</option>
                      <option>OUT</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Category</label>
                    <select
                      required
                      value={form.categoryId}
                      onChange={(e) =>
                        setForm({ ...form, categoryId: e.target.value })
                      }
                    >
                      <option value="">Select category</option>
                      {cashCats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Amount AED</label>
                    <input
                      required
                      min="0.01"
                      type="number"
                      step=".01"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Counterparty</label>
                    <input
                      value={form.counterparty}
                      onChange={(e) =>
                        setForm({ ...form, counterparty: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Reference</label>
                    <input
                      value={form.reference}
                      onChange={(e) =>
                        setForm({ ...form, reference: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Description</label>
                    <input
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="modalActions">
                  <button
                    type="button"
                    className="btn btnSoft"
                    onClick={() => setMode("")}
                  >
                    CANCEL
                  </button>
                  <button
                    disabled={busy || row.transfer_group}
                    className="btn btnPrimary"
                  >
                    <Save size={14} />
                    {busy ? "SAVING…" : "SAVE CHANGES"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="modalHead">
                  <div>
                    <small>TRANSACTION #{row.id}</small>
                    <h3>
                      {mode === "restore"
                        ? "Restore Transaction"
                        : "Void Transaction"}
                    </h3>
                  </div>
                  <button onClick={() => setMode("")}>
                    <X size={18} />
                  </button>
                </div>
                <div className={`confirmOrb ${mode}`}>
                  {mode === "restore" ? <Undo2 /> : <Ban />}
                </div>
                <p className="confirmText">
                  {mode === "restore"
                    ? "This transaction will return to all balances and reports."
                    : "This transaction will be removed from balances but safely retained in the audit history."}
                </p>
                {mode === "void" && (
                  <div className="field">
                    <label>Reason for void</label>
                    <textarea
                      rows="3"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Example: Duplicate or incorrect entry"
                    />
                  </div>
                )}
                <div className="modalActions">
                  <button className="btn btnSoft" onClick={() => setMode("")}>
                    CANCEL
                  </button>
                  <button
                    disabled={busy}
                    className={`btn ${mode === "restore" ? "btnPrimary" : "btnDanger"}`}
                    onClick={statusAction}
                  >
                    {busy
                      ? "PROCESSING…"
                      : mode === "restore"
                        ? "RESTORE TRANSACTION"
                        : "CONFIRM VOID"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CashJournal({ data, onChanged }) {
  return (
    <Table
      rows={data.entries}
      actions={(row) => (
        <CashEntryActions
          row={row}
          categories={data.categories || []}
          onChanged={onChanged}
        />
      )}
    />
  );
}
function Hero({ user, settings = {} }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const greeting = (
      settings.hero_greeting || "Good to see you, {name}"
    ).replaceAll("{name}", user?.name || "Northfield"),
    subtitle =
      settings.hero_subtitle ||
      "One elegant command center for cash, banking and daily operations.",
    badges = [
      settings.hero_badge_one || "Live sync",
      settings.hero_badge_two || "Secure workspace",
      settings.hero_badge_three || "Executive view",
    ],
    icons = [Wifi, ShieldCheck, Sparkles];
  return (
    <div className="hero heroCompact">
      <div className="heroAura one" />
      <div className="heroAura two" />
      <div className="heroLeft">
        <CompanyBrand className="heroBrand" />
        <div className="heroKicker">
          {settings.company_name || "NORTHFIELD VETERINARY CLINIC L.L.C"}
        </div>
        <h1 className="heroMessage">{greeting}</h1>
        <p className="heroMessage heroMessageDelay">{subtitle}</p>
        <div className="liveStrip heroMessage heroBadgeDelay">
          {badges.map((label, i) => {
            const Icon = icons[i];
            return (
              <span key={`${label}-${i}`}>
                <Icon size={12} />
                {label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="clockBox">
        <div className="heroKicker">LOCAL TIME · DUBAI</div>
        <div className="clock">
          {now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
          <small> {String(now.getSeconds()).padStart(2, "0")}</small>
        </div>
        <div className="dateTxt">
          {now.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
        <div className="onlinePill">
          <i /> SYSTEM ONLINE
        </div>
      </div>
    </div>
  );
}
function PageHead({ title, sub, date, setDate, actions }) {
  return (
    <div className="pageHead">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {date && (
          <input
            className="dateInput"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        )}{" "}
        {actions}
      </div>
    </div>
  );
}

function smoothPath(values, w = 760, h = 230, p = 28) {
  if (!values.length) return "";
  const max = Math.max(...values, 1),
    step = values.length > 1 ? (w - p * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [
    p + i * step,
    h - p - (Number(v) / max) * (h - p * 2),
  ]);
  if (pts.length === 1)
    return `M ${pts[0][0]} ${pts[0][1]} L ${w - p} ${pts[0][1]}`;
  return pts.slice(1).reduce((d, pt, i) => {
    const prev = pts[i],
      cx = (prev[0] + pt[0]) / 2;
    return `${d} C ${cx} ${prev[1]}, ${cx} ${pt[1]}, ${pt[0]} ${pt[1]}`;
  }, `M ${pts[0][0]} ${pts[0][1]}`);
}
function CashFlowChart({ days = [] }) {
  const incoming = days.map((x) => Number(x.cash_in || 0)),
    outgoing = days.map((x) => Number(x.cash_out || 0)),
    max = Math.max(...incoming, ...outgoing, 1),
    left = 32,
    right = 744,
    bottom = 202,
    top = 35,
    step = days.length > 1 ? (right - left) / (days.length - 1) : 0;
  const pts = (values) =>
    values.map((v, i) => ({
      x: left + i * step,
      y: bottom - (v / max) * (bottom - top),
      v,
    }));
  const inPts = pts(incoming),
    outPts = pts(outgoing);
  const path = (points) =>
    points.length < 2
      ? points[0]
        ? `M ${points[0].x} ${points[0].y} L ${right} ${points[0].y}`
        : ""
      : points.slice(1).reduce((d, p, i) => {
          const prev = points[i],
            cx = (prev.x + p.x) / 2;
          return `${d} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
        }, `M ${points[0].x} ${points[0].y}`);
  const showLabel = (i) =>
      days.length <= 12 || i === 0 || i === days.length - 1 || i % 3 === 0,
    totalIn = incoming.reduce((a, b) => a + b, 0),
    totalOut = outgoing.reduce((a, b) => a + b, 0);
  return (
    <div className="flowChart dailyFlow chartEntering">
      <div className="dailyChartTop">
        <div className="chartLegend">
          <span>
            <i className="in" />
            Cash in
          </span>
          <span>
            <i className="out" />
            Cash out
          </span>
        </div>
        <div className="chartTotals">
          <span>
            IN <b>{money(totalIn)}</b>
          </span>
          <span>
            OUT <b>{money(totalOut)}</b>
          </span>
        </div>
      </div>
      <svg
        viewBox="0 0 780 230"
        role="img"
        aria-label="Daily cash flow for selected month"
      >
        <defs>
          <linearGradient id="cashAreaDaily" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2fc6aa" stopOpacity=".32" />
            <stop offset="1" stopColor="#2fc6aa" stopOpacity="0" />
          </linearGradient>
          <filter id="dailyGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[top, 77, 119, 161, bottom].map((y, i) => (
          <line
            key={y}
            x1={left}
            x2={right}
            y1={y}
            y2={y}
            className="gridLine chartGrid"
            style={{ animationDelay: `${i * 55}ms` }}
          />
        ))}
        <path
          className="chartAreaReveal"
          d={`${path(inPts)} L ${right} ${bottom} L ${left} ${bottom} Z`}
          fill="url(#cashAreaDaily)"
        />
        <path
          pathLength="1"
          d={path(inPts)}
          className="cashLine in chartLineDraw"
          filter="url(#dailyGlow)"
        />
        <path
          pathLength="1"
          d={path(outPts)}
          className="cashLine out chartLineDraw chartLineDelay"
        />
        {inPts.map((p, i) => (
          <circle
            key={`i${i}`}
            cx={p.x}
            cy={p.y}
            r={i === days.length - 1 ? 5 : 3.3}
            className="chartDot in chartDotReveal"
            style={{ animationDelay: `${620 + i * 45}ms` }}
          >
            <title>
              {days[i].weekday}, {days[i].business_day} · Cash In: {money(p.v)}
            </title>
          </circle>
        ))}
        {outPts.map((p, i) => (
          <circle
            key={`o${i}`}
            cx={p.x}
            cy={p.y}
            r={i === days.length - 1 ? 4.5 : 3}
            className="chartDot out chartDotReveal"
            style={{ animationDelay: `${760 + i * 45}ms` }}
          >
            <title>
              {days[i].weekday}, {days[i].business_day} · Cash Out: {money(p.v)}
            </title>
          </circle>
        ))}
        {days.map(
          (d, i) =>
            showLabel(i) && (
              <text
                key={d.business_day}
                x={left + i * step}
                y="224"
                textAnchor="middle"
              >
                {d.label}
              </text>
            ),
        )}
      </svg>
    </div>
  );
}
function Dashboard({ user }) {
  const [date, setDate] = useState(today()),
    [d, setD] = useState(),
    [err, setErr] = useState("");
  async function load() {
    setErr("");
    try {
      setD(await api(`/api/dashboard?date=${date}`));
      pushToast("Dashboard refreshed with the latest company data.", "info");
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [date]);
  if (!d)
    return <>{err ? <div className="notice error">{err}</div> : <Loading />}</>;
  const s = d.snap;
  const total = Number(s.cashIn) + Number(s.cashOut),
    inShare = total ? (Number(s.cashIn) / total) * 100 : 50;
  const monthName = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const kpis = [
    ["OPENING CASH", s.opening, "Start-of-day physical cash", "neutral"],
    ["TOTAL CASH IN", s.cashIn, "Posted receipts today", "positive"],
    ["TOTAL CASH OUT", s.cashOut, "Posted payments today", "negative"],
    ["RUNNING CASH", s.expected, "Expected cash on hand", "balance"],
  ];
  return (
    <>
      <Hero user={user} settings={d.settings} />
      <PageHead
        title="Executive Dashboard"
        sub="A live, connected view of Northfield’s financial operations."
        date={date}
        setDate={setDate}
        actions={
          <button
            className="btn btnSoft iconBtn"
            onClick={load}
            title="Refresh dashboard"
          >
            <RefreshCw size={15} />
          </button>
        }
      />
      <div className="kpis">
        {kpis.map((x, i) => (
          <div className={`card kpi ${x[3]}`} key={x[0]}>
            <div className="kpiTop">
              <div className="kpiIcon">
                {i === 1 ? (
                  <ArrowUpRight />
                ) : i === 2 ? (
                  <ArrowDownRight />
                ) : (
                  <Landmark />
                )}
              </div>
              <div className="miniTrend">LIVE</div>
            </div>
            <div className="label">{x[0]}</div>
            <div className="value">{money(x[1])}</div>
            <div className="note">{x[2]}</div>
          </div>
        ))}
      </div>
      <div className="grid2 dashboardCharts">
        <div className="card chartCard">
          <div className="cardHeader">
            <div>
              <div className="sectionTitle">Daily Cash Flow</div>
              <div className="sectionSub">
                Day-by-day performance for {monthName} · through selected date
              </div>
            </div>
            <span className="softBadge">MONTH TO DATE</span>
          </div>
          <CashFlowChart days={d.days} />
        </div>
        <div className="card movementCard">
          <div className="cardHeader">
            <div>
              <div className="sectionTitle">Today’s Movement</div>
              <div className="sectionSub">Receipts and payments</div>
            </div>
            <Bell size={18} />
          </div>
          <div
            className="donut"
            style={{
              background: `conic-gradient(#2fc6aa 0 ${inShare}%,#f19a62 ${inShare}% 100%)`,
            }}
          >
            <div>
              <small>TOTAL FLOW</small>
              <b>{money(total)}</b>
            </div>
          </div>
          <div className="movementLegend">
            <div>
              <i className="in" />
              <span>
                Cash in<b>{money(s.cashIn)}</b>
              </span>
            </div>
            <div>
              <i className="out" />
              <span>
                Cash out<b>{money(s.cashOut)}</b>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="card activityCard">
        <div className="cardHeader">
          <div>
            <div className="sectionTitle">Latest Activity</div>
            <div className="sectionSub">Newest postings for {date}</div>
          </div>
          <span className="softBadge">
            <i /> AUTO-SYNC
          </span>
        </div>
        <Table rows={d.latest} />
      </div>
    </>
  );
}

function TransactionPage() {
  const [date, setDate] = useState(today()),
    [data, setData] = useState(),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  const [f, setF] = useState({
    movement: "Money In",
    categoryId: "",
    amount: "",
    counterparty: "",
    description: "",
    reference: "",
  });
  async function load() {
    setData(await api(`/api/transactions?date=${date}`));
  }
  useEffect(() => {
    load();
  }, [date]);
  const cats = useMemo(
    () =>
      data?.categories.filter(
        (c) =>
          (f.movement === "Money In"
            ? ["IN", "BOTH"]
            : ["OUT", "BOTH"]
          ).includes(c.direction) && ["CASH", "BOTH"].includes(c.account_scope),
      ) || [],
    [data, f.movement],
  );
  useEffect(() => {
    if (cats.length && !cats.find((c) => String(c.id) === String(f.categoryId)))
      setF((x) => ({ ...x, categoryId: String(cats[0].id) }));
  }, [cats.length, f.movement]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api("/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...f,
          date,
          amount: Number(f.amount),
          categoryId: Number(f.categoryId),
        }),
      });
      setF({ ...f, amount: "", description: "", reference: "" });
      setMsg("Transaction posted.");
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  const movementMeta = {
    "Money In": [ArrowDownRight, "Cash receipt", "IN"],
    "Money Out": [ArrowUpRight, "Cash payment", "OUT"],
    "Deposit to Bank": [Landmark, "Bank deposit", "BANK IN"],
    "Withdraw from Bank": [ArrowLeftRight, "Bank withdrawal", "BANK OUT"],
  };
  return (
    <>
      <PageHead
        title="New Transaction"
        sub="A secure, standardised workspace for every financial entry."
        date={date}
        setDate={setDate}
      />
      <div className="entryWorkspace">
        <form className="card entryComposer" onSubmit={save}>
          <div className="entryCardHead">
            <div className="entryHeadIcon">
              <PlusCircle />
            </div>
            <div>
              <small>FINANCIAL ENTRY</small>
              <div className="sectionTitle">Create a new transaction</div>
              <div className="sectionSub">
                Complete the details below and review before posting.
              </div>
            </div>
            <span className="entrySecure">
              <ShieldCheck size={13} /> SECURE
            </span>
          </div>
          <div className="movementPicker">
            {Object.entries(movementMeta).map(([name, [Icon, sub, code]]) => (
              <button
                type="button"
                className={f.movement === name ? "active" : ""}
                onClick={() => setF({ ...f, movement: name })}
                key={name}
              >
                <span>
                  <Icon size={19} />
                </span>
                <b>{name}</b>
                <small>{sub}</small>
                <i>{code}</i>
              </button>
            ))}
          </div>
          <div className="entryDivider">
            <span>TRANSACTION DETAILS</span>
          </div>
          <div className="formGrid entryForm">
            {!["Deposit to Bank", "Withdraw from Bank"].includes(
              f.movement,
            ) && (
              <div className="field full">
                <label>
                  Category <em>Required</em>
                </label>
                <select
                  required
                  value={f.categoryId}
                  onChange={(e) => setF({ ...f, categoryId: e.target.value })}
                >
                  {cats.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field amountField">
              <label>
                Amount <em>AED</em>
              </label>
              <div className="currencyInput">
                <span>AED</span>
                <input
                  min="0.01"
                  type="number"
                  step=".01"
                  placeholder="0.00"
                  value={f.amount}
                  onChange={(e) => setF({ ...f, amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>Counterparty</label>
              <input
                placeholder="Customer, supplier or person"
                list="parties"
                value={f.counterparty}
                onChange={(e) => setF({ ...f, counterparty: e.target.value })}
              />
              <datalist id="parties">
                {data?.parties.map((x) => (
                  <option value={x} key={x} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>Reference Number</label>
              <input
                placeholder="Invoice, receipt or reference"
                value={f.reference}
                onChange={(e) => setF({ ...f, reference: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Description</label>
              <input
                placeholder="Short transaction description"
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
            </div>
          </div>
          {msg && (
            <div className={`notice ${msg.includes("posted") ? "" : "error"}`}>
              {msg}
            </div>
          )}
          <div className="entryReview">
            <div>
              <small>ENTRY TYPE</small>
              <b>{f.movement}</b>
            </div>
            <div>
              <small>BUSINESS DATE</small>
              <b>{date}</b>
            </div>
            <div>
              <small>AMOUNT</small>
              <b>{money(f.amount)}</b>
            </div>
          </div>
          <button disabled={busy} className="entrySubmit">
            <span>
              {busy ? (
                <RefreshCw className="spin" size={19} />
              ) : (
                <Save size={19} />
              )}
            </span>
            <div>
              <b>{busy ? "POSTING TRANSACTION…" : "SAVE & POST TRANSACTION"}</b>
              <small>
                {busy ? "Please wait" : "Securely record this entry"}
              </small>
            </div>
            <ArrowUpRight size={18} />
          </button>
        </form>
        <div className="card entryJournal">
          <div className="journalHead">
            <div>
              <small>LIVE LEDGER</small>
              <div className="sectionTitle">Today’s Journal</div>
              <div className="sectionSub">
                Review, edit, void or restore entries with a complete audit
                trail.
              </div>
            </div>
            <span>
              <i /> LIVE SYNC
            </span>
          </div>
          {data ? <CashJournal data={data} onChanged={load} /> : <Loading />}
        </div>
      </div>
    </>
  );
}

function Movements() {
  const [date, setDate] = useState(today()),
    [d, setD] = useState();
  const load = () => api(`/api/transactions?date=${date}`).then(setD);
  useEffect(() => {
    load();
  }, [date]);
  return (
    <>
      <PageHead
        title="Money Movements"
        sub="Review, edit, void and restore cash entries securely."
        date={date}
        setDate={setDate}
      />
      <div className="card">
        {d ? <CashJournal data={d} onChanged={load} /> : <Loading />}
      </div>
    </>
  );
}
function DailyClose() {
  const [date, setDate] = useState(today()),
    [d, setD] = useState(),
    [actual, setActual] = useState(""),
    [opening, setOpening] = useState(""),
    [note, setNote] = useState(""),
    [m, setM] = useState(""),
    [reopen, setReopen] = useState(false),
    [busy, setBusy] = useState(false);
  const load = () =>
    api(`/api/close?date=${date}`).then((x) => {
      setD(x);
      setOpening(String(x.opening || 0));
      setActual(String(x.day?.actual_cash ?? x.expected ?? 0));
      setNote(x.day?.manager_note || "");
    });
  useEffect(() => {
    load();
  }, [date]);
  async function save() {
    setBusy(true);
    try {
      const x = await api("/api/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, actual: Number(actual), note }),
      });
      setM(
        `${d.day?.status === "FINALIZED" ? "Closing updated" : "Day finalized"}. Variance ${money(x.variance)}`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function saveOpening(action = "opening") {
    setBusy(true);
    try {
      await api("/api/close", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, action, opening: Number(opening) }),
      });
      setM(
        action === "resetOpening"
          ? "Opening cash reset to the carried balance."
          : "Opening cash updated.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function reopenDay() {
    setBusy(true);
    try {
      await api("/api/close", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          action: "reopen",
          reason: "Reopened for correction",
        }),
      });
      setReopen(false);
      setM("Day reopened. Transactions can now be edited or voided.");
      await load();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="Daily Closing"
        sub="Control opening cash, closing cash and day status with an audit trail."
        date={date}
        setDate={setDate}
      />
      {d ? (
        <>
          <div className="dayStatusBar">
            <span
              className={`dayStatus ${String(d.day?.status).toLowerCase()}`}
            >
              <i />
              {d.day?.status === "FINALIZED" ? "DAY FINALIZED" : "DAY OPEN"}
            </span>
            <small>{date}</small>
          </div>
          <div className="kpis">
            {[
              ["OPENING", d.opening],
              ["CASH IN", d.cashIn],
              ["CASH OUT", d.cashOut],
              ["EXPECTED", d.expected],
            ].map((x) => (
              <div className="card kpi" key={x[0]}>
                <div className="label">{x[0]}</div>
                <div className="value">{money(x[1])}</div>
              </div>
            ))}
          </div>
          <div className="dayControlGrid">
            <div className="card dayControlCard">
              <div className="controlIcon opening">
                <Landmark />
              </div>
              <div>
                <div className="sectionTitle">Day Opening Control</div>
                <div className="sectionSub">
                  Correct or reset the opening cash carried into this date.
                </div>
              </div>
              <div className="field">
                <label>Opening Cash AED</label>
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                />
              </div>
              <div className="luxControlActions">
                <button
                  disabled={busy}
                  className="btn btnPrimary"
                  onClick={() => saveOpening("opening")}
                >
                  <Save size={14} /> SAVE OPENING
                </button>
                <button
                  disabled={busy}
                  className="btn btnSoft"
                  onClick={() => saveOpening("resetOpening")}
                >
                  <RotateCcw size={14} /> RESET
                </button>
              </div>
            </div>
            <div className="card dayControlCard">
              <div className="controlIcon closing">
                <CheckCircle2 />
              </div>
              <div>
                <div className="sectionTitle">Day Closing Control</div>
                <div className="sectionSub">
                  {d.day?.status === "FINALIZED"
                    ? "Update the saved physical count or reopen the day."
                    : "Count physical cash and finalize the business day."}
                </div>
              </div>
              <div className="formGrid">
                <div className="field">
                  <label>Counted Cash</label>
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Difference</label>
                  <input
                    value={money(Number(actual || 0) - Number(d.expected))}
                    disabled
                  />
                </div>
                <div className="field full">
                  <label>Closing Note</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="luxControlActions">
                <button
                  disabled={busy}
                  className="btn btnPrimary"
                  onClick={save}
                >
                  <Save size={14} />
                  {d.day?.status === "FINALIZED"
                    ? "UPDATE CLOSING"
                    : "FINALIZE DAY"}
                </button>
                {d.day?.status === "FINALIZED" && (
                  <button
                    disabled={busy}
                    className="btn reopenButton"
                    onClick={() => setReopen(true)}
                  >
                    <LockOpen size={14} /> REOPEN DAY
                  </button>
                )}
              </div>
            </div>
          </div>
          {m && <div className="notice dayMessage">{m}</div>}
          {reopen && (
            <div className="modalShade">
              <div className="luxModal compact">
                <div className="modalHead">
                  <div>
                    <small>DAY CONTROL</small>
                    <h3>Reopen {date}?</h3>
                  </div>
                  <button onClick={() => setReopen(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className="confirmOrb reopen">
                  <LockOpen />
                </div>
                <p className="confirmText">
                  Closing figures will be cleared so transactions can be
                  corrected. You must finalize the day again afterward.
                </p>
                <div className="modalActions">
                  <button
                    className="btn btnSoft"
                    onClick={() => setReopen(false)}
                  >
                    CANCEL
                  </button>
                  <button
                    disabled={busy}
                    className="btn reopenButton"
                    onClick={reopenDay}
                  >
                    {busy ? "REOPENING…" : "CONFIRM REOPEN"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <Loading />
      )}
    </>
  );
}
function Bank() {
  const [date, setDate] = useState(today()),
    [d, setD] = useState(),
    [busy, setBusy] = useState(false),
    [f, setF] = useState({
      direction: "IN",
      categoryId: "",
      amount: "",
      counterparty: "",
      description: "",
      reference: "",
    });
  const load = () => api(`/api/bank?date=${date}`).then(setD);
  useEffect(() => {
    load();
  }, [date]);
  const cats =
    d?.categories.filter((c) => [f.direction, "BOTH"].includes(c.direction)) ||
    [];
  useEffect(() => {
    if (cats.length) setF((x) => ({ ...x, categoryId: String(cats[0].id) }));
  }, [f.direction, d?.categories?.length]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/bank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...f,
          date,
          amount: Number(f.amount),
          categoryId: Number(f.categoryId),
        }),
      });
      setF({ ...f, amount: "", description: "", reference: "" });
      await load();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="Emirates Islamic"
        sub="Premium banking ledger with live balance and secure posting."
        date={date}
        setDate={setDate}
      />
      {d ? (
        <div className="financeWorkspace">
          <div className="bankHero">
            <div className="bankMark">
              <Landmark />
            </div>
            <div>
              <small>EMIRATES ISLAMIC · LIVE ACCOUNT</small>
              <h3>{d.bank?.name || "Corporate Bank Account"}</h3>
              <p>Connected financial ledger</p>
            </div>
            <div className="bankBalance">
              <small>CURRENT BALANCE</small>
              <b>{money(d.bank?.balance)}</b>
              <span>
                <i /> LIVE & SECURE
              </span>
            </div>
          </div>
          <div className="grid2 financeGrid">
            <form className="card financeComposer" onSubmit={save}>
              <div className="financeHead">
                <div>
                  <small>BANK ENTRY</small>
                  <div className="sectionTitle">Post a bank movement</div>
                </div>
                <ShieldCheck />
              </div>
              <div className="directionSwitch">
                <button
                  type="button"
                  className={f.direction === "IN" ? "active in" : ""}
                  onClick={() => setF({ ...f, direction: "IN" })}
                >
                  <ArrowDownRight /> MONEY IN
                </button>
                <button
                  type="button"
                  className={f.direction === "OUT" ? "active out" : ""}
                  onClick={() => setF({ ...f, direction: "OUT" })}
                >
                  <ArrowUpRight /> MONEY OUT
                </button>
              </div>
              <div className="formGrid">
                <div className="field full">
                  <label>Category</label>
                  <select
                    required
                    value={f.categoryId}
                    onChange={(e) => setF({ ...f, categoryId: e.target.value })}
                  >
                    {cats.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Amount AED</label>
                  <input
                    required
                    min="0.01"
                    step=".01"
                    type="number"
                    placeholder="0.00"
                    value={f.amount}
                    onChange={(e) => setF({ ...f, amount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Counterparty</label>
                  <input
                    placeholder="Company or person"
                    value={f.counterparty}
                    onChange={(e) =>
                      setF({ ...f, counterparty: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Reference</label>
                  <input
                    placeholder="Bank reference"
                    value={f.reference}
                    onChange={(e) => setF({ ...f, reference: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Description</label>
                  <input
                    placeholder="Movement details"
                    value={f.description}
                    onChange={(e) =>
                      setF({ ...f, description: e.target.value })
                    }
                  />
                </div>
              </div>
              <button disabled={busy} className="financeSubmit">
                <Save />
                {busy ? "POSTING…" : "SAVE BANK ENTRY"}
                <ArrowUpRight />
              </button>
            </form>
            <div className="card financeLedger">
              <div className="journalHead">
                <div>
                  <small>DAILY BANK LEDGER</small>
                  <div className="sectionTitle">Bank Activity</div>
                </div>
                <span>
                  <i /> LIVE SYNC
                </span>
              </div>
              <Table rows={d.entries} />
            </div>
          </div>
        </div>
      ) : (
        <Loading />
      )}
    </>
  );
}
function IranDubai() {
  const [d, setD] = useState(),
    [busy, setBusy] = useState(false),
    [f, setF] = useState({
      date: today(),
      direction: "IRAN_TO_DUBAI",
      amountAed: "",
      amountIrr: "",
      rate: "",
      sender: "",
      receiver: "",
      channel: "",
      reference: "",
      description: "",
    });
  const load = () => api("/api/iran-dubai").then(setD);
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/iran-dubai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...f,
          amountAed: Number(f.amountAed),
          amountIrr: f.amountIrr ? Number(f.amountIrr) : null,
          rate: f.rate ? Number(f.rate) : null,
        }),
      });
      setF({
        ...f,
        amountAed: "",
        amountIrr: "",
        reference: "",
        description: "",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="Iran / Dubai"
        sub="Premium cross-border transfer control and currency ledger."
      />
      <div className="transferRoute">
        <div>
          <span>IR</span>
          <b>IRAN</b>
          <small>Origin / Destination</small>
        </div>
        <i>
          <ArrowLeftRight />
        </i>
        <div>
          <span>AE</span>
          <b>DUBAI</b>
          <small>Origin / Destination</small>
        </div>
      </div>
      <div className="grid2 financeGrid">
        <form className="card financeComposer transferComposer" onSubmit={save}>
          <div className="financeHead">
            <div>
              <small>INTERNATIONAL TRANSFER</small>
              <div className="sectionTitle">Create transfer record</div>
            </div>
            <Globe2 />
          </div>
          <div className="directionSwitch">
            <button
              type="button"
              className={f.direction === "IRAN_TO_DUBAI" ? "active" : ""}
              onClick={() => setF({ ...f, direction: "IRAN_TO_DUBAI" })}
            >
              IRAN <ArrowUpRight /> DUBAI
            </button>
            <button
              type="button"
              className={f.direction === "DUBAI_TO_IRAN" ? "active" : ""}
              onClick={() => setF({ ...f, direction: "DUBAI_TO_IRAN" })}
            >
              DUBAI <ArrowUpRight /> IRAN
            </button>
          </div>
          <div className="formGrid">
            <div className="field">
              <label>Business Date</label>
              <input
                required
                type="date"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Amount AED</label>
              <input
                required
                min="0.01"
                step=".01"
                type="number"
                placeholder="0.00"
                value={f.amountAed}
                onChange={(e) => setF({ ...f, amountAed: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Amount IRR</label>
              <input
                step="1"
                type="number"
                placeholder="0"
                value={f.amountIrr}
                onChange={(e) => setF({ ...f, amountIrr: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Exchange Rate</label>
              <input
                step="any"
                type="number"
                placeholder="Rate"
                value={f.rate}
                onChange={(e) => setF({ ...f, rate: e.target.value })}
              />
            </div>
            {[
              ["sender", "Sender"],
              ["receiver", "Receiver"],
              ["channel", "Payment Channel"],
              ["reference", "Reference"],
              ["description", "Description"],
            ].map(([k, l]) => (
              <div
                className={`field ${k === "description" ? "full" : ""}`}
                key={k}
              >
                <label>{l}</label>
                <input
                  value={f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <button disabled={busy} className="financeSubmit">
            <Save />
            {busy ? "SAVING…" : "SAVE TRANSFER"}
            <ArrowUpRight />
          </button>
        </form>
        <div className="card financeLedger">
          <div className="journalHead">
            <div>
              <small>CROSS-BORDER LEDGER</small>
              <div className="sectionTitle">Transfer Activity</div>
            </div>
            <span>
              <i /> LIVE SYNC
            </span>
          </div>
          {d ? <Table rows={d.entries} /> : <Loading />}
        </div>
      </div>
    </>
  );
}
function Reports() {
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 8) + "01"),
    [to, setTo] = useState(today()),
    [d, setD] = useState();
  async function load() {
    setD(await api(`/api/reports?from=${from}&to=${to}`));
  }
  useEffect(() => {
    load();
  }, []);
  function excel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(d.entries),
      "Cash Report",
    );
    XLSX.writeFile(wb, `Northfield_Cash_${from}_${to}.xlsx`);
    pushToast("Excel report downloaded successfully.");
  }
  async function pdf() {
    try {
      const settings = await fetch("/api/public-settings", {
        cache: "no-store",
      }).then((r) => r.json());
      const logoUrl = settings.company_logo || "/northfield-logo.png";
      const [logo, watermark] = await Promise.all([
        imageData(logoUrl),
        imageData(logoUrl, 0.055),
      ]);
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = doc.internal.pageSize.getWidth(),
        pageHeight = doc.internal.pageSize.getHeight();
      const company =
        settings.company_name || "Northfield Veterinary Clinic L.L.C";
      const address = settings.company_address || "United Arab Emirates";
      const keys = Object.keys(d.entries[0] || {});
      const rows = d.entries.map((row) => keys.map((key) => row[key] ?? ""));
      const drawFrame = () => {
        doc.setDrawColor(10, 48, 72);
        doc.setLineWidth(0.35);
        doc.roundedRect(7, 7, pageWidth - 14, pageHeight - 14, 1.8, 1.8);
        doc.setDrawColor(241, 189, 88);
        doc.setLineWidth(1.1);
        doc.line(12, 38, pageWidth - 12, 38);
        doc.setDrawColor(20, 68, 93);
        doc.setLineWidth(0.25);
        doc.line(12, 40, pageWidth - 12, 40);
        doc.addImage(
          watermark,
          "PNG",
          pageWidth / 2 - 52,
          pageHeight / 2 - 24,
          104,
          48,
        );
        doc.addImage(logo, "PNG", 13, 12, 43, 20);
        doc.setTextColor(8, 39, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text(company.toUpperCase(), 61, 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(98, 119, 132);
        doc.text(address, 61, 24);
        const contact = [settings.company_phone, settings.company_email]
          .filter(Boolean)
          .join("  •  ");
        if (contact) doc.text(contact, 61, 28.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 59, 89);
        doc.text("CASH CONTROL REPORT", 61, 34);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(93, 111, 122);
        doc.text(`REPORTING PERIOD  ${from}  —  ${to}`, pageWidth - 13, 20, {
          align: "right",
        });
        doc.text(
          `GENERATED  ${new Date().toLocaleString("en-GB")}`,
          pageWidth - 13,
          25,
          { align: "right" },
        );
      };
      autoTable(doc, {
        startY: 46,
        margin: { top: 46, left: 12, right: 12, bottom: 18 },
        head: [keys.map((k) => k.replaceAll("_", " ").toUpperCase())],
        body: rows,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 6.5,
          textColor: [45, 68, 81],
          lineColor: [222, 231, 235],
          lineWidth: 0.2,
          cellPadding: 2.2,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [8, 45, 67],
          textColor: [247, 214, 143],
          fontStyle: "bold",
          fontSize: 6.3,
          lineColor: [8, 45, 67],
        },
        alternateRowStyles: { fillColor: [245, 249, 249] },
        willDrawPage: drawFrame,
        didDrawPage: (data) => {
          doc.setFontSize(7);
          doc.setTextColor(117, 133, 142);
          doc.text(
            "CONFIDENTIAL · NORTHFIELD FINANCIAL CONTROL SUITE",
            13,
            pageHeight - 10,
          );
          doc.text(`PAGE ${data.pageNumber}`, pageWidth - 13, pageHeight - 10, {
            align: "right",
          });
        },
      });
      doc.save(`Northfield_Cash_Control_${from}_${to}.pdf`);
      pushToast("Luxury branded PDF report downloaded successfully.");
    } catch (e) {
      pushToast(`PDF could not be created: ${e.message}`, "error");
    }
  }
  return (
    <>
      <PageHead
        title="Reports"
        sub="Branded financial reports with Excel and executive PDF export."
        actions={
          <>
            <input
              className="dateInput"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              className="dateInput"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <button className="btn btnSoft" onClick={load}>
              RUN
            </button>
          </>
        }
      />
      {d ? (
        <>
          <div
            className="kpis"
            style={{
              gridTemplateColumns: "repeat(2,1fr)",
              maxWidth: 650,
              marginBottom: 14,
            }}
          >
            <div className="card kpi positive">
              <div className="label">TOTAL CASH IN</div>
              <div className="value">{money(d.summary.total_in)}</div>
            </div>
            <div className="card kpi negative">
              <div className="label">TOTAL CASH OUT</div>
              <div className="value">{money(d.summary.total_out)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button className="btn btnPrimary" onClick={pdf}>
              DOWNLOAD LUXURY PDF
            </button>
            <button className="btn btnSoft" onClick={excel}>
              DOWNLOAD EXCEL
            </button>
          </div>
          <div className="card">
            <Table rows={d.entries} />
          </div>
        </>
      ) : (
        <Loading />
      )}
    </>
  );
}
function Directory() {
  const [d, setD] = useState(),
    [tab, setTab] = useState("category"),
    [f, setF] = useState({
      name: "",
      direction: "IN",
      scope: "CASH",
      sort: 500,
      type: "Other",
      notes: "",
    });
  const load = () => api("/api/directory").then(setD);
  useEffect(() => {
    load();
  }, []);
  async function save() {
    await api("/api/directory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, kind: tab }),
    });
    setF({ ...f, name: "" });
    load();
  }
  return (
    <>
      <PageHead
        title="Directory"
        sub="Categories and counterparties used throughout Northfield."
      />
      <div className="tabs">
        <button
          className={`tab ${tab === "category" ? "active" : ""}`}
          onClick={() => setTab("category")}
        >
          Categories
        </button>
        <button
          className={`tab ${tab === "party" ? "active" : ""}`}
          onClick={() => setTab("party")}
        >
          Counterparties
        </button>
      </div>
      <div className="grid2">
        <div className="card">
          <div className="formGrid">
            <div className="field full">
              <label>Name</label>
              <input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </div>
            {tab === "category" ? (
              <>
                <div className="field">
                  <label>Direction</label>
                  <select
                    value={f.direction}
                    onChange={(e) => setF({ ...f, direction: e.target.value })}
                  >
                    <option>IN</option>
                    <option>OUT</option>
                    <option>BOTH</option>
                  </select>
                </div>
                <div className="field">
                  <label>Scope</label>
                  <select
                    value={f.scope}
                    onChange={(e) => setF({ ...f, scope: e.target.value })}
                  >
                    <option>CASH</option>
                    <option>BANK</option>
                    <option>BOTH</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>Type</label>
                  <select
                    value={f.type}
                    onChange={(e) => setF({ ...f, type: e.target.value })}
                  >
                    {[
                      "Customer",
                      "Supplier",
                      "Staff",
                      "Management",
                      "Internal",
                      "Other",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Notes</label>
                  <input
                    value={f.notes}
                    onChange={(e) => setF({ ...f, notes: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <br />
          <button className="btn btnPrimary" onClick={save}>
            SAVE
          </button>
        </div>
        <div className="card">
          {d ? (
            <Table rows={tab === "category" ? d.categories : d.parties} />
          ) : (
            <Loading />
          )}
        </div>
      </div>
    </>
  );
}
function Control() {
  const [d, setD] = useState(),
    [msg, setMsg] = useState("");
  const load = () =>
    api("/api/settings")
      .then(setD)
      .catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
  }, []);
  if (!d)
    return <>{msg ? <div className="notice error">{msg}</div> : <Loading />}</>;
  function chooseLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMsg("Use a PNG, JPG or WebP logo.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setMsg("Logo must be smaller than 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setD({
        ...d,
        settings: { ...d.settings, company_logo: String(reader.result) },
      });
    reader.readAsDataURL(file);
  }
  async function saveSettings() {
    try {
      const values = {
        company_name: d.settings.company_name,
        company_address: d.settings.company_address,
        company_email: d.settings.company_email,
        company_phone: d.settings.company_phone,
        company_logo: d.settings.company_logo || "",
        daily_messages: d.settings.daily_messages,
      };
      await api("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "settings", values }),
      });
      setMsg("Settings saved.");
    } catch (e) {
      setMsg(e.message);
    }
  }
  return (
    <>
      <PageHead
        title="Control Center"
        sub="Company, users and system configuration."
      />
      <div className="card">
        <div className="sectionTitle">Company Settings</div>
        <div className="formGrid">
          {[
            ["company_name", "Company Name"],
            ["company_address", "Address"],
            ["company_email", "Email"],
            ["company_phone", "Phone"],
          ].map(([k, l]) => (
            <div className="field" key={k}>
              <label>{l}</label>
              <input
                value={d.settings[k] || ""}
                onChange={(e) =>
                  setD({
                    ...d,
                    settings: { ...d.settings, [k]: e.target.value },
                  })
                }
              />
            </div>
          ))}
          <div className="field full">
            <label>Company Logo (PNG, JPG or WebP · max 1 MB)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={chooseLogo}
            />
            {d.settings.company_logo && (
              <>
                <img
                  className="logoPreview"
                  src={d.settings.company_logo}
                  alt="Company logo preview"
                />
                <button
                  type="button"
                  className="btn btnSoft"
                  style={{ width: "fit-content" }}
                  onClick={() =>
                    setD({
                      ...d,
                      settings: { ...d.settings, company_logo: "" },
                    })
                  }
                >
                  REMOVE LOGO
                </button>
              </>
            )}
          </div>
          <div className="field full">
            <label>Dashboard Messages</label>
            <textarea
              rows="6"
              value={d.settings.daily_messages || ""}
              onChange={(e) =>
                setD({
                  ...d,
                  settings: { ...d.settings, daily_messages: e.target.value },
                })
              }
            />
          </div>
        </div>
        {msg && <div className="notice">{msg}</div>}
        <button className="btn btnPrimary" onClick={saveSettings}>
          SAVE SETTINGS
        </button>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sectionTitle">Users</div>
        <Table rows={d.users} />
      </div>
    </>
  );
}

function notificationText(n) {
  const names = {
    LOGIN: "signed in",
    LOGOUT: "signed out",
    POST_CASH: "created a cash transaction",
    EDIT_CASH: "edited a transaction",
    VOID_CASH: "voided a transaction",
    RESTORE_CASH: "restored a transaction",
    POST_BANK: "created a bank entry",
    FINALIZE_DAY: "finalized the business day",
    REOPEN_DAY: "reopened the business day",
    EDIT_OPENING: "updated opening cash",
    RESET_OPENING: "reset opening cash",
  };
  return (
    names[n.action] ||
    String(n.action || "System activity")
      .replaceAll("_", " ")
      .toLowerCase()
  );
}
function notificationTime(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
}
function TopBar({ page, user, theme, setTheme, collapsed, setCollapsed }) {
  const [now, setNow] = useState(new Date()),
    [panel, setPanel] = useState(false),
    [items, setItems] = useState([]),
    [seen, setSeen] = useState(0);
  async function loadNotifications() {
    try {
      const d = await api("/api/notifications");
      setItems(d.notifications || []);
    } catch {}
  }
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setSeen(Number(localStorage.getItem("northfield-notifications-seen") || 0));
    loadNotifications();
    const id = setInterval(loadNotifications, 20000);
    return () => clearInterval(id);
  }, []);
  const unread = items.filter(
    (n) => new Date(n.event_time).getTime() > seen,
  ).length;
  function toggle() {
    const next = !panel;
    setPanel(next);
    if (next) {
      const stamp = Date.now();
      setSeen(stamp);
      localStorage.setItem("northfield-notifications-seen", String(stamp));
      loadNotifications();
    }
  }
  return (
    <header className="topBar">
      <div className="topBarLeft">
        <button
          className="topIcon desktopCollapse"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
        <div>
          <span className="topEyebrow">NORTHFIELD WORKSPACE</span>
          <h2>{page}</h2>
        </div>
      </div>
      <div className="topBarRight">
        <div className="topDate">
          <CalendarDays size={15} />
          <span>
            {now.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <button
          className={`topIcon notificationBell ${panel ? "active" : ""}`}
          onClick={toggle}
          title="Notifications"
        >
          <Bell size={17} />
          {unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}
        </button>
        <button
          className="themeSwitch"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Switch theme"
        >
          <span className={theme === "light" ? "active" : ""}>
            <Sun size={14} />
          </span>
          <span className={theme === "dark" ? "active" : ""}>
            <Moon size={14} />
          </span>
        </button>
        <div className="userChip">
          <b>
            {String(user?.name || "N")
              .slice(0, 1)
              .toUpperCase()}
          </b>
          <span>
            <strong>{user?.name || "Northfield"}</strong>
            <small>{user?.role || "Administrator"}</small>
          </span>
        </div>
      </div>
      {panel && (
        <>
          <button
            className="notificationBackdrop"
            aria-label="Close notifications"
            onClick={() => setPanel(false)}
          />
          <section className="notificationPanel">
            <div className="notificationHead">
              <div>
                <small>LIVE ACTIVITY</small>
                <h3>Notifications</h3>
              </div>
              <button onClick={() => setPanel(false)}>
                <X size={17} />
              </button>
            </div>
            <div className="notificationList">
              {items.length ? (
                items.map((n) => (
                  <article key={n.id}>
                    <span
                      className={`notificationIcon ${String(n.action).toLowerCase()}`}
                    >
                      <Bell size={14} />
                    </span>
                    <div>
                      <b>
                        {n.user_name} {notificationText(n)}
                      </b>
                      <p>{n.detail || n.entity_type}</p>
                      <small>
                        {notificationTime(n.event_time)}
                        {n.business_date
                          ? ` · ${String(n.business_date).slice(0, 10)}`
                          : ""}
                      </small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="notificationEmpty">
                  <Bell size={20} />
                  <span>No activity yet.</span>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </header>
  );
}
function vapidKey(value) {
  const pad = "=".repeat((4 - (value.length % 4)) % 4),
    base64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
function PushDeviceControl() {
  const [state, setState] = useState("loading"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setState("unsupported");
        return;
      }
      try {
        await navigator.serviceWorker.register("/sw.js");
        const sub = await (
          await navigator.serviceWorker.ready
        ).pushManager.getSubscription();
        setState(
          sub
            ? "enabled"
            : Notification.permission === "denied"
              ? "blocked"
              : "disabled",
        );
      } catch {
        setState("disabled");
      }
    })();
  }, []);
  async function toggle() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready,
        existing = await registration.pushManager.getSubscription();
      if (existing) {
        await api("/api/push", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setState("disabled");
        pushToast("Phone and desktop alerts disabled.", "info");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "disabled");
        pushToast("Notification permission was not granted.", "error");
        return;
      }
      const config = await api("/api/push");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey(config.publicKey),
      });
      await api("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          deviceLabel: `${navigator.platform || "Device"} · ${navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop"}`,
        }),
      });
      setState("enabled");
      pushToast("Phone and desktop alerts are now active.");
    } catch (e) {
      pushToast(e.message || "Could not enable notifications.", "error");
    } finally {
      setBusy(false);
    }
  }
  if (state === "unsupported") return null;
  const on = state === "enabled",
    status = busy
      ? "Updating…"
      : state === "blocked"
        ? "Blocked in browser"
        : on
          ? "Phone & desktop alerts"
          : "Alerts are turned off";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Notifications ${on ? "on" : "off"}`}
      className={`installAppButton pushDeviceButton pushToggleCard ${state}`}
      disabled={busy || state === "loading" || state === "blocked"}
      onClick={toggle}
    >
      <span className="pushToggleIcon">
        <Bell size={15} />
      </span>
      <span className="pushToggleCopy">
        <strong>Notifications</strong>
        <small>{status}</small>
      </span>
      <span className="pushSwitch" aria-hidden="true">
        <i />
      </span>
    </button>
  );
}
function InstallApp() {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  async function install() {
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }
  return (
    <>
      <PushDeviceControl />
      {prompt && (
        <button className="btn installAppButton" onClick={install}>
          Install Desktop App
        </button>
      )}
    </>
  );
}
function reportRange(period, anchor) {
  const d = new Date(`${anchor}T00:00:00`),
    y = d.getFullYear(),
    m = d.getMonth();
  if (period === "daily") return [anchor, anchor];
  if (period === "yearly") return [`${y}-01-01`, `${y}-12-31`];
  return [
    new Date(y, m, 1).toISOString().slice(0, 10),
    new Date(y, m + 1, 0).toISOString().slice(0, 10),
  ];
}
function ReportsV2() {
  const [scope, setScope] = useState("cash"),
    [period, setPeriod] = useState("monthly"),
    [anchor, setAnchor] = useState(today()),
    [from, setFrom] = useState(new Date().toISOString().slice(0, 8) + "01"),
    [to, setTo] = useState(today()),
    [d, setD] = useState(),
    [busy, setBusy] = useState(false);
  const names = {
    cash: "Cash Transactions",
    closing: "Daily Closing",
    bank: "Emirates Islamic",
    transfer: "Iran / Dubai",
  };
  async function load(nextScope = scope, nextFrom = from, nextTo = to) {
    setBusy(true);
    try {
      setD(
        await api(
          `/api/reports?scope=${nextScope}&from=${nextFrom}&to=${nextTo}`,
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function choosePeriod(p) {
    setPeriod(p);
    const [a, b] = reportRange(p, anchor);
    setFrom(a);
    setTo(b);
    load(scope, a, b);
  }
  function chooseScope(s) {
    setScope(s);
    load(s, from, to);
  }
  function changeAnchor(value) {
    setAnchor(value);
    const [a, b] = reportRange(period, value);
    setFrom(a);
    setTo(b);
  }
  function excel() {
    const wb = XLSX.utils.book_new(),
      meta = [
        ["NORTHFIELD VETERINARY CLINIC L.L.C"],
        [`${names[scope]} Report`],
        ["Period", from, to],
        ["Generated", new Date().toLocaleString("en-GB")],
        [],
        ["SUMMARY"],
        ...Object.entries(d.summary || {}).map(([k, v]) => [
          k.replaceAll("_", " ").toUpperCase(),
          v,
        ]),
      ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(meta),
      "Executive Summary",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(d.entries),
      names[scope].slice(0, 31),
    );
    XLSX.writeFile(wb, `Northfield_${scope}_${period}_${from}_${to}.xlsx`);
    pushToast("Professional Excel workbook downloaded successfully.");
  }
  async function pdf() {
    try {
      const settings = await fetch("/api/public-settings", {
        cache: "no-store",
      }).then((r) => r.json());
      const logoUrl = settings.company_logo || "/northfield-logo.png";
      const [logo, watermark] = await Promise.all([
        imageData(logoUrl),
        imageData(logoUrl, 0.045),
      ]);
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const width = doc.internal.pageSize.getWidth(),
        height = doc.internal.pageSize.getHeight();
      const company =
          settings.company_name || "Northfield Veterinary Clinic L.L.C",
        address = settings.company_address || "United Arab Emirates";
      const keys = Object.keys(d.entries[0] || {}),
        rows = d.entries.map((row) =>
          keys.map((key) => pdfCell(key, row[key])),
        );
      const summary = d.summary || {},
        running = Number(
          summary.running_cash ?? summary.balance ?? summary.total_aed ?? 0,
        );
      const cards = [
        [
          scope === "transfer" ? "TOTAL AED" : "OPENING / DAYS",
          Number(
            summary.opening_cash ?? summary.day_count ?? summary.total_aed ?? 0,
          ),
          [43, 102, 157],
        ],
        [
          scope === "transfer" ? "TOTAL IRR" : "TOTAL IN",
          Number(summary.total_irr ?? summary.total_in ?? 0),
          [26, 135, 108],
        ],
        [
          scope === "closing" ? "VARIANCE" : "TOTAL OUT",
          Number(summary.total_variance ?? summary.total_out ?? 0),
          [192, 79, 67],
        ],
        [
          scope === "transfer"
            ? "RECORDS"
            : scope === "closing"
              ? "FINALIZED"
              : "BALANCE",
          scope === "transfer"
            ? Number(summary.record_count || 0)
            : scope === "closing"
              ? Number(summary.finalized_count || 0)
              : running,
          [205, 145, 44],
        ],
      ];
      const drawChrome = (data) => {
        doc.setDrawColor(218, 154, 44);
        doc.setLineWidth(0.45);
        doc.roundedRect(7, 7, width - 14, height - 14, 2.4, 2.4);
        doc.setDrawColor(229, 216, 188);
        doc.setLineWidth(0.2);
        doc.roundedRect(9, 9, width - 18, height - 18, 2, 2);
        doc.addImage(watermark, "PNG", width / 2 - 48, height / 2 - 22, 96, 44);
        doc.addImage(logo, "PNG", 13, 13, 39, 18);
        doc.setTextColor(9, 39, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(company.toUpperCase(), width / 2, 17, {
          align: "center",
          maxWidth: 92,
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.4);
        doc.setTextColor(104, 119, 128);
        doc.text(address, width / 2, 28, { align: "center", maxWidth: 92 });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(9, 39, 59);
        doc.text(names[scope].toUpperCase(), width - 13, 17, {
          align: "right",
        });
        doc.text(`${period.toUpperCase()} REPORT`, width - 13, 22, {
          align: "right",
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.4);
        doc.setTextColor(116, 130, 139);
        doc.text(`${from}  -  ${to}`, width - 13, 29, { align: "right" });
        doc.setDrawColor(218, 154, 44);
        doc.setLineWidth(0.7);
        doc.line(13, 35, width - 13, 35);
        if (data.pageNumber === 1) {
          const gap = 1.5,
            cardW = (width - 26 - gap * 3) / 4,
            y = 41;
          cards.forEach((card, i) => {
            const x = 13 + i * (cardW + gap);
            doc.setFillColor(250, 249, 246);
            doc.setDrawColor(224, 216, 199);
            doc.setLineWidth(0.25);
            doc.roundedRect(x, y, cardW, 23, 1.2, 1.2, "FD");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(5.2);
            doc.setTextColor(112, 128, 137);
            doc.text(card[0], x + cardW / 2, y + 7, { align: "center" });
            doc.setFontSize(9);
            doc.setTextColor(...card[2]);
            doc.text(
              `AED ${card[1].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              x + cardW / 2,
              y + 16,
              { align: "center" },
            );
          });
        }
      };
      autoTable(doc, {
        startY: 72,
        margin: { top: 42, left: 13, right: 13, bottom: 17 },
        head: [keys.map((k) => k.replaceAll("_", " ").toUpperCase())],
        body: rows,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 5.1,
          textColor: [45, 68, 81],
          lineColor: [224, 229, 230],
          lineWidth: 0.18,
          cellPadding: 1.35,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [8, 42, 63],
          textColor: [246, 211, 137],
          fontStyle: "bold",
          fontSize: 4.9,
          lineColor: [8, 42, 63],
          minCellHeight: 7,
        },
        alternateRowStyles: { fillColor: [248, 250, 249] },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 14 },
          2: { cellWidth: 10 },
          7: { halign: "right" },
          8: { cellWidth: 16 },
        },
        willDrawPage: drawChrome,
        didDrawPage: (data) => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.8);
          doc.setTextColor(124, 139, 147);
          doc.text(
            "Prepared by Northfield Financial Control Suite",
            width / 2,
            height - 12,
            { align: "center" },
          );
          doc.setTextColor(181, 137, 61);
          doc.text(
            "NORTHFIELD VETERINARY CLINIC L.L.C  ·  CONFIDENTIAL CASH CONTROL RECORD",
            width / 2,
            height - 8.5,
            { align: "center" },
          );
          doc.setTextColor(118, 132, 140);
          doc.text(`PAGE ${data.pageNumber}`, width - 13, height - 11, {
            align: "right",
          });
        },
      });
      doc.save(`Northfield_${scope}_${period}_${from}_${to}.pdf`);
      pushToast("Branded executive PDF downloaded successfully.");
    } catch (e) {
      pushToast(`PDF could not be created: ${e.message}`, "error");
    }
  }
  const s = d?.summary || {},
    cards =
      scope === "transfer"
        ? [
            ["TOTAL AED", s.total_aed],
            ["TOTAL IRR", s.total_irr],
            ["RECORDS", s.record_count],
          ]
        : scope === "closing"
          ? [
              ["TOTAL CASH IN", s.total_in],
              ["TOTAL CASH OUT", s.total_out],
              ["TOTAL VARIANCE", s.total_variance],
              ["FINALIZED DAYS", s.finalized_count],
            ]
          : [
              ["TOTAL IN", s.total_in],
              ["TOTAL OUT", s.total_out],
              ["NET BALANCE", scope === "bank" ? s.balance : s.running_cash],
            ];
  return (
    <>
      <PageHead
        title="Executive Reports"
        sub="Daily, monthly and annual reporting across every financial ledger."
      />
      <div className="reportStudio">
        <div className="reportScope">
          {[
            ["cash", "Cash Control", FileText],
            ["closing", "Daily Closing", CheckCircle2],
            ["bank", "Emirates Islamic", Landmark],
            ["transfer", "Iran / Dubai", Globe2],
          ].map(([key, label, Icon]) => (
            <button
              className={scope === key ? "active" : ""}
              onClick={() => chooseScope(key)}
              key={key}
            >
              <span>
                <Icon />
              </span>
              <b>{label}</b>
              <small>Professional report</small>
            </button>
          ))}
        </div>
        <div className="card reportCommand">
          <div className="periodSwitch">
            {["daily", "monthly", "yearly"].map((p) => (
              <button
                className={period === p ? "active" : ""}
                onClick={() => choosePeriod(p)}
                key={p}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="reportDates">
            <label>
              Report Date
              <input
                type="date"
                value={anchor}
                onChange={(e) => changeAnchor(e.target.value)}
              />
            </label>
            <span>
              <small>FROM</small>
              <b>{from}</b>
            </span>
            <i>→</i>
            <span>
              <small>TO</small>
              <b>{to}</b>
            </span>
            <button
              disabled={busy}
              className="runReport"
              onClick={() => load()}
            >
              <RefreshCw className={busy ? "spin" : ""} />
              {busy ? "RUNNING…" : "RUN REPORT"}
            </button>
          </div>
        </div>
        {d ? (
          <>
            <div className="kpis reportKpis">
              {cards.map((x, i) => (
                <div
                  className={`card kpi ${i === 0 ? "positive" : i === 1 ? "negative" : ""}`}
                  key={x[0]}
                >
                  <div className="label">{x[0]}</div>
                  <div className="value">
                    {x[0].includes("DAYS") || x[0] === "RECORDS"
                      ? Number(x[1] || 0)
                      : money(x[1])}
                  </div>
                  <div className="note">
                    {names[scope]} · {period}
                  </div>
                </div>
              ))}
            </div>
            <div className="exportSuite">
              <div>
                <small>EXPORT CENTER</small>
                <b>
                  {names[scope]} · {period} report
                </b>
              </div>
              <button onClick={pdf}>
                <FileText /> DOWNLOAD LUXURY PDF
              </button>
              <button onClick={excel}>
                <FileText /> DOWNLOAD EXCEL
              </button>
            </div>
            <div className="card reportTableCard">
              <div className="cardHeader">
                <div>
                  <div className="sectionTitle">{names[scope]} Detail</div>
                  <div className="sectionSub">
                    Official records from {from} to {to}.
                  </div>
                </div>
                <span className="softBadge">{d.entries.length} RECORDS</span>
              </div>
              <Table rows={d.entries} />
            </div>
          </>
        ) : (
          <Loading />
        )}
      </div>
    </>
  );
}
const attendanceLabel = (x) =>
  ({
    CLOCK_IN: "Clock In",
    BREAK_START: "Start Break",
    BREAK_END: "End Break",
    CLOCK_OUT: "Clock Out",
  })[x] || String(x || "").replaceAll("_", " ");
const attendanceTime = (x) =>
  x
    ? new Date(x).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

const bytesToBase64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const base64UrlToBytes = (value) => {
  const base64 = String(value).replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(
    atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    (c) => c.charCodeAt(0),
  );
};

function EmployeePortal({ user }) {
  const [d, setD] = useState(),
    [busy, setBusy] = useState(false),
    [scan, setScan] = useState(false),
    [msg, setMsg] = useState(""),
    [now, setNow] = useState(Date.now()),
    [leave, setLeave] = useState(null);
  const load = () =>
    api("/api/attendance")
      .then(setD)
      .catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
    return () => window.__northfieldQrControls?.stop?.();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function submit(raw, eventType) {
    const value = String(raw || "")
      .trim()
      .replace("northfield-attendance:", "");
    if (!value) {
      setMsg("Scan the office QR code or paste its code.");
      return;
    }
    setBusy(true);
    try {
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }),
      );
      await api("/api/attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: value,
          eventType,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          deviceLabel: `${navigator.platform || "Device"} · ${navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop"}`,
        }),
      });
      window.__northfieldQrControls?.stop?.();
      setScan(false);
      setMsg(
        `${attendanceLabel(eventType || d.nextEvent)} recorded successfully.`,
      );
      await load();
    } catch (e) {
      setMsg(
        e.code === 1
          ? "Location permission is required. Enable Precise Location and try again."
          : e.message || "Could not verify your location.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verifyDevice() {
    if (!window.PublicKeyCredential || !navigator.credentials)
      throw new Error(
        "Face ID or device PIN is not supported in this browser.",
      );
    const storageKey = `northfield-device-passkey-${user.id}`,
      saved = localStorage.getItem(storageKey),
      challenge = crypto.getRandomValues(new Uint8Array(32));
    if (!saved) {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Northfield Cash Control" },
          user: {
            id: new TextEncoder().encode(`northfield-${user.id}`),
            name: user.username || user.name,
            displayName: user.name,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          timeout: 60000,
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            residentKey: "preferred",
            userVerification: "required",
          },
          attestation: "none",
        },
      });
      if (!credential) throw new Error("Device verification was cancelled.");
      localStorage.setItem(storageKey, bytesToBase64Url(credential.rawId));
      return;
    }
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            type: "public-key",
            id: base64UrlToBytes(saved),
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });
    if (!assertion) throw new Error("Device verification was cancelled.");
  }
  async function camera() {
    setBusy(true);
    setMsg("");
    try {
      await verifyDevice();
    } catch (e) {
      setBusy(false);
      setMsg(
        e.name === "NotAllowedError"
          ? "Face ID or device PIN was cancelled."
          : e.message,
      );
      return;
    }
    setScan(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      window.__northfieldQrControls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        "attendance-camera",
        (result, _error, controls) => {
          if (result) {
            controls.stop();
            const scanned = result.getText();
            submit(scanned, d.nextEvent);
          }
        },
      );
    } catch (e) {
      setMsg("Camera could not start. Allow camera access and try again.");
    } finally {
      setBusy(false);
    }
  }
  function closeScanner() {
    window.__northfieldQrControls?.stop?.();
    setScan(false);
  }
  async function requestLeave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...leave, kind: "leave" }),
      });
      setLeave(null);
      setMsg("Leave request sent to your manager.");
      await load();
    } finally {
      setBusy(false);
    }
  }
  if (!d)
    return <>{msg ? <div className="notice error">{msg}</div> : <Loading />}</>;
  const p = d.profile || {},
    events = d.events || [],
    inside =
      events.length && events[events.length - 1].event_type !== "CLOCK_OUT",
    clockIn = events.find((x) => x.event_type === "CLOCK_IN")?.event_time,
    elapsedSeconds =
      inside && clockIn
        ? Math.max(0, Math.floor((now - new Date(clockIn).getTime()) / 1000))
        : 0,
    elapsed = `${String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`,
    fmtMinutes = (value) =>
      `${Math.floor(Number(value || 0) / 60)}h ${Number(value || 0) % 60}m`,
    monthTarget = Math.round(Number(p.committed_hours || 48) * 4.33 * 60),
    monthMinutes = Number(d.totals?.month_minutes || 0),
    targetProgress = Math.min(
      100,
      Math.round((monthMinutes / Math.max(1, monthTarget)) * 100),
    ),
    trendMax = Math.max(
      1,
      ...(d.trend || []).map((x) => Number(x.minutes || 0)),
    );
  return (
    <div className="attendancePortal">
      <div className="attendanceWelcome">
        <div>
          <small>MY NORTHFIELD · STAFF PORTAL</small>
          <h1>Welcome, {user.name}</h1>
          <p>
            Your private attendance workspace. Financial areas are not available
            to staff accounts.
          </p>
        </div>
        <div className={`attendanceState ${inside ? "inside" : "outside"}`}>
          <i />
          <span>{inside ? "ON SITE" : "OFF DUTY"}</span>
        </div>
      </div>
      <div className="attendanceStats">
        <article>
          <Clock3 />
          <span>
            <small>SHIFT</small>
            <b>
              {String(p.shift_start || "09:00").slice(0, 5)} –{" "}
              {String(p.shift_end || "18:00").slice(0, 5)}
            </b>
          </span>
        </article>
        <article>
          <UserCheck />
          <span>
            <small>TODAY</small>
            <b>
              {events.length
                ? `${attendanceTime(events[0].event_time)} · ${events.length} event${events.length > 1 ? "s" : ""}`
                : "Not clocked in"}
            </b>
          </span>
        </article>
        <article>
          <Timer />
          <span>
            <small>TODAY TOTAL</small>
            <b>{inside ? elapsed : fmtMinutes(d.totals?.today_minutes)}</b>
          </span>
        </article>
        <article>
          <Target />
          <span>
            <small>MONTH TARGET</small>
            <b>
              {targetProgress}% · {fmtMinutes(monthTarget)}
            </b>
          </span>
        </article>
      </div>
      <section className={`staffLiveClock ${inside ? "running" : ""}`}>
        <div>
          <small>
            {inside
              ? `IN SINCE ${attendanceTime(clockIn)}`
              : "READY FOR YOUR SHIFT"}
          </small>
          <strong>{inside ? elapsed : "00:00:00"}</strong>
          <span>
            {inside
              ? "Your working time is counting live"
              : "Scan the workplace QR to begin"}
          </span>
        </div>
        <div
          className="staffClockRing"
          style={{
            "--progress": `${Math.min(100, (elapsedSeconds / 28800) * 100)}%`,
          }}
        >
          <b>{Math.min(100, Math.round((elapsedSeconds / 28800) * 100))}%</b>
          <small>8H TARGET</small>
        </div>
      </section>
      <div className="staffMetricGrid">
        <article>
          <Clock3 />
          <small>Today</small>
          <b>{inside ? elapsed : fmtMinutes(d.totals?.today_minutes)}</b>
        </article>
        <article>
          <CalendarCheck />
          <small>This month</small>
          <b>{fmtMinutes(monthMinutes)}</b>
        </article>
        <article>
          <Target />
          <small>Monthly target</small>
          <b>{fmtMinutes(monthTarget)}</b>
        </article>
        <article>
          <Plane />
          <small>Leave requests</small>
          <b>{(d.leaves || []).length}</b>
        </article>
      </div>
      <section className="card staffTrendCard">
        <div className="cardHeader">
          <div>
            <div className="sectionTitle">My working trend</div>
            <div className="sectionSub">
              Actual hours across the last six months
            </div>
          </div>
          <button
            className="btn btnSoft"
            onClick={() =>
              setLeave({
                leaveType: "ANNUAL",
                dateFrom: today(),
                dateTo: today(),
                note: "",
              })
            }
          >
            <Plane /> REQUEST LEAVE
          </button>
        </div>
        <div className="staffTrendChart">
          {(d.trend || []).map((x) => (
            <div key={x.month_start}>
              <span
                style={{
                  height: `${Math.max(4, (Number(x.minutes || 0) / trendMax) * 100)}%`,
                }}
              >
                <i>{fmtMinutes(x.minutes)}</i>
              </span>
              <small>
                {new Date(x.month_start).toLocaleDateString("en", {
                  month: "short",
                })}
              </small>
            </div>
          ))}
        </div>
        <div className="staffTargetProgress">
          <span>
            <b style={{ width: `${targetProgress}%` }} />
          </span>
          <small>{targetProgress}% of this month’s target completed</small>
        </div>
      </section>
      {(d.leaves || []).length > 0 && (
        <section className="card staffUpdates">
          <div className="cardHeader">
            <div>
              <div className="sectionTitle">My staff updates</div>
              <div className="sectionSub">
                Attendance and leave decisions only
              </div>
            </div>
            <Bell />
          </div>
          <div className="staffUpdateList">
            {d.leaves.slice(0, 4).map((item) => (
              <article key={item.id}>
                <Plane />
                <div>
                  <b>{item.leave_type} leave</b>
                  <span>
                    {String(item.date_from).slice(0, 10)} →{" "}
                    {String(item.date_to).slice(0, 10)}
                  </span>
                </div>
                <em
                  className={`leaveStatus ${String(item.status).toLowerCase()}`}
                >
                  {item.status}
                </em>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="card employeeProfileStrip">
        <div className="employeeProfileAvatar">
          {String(user.name || "S")[0]}
        </div>
        <div>
          <small>EMPLOYEE PROFILE</small>
          <h3>{user.name}</h3>
          <span>{p.job_title || "Staff"}</span>
        </div>
        <dl>
          <div>
            <dt>Email</dt>
            <dd>{p.email || "—"}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{p.phone || "—"}</dd>
          </div>
          <div>
            <dt>Committed Hours / Week</dt>
            <dd>{p.committed_hours || 48}</dd>
          </div>
          <div>
            <dt>Employee Code</dt>
            <dd>{p.employee_code || "—"}</dd>
          </div>
        </dl>
      </section>
      <div className="attendanceGrid">
        <section className="card attendanceAction">
          <div className="attendanceActionIcon">
            <ScanLine />
          </div>
          <small>SECURE ATTENDANCE</small>
          <h2>{attendanceLabel(d.nextEvent)}</h2>
          <p>
            Tap below, verify with Face ID or device PIN, then scan the printed
            workplace QR.
          </p>
          <button className="attendanceScan" onClick={camera} disabled={busy}>
            <QrCode />
            {busy ? "VERIFYING…" : attendanceLabel(d.nextEvent).toUpperCase()}
          </button>
          {msg && (
            <div
              className={`notice ${msg.includes("successfully") ? "" : "error"}`}
            >
              {msg}
            </div>
          )}
        </section>
        <section className="card attendanceTimeline">
          <div className="cardHeader">
            <div>
              <div className="sectionTitle">Today’s timeline</div>
              <div className="sectionSub">{d.date} · Dubai time</div>
            </div>
            <span className="softBadge">
              <i /> LIVE
            </span>
          </div>
          {events.length ? (
            <div className="eventTimeline">
              {events.map((e) => (
                <div key={e.id}>
                  <span className="eventDot">
                    <Clock3 />
                  </span>
                  <b>{attendanceLabel(e.event_type)}</b>
                  <time>{attendanceTime(e.event_time)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="attendanceEmpty">
              <Clock3 />
              <b>No attendance events yet</b>
              <span>Scan the workplace QR when your shift begins.</span>
            </div>
          )}
        </section>
      </div>
      <section className="card attendanceHistory">
        <div className="cardHeader">
          <div>
            <div className="sectionTitle">My monthly attendance</div>
            <div className="sectionSub">
              Only you and authorized managers can see these records.
            </div>
          </div>
        </div>
        <Table
          rows={(d.history || []).map((x) => ({
            date: String(x.work_date).slice(0, 10),
            clock_in: attendanceTime(x.clock_in),
            clock_out: attendanceTime(x.clock_out),
            worked:
              x.worked_minutes == null
                ? "Open"
                : `${Math.floor(x.worked_minutes / 60)}h ${x.worked_minutes % 60}m`,
            late: `${x.late_minutes || 0}m`,
            overtime: `${x.overtime_minutes || 0}m`,
          }))}
        />
      </section>
      {scan && (
        <div className="modalShade">
          <div className="luxModal scannerModal scanBottomSheet">
            <div className="modalHead">
              <div>
                <small>QR SCANNER</small>
                <h3>Point camera at office QR</h3>
              </div>
              <button onClick={closeScanner}>
                <X />
              </button>
            </div>
            <video id="attendance-camera" playsInline muted />
            <p>
              Hold the printed workplace QR inside the frame. Scanning is
              automatic.
            </p>
          </div>
        </div>
      )}
      {leave && (
        <div className="modalShade">
          <div className="luxModal leaveRequestModal">
            <form onSubmit={requestLeave}>
              <div className="modalHead">
                <div>
                  <small>STAFF REQUEST</small>
                  <h3>Request leave</h3>
                  <p>Your manager will review and decide.</p>
                </div>
                <button type="button" onClick={() => setLeave(null)}>
                  <X />
                </button>
              </div>
              <div className="leaveTypePicker">
                {["ANNUAL", "SICK", "UNPAID", "OTHER"].map((type) => (
                  <button
                    type="button"
                    className={leave.leaveType === type ? "active" : ""}
                    onClick={() => setLeave({ ...leave, leaveType: type })}
                    key={type}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="formGrid">
                <div className="field">
                  <label>From</label>
                  <input
                    required
                    type="date"
                    value={leave.dateFrom}
                    onChange={(e) =>
                      setLeave({ ...leave, dateFrom: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>To</label>
                  <input
                    required
                    type="date"
                    value={leave.dateTo}
                    onChange={(e) =>
                      setLeave({ ...leave, dateTo: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label>Note (optional)</label>
                <textarea
                  rows="4"
                  value={leave.note}
                  onChange={(e) => setLeave({ ...leave, note: e.target.value })}
                  placeholder="Anything your manager should know"
                />
              </div>
              <div className="modalActions">
                <button
                  type="button"
                  className="btn btnSoft"
                  onClick={() => setLeave(null)}
                >
                  CANCEL
                </button>
                <button disabled={busy} className="btn btnPrimary">
                  <Plane /> SUBMIT REQUEST
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceAdmin() {
  const [d, setD] = useState(),
    [qr, setQr] = useState(),
    [edit, setEdit] = useState(null),
    [eventEdit, setEventEdit] = useState(null),
    [create, setCreate] = useState(null),
    [siteEdit, setSiteEdit] = useState(null),
    [filters, setFilters] = useState({
      from: today().slice(0, 8) + "01",
      to: today(),
      userId: "0",
    }),
    [msg, setMsg] = useState("");
  const load = (f = filters) =>
    api(
      `/api/attendance/admin?from=${f.from}&to=${f.to}&userId=${f.userId}`,
    ).then((x) => {
      setD(x);
      if (!siteEdit && x.site)
        setSiteEdit({
          kind: "site",
          siteName: x.site.site_name || "Northfield Clinic",
          latitude: x.site.latitude || "",
          longitude: x.site.longitude || "",
          radiusMeters: x.site.radius_meters || 200,
          blockOutside: x.site.block_outside !== false,
        });
    });
  const loadQr = () => api("/api/attendance/qr").then(setQr);
  useEffect(() => {
    load();
    loadQr();
  }, []);
  async function save(e) {
    e.preventDefault();
    await api("/api/attendance/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(edit),
    });
    setEdit(null);
    setMsg("Employee schedule saved.");
    load();
  }
  async function createStaff(e) {
    e.preventDefault();
    await api("/api/attendance/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...create, kind: "create_staff" }),
    });
    setCreate(null);
    setMsg(
      "Staff account created. Give the username and password directly to the employee.",
    );
    load();
  }
  async function saveSite(e) {
    e.preventDefault();
    await api("/api/attendance/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(siteEdit),
    });
    setMsg("Workplace location and allowed radius saved.");
    load();
  }
  async function decideLeave(leaveId, status) {
    await api("/api/attendance/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "leave_decision", leaveId, status }),
    });
    setMsg(`Leave request ${status.toLowerCase()}.`);
    load();
  }
  async function staffAction(userId, kind, active) {
    const destructive = kind === "staff_delete";
    if (
      destructive &&
      !window.confirm(
        "Delete this staff account and all attendance records permanently?",
      )
    )
      return;
    await api("/api/attendance/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, userId, active }),
    });
    setMsg(
      destructive
        ? "Staff account deleted."
        : active
          ? "Staff access enabled."
          : "Staff access disabled.",
    );
    load();
  }
  async function saveEvent(e) {
    e.preventDefault();
    await api("/api/attendance/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "event_update",
        eventId: eventEdit.id,
        eventType: eventEdit.eventType,
        eventTime: new Date(eventEdit.eventTime).toISOString(),
        workDate: eventEdit.eventTime.slice(0, 10),
        note: eventEdit.note,
      }),
    });
    setEventEdit(null);
    setMsg("Attendance time corrected with manager audit note.");
    load();
  }
  async function deleteEvent(eventId) {
    if (!window.confirm("Delete this attendance scan permanently?")) return;
    await api("/api/attendance/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "event_delete", eventId }),
    });
    setMsg("Attendance scan deleted.");
    load();
  }
  function useCurrentLocation() {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setSiteEdit({
          ...siteEdit,
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        }),
      () => setMsg("Allow location access to set the workplace position."),
      { enableHighAccuracy: true },
    );
  }
  function printQr() {
    if (!qr) return;
    const w = window.open("", "_blank");
    w.document.write(
      `<html><head><title>Northfield Attendance QR</title><style>body{font-family:Arial;text-align:center;padding:40px;color:#08243a}img{width:420px;max-width:90%}h1{margin-bottom:5px}p{color:#607585}</style></head><body><h1>Northfield Staff Attendance</h1><p>Scan with your Northfield employee account</p><img src="${qr.image}"/><p>${siteEdit?.siteName || "Northfield Clinic"}</p><script>onload=()=>print()<\/script></body></html>`,
    );
    w.document.close();
  }
  function excelReport() {
    const rows = (d.summary || []).map((x) => ({
      Date: String(x.work_date).slice(0, 10),
      Employee: x.display_name,
      "Clock In": attendanceTime(x.clock_in),
      "Clock Out": attendanceTime(x.clock_out),
      "Worked Minutes": x.worked_minutes,
      "Late Minutes": x.late_minutes,
      "Overtime Minutes": x.overtime_minutes,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Attendance Summary",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        (d.records || []).map((x) => ({
          Date: String(x.work_date).slice(0, 10),
          Employee: x.display_name,
          Event: attendanceLabel(x.event_type),
          Time: attendanceTime(x.event_time),
          "Distance (m)": Number(x.distance_meters || 0).toFixed(0),
          Latitude: x.latitude,
          Longitude: x.longitude,
        })),
      ),
      "Location Audit",
    );
    XLSX.writeFile(
      wb,
      `Northfield-Attendance-${filters.from}-${filters.to}.xlsx`,
    );
  }
  async function pdfReport() {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(6, 35, 52);
    doc.roundedRect(8, 8, pageWidth - 16, 35, 4, 4, "F");
    try {
      const logo = await imageData("/northfield-logo.png");
      doc.addImage(logo, "PNG", 14, 13, 29, 24);
    } catch {}
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text("STAFF TIME & ATTENDANCE", 49, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(162, 200, 211);
    doc.text(
      `${siteEdit?.siteName || "Northfield Clinic"}  |  ${filters.from} to ${filters.to}`,
      49,
      29,
    );
    const completed = (d.summary || []).filter((x) => x.worked_minutes != null),
      totalMinutes = completed.reduce(
        (sum, x) => sum + Number(x.worked_minutes || 0),
        0,
      ),
      lateMinutes = completed.reduce(
        (sum, x) => sum + Number(x.late_minutes || 0),
        0,
      ),
      overtimeMinutes = completed.reduce(
        (sum, x) => sum + Number(x.overtime_minutes || 0),
        0,
      ),
      cards = [
        [
          "TOTAL WORKED",
          `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
        ],
        ["LATE TIME", `${lateMinutes} min`],
        ["OVERTIME", `${overtimeMinutes} min`],
        ["COMPLETED DAYS", String(completed.length)],
      ];
    cards.forEach(([label, value], index) => {
      const x = 9 + index * ((pageWidth - 18) / 4),
        width = (pageWidth - 24) / 4;
      doc.setFillColor(
        index === 0 ? 225 : 242,
        index === 0 ? 247 : 247,
        index === 0 ? 240 : 249,
      );
      doc.setDrawColor(202, 222, 228);
      doc.roundedRect(x, 48, width, 20, 3, 3, "FD");
      doc.setTextColor(91, 119, 131);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(label, x + 5, 55);
      doc.setTextColor(8, 45, 64);
      doc.setFontSize(12);
      doc.text(value, x + 5, 64);
    });
    autoTable(doc, {
      startY: 75,
      head: [
        [
          "Date",
          "Employee",
          "Clock In",
          "Clock Out",
          "Worked",
          "Late",
          "Overtime",
        ],
      ],
      body: (d.summary || []).map((x) => [
        String(x.work_date).slice(0, 10),
        x.display_name,
        attendanceTime(x.clock_in),
        attendanceTime(x.clock_out),
        x.worked_minutes == null
          ? "Open"
          : `${Math.floor(x.worked_minutes / 60)}h ${x.worked_minutes % 60}m`,
        `${x.late_minutes || 0}m`,
        `${x.overtime_minutes || 0}m`,
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 3.2,
        textColor: [37, 67, 81],
        lineColor: [214, 229, 234],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [9, 64, 83],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [244, 249, 250] },
      didDrawPage: () => {
        const h = doc.internal.pageSize.getHeight();
        doc.setDrawColor(20, 106, 126);
        doc.setLineWidth(0.5);
        doc.rect(7, 7, pageWidth - 14, h - 14);
        doc.setTextColor(112, 137, 147);
        doc.setFontSize(7);
        doc.text(
          `Northfield Staff Control · Generated ${new Date().toLocaleString()}`,
          10,
          h - 9,
        );
      },
    });
    const detailsY = Math.min((doc.lastAutoTable?.finalY || 75) + 10, 138),
      reportHeight = 34;
    doc.setFillColor(7, 37, 54);
    doc.roundedRect(9, detailsY, pageWidth - 18, reportHeight, 4, 4, "F");
    doc.setFillColor(25, 171, 139);
    doc.roundedRect(9, detailsY, 3, reportHeight, 1, 1, "F");
    doc.setTextColor(238, 249, 251);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("ATTENDANCE CONTROL SUMMARY", 18, detailsY + 9);
    doc.setTextColor(154, 187, 199);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Report scope: ${filters.userId === "0" ? "All employees" : d.staff.find((x) => String(x.id) === String(filters.userId))?.display_name || "Selected employee"}`,
      18,
      detailsY + 17,
    );
    doc.text(
      `Workplace: ${siteEdit?.siteName || "Northfield Clinic"}`,
      18,
      detailsY + 23,
    );
    doc.text(
      "Calculation: Actual elapsed time from Clock In to Clock Out · Dubai local time",
      18,
      detailsY + 29,
    );
    const signatureX = pageWidth - 90;
    doc.setDrawColor(89, 128, 143);
    doc.line(signatureX, detailsY + 22, signatureX + 31, detailsY + 22);
    doc.line(signatureX + 39, detailsY + 22, signatureX + 70, detailsY + 22);
    doc.setTextColor(164, 193, 202);
    doc.setFontSize(7);
    doc.text("PREPARED BY", signatureX, detailsY + 28);
    doc.text("MANAGER APPROVAL", signatureX + 39, detailsY + 28);
    doc.setTextColor(8, 53, 71);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(
      "CONFIDENTIAL · AUTHORIZED STAFF USE ONLY",
      pageWidth / 2,
      detailsY + 43,
      { align: "center" },
    );
    doc.save(`Northfield-Attendance-${filters.from}-${filters.to}.pdf`);
  }
  if (!d) return <Loading />;
  return (
    <>
      <PageHead
        title="Staff Attendance"
        sub="Live QR clock-in, schedules and private employee time records."
        actions={
          <div className="attendanceHeadActions">
            <button
              className="btn btnPrimary"
              onClick={() =>
                setCreate({
                  name: "",
                  username: "",
                  email: "",
                  phone: "",
                  password: "",
                  employeeCode: "",
                  jobTitle: "Staff",
                  committedHours: 48,
                  shiftStart: "09:00",
                  shiftEnd: "18:00",
                  breakMinutes: 0,
                  graceMinutes: 10,
                  workDays: "1,2,3,4,5,6",
                  overtimeRequiresApproval: true,
                })
              }
            >
              <PlusCircle size={15} /> ADD STAFF
            </button>
            <button className="btn btnSoft" onClick={() => load()}>
              <RefreshCw size={15} />
            </button>
          </div>
        }
      />
      <div className="attendanceAdminGrid">
        <section className="card qrStation">
          <small>PERMANENT WORKPLACE QR</small>
          <h3>Scan to clock in or out</h3>
          <p>
            Print this QR once. Every scan requires the employee’s live GPS
            location.
          </p>
          {qr ? (
            <img src={qr.image} alt="Live Northfield attendance QR" />
          ) : (
            <Loading />
          )}
          <div className="qrPrintActions">
            <button className="btn btnPrimary" onClick={printQr}>
              <FileText size={14} /> PRINT QR
            </button>
          </div>
          {siteEdit && (
            <form className="siteConfig" onSubmit={saveSite}>
              <div className="field">
                <label>Workplace Name</label>
                <input
                  value={siteEdit.siteName}
                  onChange={(e) =>
                    setSiteEdit({ ...siteEdit, siteName: e.target.value })
                  }
                />
              </div>
              <div className="siteCoordinates">
                <div className="field">
                  <label>Latitude</label>
                  <input
                    value={siteEdit.latitude}
                    onChange={(e) =>
                      setSiteEdit({ ...siteEdit, latitude: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Longitude</label>
                  <input
                    value={siteEdit.longitude}
                    onChange={(e) =>
                      setSiteEdit({ ...siteEdit, longitude: e.target.value })
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn btnSoft"
                onClick={useCurrentLocation}
              >
                <ScanLine size={14} /> USE THIS DEVICE LOCATION
              </button>
              <div className="field">
                <label>Allowed Radius (meters)</label>
                <input
                  type="number"
                  min="20"
                  value={siteEdit.radiusMeters}
                  onChange={(e) =>
                    setSiteEdit({ ...siteEdit, radiusMeters: e.target.value })
                  }
                />
              </div>
              <label className="activeToggle">
                <input
                  type="checkbox"
                  checked={siteEdit.blockOutside}
                  onChange={(e) =>
                    setSiteEdit({ ...siteEdit, blockOutside: e.target.checked })
                  }
                />
                <span />
                <b>Block scans outside this radius</b>
              </label>
              <button className="btn btnPrimary">
                SAVE WORKPLACE LOCATION
              </button>
            </form>
          )}
        </section>
        <section className="card attendanceRoster">
          <div className="cardHeader">
            <div>
              <div className="sectionTitle">Today’s team</div>
              <div className="sectionSub">Dubai local time · live status</div>
            </div>
          </div>
          <div className="rosterList">
            {d.today.map((x) => (
              <article key={x.id}>
                <span>{String(x.display_name || "?")[0]}</span>
                <div>
                  <b>{x.display_name}</b>
                  <small>
                    {x.clock_in
                      ? `In ${attendanceTime(x.clock_in)}`
                      : "Not arrived"}
                    {x.clock_out ? ` · Out ${attendanceTime(x.clock_out)}` : ""}
                  </small>
                </div>
                <i className={x.clock_in && !x.clock_out ? "online" : ""} />
              </article>
            ))}
          </div>
        </section>
      </div>
      {msg && <div className="notice">{msg}</div>}
      <section className="card employeeSchedules">
        <div className="cardHeader">
          <div>
            <div className="sectionTitle">Employees & shifts</div>
            <div className="sectionSub">
              Set each employee’s fixed schedule, break and overtime rule.
            </div>
          </div>
        </div>
        <div className="userAdminGrid">
          {d.staff.map((u) => (
            <article className="userAdminCard" key={u.id}>
              <div className="userAvatar">
                {String(u.display_name || u.username)[0]}
              </div>
              <div className="userIdentity">
                <b>{u.display_name}</b>
                <span>@{u.username}</span>
                <small>{u.employee_code || "No employee code"}</small>
              </div>
              <div className="userRole">
                {String(u.shift_start || "09:00").slice(0, 5)} –{" "}
                {String(u.shift_end || "18:00").slice(0, 5)}
              </div>
              <button
                className="editUserButton"
                onClick={() =>
                  setEdit({
                    userId: u.id,
                    employeeCode: u.employee_code || "",
                    jobTitle: u.job_title || "Staff",
                    phone: u.phone || "",
                    committedHours: u.committed_hours ?? 48,
                    shiftStart: String(u.shift_start || "09:00").slice(0, 5),
                    shiftEnd: String(u.shift_end || "18:00").slice(0, 5),
                    breakMinutes: 0,
                    graceMinutes: u.grace_minutes ?? 10,
                    workDays: u.work_days || "1,2,3,4,5,6",
                    overtimeRequiresApproval:
                      u.overtime_requires_approval !== false,
                  })
                }
              >
                <Pencil /> MANAGE SHIFT
              </button>
              {u.role === "Staff" && (
                <div className="staffAccountActions">
                  <button
                    className={u.active ? "disable" : "enable"}
                    onClick={() => staffAction(u.id, "staff_toggle", !u.active)}
                  >
                    <UserX />
                    {u.active ? "DISABLE ACCESS" : "ENABLE ACCESS"}
                  </button>
                  <button
                    className="delete"
                    onClick={() => staffAction(u.id, "staff_delete")}
                  >
                    <Trash2 />
                    DELETE STAFF
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="card managerLeaveBoard">
        <div className="cardHeader">
          <div>
            <div className="sectionTitle">Leave requests</div>
            <div className="sectionSub">
              Approve or reject staff requests from one place.
            </div>
          </div>
          <span className="softBadge">
            {(d.leaves || []).filter((x) => x.status === "PENDING").length}{" "}
            PENDING
          </span>
        </div>
        <div className="leaveRequestList">
          {(d.leaves || []).length ? (
            d.leaves.map((item) => (
              <article key={item.id}>
                <div className="leaveAvatar">
                  {String(item.display_name || "S")[0]}
                </div>
                <div>
                  <b>{item.display_name}</b>
                  <span>
                    {item.leave_type} · {String(item.date_from).slice(0, 10)} →{" "}
                    {String(item.date_to).slice(0, 10)}
                  </span>
                  <small>{item.note || "No note provided"}</small>
                </div>
                <em
                  className={`leaveStatus ${String(item.status).toLowerCase()}`}
                >
                  {item.status}
                </em>
                {item.status === "PENDING" && (
                  <div className="leaveDecision">
                    <button onClick={() => decideLeave(item.id, "REJECTED")}>
                      REJECT
                    </button>
                    <button onClick={() => decideLeave(item.id, "APPROVED")}>
                      APPROVE
                    </button>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="attendanceEmpty">
              <Plane />
              <b>No leave requests</b>
              <span>New requests will appear here.</span>
            </div>
          )}
        </div>
      </section>
      <section className="card attendanceReports">
        <div className="cardHeader">
          <div>
            <div className="sectionTitle">Attendance Reports</div>
            <div className="sectionSub">
              Choose one employee or the full team, then export PDF or Excel.
            </div>
          </div>
        </div>
        <div className="attendanceFilters">
          <label>
            Employee
            <select
              value={filters.userId}
              onChange={(e) =>
                setFilters({ ...filters, userId: e.target.value })
              }
            >
              <option value="0">All Employees</option>
              {d.staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </label>
          <button className="btn btnPrimary" onClick={() => load(filters)}>
            RUN REPORT
          </button>
          <button className="btn btnSoft" onClick={pdfReport}>
            PDF
          </button>
          <button className="btn btnSoft" onClick={excelReport}>
            EXCEL
          </button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Worked</th>
                <th>Late</th>
                <th>Overtime</th>
              </tr>
            </thead>
            <tbody>
              {(d.summary || []).map((x, i) => (
                <tr key={`${x.display_name}-${x.work_date}-${i}`}>
                  <td>{String(x.work_date).slice(0, 10)}</td>
                  <td>{x.display_name}</td>
                  <td>{attendanceTime(x.clock_in)}</td>
                  <td>{attendanceTime(x.clock_out)}</td>
                  <td>
                    {x.worked_minutes == null
                      ? "Open"
                      : `${Math.floor(x.worked_minutes / 60)}h ${x.worked_minutes % 60}m`}
                  </td>
                  <td>{x.late_minutes || 0}m</td>
                  <td>{x.overtime_minutes || 0}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="locationAudit">
          <summary>Location Audit · {(d.records || []).length} scans</summary>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Event</th>
                  <th>Distance</th>
                  <th>Actions</th>
                  <th>Map</th>
                </tr>
              </thead>
              <tbody>
                {(d.records || []).map((x) => (
                  <tr key={x.id}>
                    <td>{String(x.work_date).slice(0, 10)}</td>
                    <td>{x.display_name}</td>
                    <td>{attendanceLabel(x.event_type)}</td>
                    <td>
                      {Number(x.distance_meters || 0) >= 1000
                        ? `${(Number(x.distance_meters) / 1000).toFixed(2)} km`
                        : `${Number(x.distance_meters || 0).toFixed(0)} m`}
                    </td>
                    <td>
                      <div className="recordActions">
                        <button
                          onClick={() => {
                            const local = new Date(x.event_time),
                              offset = local.getTimezoneOffset() * 60000;
                            setEventEdit({
                              id: x.id,
                              eventType: x.event_type,
                              eventTime: new Date(local.getTime() - offset)
                                .toISOString()
                                .slice(0, 16),
                              note: "Manager correction",
                            });
                          }}
                        >
                          <Pencil /> EDIT
                        </button>
                        <button onClick={() => deleteEvent(x.id)}>
                          <Trash2 /> DELETE
                        </button>
                      </div>
                    </td>
                    <td>
                      {x.latitude ? (
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={`https://www.google.com/maps?q=${x.latitude},${x.longitude}`}
                          className={
                            x.outside_geofence
                              ? "locationOutside"
                              : "locationOk"
                          }
                        >
                          VIEW MAP
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        {(d.attempts || []).some((x) => !x.accepted) && (
          <>
            <div className="outsideAttempts">
              <AlertTriangle />
              <div>
                <b>Blocked outside-location attempts</b>
                <span>
                  {d.attempts.filter((x) => !x.accepted).length} attempt(s) were
                  blocked and preserved in the audit log.
                </span>
              </div>
            </div>
            <details className="locationAudit blockedAudit">
              <summary>Open blocked attempts</summary>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Time</th>
                      <th>Attempt</th>
                      <th>Distance</th>
                      <th>Exact Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.attempts
                      .filter((x) => !x.accepted)
                      .map((x) => (
                        <tr key={x.id}>
                          <td>{x.display_name || "Unknown"}</td>
                          <td>{new Date(x.attempted_at).toLocaleString()}</td>
                          <td>{attendanceLabel(x.event_type)}</td>
                          <td>
                            {Number(x.distance_meters || 0) >= 1000
                              ? `${(Number(x.distance_meters) / 1000).toFixed(2)} km`
                              : `${Number(x.distance_meters || 0).toFixed(0)} m`}
                          </td>
                          <td>
                            <a
                              target="_blank"
                              rel="noreferrer"
                              className="locationOutside"
                              href={`https://www.google.com/maps?q=${x.latitude},${x.longitude}`}
                            >
                              VIEW ON MAP
                            </a>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>
      {eventEdit && (
        <div className="modalShade">
          <div className="luxModal eventEditorModal">
            <form onSubmit={saveEvent}>
              <div className="modalHead">
                <div>
                  <small>MANAGER CORRECTION</small>
                  <h3>Edit attendance scan</h3>
                  <p>
                    The corrected time will be used in staff totals and reports.
                  </p>
                </div>
                <button type="button" onClick={() => setEventEdit(null)}>
                  <X />
                </button>
              </div>
              <div className="formGrid">
                <div className="field">
                  <label>Event</label>
                  <select
                    value={eventEdit.eventType}
                    onChange={(e) =>
                      setEventEdit({ ...eventEdit, eventType: e.target.value })
                    }
                  >
                    <option value="CLOCK_IN">Clock In</option>
                    <option value="CLOCK_OUT">Clock Out</option>
                  </select>
                </div>
                <div className="field">
                  <label>Date & time</label>
                  <input
                    required
                    type="datetime-local"
                    value={eventEdit.eventTime}
                    onChange={(e) =>
                      setEventEdit({ ...eventEdit, eventTime: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label>Correction note</label>
                <input
                  required
                  value={eventEdit.note}
                  onChange={(e) =>
                    setEventEdit({ ...eventEdit, note: e.target.value })
                  }
                />
              </div>
              <div className="modalActions">
                <button
                  type="button"
                  className="btn btnSoft"
                  onClick={() => setEventEdit(null)}
                >
                  CANCEL
                </button>
                <button className="btn btnPrimary">
                  <Save />
                  SAVE CORRECTION
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {create && (
        <div className="modalShade">
          <div className="luxModal staffCreator">
            <form onSubmit={createStaff}>
              <div className="modalHead">
                <div>
                  <small>NEW EMPLOYEE ACCOUNT</small>
                  <h3>Add Staff</h3>
                  <p>Create login, role and working schedule together.</p>
                </div>
                <button type="button" onClick={() => setCreate(null)}>
                  <X />
                </button>
              </div>
              <div className="formGrid">
                <div className="field">
                  <label>Full Name</label>
                  <input
                    required
                    value={create.name}
                    onChange={(e) =>
                      setCreate({ ...create, name: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Job Title</label>
                  <input
                    value={create.jobTitle}
                    onChange={(e) =>
                      setCreate({ ...create, jobTitle: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Username</label>
                  <input
                    required
                    value={create.username}
                    onChange={(e) =>
                      setCreate({ ...create, username: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Temporary Password (8+ characters)</label>
                  <input
                    required
                    minLength="8"
                    type="password"
                    value={create.password}
                    onChange={(e) =>
                      setCreate({ ...create, password: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={create.email}
                    onChange={(e) =>
                      setCreate({ ...create, email: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input
                    value={create.phone}
                    onChange={(e) =>
                      setCreate({ ...create, phone: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Employee Code</label>
                  <input
                    value={create.employeeCode}
                    onChange={(e) =>
                      setCreate({ ...create, employeeCode: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Committed Hours / Week</label>
                  <input
                    type="number"
                    value={create.committedHours}
                    onChange={(e) =>
                      setCreate({ ...create, committedHours: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Shift Start</label>
                  <input
                    type="time"
                    value={create.shiftStart}
                    onChange={(e) =>
                      setCreate({ ...create, shiftStart: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Shift End</label>
                  <input
                    type="time"
                    value={create.shiftEnd}
                    onChange={(e) =>
                      setCreate({ ...create, shiftEnd: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Grace Minutes</label>
                  <input
                    type="number"
                    value={create.graceMinutes}
                    onChange={(e) =>
                      setCreate({ ...create, graceMinutes: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="modalActions">
                <button
                  type="button"
                  className="btn btnSoft"
                  onClick={() => setCreate(null)}
                >
                  CANCEL
                </button>
                <button className="btn btnPrimary">
                  <PlusCircle /> CREATE STAFF ACCOUNT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {edit && (
        <div className="modalShade">
          <div className="luxModal">
            <form onSubmit={save}>
              <div className="modalHead">
                <div>
                  <small>EMPLOYEE SCHEDULE</small>
                  <h3>Shift & overtime rules</h3>
                </div>
                <button type="button" onClick={() => setEdit(null)}>
                  <X />
                </button>
              </div>
              <div className="formGrid">
                <div className="field">
                  <label>Employee Code</label>
                  <input
                    value={edit.employeeCode}
                    onChange={(e) =>
                      setEdit({ ...edit, employeeCode: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Job Title</label>
                  <input
                    value={edit.jobTitle}
                    onChange={(e) =>
                      setEdit({ ...edit, jobTitle: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input
                    value={edit.phone}
                    onChange={(e) =>
                      setEdit({ ...edit, phone: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Committed Hours / Week</label>
                  <input
                    type="number"
                    value={edit.committedHours}
                    onChange={(e) =>
                      setEdit({ ...edit, committedHours: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Work Days (1=Monday)</label>
                  <input
                    value={edit.workDays}
                    onChange={(e) =>
                      setEdit({ ...edit, workDays: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Shift Start</label>
                  <input
                    type="time"
                    value={edit.shiftStart}
                    onChange={(e) =>
                      setEdit({ ...edit, shiftStart: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Shift End</label>
                  <input
                    type="time"
                    value={edit.shiftEnd}
                    onChange={(e) =>
                      setEdit({ ...edit, shiftEnd: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Grace Minutes</label>
                  <input
                    type="number"
                    value={edit.graceMinutes}
                    onChange={(e) =>
                      setEdit({ ...edit, graceMinutes: e.target.value })
                    }
                  />
                </div>
              </div>
              <label className="activeToggle">
                <input
                  type="checkbox"
                  checked={edit.overtimeRequiresApproval}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      overtimeRequiresApproval: e.target.checked,
                    })
                  }
                />
                <span />
                <b>Overtime requires manager approval</b>
              </label>
              <div className="modalActions">
                <button
                  type="button"
                  className="btn btnSoft"
                  onClick={() => setEdit(null)}
                >
                  CANCEL
                </button>
                <button className="btn btnPrimary">
                  <Save /> SAVE SCHEDULE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function StaffWorkspace({ user }) {
  const canManage = ["Super Admin", "Manager"].includes(user.role),
    [tab, setTab] = useState(canManage ? "team" : "mine");
  return (
    <div className="staffWorkspace">
      {canManage && (
        <div className="staffWorkspaceTabs">
          <button
            className={tab === "team" ? "active" : ""}
            onClick={() => setTab("team")}
          >
            <Users /> TEAM CONTROL
          </button>
          <button
            className={tab === "mine" ? "active" : ""}
            onClick={() => setTab("mine")}
          >
            <Clock3 /> MY TIME
          </button>
        </div>
      )}
      {tab === "team" && canManage ? (
        <AttendanceAdmin />
      ) : (
        <EmployeePortal user={user} />
      )}
    </div>
  );
}

const CONTROL_PERMISSIONS = [
  ["dashboard", "Dashboard"],
  ["transactions", "New Transaction"],
  ["movements", "Money Movements"],
  ["closing", "Daily Closing"],
  ["bank", "Emirates Islamic"],
  ["transfer", "Iran / Dubai"],
  ["reports", "Reports"],
  ["directory", "Directory"],
  ["attendance", "Staff Attendance"],
];
function ControlLuxury() {
  const [d, setD] = useState(),
    [tab, setTab] = useState("company"),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState(null);
  const load = () =>
    api("/api/settings")
      .then(setD)
      .catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
  }, []);
  if (!d)
    return <>{msg ? <div className="notice error">{msg}</div> : <Loading />}</>;
  const setting = (k, v) => setD({ ...d, settings: { ...d.settings, [k]: v } });
  function logo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
      f.size > 1048576
    ) {
      setMsg("Use a PNG, JPG or WebP logo smaller than 1 MB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => setting("company_logo", String(r.result));
    r.readAsDataURL(f);
  }
  async function saveSettings() {
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "settings", values: d.settings }),
      });
      setMsg("Settings saved successfully.");
      await load();
    } finally {
      setBusy(false);
    }
  }
  function addUser() {
    setEdit({
      id: null,
      username: "",
      name: "",
      email: "",
      role: "Staff",
      active: true,
      password: "",
      permissions: Object.fromEntries(
        CONTROL_PERMISSIONS.map((x) => [x[0], true]),
      ),
    });
  }
  function editUser(u) {
    setEdit({
      id: u.id,
      username: u.username,
      name: u.display_name,
      email: u.email || "",
      role: u.role,
      active: u.active,
      password: "",
      permissions:
        u.permissions ||
        Object.fromEntries(CONTROL_PERMISSIONS.map((x) => [x[0], true])),
    });
  }
  async function saveUser(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "user", ...edit }),
      });
      setEdit(null);
      setMsg("User and permissions saved.");
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function saveBank() {
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "bank",
          id: d.bank.id,
          name: d.bank.name,
          opening: d.bank.opening_balance,
          notes: d.bank.notes,
        }),
      });
      setMsg("Bank settings saved.");
      await load();
    } finally {
      setBusy(false);
    }
  }
  const tabs = [
    ["company", "Company", Settings],
    ["security", "Recovery", ShieldCheck],
    ["users", "Users & Access", Users],
    ["bank", "Bank Account", Landmark],
  ];
  return (
    <>
      <PageHead
        title="Control Center"
        sub="Secure company, recovery, user and permission management."
      />
      <div className="controlHero">
        <div>
          <small>SUPER ADMIN · SECURE CONFIGURATION</small>
          <h3>Northfield Control Center</h3>
          <p>Manage every user, menu permission and recovery destination.</p>
        </div>
        <ShieldCheck />
      </div>
      <div className="controlTabs">
        {tabs.map(([k, l, I]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            <I />
            <span>{l}</span>
          </button>
        ))}
      </div>
      {msg && <div className="notice controlNotice">{msg}</div>}
      {tab === "company" && (
        <div className="card controlPanel">
          <div className="controlPanelHead">
            <div>
              <small>COMPANY IDENTITY</small>
              <h3>Business profile</h3>
            </div>
            <Settings />
          </div>
          <div className="formGrid">
            {[
              ["company_name", "Company Name"],
              ["company_address", "Registered Address"],
              ["company_email", "Company Email"],
              ["company_phone", "Company Phone"],
            ].map(([k, l]) => (
              <div className="field" key={k}>
                <label>{l}</label>
                <input
                  value={d.settings[k] || ""}
                  onChange={(e) => setting(k, e.target.value)}
                />
              </div>
            ))}
            <div className="heroSettings full">
              <div>
                <small>DASHBOARD WELCOME</small>
                <h4>Hero messages</h4>
                <p>
                  Use <b>{"{name}"}</b> inside the greeting to show the
                  signed-in user automatically.
                </p>
              </div>
              <div className="formGrid">
                <div className="field full">
                  <label>Welcome Greeting</label>
                  <input
                    placeholder="Good to see you, {name}"
                    value={d.settings.hero_greeting || ""}
                    onChange={(e) => setting("hero_greeting", e.target.value)}
                  />
                </div>
                <div className="field full">
                  <label>Welcome Subtitle</label>
                  <input
                    placeholder="One elegant command center..."
                    value={d.settings.hero_subtitle || ""}
                    onChange={(e) => setting("hero_subtitle", e.target.value)}
                  />
                </div>
                {[
                  ["hero_badge_one", "First Badge · Live sync"],
                  ["hero_badge_two", "Second Badge · Secure workspace"],
                  ["hero_badge_three", "Third Badge · Executive view"],
                ].map(([k, l]) => (
                  <div className="field" key={k}>
                    <label>{l}</label>
                    <input
                      value={d.settings[k] || ""}
                      onChange={(e) => setting(k, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="field full">
              <label>Company Logo · max 1 MB</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={logo}
              />
              {d.settings.company_logo && (
                <div className="brandPreview">
                  <img src={d.settings.company_logo} />
                  <button
                    className="btn btnSoft"
                    onClick={() => setting("company_logo", "")}
                  >
                    REMOVE
                  </button>
                </div>
              )}
            </div>
            <div className="field full">
              <label>Dashboard Messages</label>
              <textarea
                rows="6"
                value={d.settings.daily_messages || ""}
                onChange={(e) => setting("daily_messages", e.target.value)}
              />
            </div>
          </div>
          <button
            disabled={busy}
            className="controlSave"
            onClick={saveSettings}
          >
            <Save />
            {busy ? "SAVING…" : "SAVE COMPANY PROFILE"}
          </button>
        </div>
      )}
      {tab === "security" && (
        <div className="card controlPanel">
          <div className="controlPanelHead">
            <div>
              <small>PASSWORD RECOVERY</small>
              <h3>Security inbox</h3>
              <p>The next Super Admin OTP will go to this email.</p>
            </div>
            <ShieldCheck />
          </div>
          <div className="securityCallout">
            <ShieldCheck />
            <div>
              <b>Forgot Password & Reset Password</b>
              <span>
                Changing this email immediately changes the destination of the
                next verification code.
              </span>
            </div>
          </div>
          <div className="field recoveryField">
            <label>Super Admin Recovery Email</label>
            <input
              type="email"
              value={d.settings.recovery_email || ""}
              onChange={(e) => setting("recovery_email", e.target.value)}
            />
            <small>Use an inbox controlled only by the company owner.</small>
          </div>
          <button
            disabled={busy}
            className="controlSave"
            onClick={saveSettings}
          >
            <Save />
            UPDATE RECOVERY EMAIL
          </button>
        </div>
      )}
      {tab === "users" && (
        <div className="card controlPanel">
          <div className="controlPanelHead">
            <div>
              <small>IDENTITY & ACCESS</small>
              <h3>Users and permissions</h3>
            </div>
            <button className="controlAddUser" onClick={addUser}>
              <PlusCircle /> ADD USER
            </button>
          </div>
          <div className="userAdminGrid">
            {d.users.map((u) => (
              <article className="userAdminCard" key={u.id}>
                <div className="userAvatar">
                  {String(u.display_name || u.username)[0].toUpperCase()}
                </div>
                <div className="userIdentity">
                  <b>{u.display_name}</b>
                  <span>@{u.username}</span>
                  <small>{u.email || "No recovery email"}</small>
                </div>
                <span
                  className={`userState ${u.active ? "active" : "inactive"}`}
                >
                  <i />
                  {u.active ? "ACTIVE" : "INACTIVE"}
                </span>
                <div className="userRole">{u.role}</div>
                <div className="permissionMini">
                  {u.role === "Super Admin" ? (
                    <span>Full system access</span>
                  ) : (
                    CONTROL_PERMISSIONS.filter(
                      (x) => u.permissions?.[x[0]] !== false,
                    )
                      .slice(0, 4)
                      .map((x) => <span key={x[0]}>{x[1]}</span>)
                  )}
                </div>
                <button className="editUserButton" onClick={() => editUser(u)}>
                  <Pencil /> MANAGE USER
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      {tab === "bank" && (
        <div className="card controlPanel">
          <div className="controlPanelHead">
            <div>
              <small>FINANCIAL ACCOUNT</small>
              <h3>Primary bank configuration</h3>
            </div>
            <Landmark />
          </div>
          {d.bank ? (
            <div className="formGrid">
              <div className="field">
                <label>Account Name</label>
                <input
                  value={d.bank.name || ""}
                  onChange={(e) =>
                    setD({ ...d, bank: { ...d.bank, name: e.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label>Opening Balance AED</label>
                <input
                  type="number"
                  step=".01"
                  value={d.bank.opening_balance || 0}
                  onChange={(e) =>
                    setD({
                      ...d,
                      bank: { ...d.bank, opening_balance: e.target.value },
                    })
                  }
                />
              </div>
              <div className="field full">
                <label>Internal Notes</label>
                <textarea
                  value={d.bank.notes || ""}
                  onChange={(e) =>
                    setD({ ...d, bank: { ...d.bank, notes: e.target.value } })
                  }
                />
              </div>
              <button className="controlSave" onClick={saveBank}>
                <Save />
                SAVE BANK SETTINGS
              </button>
            </div>
          ) : (
            <div className="notice">No bank account configured.</div>
          )}
        </div>
      )}
      {edit && (
        <div className="modalShade">
          <div className="luxModal userEditor">
            <form onSubmit={saveUser}>
              <div className="modalHead">
                <div>
                  <small>USER ACCESS PROFILE</small>
                  <h3>{edit.id ? "Manage User" : "Create New User"}</h3>
                </div>
                <button type="button" onClick={() => setEdit(null)}>
                  <X />
                </button>
              </div>
              <div className="formGrid userFields">
                <div className="field">
                  <label>Username</label>
                  <input
                    required
                    value={edit.username}
                    onChange={(e) =>
                      setEdit({ ...edit, username: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Display Name</label>
                  <input
                    required
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Recovery Email</label>
                  <input
                    type="email"
                    value={edit.email}
                    onChange={(e) =>
                      setEdit({ ...edit, email: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Role</label>
                  <select
                    value={edit.role}
                    onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                  >
                    {["Super Admin", "Manager", "Staff", "Viewer"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>
                    {edit.id
                      ? "New Password · blank keeps current"
                      : "Password"}
                  </label>
                  <input
                    type="password"
                    required={!edit.id}
                    minLength="8"
                    value={edit.password}
                    onChange={(e) =>
                      setEdit({ ...edit, password: e.target.value })
                    }
                  />
                </div>
                <label className="activeToggle">
                  <input
                    type="checkbox"
                    checked={edit.active}
                    onChange={(e) =>
                      setEdit({ ...edit, active: e.target.checked })
                    }
                  />
                  <span />
                  <b>Account active</b>
                </label>
              </div>
              <div className="permissionTitle">
                <div>
                  <small>MENU PERMISSIONS</small>
                  <h4>Allowed workspaces</h4>
                </div>
                <span>
                  {edit.role === "Super Admin"
                    ? "FULL ACCESS"
                    : "CUSTOM ACCESS"}
                </span>
              </div>
              <div
                className={`permissionGrid ${edit.role === "Super Admin" ? "locked" : ""}`}
              >
                {CONTROL_PERMISSIONS.map(([k, l]) => (
                  <label key={k}>
                    <span>
                      <b>{l}</b>
                      <small>Allow access to this workspace</small>
                    </span>
                    <input
                      type="checkbox"
                      disabled={edit.role === "Super Admin"}
                      checked={
                        edit.role === "Super Admin" ||
                        edit.permissions[k] !== false
                      }
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          permissions: {
                            ...edit.permissions,
                            [k]: e.target.checked,
                          },
                        })
                      }
                    />
                    <i />
                  </label>
                ))}
              </div>
              <div className="modalActions">
                <button
                  type="button"
                  className="btn btnSoft"
                  onClick={() => setEdit(null)}
                >
                  CANCEL
                </button>
                <button disabled={busy} className="btn btnPrimary">
                  <Save />
                  {busy ? "SAVING…" : "SAVE USER & ACCESS"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
const ITEMS = [
  ["Dashboard", LayoutDashboard, "dashboard"],
  ["New Transaction", PlusCircle, "transactions"],
  ["Money Movements", ArrowLeftRight, "movements"],
  ["Daily Closing", CheckCircle2, "closing"],
  ["Emirates Islamic", Landmark, "bank"],
  ["Iran / Dubai", Globe2, "transfer"],
  ["Staff", Users, "attendance"],
  ["Reports", FileText, "reports"],
  ["Directory", Users, "directory"],
  ["Control Center", Settings, "control"],
];
function MobileBottomNav({ page, setPage, setOpen, items }) {
  const labels = {
      Dashboard: "Home",
      Staff: "Staff",
      "New Transaction": "Add",
      "Money Movements": "Activity",
      Reports: "Reports",
    },
    links = items.filter((x) => labels[x[0]]).slice(0, 4);
  return (
    <nav
      className="mobileBottomNav"
      style={{
        gridTemplateColumns: `repeat(${Math.min(links.length + 1, 5)}, 1fr)`,
      }}
    >
      {links.map(([name, Icon]) => (
        <button
          key={name}
          className={page === name ? "active" : ""}
          onClick={() => {
            setPage(name);
            setOpen(false);
          }}
        >
          <span>
            <Icon size={19} />
          </span>
          <small>{labels[name]}</small>
        </button>
      ))}
      <button onClick={() => setOpen(true)}>
        <span>
          <Menu size={19} />
        </span>
        <small>More</small>
      </button>
    </nav>
  );
}
export default function NorthfieldApp({ user }) {
  const [page, setPage] = useState(""),
    [access, setAccess] = useState(null),
    [open, setOpen] = useState(false),
    [theme, setTheme] = useState("light"),
    [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("northfield-theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
    setCollapsed(localStorage.getItem("northfield-sidebar") === "collapsed");
    api("/api/access").then((x) => setAccess(x.access));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("northfield-theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem(
      "northfield-sidebar",
      collapsed ? "collapsed" : "open",
    );
  }, [collapsed]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  const allowed = access
    ? ITEMS.filter(([, , key]) =>
        key === "control"
          ? user.role === "Super Admin"
          : key === "attendance"
            ? access.attendance
            : access[key],
      )
    : [];
  useEffect(() => {
    if (allowed.length && !allowed.some((x) => x[0] === page))
      setPage(
        user.role === "Staff" && allowed.some((x) => x[0] === "Staff")
          ? "Staff"
          : allowed[0][0],
      );
  }, [access, page]);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }
  if (!access || !page)
    return (
      <main className="app">
        <Loading />
      </main>
    );
  let body =
    page === "Dashboard" ? (
      <Dashboard user={user} />
    ) : page === "Staff" ? (
      <StaffWorkspace user={user} />
    ) : page === "New Transaction" ? (
      <TransactionPage />
    ) : page === "Money Movements" ? (
      <Movements />
    ) : page === "Daily Closing" ? (
      <DailyClose />
    ) : page === "Emirates Islamic" ? (
      <Bank />
    ) : page === "Iran / Dubai" ? (
      <IranDubai />
    ) : page === "Reports" ? (
      <ReportsV2 />
    ) : page === "Directory" ? (
      <Directory />
    ) : (
      <ControlLuxury />
    );
  return (
    <main
      className={`app ${collapsed ? "sidebarCollapsed" : ""} ${open ? "mobileMenuOpen" : ""}`}
    >
      <NotificationHub />
      {open && (
        <button
          className="mobileBackdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <button
        className="mobileMenu btn btnPrimary"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      <aside
        className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
      >
        <div className="brand">
          <CompanyBrand />
          <div>
            <b>NORTHFIELD</b>
            <small>
              {user.role === "Staff"
                ? "EMPLOYEE TIME PORTAL"
                : "FINANCIAL CONTROL SUITE"}
            </small>
          </div>
        </div>
        <div className="workspaceLabel">
          {user.role === "Staff" ? "MY WORKSPACE" : "WORKSPACE"}
        </div>
        <nav className="nav">
          {allowed.map(([name, Icon]) => (
            <button
              key={name}
              title={collapsed ? name : undefined}
              className={page === name ? "active" : ""}
              onClick={() => {
                setPage(name);
                setOpen(false);
              }}
            >
              <span className="navIcon">
                <Icon size={17} />
              </span>
              <span className="navText">{name}</span>
              {page === name && <i className="activeDot" />}
            </button>
          ))}
        </nav>
        <div className="sidebarFooter">
          <div className="secureStatus">
            <span>
              <i />
              Connected
            </span>
            <small>Northfield secure cloud</small>
          </div>
          <InstallApp />
          <button className="btn btnSoft signOutButton" onClick={logout}>
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <section className="content">
        <TopBar
          page={page}
          user={user}
          theme={theme}
          setTheme={setTheme}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
        <div className="pageCanvas">{body}</div>
      </section>
      <MobileBottomNav
        page={page}
        setPage={setPage}
        setOpen={setOpen}
        items={allowed}
      />
    </main>
  );
}
