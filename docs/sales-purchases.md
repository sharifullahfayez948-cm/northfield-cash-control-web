# Sales, purchases and account statements

This workspace provides manual reception entry. It does not import spreadsheet transactions or pre-populate real clients or doctors. Only editable category names are provided as defaults.

## Activation and access

A Super Admin opens **Sales** once to initialize the additive `sales_purchase_*` tables through the application's existing database connection. No existing ledger rows are migrated. New tables deny Supabase anonymous/authenticated API access; the existing authenticated server routes enforce `sales` and `purchases` permissions. Super Admin has both permissions. For users with an explicit permission configuration, enable the relevant entries in Control Center. Viewer accounts are read-only; voiding requires Super Admin.

## Reception workflow

- Create a sale, purchase or expense with invoice date/number, account, doctor (sales), category, amount and VAT. Accounts, doctors and categories can be added or edited without leaving the form.
- Record full payment, partial payment, credit, or up to eight split payment lines. Cash, Card, Payment Link, Bank Transfer, Botim card, Cheque and Other are supported as recorded payment methods. Selecting a method records an already received/made payment; it does not charge a card or generate a gateway payment link.
- Save offers invoice printing or PDF download. Save & add next retains date, doctor, category, VAT and payment method. Ctrl+Enter saves; Ctrl+Shift+Enter saves and opens the next entry.
- Cash lines create linked Cash Control entries. Non-cash lines never change physical cash. Do not enter linked cash payments a second time manually.
- Outstanding opens the searchable customer/supplier panel. Choose an account, select invoices, and record full or partial settlement across methods. Allocation is oldest selected invoice first. The payment date is independent of the original invoice date.
- Customer/Supplier Accounts show all invoices and debit/credit statements with opening/closing balances and optional date filters. Statements export to PDF and Excel. Sales includes searchable doctor performance and detailed PDF/Excel reports.
- Money Movements searches across the selected day or all history, including party, doctor in the description, invoice, reference, category, amount and status. Linked entries open their originating invoice.

## Integrity

Money is validated in integer cents. Posting, cash linkage and audit records commit together. Save requests and batch settlements are idempotent. Invoice/payment edits preserve history; stale invoice/directory edits and overpayment are rejected. Correcting a payment voids its old record and posts a replacement atomically. A finalized affected cash day must be reopened before changing its cash payments. Daily closing and cash posting lock the same cash-day row.

Register pages show 50 entries; exports and individual account histories are limited to 10,000 invoices with an explicit error rather than silent truncation. Batch settlement supports up to 200 selected invoices.

## Verification

`npm test` runs isolated PGlite integration tests covering split cash/non-cash posting, retry protection, oldest-invoice settlement, overpayment, invoice revisions, payment corrections, supplier invoice uniqueness, voids, closed days, rollback on audit failure, catalog identity and access revocations. The tests contain synthetic data only.

`npm run build` builds the application. For isolated local builds, `NORTHFIELD_BUILD_DIR` selects a separate output folder. `NORTHFIELD_LOCAL_BUILD=1` disables the webpack worker and keeps that local build directory to avoid Windows directory-creation races; production uses standard Next.js defaults.
