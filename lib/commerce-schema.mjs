// Additive schema. No historical invoices or cash movements are imported.
export const commerceSchema = `
create table if not exists sales_purchase_catalog (
 id bigserial primary key,
 kind text not null check(kind in ('CUSTOMER','SUPPLIER','STAFF','SALE_CATEGORY','BUY_CATEGORY')),
 name text not null,
 phone text not null default '',
 address text not null default '',
 tax_no text not null default '',
 active boolean not null default true,
 revision integer not null default 1,
 created_by bigint references users(id),
 created_at timestamptz not null default now()
);
create unique index if not exists sp_catalog_name_unique on sales_purchase_catalog(kind,lower(trim(name)));
create table if not exists sales_purchase_documents (
 id bigserial primary key,
 request_key uuid not null unique,
 request_hash text not null,
 kind text not null check(kind in ('SALE','PURCHASE','EXPENSE')),
 business_date date not null,
 invoice_no text not null,
 party text not null,
 staff_name text not null default '',
 category text not null,
 before_vat numeric(14,2) not null check(before_vat>=0),
 vat numeric(14,2) not null check(vat>=0),
 total numeric(14,2) not null check(total>0 and total=before_vat+vat),
 remarks text not null default '',
 status text not null default 'POSTED' check(status in ('POSTED','VOID')),
 created_by bigint not null references users(id),
 created_at timestamptz not null default now(),
 voided_by bigint references users(id),
 voided_at timestamptz,
 void_reason text
);
alter table sales_purchase_documents add column if not exists party_id bigint references sales_purchase_catalog(id),add column if not exists staff_id bigint references sales_purchase_catalog(id),add column if not exists category_id bigint references sales_purchase_catalog(id),add column if not exists revision integer not null default 1;
create unique index if not exists sp_document_invoice_unique on sales_purchase_documents(kind,lower(trim(invoice_no)),(case when kind='SALE' then 0 else party_id end)) where status='POSTED';
create index if not exists sp_document_party_idx on sales_purchase_documents(party_id,business_date);
create index if not exists sp_document_staff_idx on sales_purchase_documents(staff_id);
create index if not exists sp_document_category_idx on sales_purchase_documents(category_id);
create index if not exists sp_document_date_idx on sales_purchase_documents(kind,business_date desc,id desc);
create table if not exists sales_purchase_payments (
 id bigserial primary key,
 document_id bigint not null references sales_purchase_documents(id),
 request_key uuid not null unique,
 request_hash text not null,
 business_date date not null,
 method text not null check(method in ('Cash','Card','Payment Link','Bank Transfer','Botim card','Cheque','Other')),
 amount numeric(14,2) not null check(amount>0),
 reference_no text not null default '',
 cash_entry_id bigint unique references cash_entries(id),
 status text not null default 'POSTED' check(status in ('POSTED','VOID')),
 created_by bigint not null references users(id),
 created_at timestamptz not null default now(),
 check((method='Cash' and cash_entry_id is not null) or (method<>'Cash' and cash_entry_id is null))
);
create index if not exists sp_payment_document_idx on sales_purchase_payments(document_id);
create index if not exists sp_payment_date_idx on sales_purchase_payments(business_date) where status='POSTED';
create table if not exists sales_purchase_batches(id bigserial primary key,request_key uuid not null unique,request_hash text not null,result jsonb not null);
alter table sales_purchase_batches enable row level security;
revoke all on sales_purchase_batches from public;
revoke all on sequence sales_purchase_batches_id_seq from public;
alter table sales_purchase_documents enable row level security;
alter table sales_purchase_payments enable row level security;
alter table sales_purchase_catalog enable row level security;
revoke all on sales_purchase_documents,sales_purchase_payments,sales_purchase_catalog from public;
revoke all on sequence sales_purchase_catalog_id_seq from public;
revoke all on sequence sales_purchase_documents_id_seq,sales_purchase_payments_id_seq from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then
  revoke all on sales_purchase_documents,sales_purchase_payments,sales_purchase_catalog from anon;
  revoke all on sequence sales_purchase_catalog_id_seq from anon;
  revoke all on sales_purchase_batches from anon;
  revoke all on sequence sales_purchase_batches_id_seq from anon;
  revoke all on sequence sales_purchase_documents_id_seq,sales_purchase_payments_id_seq from anon;
 end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then
  revoke all on sales_purchase_documents,sales_purchase_payments,sales_purchase_catalog from authenticated;
  revoke all on sequence sales_purchase_catalog_id_seq from authenticated;
  revoke all on sales_purchase_batches from authenticated;
  revoke all on sequence sales_purchase_batches_id_seq from authenticated;
  revoke all on sequence sales_purchase_documents_id_seq,sales_purchase_payments_id_seq from authenticated;
 end if;
end $$;
insert into categories(name,direction,account_scope,active,sort_order,created_at,updated_at)
values ('Sales Receipt','IN','CASH',true,860,now(),now()),('Purchase Payment','OUT','CASH',true,861,now(),now()),('Expense Payment','OUT','CASH',true,862,now(),now())
on conflict(name) do nothing;
`;
