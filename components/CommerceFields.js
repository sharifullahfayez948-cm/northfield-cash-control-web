"use client";
import { useState } from "react";
import { PAYMENT_METHODS } from "@/lib/commerce-model.mjs";
export function PaymentParts({ values, onChange }) {
  return (
    <div className="spPaymentParts">
      <div className="spSectionLabel">
        <b>Payment breakdown</b>
        <span>Split across cash, card, link or bank</span>
      </div>
      {values.map((p, i) => (
        <div className="spPaymentPart" key={i}>
          <label>
            <span>Method</span>
            <select
              aria-label={`Payment method ${i + 1}`}
              value={p.method}
              onChange={(e) =>
                onChange(
                  values.map((v, j) =>
                    j === i ? { ...v, method: e.target.value } : v,
                  ),
                )
              }
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Amount (AED)</span>
            <input
              aria-label={`Payment amount ${i + 1}`}
              type="number"
              required
              min="0.01"
              step="0.01"
              value={p.amount}
              onChange={(e) =>
                onChange(
                  values.map((v, j) =>
                    j === i ? { ...v, amount: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <label>
            <span>Reference / slip</span>
            <input
              aria-label={`Payment reference ${i + 1}`}
              value={p.reference || ""}
              maxLength={240}
              onChange={(e) =>
                onChange(
                  values.map((v, j) =>
                    j === i ? { ...v, reference: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="btn btnSoft"
            onClick={() => onChange(values.filter((_, j) => i !== j))}
            disabled={values.length === 1}
            aria-label={`Remove payment ${i + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btnSoft"
        disabled={values.length >= 8}
        onClick={() =>
          onChange([...values, { method: "Card", amount: "", reference: "" }])
        }
      >
        + Add payment method
      </button>
    </div>
  );
}
export function CatalogPicker({
  label,
  items = [],
  catalogKind,
  kind,
  value,
  id,
  onChange,
  onSaved,
}) {
  const [editor, setEditor] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const options = items.filter((r) => r.kind === catalogKind),
    selected = options.find(
      (r) =>
        String(r.id) === String(id) ||
        r.name.toLowerCase() === String(value).toLowerCase(),
    );
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/commerce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "catalog",
          kind,
          catalogKind,
          catalogId: editor.id,
          revision: editor.revision,
          name: editor.name,
          phone: editor.phone,
          address: editor.address,
          taxNo: editor.tax_no,
        }),
      });
      const row = await response.json();
      if (!response.ok) throw new Error(row.error);
      onChange(row.name, row.id);
      setEditor(null);
      onSaved?.(row);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="spCatalog">
      <label className="spField">
        <span>{label}</span>
        <input
          required
          list={`catalog-${catalogKind}`}
          value={value || ""}
          maxLength={240}
          onChange={(e) => {
            const match = options.find(
              (r) => r.name.toLowerCase() === e.target.value.toLowerCase(),
            );
            onChange(e.target.value, match?.id || null);
          }}
        />
        <datalist id={`catalog-${catalogKind}`}>
          {options.map((r) => (
            <option key={r.id} value={r.name}>
              {r.phone || ""}
            </option>
          ))}
        </datalist>
      </label>
      <div className="spCatalogActions">
        <button
          type="button"
          onClick={() => {
            setError("");
            setEditor({
              name: value || "",
              phone: "",
              address: "",
              tax_no: "",
            });
          }}
        >
          + Add {label.toLowerCase()}
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            setError("");
            setEditor({ ...selected });
          }}
        >
          Edit selected
        </button>
      </div>
      {editor && (
        <div className="spCatalogEditor">
          <b>
            {editor.id ? "Edit" : "Add"} {label.toLowerCase()}
          </b>
          <label className="spField">
            <span>Name</span>
            <input
              value={editor.name}
              maxLength={240}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
            />
          </label>
          {["CUSTOMER", "SUPPLIER"].includes(catalogKind) && (
            <>
              <label className="spField">
                <span>Phone</span>
                <input
                  value={editor.phone || ""}
                  maxLength={80}
                  onChange={(e) =>
                    setEditor({ ...editor, phone: e.target.value })
                  }
                />
              </label>
              <label className="spField">
                <span>Address</span>
                <input
                  value={editor.address || ""}
                  maxLength={500}
                  onChange={(e) =>
                    setEditor({ ...editor, address: e.target.value })
                  }
                />
              </label>
              <label className="spField">
                <span>Tax number (optional)</span>
                <input
                  value={editor.tax_no || ""}
                  maxLength={80}
                  onChange={(e) =>
                    setEditor({ ...editor, tax_no: e.target.value })
                  }
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="spAlert">
              {error}
            </p>
          )}
          <div className="spActions">
            <button
              type="button"
              className="btn btnPrimary"
              disabled={busy}
              onClick={save}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn btnSoft"
              disabled={busy}
              onClick={() => setEditor(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
