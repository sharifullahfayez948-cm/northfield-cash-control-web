begin;

create table if not exists credit_card_accounts (
  id bigserial primary key,
  name text not null,
  bank_name text not null default '',
  cardholder_name text not null default '',
  last_four varchar(4),
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  interest_rate numeric(7,3) not null default 0 check (interest_rate >= 0),
  late_fee numeric(14,2) not null default 0 check (late_fee >= 0),
  statement_day smallint check (statement_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  active boolean not null default true,
  created_by bigint references users(id),
  updated_by bigint references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_card_last_four_safe check (last_four is null or last_four ~ '^[0-9]{4}$'),
  constraint credit_card_opening_within_limit check (opening_balance <= credit_limit)
);

create table if not exists credit_card_statements (
  id bigserial primary key,
  account_id bigint not null references credit_card_accounts(id),
  statement_date date not null,
  due_date date not null,
  statement_balance numeric(14,2) not null check (statement_balance >= 0),
  minimum_due numeric(14,2) not null default 0 check (minimum_due >= 0 and minimum_due <= statement_balance),
  status varchar(12) not null default 'OPEN' check (status in ('OPEN','VOID')),
  created_by bigint references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, statement_date),
  check (due_date >= statement_date)
);

create table if not exists credit_card_entries (
  id bigserial primary key,
  account_id bigint not null references credit_card_accounts(id),
  statement_id bigint references credit_card_statements(id),
  business_date date not null,
  entry_time time not null default current_time,
  entry_type varchar(16) not null check (entry_type in ('PURCHASE','PAYMENT','REFUND','INTEREST','LATE_FEE','OTHER_FEE')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null default '',
  merchant text not null default '',
  description text not null default '',
  reference_no text not null default '',
  settlement_source varchar(10) check (settlement_source is null or settlement_source in ('BANK','CASH','OTHER')),
  status varchar(10) not null default 'POSTED' check (status in ('POSTED','VOID')),
  void_reason text,
  created_by bigint references users(id),
  created_at timestamptz not null default now(),
  modified_by bigint references users(id),
  modified_at timestamptz,
  linked_cash_entry_id bigint references cash_entries(id),
  linked_bank_entry_id bigint references bank_entries(id)
);

create index if not exists credit_card_entries_account_date_idx on credit_card_entries(account_id,business_date desc);
create index if not exists credit_card_entries_statement_idx on credit_card_entries(statement_id) where statement_id is not null;
create index if not exists credit_card_statements_due_idx on credit_card_statements(account_id,due_date) where status='OPEN';

insert into categories(name,direction,account_scope,active,sort_order)
select 'Credit Card Settlement','OUT','BOTH',true,850
where not exists (select 1 from categories where name='Credit Card Settlement');

commit;
