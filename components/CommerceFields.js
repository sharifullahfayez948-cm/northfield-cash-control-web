"use client";
import { useId, useRef, useState } from "react";
import CommerceOverlay from "./CommerceOverlay";
import { accountCode, directoryMatches } from "@/lib/commerce-directory.mjs";
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
export function CatalogEditor({
  label,
  initial = {},
  items = [],
  catalogKind,
  kind,
  onSaved,
  onClose,
}) {
  const [editor, setEditor] = useState({
    name: "",
    phone: "",
    address: "",
    tax_no: "",
    ...initial,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [discard, setDiscard] = useState(false);
  const submitting = useRef(false);
  const party = ["CUSTOMER", "SUPPLIER"].includes(catalogKind);
  const duplicate = items.find(
    (r) =>
      r.kind === catalogKind &&
      String(r.id) !== String(editor.id) &&
      r.name.trim().toLowerCase() === editor.name.trim().toLowerCase(),
  );
  const samePhone =
    editor.phone.replace(/\D/g, "").length >= 6 &&
    items.find(
      (r) =>
        r.kind === catalogKind &&
        String(r.id) !== String(editor.id) &&
        String(r.phone || "").replace(/\D/g, "") ===
          editor.phone.replace(/\D/g, ""),
    );
  function close() {
    if (busy) return;
    const dirty = ["name", "phone", "address", "tax_no"].some(
      (k) => String(editor[k] || "") !== String(initial[k] || ""),
    );
    if (dirty) setDiscard(true);
    else onClose();
  }
  async function save(e) {
    e.preventDefault();
    e.stopPropagation();
    if (submitting.current || duplicate) return;
    submitting.current = true;
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
          name: editor.name.trim(),
          phone: editor.phone,
          address: editor.address,
          taxNo: editor.tax_no,
        }),
      });
      const row = await response.json();
      if (!response.ok)
        throw new Error(row.error || "Could not save. Please try again.");
      onSaved(row);
    } catch (e) {
      setError(e.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <CommerceOverlay onClose={close} busy={busy} payment>
      <section
        className="spModal spDirectoryModal"
        role="dialog"
        aria-modal="true"
        aria-label={`${editor.id ? "Edit" : "New"} ${label.toLowerCase()}`}
      >
        <header>
          <div>
            <small>NORTHFIELD · DIRECTORY</small>
            <h2>
              {editor.id ? "Edit" : "New"} {label.toLowerCase()}
            </h2>
          </div>
          <button
            type="button"
            className="btn btnSoft"
            aria-label="Close profile"
            disabled={busy}
            onClick={close}
          >
            ×
          </button>
        </header>
        <p className="spNote">
          {party
            ? "One account for invoices, payments and statements. Contact and billing details are optional."
            : "Save once, then select it instantly on future entries."}
        </p>
        {editor.id && (
          <div className="spIdentity">
            <b>{accountCode({ ...editor, kind: catalogKind })}</b>
            <span>Account history stays linked when details change.</span>
          </div>
        )}
        <form
          onSubmit={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.stopPropagation();
              e.preventDefault();
              e.currentTarget.requestSubmit();
            }
          }}
        >
          <div className="spForm">
            <label className="spField spWide">
              <span>{label} name *</span>
              <input
                autoFocus
                required
                autoComplete="off"
                maxLength={240}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </label>
            {party && (
              <>
                <label className="spField spWide">
                  <span>Mobile / phone · optional</span>
                  <input
                    type="tel"
                    autoComplete="off"
                    maxLength={80}
                    placeholder="+971 …"
                    value={editor.phone || ""}
                    onChange={(e) =>
                      setEditor({ ...editor, phone: e.target.value })
                    }
                  />
                </label>
                <div className="spWide spSectionLabel">
                  <b>Billing details</b>
                  <span>For invoices and statements</span>
                </div>
                <label className="spField">
                  <span>Billing address · optional</span>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={editor.address || ""}
                    onChange={(e) =>
                      setEditor({ ...editor, address: e.target.value })
                    }
                  />
                </label>
                <label className="spField">
                  <span>Tax registration number · optional</span>
                  <input
                    maxLength={80}
                    value={editor.tax_no || ""}
                    onChange={(e) =>
                      setEditor({ ...editor, tax_no: e.target.value })
                    }
                  />
                </label>
              </>
            )}
          </div>
          {duplicate && (
            <p className="spAlert" role="alert">
              This name already exists ({accountCode(duplicate)}). Select that
              account, or use a distinct name for a different person.
            </p>
          )}
          {samePhone && !duplicate && (
            <p className="spNote">
              This phone is also used by {samePhone.name}. Check whether this is
              the same account before saving.
            </p>
          )}
          {!editor.id && party && (
            <p className="spNote">
              A unique {catalogKind === "CUSTOMER" ? "CUS" : "SUP"} account
              number is assigned automatically.
            </p>
          )}
          {error && (
            <p className="spAlert" role="alert">
              {error}
            </p>
          )}
          {discard ? (
            <div className="spDiscard" role="alert">
              <b>Discard these unsaved changes?</b>
              <div className="spActions">
                <button
                  type="button"
                  className="btn btnSoft"
                  onClick={() => setDiscard(false)}
                >
                  Keep editing
                </button>
                <button type="button" className="btn btnSoft" onClick={onClose}>
                  Discard changes
                </button>
              </div>
            </div>
          ) : (
            <div className="spActions spEditorFooter">
              <button
                type="submit"
                className="btn btnPrimary"
                disabled={busy || !!duplicate || !editor.name.trim()}
              >
                {busy
                  ? "Saving…"
                  : editor.id
                    ? "Save changes"
                    : "Save & select"}
              </button>
              <button
                type="button"
                className="btn btnSoft"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
              <small>Ctrl + Enter to save</small>
            </div>
          )}
        </form>
      </section>
    </CommerceOverlay>
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
    [open, setOpen] = useState(false),
    [cursor, setCursor] = useState(0),
    [recent, setRecent] = useState(null);
  const listId = useId();
  const options = [
    ...items.filter(
      (r) => r.kind === catalogKind && String(r.id) !== String(recent?.id),
    ),
    ...(recent ? [recent] : []),
  ];
  const selected = options.find((r) =>
    id
      ? String(r.id) === String(id)
      : r.name.toLowerCase() === String(value).trim().toLowerCase(),
  );
  const matches = directoryMatches(options, value).slice(0, 30);
  const party = ["CUSTOMER", "SUPPLIER"].includes(catalogKind);
  function select(row) {
    onChange(row.name, row.id);
    setOpen(false);
  }
  return (
    <div className="spCatalog">
      <div
        className="spPicker"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        <label className="spField">
          <span>{label}</span>
          <input
            required
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={
              open && matches[cursor] ? `${listId}-${cursor}` : undefined
            }
            autoComplete="off"
            placeholder={
              party
                ? "Search name, phone or account code…"
                : `Search ${label.toLowerCase()}…`
            }
            value={value || ""}
            maxLength={240}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              const match = options.find(
                (r) =>
                  r.name.toLowerCase() === e.target.value.trim().toLowerCase(),
              );
              onChange(e.target.value, match?.id || null);
              setCursor(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setOpen(true);
                setCursor((n) =>
                  Math.max(
                    0,
                    Math.min(
                      matches.length - 1,
                      n + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
              }
              if (e.key === "Enter" && open) {
                e.preventDefault();
                e.stopPropagation();
                if (matches[cursor]) select(matches[cursor]);
              }
              if (e.key === "Escape" && open) {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }
            }}
          />
        </label>
        {open && (
          <div
            className="spMatches"
            id={listId}
            role="listbox"
            aria-label={`${label} matches`}
          >
            {matches.map((r, i) => (
              <button
                type="button"
                role="option"
                id={`${listId}-${i}`}
                aria-selected={i === cursor}
                key={r.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(r)}
              >
                <span className="spMiniAvatar">
                  {r.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <b>{r.name}</b>
                  <small>
                    {party
                      ? `${accountCode(r)} · ${r.phone || "No phone"}`
                      : "Available for this entry"}
                  </small>
                </span>
              </button>
            ))}
            {!matches.length && (
              <p>
                No matching {label.toLowerCase()}. Use “Add” below to create
                one.
              </p>
            )}
            {matches.length === 30 && <p>Keep typing to narrow the results.</p>}
          </div>
        )}
      </div>
      <div className="spCatalogActions">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setEditor({
              name: selected ? "" : value || "",
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
            setOpen(false);
            setEditor({ ...selected });
          }}
        >
          Edit selected
        </button>
      </div>
      {selected && party && (
        <div className="spIdentity">
          <b>{accountCode(selected)}</b>
          <span>{selected.phone || "No phone added"}</span>
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange("", null)}
          >
            ×
          </button>
        </div>
      )}
      {editor && (
        <CatalogEditor
          label={label}
          initial={editor}
          items={options}
          catalogKind={catalogKind}
          kind={kind}
          onClose={() => setEditor(null)}
          onSaved={(row) => {
            setRecent(row);
            select(row);
            setEditor(null);
            onSaved?.(row);
          }}
        />
      )}
    </div>
  );
}
