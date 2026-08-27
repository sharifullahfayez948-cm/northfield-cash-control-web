# Northfield Cash Control Web

Production-direction rebuild of Northfield as a real web application.

## Architecture
- Next.js App Router
- PostgreSQL / Supabase Mumbai
- Vercel
- Custom Northfield users table with PBKDF2 password compatibility
- Client-side navigation: no Streamlit full-script reruns

## Upload to GitHub
Upload **the contents of this folder** to the root of:
`northfield-cash-control-web`

Do not upload the ZIP itself.

## Vercel Environment Variables
Before Deploy, configure:

`DATABASE_URL`
- Use the Supabase Mumbai **Session Pooler** URI.
- Port 5432.
- Keep the password private.

`SESSION_SECRET`
- Use a long random value (at least 32 characters).
- This signs Northfield login sessions.

## Supabase
Use the Mumbai database where the Northfield schema was already created.

This build expects these tables:
users, settings, categories, counterparties, cash_days, cash_entries,
bank_accounts, bank_entries, iran_dubai_transfers, audit_log,
vouchers, voucher_revisions, voucher_favorites.

## Included screens
- Executive Dashboard
- New Transaction
- Money Movements
- Daily Closing
- Emirates Islamic
- Iran / Dubai
- Reports with PDF and Excel export
- Directory
- Control Center
- First Admin setup
- Login/session handling

## Important
This is deliberately a clean web architecture rather than a Streamlit wrapper.
Navigation is client-side and each page requests only its own data.
