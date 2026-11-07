// Shared "luxury" PDF layout for every Northfield report: navy and gold
// header, KPI cards, styled tables, signature block and footer.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const LUX = {
  NAVY: [8, 38, 58],
  NAVY2: [16, 58, 84],
  GOLD: [205, 150, 52],
  GOLD_DARK: [120, 82, 20],
  GOLD_SOFT: [250, 241, 222],
  IVORY: [252, 250, 245],
  BLUE_SOFT: [232, 240, 246],
  ZEBRA: [250, 248, 243],
  GREEN: [18, 125, 92],
  RED: [184, 62, 52],
  INK: [33, 52, 64],
  MUTED: [120, 134, 142],
  WHITE: [255, 255, 255],
};

export const aed = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const money = (n) => `AED ${aed(n)}`;
export const signed = (n, sign) => (Number(n) ? `${sign} ${aed(n)}` : "—");

const asDate = (v) => new Date(`${String(v ?? "").slice(0, 10)}T00:00:00`);
export const dayLabel = (v) =>
  v
    ? asDate(v).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
export const longDayLabel = (v) =>
  asDate(v)
    .toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
export function timeLabel(value) {
  const m = String(value ?? "").match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return String(value ?? "");
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

function imageData(url, opacity = 1) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function loadBrand() {
  let settings = {};
  try {
    settings = await fetch("/api/public-settings", { cache: "no-store" }).then(
      (r) => r.json(),
    );
  } catch {}
  const logoUrl = settings.company_logo || "/northfield-logo.png";
  let logo = null,
    watermark = null;
  try {
    [logo, watermark] = await Promise.all([
      imageData(logoUrl),
      imageData(logoUrl, 0.04),
    ]);
  } catch {}
  return {
    company: settings.company_name || "Northfield Veterinary Clinic L.L.C",
    address: settings.company_address || "United Arab Emirates",
    logo,
    watermark,
  };
}

// title: big gold report name; subtitle: small white line under it.
export function createLuxuryReport({
  brand,
  title,
  subtitle = "",
  from,
  to,
  orientation = "portrait",
}) {
  const C = LUX;
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(),
    H = doc.internal.pageSize.getHeight(),
    M = 12,
    P = orientation === "portrait";
  const company = brand.company;

  const chrome = (pageNumber) => {
    doc.setFillColor(...C.IVORY);
    doc.rect(0, 0, W, H, "F");
    if (brand.watermark)
      doc.addImage(brand.watermark, "PNG", W / 2 - 55, H / 2 - 26, 110, 52);
    doc.setDrawColor(...C.GOLD);
    doc.setLineWidth(0.6);
    doc.roundedRect(6, 6, W - 12, H - 12, 2.5, 2.5);
    doc.setDrawColor(230, 215, 185);
    doc.setLineWidth(0.2);
    doc.roundedRect(8, 8, W - 16, H - 16, 2, 2);
    // header band
    doc.setFillColor(...C.NAVY);
    doc.roundedRect(M, 12, W - M * 2, 24, 1.8, 1.8, "F");
    doc.setFillColor(...C.GOLD);
    doc.rect(M, 35, W - M * 2, 0.9, "F");
    const lw = P ? 34 : 40;
    doc.setFillColor(...C.WHITE);
    doc.roundedRect(M + 3, 14.5, lw, 19, 1.4, 1.4, "F");
    if (brand.logo) doc.addImage(brand.logo, "PNG", M + 4.5, 15.5, lw - 3, 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(P ? 10 : 15);
    doc.setTextColor(...C.WHITE);
    doc.text(company.toUpperCase(), W / 2, 22.5, {
      align: "center",
      maxWidth: P ? 96 : 140,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(P ? 6.8 : 8);
    doc.setTextColor(214, 196, 160);
    doc.text(brand.address, W / 2, 29, { align: "center", maxWidth: P ? 96 : 140 });
    const rx = W - M - 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(P ? 9.5 : 11);
    doc.setTextColor(...C.GOLD);
    doc.text(title, rx, 20.5, { align: "right" });
    doc.setFontSize(P ? 6.6 : 8);
    doc.setTextColor(...C.WHITE);
    if (subtitle) doc.text(subtitle, rx, 26, { align: "right", maxWidth: P ? 52 : 80 });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(214, 196, 160);
    if (from || to)
      doc.text(
        from === to ? dayLabel(from) : `${dayLabel(from)}  —  ${dayLabel(to)}`,
        rx,
        31.5,
        { align: "right" },
      );
    // footer
    doc.setDrawColor(...C.GOLD);
    doc.setLineWidth(0.3);
    doc.line(M, H - 15, W - M, H - 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(P ? 6.4 : 7.5);
    doc.setTextColor(...C.MUTED);
    doc.text(
      `Generated ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Dubai" })}`,
      M,
      H - 10.5,
    );
    doc.setTextColor(...C.GOLD);
    doc.setFont("helvetica", "bold");
    doc.text(`${company.toUpperCase()}  ·  CONFIDENTIAL RECORD`, W / 2, H - 10.5, {
      align: "center",
    });
    doc.setTextColor(...C.NAVY);
    doc.text(`PAGE ${pageNumber}`, W - M, H - 10.5, { align: "right" });
  };
  const drawn = new Set();
  const chromeOnce = () => {
    const p = doc.getCurrentPageInfo().pageNumber;
    if (drawn.has(p)) return;
    drawn.add(p);
    chrome(p);
  };
  const newPage = () => {
    doc.addPage();
    chromeOnce();
  };

  // cards: [{ label, value, color, note }]; returns the y below them
  const cards = (list, y = 42) => {
    const gap = P ? 3 : 4,
      n = list.length,
      cw = (W - M * 2 - gap * (n - 1)) / n,
      big = n > 4 ? (P ? 10.5 : 13) : P ? 12.5 : 16;
    list.forEach(({ label, value, color = C.NAVY2, note = "" }, i) => {
      const x = M + i * (cw + gap);
      doc.setFillColor(...C.WHITE);
      doc.setDrawColor(228, 216, 192);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cw, 27, 2, 2, "FD");
      doc.setFillColor(...color);
      doc.roundedRect(x, y, 2.4, 27, 1.2, 1.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(P ? 7.2 : 8.5);
      doc.setTextColor(...C.MUTED);
      doc.text(label, x + 6, y + 8, { maxWidth: cw - 8 });
      doc.setFontSize(big);
      doc.setTextColor(...color);
      doc.text(String(value), x + 6, y + 18, { maxWidth: cw - 8 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(P ? 6.4 : 7.5);
      doc.setTextColor(...C.MUTED);
      doc.text(note, x + 6, y + 23.5, { maxWidth: cw - 8 });
    });
    return y + 27;
  };

  const heading = (text, note, y) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(P ? 10 : 11);
    doc.setTextColor(...C.NAVY);
    doc.text(text, M, y);
    if (note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(P ? 7 : 8);
      doc.setTextColor(...C.MUTED);
      doc.text(note, W - M, y, { align: "right" });
    }
    return y + 4;
  };

  const table = ({ styles, headStyles, footStyles, ...opts }) => {
    autoTable(doc, {
      theme: "grid",
      margin: { top: 42, left: M, right: M, bottom: 19 },
      willDrawPage: chromeOnce,
      showFoot: "lastPage",
      rowPageBreak: "avoid",
      alternateRowStyles: { fillColor: C.ZEBRA },
      styles: {
        font: "helvetica",
        fontSize: P ? 7.4 : 8.6,
        textColor: C.INK,
        lineColor: [226, 222, 212],
        lineWidth: 0.2,
        cellPadding: P
          ? { top: 1.9, bottom: 1.9, left: 1.8, right: 1.8 }
          : { top: 2.2, bottom: 2.2, left: 2.6, right: 2.6 },
        valign: "middle",
        overflow: "linebreak",
        fillColor: C.WHITE,
        ...styles,
      },
      headStyles: {
        fillColor: C.NAVY,
        textColor: C.GOLD,
        fontStyle: "bold",
        fontSize: P ? 7.2 : 8.4,
        lineColor: C.NAVY,
        cellPadding: P ? 2.2 : 2.8,
        ...headStyles,
      },
      footStyles: {
        fillColor: C.NAVY,
        textColor: C.WHITE,
        fontStyle: "bold",
        fontSize: P ? 7.8 : 9,
        ...footStyles,
      },
      ...opts,
    });
    return doc.lastAutoTable.finalY;
  };

  // "Prepared / Reviewed / Approved" signature lines after the last table
  const signatures = (labels = ["PREPARED BY", "REVIEWED BY", "APPROVED BY"]) => {
    let y = (doc.lastAutoTable?.finalY || 60) + 16;
    if (y > H - 40) {
      newPage();
      y = 56;
    }
    const n = labels.length,
      gap = 12,
      w = (W - M * 2 - gap * (n - 1)) / n;
    labels.forEach((label, i) => {
      const x = M + i * (w + gap);
      doc.setDrawColor(...C.GOLD);
      doc.setLineWidth(0.35);
      doc.line(x, y, x + w, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(P ? 6.8 : 7.6);
      doc.setTextColor(...C.NAVY);
      doc.text(label, x, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.MUTED);
      doc.text("Name, signature & date", x, y + 9);
    });
  };

  chromeOnce();
  return {
    doc,
    W,
    H,
    M,
    P,
    C,
    cards,
    heading,
    table,
    newPage,
    signatures,
    save: (name) => doc.save(name),
  };
}
