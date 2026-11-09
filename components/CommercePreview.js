"use client";
import { useEffect, useState } from "react";
import CommerceOverlay from "./CommerceOverlay";
export default function CommercePreview({ report, title, filename, onClose }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(report.doc.output("blob"));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [report]);
  function print() {
    const popup = window.open(url, "_blank");
    if (popup) popup.opener = null;
  }
  return (
    <CommerceOverlay payment onClose={onClose}>
      <section
        className="spModal spReportPreview"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <small>NORTHFIELD · DOCUMENT PREVIEW</small>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="btn btnSoft"
            onClick={onClose}
            aria-label="Close preview"
          >
            ×
          </button>
        </header>
        <div className="spActions">
          <a
            className="btn btnPrimary"
            href={url || undefined}
            download={filename}
          >
            Download PDF
          </a>
          <button
            type="button"
            className="btn btnSoft"
            onClick={print}
            disabled={!url}
          >
            Open / print PDF
          </button>
          <button type="button" className="btn btnSoft" onClick={onClose}>
            Back
          </button>
        </div>
        <p className="spNote">
          If your browser does not show the preview, use Download PDF or Open /
          print PDF.
        </p>
        {url && <iframe title={title} src={url} />}
      </section>
    </CommerceOverlay>
  );
}
