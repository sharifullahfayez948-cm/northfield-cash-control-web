"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Download,
  MapPin,
  CreditCard,
} from "lucide-react";
import FayezSignature from "@/components/FayezSignature";
import CreditCardCenter from "@/components/CreditCardCenter";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CompanyBrand from "@/components/CompanyBrand";
import {
  aed,
  createLuxuryReport,
  dayLabel,
  loadBrand,
  longDayLabel,
  signed,
  timeLabel,
} from "@/lib/luxuryPdf";

const dayStatusCell = (status, C) => ({
  content: status === "FINALIZED" ? "CLOSED" : "OPEN",
  styles: {
    halign: "center",
    fontStyle: "bold",
    textColor: status === "FINALIZED" ? C.GREEN : C.GOLD,
  },
});

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
    ["cash_in", "cash_out", "balance", "opening_cash", "opening", "closing", "expected", "variance"].includes(key)
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
  if (key === "finalized_at" && value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()))
      return date.toLocaleString("en-GB", {
        timeZone: "Asia/Dubai",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
  }
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
  const seedDate = String(days[0]?.business_day || today()).slice(0, 10),
    [chartYear, chartMonth] = seedDate.split("-").map(Number),
    monthLength = new Date(Date.UTC(chartYear, chartMonth, 0)).getUTCDate(),
    sourceByDay = new Map(
      days.map((item) => [
        Number(String(item.business_day).slice(8, 10)),
        item,
      ]),
    ),
    plotDays = Array.from({ length: monthLength }, (_, index) => {
      const day = index + 1,
        original = sourceByDay.get(day),
        businessDay = `${chartYear}-${String(chartMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return {
        business_day: businessDay,
        label: String(day).padStart(2, "0"),
        weekday:
          original?.weekday ||
          new Date(`${businessDay}T12:00:00Z`).toLocaleDateString("en-GB", {
            weekday: "short",
            timeZone: "UTC",
          }),
        cash_in: Number(original?.cash_in || 0),
        cash_out: Number(original?.cash_out || 0),
      };
    }),
    incoming = plotDays.map((x) => Number(x.cash_in || 0)),
    outgoing = plotDays.map((x) => Number(x.cash_out || 0)),
    max = Math.max(...incoming, ...outgoing, 1),
    left = 32,
    right = 744,
    bottom = 202,
    top = 35,
    step = (right - left) / (plotDays.length - 1);
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
  const showLabel = (i) => i === 0 || i === plotDays.length - 1 || i % 3 === 0,
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
        <line x1={left} x2={left} y1={top} y2={bottom} className="chartSweep" />
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
        <circle className="flowRunner" r="4.5">
          <animateMotion
            dur="3.2s"
            repeatCount="indefinite"
            path={path(inPts)}
          />
        </circle>
        <path
          pathLength="1"
          d={path(outPts)}
          className="cashLine out chartLineDraw chartLineDelay"
        />
        {inPts.map((p, i) => (
          <g key={`i${i}`}>
            {i === plotDays.length - 1 && (
              <circle cx={p.x} cy={p.y} r="8" className="latestPointPulse" />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={i === plotDays.length - 1 ? 5 : 3.3}
              className="chartDot in chartDotReveal"
              style={{ animationDelay: `${620 + i * 45}ms` }}
            >
              <title>
                {plotDays[i].weekday}, {plotDays[i].business_day} · Cash In:{" "}
                {money(p.v)}
              </title>
            </circle>
          </g>
        ))}
        {outPts.map((p, i) => (
          <circle
            key={`o${i}`}
            cx={p.x}
            cy={p.y}
            r={i === plotDays.length - 1 ? 4.5 : 3}
            className="chartDot out chartDotReveal"
            style={{ animationDelay: `${760 + i * 45}ms` }}
          >
            <title>
              {plotDays[i].weekday}, {plotDays[i].business_day} · Cash Out:{" "}
              {money(p.v)}
            </title>
          </circle>
        ))}
        {plotDays.map(
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
    inShare = total ? (Number(s.cashIn) / total) * 100 : 0;
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
          <div className="movementRing" aria-label="Today cash movement">
            <svg viewBox="0 0 120 120" role="img">
              <defs>
                <linearGradient
                  id="movementInGradient"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0" stopColor="#52e0c3" />
                  <stop offset="1" stopColor="#159f91" />
                </linearGradient>
                <linearGradient
                  id="movementOutGradient"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0" stopColor="#ffbd83" />
                  <stop offset="1" stopColor="#ee7e55" />
                </linearGradient>
              </defs>
              <circle
                className="movementTrack"
                cx="60"
                cy="60"
                r="46"
                pathLength="100"
              />
              {total > 0 && (
                <>
                  <circle
                    className="movementArc out"
                    cx="60"
                    cy="60"
                    r="46"
                    pathLength="100"
                  />
                  <circle
                    className="movementArc in"
                    cx="60"
                    cy="60"
                    r="46"
                    pathLength="100"
                    strokeDasharray={`${inShare} ${100 - inShare}`}
                  />
                </>
              )}
            </svg>
            <div>
              <small>TOTAL FLOW</small>
              <b>{money(total)}</b>
              <span>
                {total ? `${Math.round(inShare)}% cash in` : "No movement"}
              </span>
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
// Local calendar date (YYYY-MM-DD). toISOString() would shift to UTC and,
// in Dubai, turn the 1st of the month into the last day of the previous one.
const localYmd = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const REPORT_PERIODS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["thisWeek", "This Week"],
  ["lastWeek", "Last Week"],
  ["thisMonth", "This Month"],
  ["lastMonth", "Last Month"],
  ["thisYear", "This Year"],
  ["custom", "Custom"],
];
function reportRange(key) {
  const now = new Date(),
    y = now.getFullYear(),
    m = now.getMonth(),
    day = now.getDate(),
    D = (yy, mm, dd) => localYmd(new Date(yy, mm, dd)),
    monday = day - ((now.getDay() + 6) % 7);
  switch (key) {
    case "today":
      return [D(y, m, day), D(y, m, day)];
    case "yesterday":
      return [D(y, m, day - 1), D(y, m, day - 1)];
    case "thisWeek":
      return [D(y, m, monday), D(y, m, day)];
    case "lastWeek":
      return [D(y, m, monday - 7), D(y, m, monday - 1)];
    case "lastMonth":
      return [D(y, m - 1, 1), D(y, m, 0)];
    case "thisYear":
      return [D(y, 0, 1), D(y, m, day)];
    default:
      return [D(y, m, 1), D(y, m, day)];
  }
}
function ReportsV2() {
  const [scope, setScope] = useState("cash"),
    [period, setPeriod] = useState("thisMonth"),
    [from, setFrom] = useState(() => reportRange("thisMonth")[0]),
    [to, setTo] = useState(() => reportRange("thisMonth")[1]),
    [d, setD] = useState(),
    [busy, setBusy] = useState(false);
  const periodLabel =
    period === "custom"
      ? "Custom Period"
      : REPORT_PERIODS.find((p) => p[0] === period)?.[1] || "Period";
  const names = {
    cash: "Cash Transactions",
    closing: "Daily Closing",
    bank: "Emirates Islamic",
    transfer: "Iran / Dubai",
  };
  const loadSeq = useRef(0);
  async function load(nextScope = scope, nextFrom = from, nextTo = to) {
    const seq = ++loadSeq.current;
    setBusy(true);
    try {
      const res = await api(
        `/api/reports?scope=${nextScope}&from=${nextFrom}&to=${nextTo}`,
      );
      // ignore answers from an older request that finished late
      if (seq === loadSeq.current) setD(res);
    } finally {
      if (seq === loadSeq.current) setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function choosePeriod(p) {
    setPeriod(p);
    if (p === "custom") return;
    const [a, b] = reportRange(p);
    setFrom(a);
    setTo(b);
    load(scope, a, b);
  }
  function chooseScope(s) {
    setScope(s);
    load(s, from, to);
  }
  function changeDate(which, value) {
    if (!value) return;
    let a = which === "from" ? value : from,
      b = which === "to" ? value : to;
    // keep the range valid: moving one end past the other moves both
    if (a > b) {
      if (which === "from") b = a;
      else a = b;
    }
    setPeriod("custom");
    setFrom(a);
    setTo(b);
    load(scope, a, b);
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
    if (scope === "cash" && d.days)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          d.days.map((x, i) => ({
            DATE: x.date,
            "DAY STATUS": x.status === "FINALIZED" ? "CLOSED" : "OPEN",
            OPENING: x.opening,
            "CASH IN": x.cash_in,
            "CASH OUT": x.cash_out,
            EXPECTED: x.expected,
            COUNTED: x.counted ?? "",
            VARIANCE: x.variance,
            CLOSING: x.closing,
            "CARRIED TO": d.days[i + 1]?.date || "",
          })),
        ),
        "Daily Cash",
      );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(d.entries),
      names[scope].slice(0, 31),
    );
    XLSX.writeFile(wb, `Northfield_${scope}_${period}_${from}_${to}.xlsx`);
    pushToast("Professional Excel workbook downloaded successfully.");
  }
  // ---------- Cash Control: day-by-day carry-forward ----------
  async function cashDailyPdf(brand) {
    const r = createLuxuryReport({
      brand,
      title: "DAILY CASH REPORT",
      subtitle: "OPENING  ·  MOVEMENTS  ·  CLOSING",
      from,
      to,
    });
    const { C } = r;
    const days = d.days || [],
      s = d.summary || {};
    const byDay = {};
    for (const e of d.entries) (byDay[String(e.date).slice(0, 10)] ||= []).push(e);

    let y = r.cards([
      { label: "OPENING CASH", value: money(s.opening_cash), color: C.NAVY2, note: `Start of ${dayLabel(days[0]?.date || from)}` },
      { label: "TOTAL CASH IN", value: money(s.total_in), color: C.GREEN, note: "All posted receipts" },
      { label: "TOTAL CASH OUT", value: money(s.total_out), color: C.RED, note: "All posted payments" },
      { label: "CLOSING CASH", value: money(s.running_cash), color: C.GOLD, note: "Carried forward" },
    ]);
    y = r.heading(
      "DAY-BY-DAY CASH FLOW",
      "Each day opens with the cash carried forward from the previous day.",
      y + 10,
    );
    r.table({
      startY: y,
      head: [["DATE", "DAY STATUS", "OPENING", "CASH IN", "CASH OUT", "CLOSING", "CARRIED TO"]],
      body: days.map((x, i) => [
        { content: dayLabel(x.date), styles: { fontStyle: "bold", textColor: C.NAVY } },
        dayStatusCell(x.status, C),
        { content: aed(x.opening), styles: { halign: "right" } },
        { content: signed(x.cash_in, "+"), styles: { halign: "right", textColor: C.GREEN, fontStyle: "bold" } },
        { content: signed(x.cash_out, "-"), styles: { halign: "right", textColor: C.RED, fontStyle: "bold" } },
        { content: aed(x.closing), styles: { halign: "right", fontStyle: "bold", textColor: x.closing < 0 ? C.RED : C.NAVY, fillColor: C.GOLD_SOFT } },
        { content: days[i + 1] ? `to ${dayLabel(days[i + 1].date)}` : "next day", styles: { textColor: C.MUTED, halign: "center" } },
      ]),
      foot: [[
        { content: `${days.length} BUSINESS DAYS`, colSpan: 2 },
        { content: aed(s.opening_cash), styles: { halign: "right" } },
        { content: `+ ${aed(s.total_in)}`, styles: { halign: "right" } },
        { content: `- ${aed(s.total_out)}`, styles: { halign: "right" } },
        { content: aed(s.running_cash), styles: { halign: "right" } },
        "",
      ]],
    });

    r.newPage();
    const N = 9,
      body = [];
    days.forEach((day, i) => {
      const prev = days[i - 1],
        next = days[i + 1],
        list = byDay[day.date] || [];
      body.push([{
        content: `${longDayLabel(day.date)}     ·     DAY ${day.status === "FINALIZED" ? "CLOSED" : "OPEN"}`,
        colSpan: N,
        styles: { fillColor: C.NAVY, textColor: C.WHITE, fontStyle: "bold", fontSize: r.P ? 8.6 : 10, cellPadding: { top: 3.2, bottom: 3.2, left: 4, right: 4 } },
      }]);
      body.push([
        { content: `OPENING CASH${prev ? `   (brought forward from ${dayLabel(prev.date)})` : ""}`, colSpan: 8, styles: { fillColor: C.BLUE_SOFT, fontStyle: "bold", textColor: C.NAVY2 } },
        { content: aed(day.opening), styles: { fillColor: C.BLUE_SOFT, fontStyle: "bold", halign: "right", textColor: C.NAVY2 } },
      ]);
      let bal = day.opening;
      for (const e of list) {
        const posted = e.status === "POSTED",
          isIn = e.type === "IN";
        if (posted) bal += isIn ? Number(e.amount) : -Number(e.amount);
        const dim = posted ? {} : { textColor: [170, 170, 170], fontStyle: "italic" };
        body.push([
          { content: timeLabel(e.time), styles: { textColor: C.MUTED, ...dim } },
          { content: posted ? e.type : `${e.type} · ${e.status}`, styles: { fontStyle: "bold", halign: "center", textColor: isIn ? C.GREEN : C.RED, ...dim } },
          { content: e.category || "", styles: dim },
          { content: e.counterparty || "", styles: dim },
          { content: e.description || "", styles: dim },
          { content: e.reference || "", styles: { textColor: C.MUTED, ...dim } },
          { content: isIn ? aed(e.amount) : "", styles: { halign: "right", textColor: C.GREEN, fontStyle: "bold", ...dim } },
          { content: isIn ? "" : aed(e.amount), styles: { halign: "right", textColor: C.RED, fontStyle: "bold", ...dim } },
          { content: aed(Math.round(bal * 100) / 100), styles: { halign: "right", textColor: bal < 0 ? C.RED : C.NAVY, fillColor: C.ZEBRA, ...dim } },
        ]);
      }
      if (!list.length)
        body.push([{ content: "No cash movements recorded on this day.", colSpan: N, styles: { textColor: C.MUTED, fontStyle: "italic", halign: "center" } }]);
      body.push([
        { content: "DAY TOTAL", colSpan: 6, styles: { fontStyle: "bold", halign: "right", textColor: C.NAVY } },
        { content: `+ ${aed(day.cash_in)}`, styles: { halign: "right", fontStyle: "bold", textColor: C.GREEN } },
        { content: `- ${aed(day.cash_out)}`, styles: { halign: "right", fontStyle: "bold", textColor: C.RED } },
        "",
      ]);
      if (day.counted != null && Math.abs(day.variance) >= 0.01)
        body.push([{
          content: `EXPECTED ${aed(day.expected)}   ·   COUNTED ${aed(day.counted)}   ·   VARIANCE ${day.variance > 0 ? "+" : ""}${aed(day.variance)}`,
          colSpan: N,
          styles: { halign: "right", fontStyle: "bold", textColor: day.variance < 0 ? C.RED : C.GREEN },
        }]);
      body.push([
        { content: `CLOSING CASH   ·   carried forward to ${next ? dayLabel(next.date) : "the next business day"}`, colSpan: 8, styles: { fillColor: C.GOLD_SOFT, fontStyle: "bold", fontSize: r.P ? 8 : 9.4, textColor: C.GOLD_DARK } },
        { content: money(day.closing), styles: { fillColor: C.GOLD_SOFT, fontStyle: "bold", fontSize: r.P ? 8 : 9.4, halign: "right", textColor: day.closing < 0 ? C.RED : C.GOLD_DARK } },
      ]);
      if (next) body.push([{ content: "", colSpan: N, styles: { minCellHeight: 5, lineWidth: 0, fillColor: false } }]);
    });
    const widths = [17, 12, 23, 21, null, 18, 20, 20, 24];
    r.table({
      startY: 42,
      head: [["TIME", "TYPE", "CATEGORY", "PARTY", "DESCRIPTION", "REF.", "CASH IN", "CASH OUT", "BALANCE"]],
      body,
      alternateRowStyles: {},
      columnStyles: Object.fromEntries(widths.map((w, i) => [i, w ? { cellWidth: w } : {}])),
    });
    r.signatures();
    r.save(`Northfield_daily_cash_${from}_${to}.pdf`);
  }

  // ---------- Daily Closing ----------
  async function closingPdf(brand) {
    const r = createLuxuryReport({ brand, title: "DAILY CLOSING REPORT", subtitle: "OPENING  ·  EXPECTED  ·  COUNTED", from, to });
    const { C } = r;
    const days = d.entries || [],
      s = d.summary || {};
    let y = r.cards([
      { label: "OPENING CASH", value: money(s.opening_cash), color: C.NAVY2, note: `Start of ${dayLabel(days[0]?.date || from)}` },
      { label: "TOTAL CASH IN", value: money(s.total_in), color: C.GREEN, note: "All posted receipts" },
      { label: "TOTAL CASH OUT", value: money(s.total_out), color: C.RED, note: "All posted payments" },
      { label: "FINAL CASH", value: money(s.final_cash), color: C.GOLD, note: "Carried forward" },
    ]);
    const tv = Number(s.total_variance || 0);
    y = r.cards(
      [
        { label: "BUSINESS DAYS", value: String(s.day_count || 0), color: C.NAVY2, note: "Days with activity" },
        { label: "DAYS CLOSED", value: `${s.finalized_count || 0} / ${s.day_count || 0}`, color: C.GREEN, note: "Counted and finalized" },
        { label: "TOTAL VARIANCE", value: money(tv), color: tv < 0 ? C.RED : C.GREEN, note: "Counted minus expected" },
      ],
      y + 4,
    );
    y = r.heading("DAY-BY-DAY CLOSING", "Each day opens with the previous day's closing cash.", y + 10);
    const body = [];
    days.forEach((x, i) => {
      const fin = x.status === "FINALIZED";
      body.push([
        { content: dayLabel(x.date), styles: { fontStyle: "bold", textColor: C.NAVY } },
        dayStatusCell(x.status, C),
        { content: aed(x.opening), styles: { halign: "right" } },
        { content: signed(x.cash_in, "+"), styles: { halign: "right", textColor: C.GREEN, fontStyle: "bold" } },
        { content: signed(x.cash_out, "-"), styles: { halign: "right", textColor: C.RED, fontStyle: "bold" } },
        { content: aed(x.expected), styles: { halign: "right" } },
        { content: fin ? aed(x.counted) : "—", styles: { halign: "right", fontStyle: "bold", textColor: fin ? C.NAVY : C.MUTED } },
        { content: fin ? `${x.variance > 0 ? "+" : ""}${aed(x.variance)}` : "—", styles: { halign: "right", fontStyle: "bold", textColor: !fin ? C.MUTED : x.variance < 0 ? C.RED : x.variance > 0 ? C.GREEN : C.NAVY } },
        { content: aed(x.closing), styles: { halign: "right", fontStyle: "bold", textColor: x.closing < 0 ? C.RED : C.NAVY, fillColor: C.GOLD_SOFT } },
      ]);
      if (x.note)
        body.push([{ content: `Manager note: ${x.note}`, colSpan: 9, styles: { fontStyle: "italic", textColor: C.MUTED, fillColor: C.ZEBRA } }]);
    });
    r.table({
      startY: y,
      head: [["DATE", "STATUS", "OPENING", "CASH IN", "CASH OUT", "EXPECTED", "COUNTED", "VARIANCE", "CLOSING"]],
      body,
      foot: [[
        { content: `${days.length} DAYS`, colSpan: 2 },
        { content: aed(s.opening_cash), styles: { halign: "right" } },
        { content: `+ ${aed(s.total_in)}`, styles: { halign: "right" } },
        { content: `- ${aed(s.total_out)}`, styles: { halign: "right" } },
        "",
        "",
        { content: `${tv > 0 ? "+" : ""}${aed(tv)}`, styles: { halign: "right" } },
        { content: aed(s.final_cash), styles: { halign: "right" } },
      ]],
      columnStyles: { 0: { cellWidth: 21 }, 1: { cellWidth: 17 } },
    });
    r.signatures(["CASHIER", "MANAGER", "APPROVED BY"]);
    r.save(`Northfield_daily_closing_${from}_${to}.pdf`);
  }

  // ---------- Emirates Islamic (bank) ----------
  async function bankPdf(brand) {
    const account = d.entries[0]?.account || "Emirates Islamic";
    const r = createLuxuryReport({ brand, title: "BANK STATEMENT REPORT", subtitle: account.toUpperCase(), from, to });
    const { C } = r;
    const s = d.summary || {},
      opening = Number(s.opening_balance || 0);
    let y = r.cards([
      { label: "OPENING BALANCE", value: money(opening), color: C.NAVY2, note: `Start of ${dayLabel(from)}` },
      { label: "MONEY IN", value: money(s.total_in), color: C.GREEN, note: "Deposits and receipts" },
      { label: "MONEY OUT", value: money(s.total_out), color: C.RED, note: "Payments and withdrawals" },
      { label: "CLOSING BALANCE", value: money(s.closing_balance ?? opening + Number(s.balance || 0)), color: C.GOLD, note: `End of ${dayLabel(to)}` },
    ]);
    y = r.heading("ACCOUNT ACTIVITY", "Running balance after every posted entry.", y + 10);
    let bal = opening,
      lastDay = "";
    const body = [[
      { content: "OPENING BALANCE", colSpan: 8, styles: { fillColor: C.BLUE_SOFT, fontStyle: "bold", textColor: C.NAVY2 } },
      { content: aed(opening), styles: { fillColor: C.BLUE_SOFT, fontStyle: "bold", halign: "right", textColor: C.NAVY2 } },
    ]];
    for (const e of d.entries) {
      const posted = e.status === "POSTED",
        isIn = e.type === "IN",
        k = String(e.date).slice(0, 10);
      if (posted) bal += isIn ? Number(e.amount) : -Number(e.amount);
      const dim = posted ? {} : { textColor: [170, 170, 170], fontStyle: "italic" };
      body.push([
        { content: k === lastDay ? "" : dayLabel(k), styles: { fontStyle: "bold", textColor: C.NAVY, ...dim } },
        { content: posted ? e.type : `${e.type} · ${e.status}`, styles: { fontStyle: "bold", halign: "center", textColor: isIn ? C.GREEN : C.RED, ...dim } },
        { content: e.category || "", styles: dim },
        { content: e.counterparty || "", styles: dim },
        { content: e.description || "", styles: dim },
        { content: e.reference || "", styles: { textColor: C.MUTED, ...dim } },
        { content: isIn ? aed(e.amount) : "", styles: { halign: "right", textColor: C.GREEN, fontStyle: "bold", ...dim } },
        { content: isIn ? "" : aed(e.amount), styles: { halign: "right", textColor: C.RED, fontStyle: "bold", ...dim } },
        { content: aed(Math.round(bal * 100) / 100), styles: { halign: "right", textColor: bal < 0 ? C.RED : C.NAVY, fillColor: C.GOLD_SOFT, ...dim } },
      ]);
      lastDay = k;
    }
    if (!d.entries.length)
      body.push([{ content: "No bank activity in this period.", colSpan: 9, styles: { textColor: C.MUTED, fontStyle: "italic", halign: "center" } }]);
    r.table({
      startY: y,
      head: [["DATE", "TYPE", "CATEGORY", "PARTY", "DESCRIPTION", "REF.", "IN", "OUT", "BALANCE"]],
      body,
      foot: [[
        { content: `${d.entries.length} ENTRIES`, colSpan: 6 },
        { content: aed(s.total_in), styles: { halign: "right" } },
        { content: aed(s.total_out), styles: { halign: "right" } },
        { content: aed(Math.round(bal * 100) / 100), styles: { halign: "right" } },
      ]],
      columnStyles: { 0: { cellWidth: 19 }, 1: { cellWidth: 12 }, 2: { cellWidth: 24 }, 3: { cellWidth: 22 }, 5: { cellWidth: 18 }, 6: { cellWidth: 19 }, 7: { cellWidth: 19 }, 8: { cellWidth: 22 } },
    });
    r.signatures();
    r.save(`Northfield_bank_${from}_${to}.pdf`);
  }

  // ---------- Iran / Dubai transfers ----------
  async function transferPdf(brand) {
    const r = createLuxuryReport({ brand, title: "IRAN / DUBAI TRANSFERS", subtitle: "AED  ·  IRR  ·  EXCHANGE RATE", from, to, orientation: "landscape" });
    const { C } = r;
    const s = d.summary || {},
      posted = d.entries.filter((x) => x.status === "POSTED"),
      dirSum = (dir) => posted.filter((x) => x.type === dir).reduce((t, x) => t + Number(x.amount_aed || 0), 0),
      irr = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 }),
      rate = Number(s.total_aed) ? Number(s.total_irr) / Number(s.total_aed) : 0;
    let y = r.cards([
      { label: "TOTAL AED", value: money(s.total_aed), color: C.NAVY2, note: "All posted transfers" },
      { label: "IRAN TO DUBAI", value: money(dirSum("IRAN_TO_DUBAI")), color: C.GREEN, note: "Received in Dubai" },
      { label: "DUBAI TO IRAN", value: money(dirSum("DUBAI_TO_IRAN")), color: C.RED, note: "Sent to Iran" },
      { label: "TOTAL IRR", value: `IRR ${irr(s.total_irr)}`, color: C.GOLD, note: `${s.record_count || 0} records · avg rate ${irr(rate)}` },
    ]);
    y = r.heading("TRANSFER REGISTER", "Every transfer with its exchange rate and parties.", y + 10);
    let lastDay = "";
    const body = d.entries.map((e) => {
      const k = String(e.date).slice(0, 10),
        ok = e.status === "POSTED",
        dim = ok ? {} : { textColor: [170, 170, 170], fontStyle: "italic" },
        toDubai = e.type === "IRAN_TO_DUBAI";
      const row = [
        { content: k === lastDay ? "" : dayLabel(k), styles: { fontStyle: "bold", textColor: C.NAVY, ...dim } },
        { content: toDubai ? "IRAN TO DUBAI" : e.type === "DUBAI_TO_IRAN" ? "DUBAI TO IRAN" : String(e.type || "").replaceAll("_", " "), styles: { fontStyle: "bold", textColor: toDubai ? C.GREEN : C.RED, ...dim } },
        { content: aed(e.amount_aed), styles: { halign: "right", fontStyle: "bold", textColor: C.NAVY, fillColor: C.GOLD_SOFT, ...dim } },
        { content: irr(e.amount_irr), styles: { halign: "right", ...dim } },
        { content: irr(e.exchange_rate), styles: { halign: "right", textColor: C.MUTED, ...dim } },
        { content: e.sender || "", styles: dim },
        { content: e.receiver || "", styles: dim },
        { content: e.channel || "", styles: dim },
        { content: e.reference || "", styles: { textColor: C.MUTED, ...dim } },
        { content: e.description || "", styles: dim },
        { content: e.status || "", styles: { halign: "center", fontStyle: "bold", textColor: ok ? C.GREEN : C.MUTED } },
      ];
      lastDay = k;
      return row;
    });
    if (!body.length)
      body.push([{ content: "No transfers in this period.", colSpan: 11, styles: { textColor: C.MUTED, fontStyle: "italic", halign: "center" } }]);
    r.table({
      startY: y,
      head: [["DATE", "DIRECTION", "AED", "IRR", "RATE", "SENDER", "RECEIVER", "CHANNEL", "REF.", "DESCRIPTION", "STATUS"]],
      body,
      foot: [[
        { content: `${d.entries.length} TRANSFERS`, colSpan: 2 },
        { content: aed(s.total_aed), styles: { halign: "right" } },
        { content: irr(s.total_irr), styles: { halign: "right" } },
        { content: irr(rate), styles: { halign: "right" } },
        { content: "", colSpan: 6 },
      ]],
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 26 }, 2: { cellWidth: 24 }, 3: { cellWidth: 30 }, 4: { cellWidth: 18 }, 10: { cellWidth: 18 } },
    });
    r.signatures();
    r.save(`Northfield_iran_dubai_${from}_${to}.pdf`);
  }

  async function pdf() {
    try {
      const brand = await loadBrand();
      if (scope === "closing") await closingPdf(brand);
      else if (scope === "bank") await bankPdf(brand);
      else if (scope === "transfer") await transferPdf(brand);
      else await cashDailyPdf(brand);
      pushToast("Luxury PDF downloaded successfully.");
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
          : scope === "cash"
            ? [
                ["OPENING CASH", s.opening_cash],
                ["TOTAL IN", s.total_in],
                ["TOTAL OUT", s.total_out],
                ["CLOSING CASH", s.running_cash],
              ]
            : [
                ["TOTAL IN", s.total_in],
                ["TOTAL OUT", s.total_out],
                ["NET BALANCE", s.balance],
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
          <div className="periodSwitch periodPresets">
            {REPORT_PERIODS.map(([p, label]) => (
              <button
                type="button"
                className={period === p ? "active" : ""}
                onClick={() => choosePeriod(p)}
                key={p}
              >
                {label.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="reportDates">
            <label className="rangeField">
              <small>FROM</small>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => changeDate("from", e.target.value)}
              />
            </label>
            <i>→</i>
            <label className="rangeField">
              <small>TO</small>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => changeDate("to", e.target.value)}
              />
            </label>
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
                    {names[scope]} · {periodLabel}
                  </div>
                </div>
              ))}
            </div>
            <div className="exportSuite">
              <div>
                <small>EXPORT CENTER</small>
                <b>
                  {names[scope]} · {periodLabel} report
                </b>
              </div>
              <button onClick={pdf}>
                <FileText /> DOWNLOAD LUXURY PDF
              </button>
              <button onClick={excel}>
                <FileText /> DOWNLOAD EXCEL
              </button>
            </div>
            {scope === "cash" && d.days?.length > 0 && (
              <div className="card reportTableCard">
                <div className="cardHeader">
                  <div>
                    <div className="sectionTitle">Day-by-Day Cash Flow</div>
                    <div className="sectionSub">
                      Each day opens with the cash carried forward from the
                      previous day.
                    </div>
                  </div>
                  <span className="softBadge">{d.days.length} DAYS</span>
                </div>
                <Table
                  rows={d.days.map((x, i) => ({
                    date: x.date,
                    day_status: x.status === "FINALIZED" ? "CLOSED" : "OPEN",
                    opening: x.opening,
                    cash_in: x.cash_in,
                    cash_out: x.cash_out,
                    closing: x.closing,
                    carried_to: d.days[i + 1]?.date || "next day",
                  }))}
                />
              </div>
            )}
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
    [scanState, setScanState] = useState("opening"),
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
      setScanState("success");
      navigator.vibrate?.(120);
      await new Promise((resolve) => setTimeout(resolve, 650));
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
    setScanState("opening");
    setScan(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      window.__northfieldQrControls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        "attendance-camera",
        (result, _error, controls) => {
          if (result) {
            controls.stop();
            setScanState("found");
            const scanned = result.getText();
            submit(scanned, d.nextEvent);
          }
        },
      );
      setScanState("scanning");
    } catch (e) {
      setScan(false);
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
    clockIn = [...events]
      .reverse()
      .find((x) => x.event_type === "CLOCK_IN")?.event_time,
    elapsedSeconds =
      inside && clockIn
        ? Math.max(0, Math.floor((now - new Date(clockIn).getTime()) / 1000))
        : 0,
    elapsed = `${String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`,
    todayTotalSeconds =
      Number(d.totals?.today_minutes || 0) * 60 + (inside ? elapsedSeconds : 0),
    todayTotal = `${String(Math.floor(todayTotalSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((todayTotalSeconds % 3600) / 60)).padStart(2, "0")}:${String(todayTotalSeconds % 60).padStart(2, "0")}`,
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
            <b>{todayTotal}</b>
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
          <b>{todayTotal}</b>
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
        <div className={`attendanceScannerFull ${scanState}`}>
          <video id="attendance-camera" playsInline muted />
          <div className="scannerShade" />
          <header>
            <button onClick={closeScanner} aria-label="Close scanner">
              <X />
            </button>
            <div>
              <small>NORTHFIELD SECURE SCAN</small>
              <b>{attendanceLabel(d.nextEvent)}</b>
            </div>
            <span />
          </header>
          <div className="scannerFocus">
            <i />
            <i />
            <i />
            <i />
            {scanState === "found" || scanState === "success" ? (
              <div className="scannerSuccess">
                <CheckCircle2 /> QR FOUND
              </div>
            ) : null}
          </div>
          <footer>
            <ScanLine />
            <b>
              {scanState === "opening"
                ? "Starting camera…"
                : "Scan workplace QR"}
            </b>
            <span>Place the complete QR code inside the frame</span>
          </footer>
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
    [selectedStaffId, setSelectedStaffId] = useState(null),
    [adminPanel, setAdminPanel] = useState(null),
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
    if (destructive) setSelectedStaffId(null);
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
  function downloadQr() {
    if (!qr?.image) return;
    const link = document.createElement("a");
    link.href = qr.image;
    link.download = "Northfield-Staff-Attendance-QR.png";
    link.click();
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
    const brand = await loadBrand();
    const r = createLuxuryReport({
      brand,
      title: "STAFF TIME & ATTENDANCE",
      subtitle: (siteEdit?.siteName || "Northfield Clinic").toUpperCase(),
      from: filters.from,
      to: filters.to,
    });
    const { C } = r;
    const rows = d.summary || [],
      completed = rows.filter((x) => x.worked_minutes != null),
      sum = (k) => completed.reduce((t, x) => t + Number(x[k] || 0), 0),
      hm = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`,
      totalMinutes = sum("worked_minutes"),
      lateMinutes = sum("late_minutes"),
      overtimeMinutes = sum("overtime_minutes");
    const scopeName =
      filters.userId === "0"
        ? "All employees"
        : d.staff.find((x) => String(x.id) === String(filters.userId))
            ?.display_name || "Selected employee";
    let y = r.cards([
      { label: "TOTAL WORKED", value: hm(totalMinutes), color: C.NAVY2, note: `${completed.length} completed shifts` },
      { label: "LATE TIME", value: `${lateMinutes} min`, color: C.RED, note: "Arrivals after grace time" },
      { label: "OVERTIME", value: `${overtimeMinutes} min`, color: C.GREEN, note: "Beyond scheduled hours" },
      { label: "OPEN SHIFTS", value: String(rows.length - completed.length), color: C.GOLD, note: "Clocked in, not out" },
    ]);
    y = r.heading("ATTENDANCE REGISTER", `Scope: ${scopeName}  ·  Dubai local time`, y + 10);
    let lastDay = "";
    r.table({
      startY: y,
      head: [["DATE", "EMPLOYEE", "CLOCK IN", "CLOCK OUT", "WORKED", "LATE", "OVERTIME"]],
      body: rows.map((x) => {
        const k = String(x.work_date).slice(0, 10),
          open = x.worked_minutes == null,
          row = [
            { content: k === lastDay ? "" : dayLabel(k), styles: { fontStyle: "bold", textColor: C.NAVY } },
            { content: x.display_name || "", styles: { fontStyle: "bold" } },
            { content: attendanceTime(x.clock_in), styles: { halign: "center" } },
            { content: attendanceTime(x.clock_out), styles: { halign: "center" } },
            { content: open ? "OPEN" : hm(Number(x.worked_minutes)), styles: { halign: "right", fontStyle: "bold", textColor: open ? C.GOLD : C.NAVY, fillColor: C.GOLD_SOFT } },
            { content: Number(x.late_minutes) ? `${x.late_minutes} min` : "—", styles: { halign: "right", textColor: Number(x.late_minutes) ? C.RED : C.MUTED } },
            { content: Number(x.overtime_minutes) ? `${x.overtime_minutes} min` : "—", styles: { halign: "right", textColor: Number(x.overtime_minutes) ? C.GREEN : C.MUTED } },
          ];
        lastDay = k;
        return row;
      }),
      foot: [[
        { content: `${rows.length} RECORDS`, colSpan: 4 },
        { content: hm(totalMinutes), styles: { halign: "right" } },
        { content: `${lateMinutes} min`, styles: { halign: "right" } },
        { content: `${overtimeMinutes} min`, styles: { halign: "right" } },
      ]],
    });
    r.signatures(["PREPARED BY", "MANAGER APPROVAL"]);
    r.save(`Northfield-Attendance-${filters.from}-${filters.to}.pdf`);
  }
  if (!d) return <Loading />;
  const selectedStaff = d.staff.find(
    (u) => String(u.id) === String(selectedStaffId),
  );
  const startStaffEdit = (u) =>
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
      overtimeRequiresApproval: u.overtime_requires_approval !== false,
    });
  const teamOnline = d.today.filter((x) => x.last_event === "CLOCK_IN").length;
  const pendingLeaves = (d.leaves || []).filter(
    (x) => x.status === "PENDING",
  ).length;
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
      <div className="staffOverview">
        <article>
          <Users />
          <span>
            <small>TOTAL STAFF</small>
            <b>{d.staff.length}</b>
          </span>
        </article>
        <article>
          <Wifi />
          <span>
            <small>ON SITE NOW</small>
            <b>{teamOnline}</b>
          </span>
        </article>
        <article>
          <Plane />
          <span>
            <small>PENDING LEAVE</small>
            <b>{pendingLeaves}</b>
          </span>
        </article>
        <article>
          <ScanLine />
          <span>
            <small>PERIOD SCANS</small>
            <b>{(d.records || []).length}</b>
          </span>
        </article>
      </div>
      <div className="attendanceAdminGrid staffCommandGrid">
        <section className="card qrStation compactQrStation">
          <small>PERMANENT WORKPLACE QR</small>
          <h3>Office attendance code</h3>
          <p>
            Print once and place it at the entrance. GPS is checked on every
            scan.
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
            <button className="btn btnSoft" onClick={downloadQr}>
              <Download size={14} /> DOWNLOAD
            </button>
          </div>
          {siteEdit && (
            <button
              className="qrSettingsButton"
              onClick={() => setAdminPanel("settings")}
            >
              <Settings size={14} /> WORKPLACE & GPS SETTINGS
            </button>
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
                    {x.last_event === "CLOCK_IN"
                      ? `On site · In ${attendanceTime(x.clock_in)}`
                      : x.clock_in
                        ? `Off duty · Last out ${attendanceTime(x.clock_out)}`
                        : "Not arrived"}
                  </small>
                </div>
                <i className={x.last_event === "CLOCK_IN" ? "online" : ""} />
              </article>
            ))}
          </div>
        </section>
      </div>
      {msg && <div className="notice">{msg}</div>}
      <section className="card employeeSchedules">
        <div className="cardHeader">
          <div>
            <div className="sectionTitle">Staff directory & shifts</div>
            <div className="sectionSub">
              Select an employee to manage schedule, access or account.
            </div>
          </div>
          {selectedStaff && (
            <div className="selectedStaffActions">
              <span>
                <i /> {selectedStaff.display_name} selected
              </span>
              <button
                className="btn btnSoft"
                onClick={() => startStaffEdit(selectedStaff)}
              >
                <Pencil size={14} /> EDIT SHIFT
              </button>
              {selectedStaff.role === "Staff" && (
                <>
                  <button
                    className={`btn ${selectedStaff.active ? "btnWarning" : "btnSuccess"}`}
                    onClick={() =>
                      staffAction(
                        selectedStaff.id,
                        "staff_toggle",
                        !selectedStaff.active,
                      )
                    }
                  >
                    <UserX size={14} />{" "}
                    {selectedStaff.active ? "DISABLE" : "ENABLE"}
                  </button>
                  <button
                    className="btn btnDanger"
                    onClick={() =>
                      staffAction(selectedStaff.id, "staff_delete")
                    }
                  >
                    <Trash2 size={14} /> DELETE
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="userAdminGrid">
          {d.staff.map((u) => (
            <article
              className={`userAdminCard selectableStaffCard ${String(selectedStaffId) === String(u.id) ? "selected" : ""} ${u.active === false ? "disabledStaff" : ""}`}
              key={u.id}
              onClick={() => setSelectedStaffId(u.id)}
              role="button"
              tabIndex="0"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  setSelectedStaffId(u.id);
              }}
            >
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
              <div
                className={`staffAccessBadge ${u.active === false ? "disabled" : "active"}`}
              >
                <i /> {u.active === false ? "DISABLED" : "ACTIVE"}
              </div>
              <span className="selectStaffHint">
                {String(selectedStaffId) === String(u.id)
                  ? "SELECTED"
                  : "SELECT TO MANAGE"}
              </span>
            </article>
          ))}
        </div>
      </section>
      <div className="staffToolGrid">
        <button
          className="staffToolCard leaveTool"
          onClick={() => setAdminPanel("leaves")}
        >
          <span>
            <Plane />
          </span>
          <div>
            <small>STAFF REQUESTS</small>
            <b>Leave approvals</b>
            <p>Review pending and previous requests</p>
          </div>
          <em>{pendingLeaves} PENDING</em>
          <ArrowUpRight />
        </button>
        <button
          className="staffToolCard reportTool"
          onClick={() => setAdminPanel("reports")}
        >
          <span>
            <FileText />
          </span>
          <div>
            <small>TIME & ATTENDANCE</small>
            <b>Reports and audit</b>
            <p>Run reports, export files and review scans</p>
          </div>
          <em>{(d.summary || []).length} RECORDS</em>
          <ArrowUpRight />
        </button>
      </div>
      {adminPanel === "settings" && siteEdit && (
        <div className="modalShade staffPanelShade">
          <div className="luxModal staffWorkspaceModal settingsWorkspaceModal">
            <div className="modalHead">
              <div>
                <small>SECURE ATTENDANCE</small>
                <h3>Workplace & GPS settings</h3>
                <p>Set the exact office position and permitted scan radius.</p>
              </div>
              <button type="button" onClick={() => setAdminPanel(null)}>
                <X />
              </button>
            </div>
            <form
              className="siteConfig modalSiteConfig"
              onSubmit={async (e) => {
                await saveSite(e);
                setAdminPanel(null);
              }}
            >
              <label>
                Workplace Name
                <input
                  value={siteEdit.siteName}
                  onChange={(e) =>
                    setSiteEdit({ ...siteEdit, siteName: e.target.value })
                  }
                />
              </label>
              <div className="formGrid two">
                <label>
                  Latitude
                  <input
                    type="number"
                    step="any"
                    value={siteEdit.latitude}
                    onChange={(e) =>
                      setSiteEdit({ ...siteEdit, latitude: e.target.value })
                    }
                  />
                </label>
                <label>
                  Longitude
                  <input
                    type="number"
                    step="any"
                    value={siteEdit.longitude}
                    onChange={(e) =>
                      setSiteEdit({ ...siteEdit, longitude: e.target.value })
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btnSoft"
                onClick={useCurrentLocation}
              >
                <MapPin size={14} /> USE CURRENT LOCATION
              </button>
              <label>
                Allowed Radius (meters)
                <input
                  type="number"
                  min="20"
                  value={siteEdit.radiusMeters}
                  onChange={(e) =>
                    setSiteEdit({ ...siteEdit, radiusMeters: e.target.value })
                  }
                />
              </label>
              <label className="switchRow">
                <input
                  type="checkbox"
                  checked={siteEdit.blockOutside}
                  onChange={(e) =>
                    setSiteEdit({ ...siteEdit, blockOutside: e.target.checked })
                  }
                />
                <span /> Block scans outside this radius
              </label>
              <button className="btn btnPrimary" type="submit">
                SAVE WORKPLACE LOCATION
              </button>
            </form>
          </div>
        </div>
      )}
      {adminPanel === "leaves" && (
        <div className="modalShade staffPanelShade">
          <div className="luxModal staffWorkspaceModal">
            <div className="modalHead">
              <div>
                <small>STAFF MANAGEMENT</small>
                <h3>Leave requests</h3>
                <p>Approve or reject employee requests.</p>
              </div>
              <button type="button" onClick={() => setAdminPanel(null)}>
                <X />
              </button>
            </div>
            <section className="managerLeaveBoard modalInnerSection">
              <div className="cardHeader">
                <div>
                  <div className="sectionTitle">Leave requests</div>
                  <div className="sectionSub">
                    Approve or reject staff requests from one place.
                  </div>
                </div>
                <span className="softBadge">
                  {
                    (d.leaves || []).filter((x) => x.status === "PENDING")
                      .length
                  }{" "}
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
                          {item.leave_type} ·{" "}
                          {String(item.date_from).slice(0, 10)} →{" "}
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
                          <button
                            onClick={() => decideLeave(item.id, "REJECTED")}
                          >
                            REJECT
                          </button>
                          <button
                            onClick={() => decideLeave(item.id, "APPROVED")}
                          >
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
          </div>
        </div>
      )}
      {adminPanel === "reports" && (
        <div className="modalShade staffPanelShade">
          <div className="luxModal staffWorkspaceModal reportWorkspaceModal">
            <div className="modalHead">
              <div>
                <small>MANAGEMENT REPORTING</small>
                <h3>Attendance reports & audit</h3>
                <p>Filter, export and review employee attendance.</p>
              </div>
              <button type="button" onClick={() => setAdminPanel(null)}>
                <X />
              </button>
            </div>
            <section className="attendanceReports modalInnerSection">
              <div className="cardHeader">
                <div>
                  <div className="sectionTitle">Attendance Reports</div>
                  <div className="sectionSub">
                    Choose one employee or the full team, then export PDF or
                    Excel.
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
                    onChange={(e) =>
                      setFilters({ ...filters, from: e.target.value })
                    }
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(e) =>
                      setFilters({ ...filters, to: e.target.value })
                    }
                  />
                </label>
                <button
                  className="btn btnPrimary"
                  onClick={() => load(filters)}
                >
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
                <summary>
                  Location Audit · {(d.records || []).length} scans
                </summary>
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
                                    eventTime: new Date(
                                      local.getTime() - offset,
                                    )
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
                        {d.attempts.filter((x) => !x.accepted).length}{" "}
                        attempt(s) were blocked and preserved in the audit log.
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
                                <td>
                                  {new Date(x.attempted_at).toLocaleString()}
                                </td>
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
          </div>
        </div>
      )}
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
  ["Credit Card", CreditCard, "bank"],
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
    ) : page === "Credit Card" ? (
      <CreditCardCenter user={user} />
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
