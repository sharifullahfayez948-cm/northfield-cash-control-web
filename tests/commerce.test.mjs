import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { commerceSchema } from "../lib/commerce-schema.mjs";
import { commerceService } from "../lib/commerce-service.mjs";
import { cents, normalizeDocument } from "../lib/commerce-model.mjs";

const fixture = `
create table users(id bigint primary key);
insert into users values(1);
create table settings(key text primary key,value text);
insert into settings values('initial_opening_cash','500');
create table categories(id bigserial primary key,name text unique not null,direction text not null,account_scope text not null,active boolean not null,sort_order integer,created_at timestamptz,updated_at timestamptz);
create table cash_days(id bigserial primary key,business_date date unique not null,opening_cash numeric(14,2),status text not null,actual_cash numeric(14,2),opened_by bigint,created_at timestamptz,updated_at timestamptz);
create table cash_entries(id bigserial primary key,business_date date not null,entry_time time not null,direction text not null,amount numeric(14,2) not null check(amount>0),category_id bigint references categories(id),counterparty text,description text,reference_no text,status text,created_by bigint references users(id),created_at timestamptz,transfer_group text,void_reason text,modified_by bigint,modified_at timestamptz);
create table audit_log(id bigserial primary key,event_time timestamptz,user_id bigint,action text,entity_type text,entity_id text,business_date date,detail text);
create role anon;create role authenticated;
`;
const doc = (extra = {}) => ({
  kind: "SALE",
  date: "2026-11-09",
  invoice: randomUUID(),
  party: "Test client",
  staff: "Dr. Test",
  category: "Consultation",
  before: "100.00",
  vatMode: "STANDARD",
  paid: "105.00",
  method: "Cash",
  requestKey: randomUUID(),
  ...extra,
});

test("initial split payment posts only its cash share and rejects an excessive split atomically", async (t) => {
  const { db, service } = await setup(t);
  const body = doc({
    before: "1000",
    vatMode: "NONE",
    payments: [
      { method: "Cash", amount: "200" },
      { method: "Card", amount: "300" },
      { method: "Payment Link", amount: "100" },
    ],
  });
  const a = await service.create(body, 1);
  await service.create(body, 1);
  assert.equal(await count(db, "sales_purchase_payments"), 3);
  assert.equal(
    (await db.query("select amount from cash_entries")).rows[0].amount,
    "200.00",
  );
  await assert.rejects(
    service.create(doc({ payments: [{ method: "Cash", amount: "106" }] }), 1),
    /exceed/,
  );
  assert.equal(await count(db, "sales_purchase_documents"), 1);
  assert.equal(
    (
      await db.query(
        "select party_id from sales_purchase_documents where id=$1",
        [a.id],
      )
    ).rows[0].party_id !== null,
    true,
  );
});
test("account settlement allocates oldest bills, supports split and retries without duplicate cash", async (t) => {
  const { db, service } = await setup(t);
  const a = await service.create(doc({ date: "2026-10-01", paid: "0" }), 1),
    b = await service.create(doc({ paid: "0" }), 1);
  const accountId = (
    await db.query(
      "select party_id from sales_purchase_documents where id=$1",
      [a.id],
    )
  ).rows[0].party_id;
  const payment = {
    kind: "SALE",
    accountId,
    documentIds: [b.id, a.id],
    date: "2026-11-09",
    payments: [
      { method: "Cash", amount: "150" },
      { method: "Payment Link", amount: "30" },
    ],
    requestKey: randomUUID(),
  };
  const result = await service.settleAccount(payment, 1);
  await service.settleAccount(payment, 1);
  assert.equal(result.paid, "180.00");
  assert.equal(await count(db, "sales_purchase_batches"), 1);
  const amounts = (
    await db.query(
      "select document_id,sum(amount) paid from sales_purchase_payments where status='POSTED' group by document_id order by document_id",
    )
  ).rows;
  assert.deepEqual(
    amounts.map((x) => Number(x.paid)),
    [105, 75],
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select sum(amount) amount from cash_entries where status='POSTED'",
        )
      ).rows[0].amount,
    ),
    150,
  );
  await assert.rejects(
    service.settleAccount({ ...payment, requestKey: randomUUID() }, 1),
    /exceeds/,
  );
  await assert.rejects(
    service.settleAccount(
      { ...payment, accountId: "999", requestKey: randomUUID() },
      1,
    ),
    /account/,
  );
});
test("invoice edits keep paid amounts and linked cash synchronized, with stale-write and closed-day protection", async (t) => {
  const { db, service } = await setup(t);
  const body = doc();
  const a = await service.create(body, 1);
  await service.edit(
    a.id,
    {
      ...body,
      revision: 1,
      invoice: "EDITED-1",
      party: "Changed client",
      before: "150",
      reason: "Correct total",
    },
    1,
  );
  const updated = (
    await db.query("select * from sales_purchase_documents where id=$1", [a.id])
  ).rows[0];
  assert.equal(updated.revision, 2);
  assert.equal(Number(updated.total), 157.5);
  const cash = (await db.query("select * from cash_entries")).rows[0];
  assert.equal(cash.counterparty, "Changed client");
  assert.equal(cash.reference_no, "EDITED-1");
  assert.equal(Number(cash.amount), 105);
  await assert.rejects(
    service.edit(a.id, { ...body, revision: 1, reason: "Stale" }, 1),
    /changed/,
  );
  await assert.rejects(
    service.edit(
      a.id,
      { ...body, revision: 2, before: "50", reason: "Invalid decrease" },
      1,
    ),
    /less than/,
  );
  await db.query("update cash_days set status='FINALIZED'");
  await assert.rejects(
    service.edit(a.id, { ...body, revision: 2, reason: "Closed" }, 1),
    /Reopen/i,
  );
});
test("payment corrections reverse old cash and retain history; cash dates and retry are exact", async (t) => {
  const { db, service } = await setup(t);
  const a = await service.create(doc(), 1);
  const p = (await db.query("select id from sales_purchase_payments")).rows[0];
  const edit = {
    paymentId: p.id,
    date: "2026-11-09",
    method: "Card",
    amount: "80",
    reference: "POS-8",
    reason: "Wrong method",
    requestKey: randomUUID(),
  };
  const correction = await service.editPayment(a.id, edit, 1);
  await service.editPayment(a.id, edit, 1);
  assert.equal(await count(db, "sales_purchase_payments"), 2);
  assert.equal(
    (await db.query("select status from cash_entries")).rows[0].status,
    "VOID",
  );
  await service.editPayment(
    a.id,
    {
      ...edit,
      paymentId: correction.id,
      method: "Cash",
      date: "2026-11-10",
      requestKey: randomUUID(),
    },
    1,
  );
  const cash = (
    await db.query(
      "select business_date::text date,amount from cash_entries where status='POSTED'",
    )
  ).rows[0];
  assert.equal(cash.date, "2026-11-10");
  assert.equal(Number(cash.amount), 80);
});
test("directory edits preserve account identity and enforce revision", async (t) => {
  const { db, service } = await setup(t);
  const a = await service.create(doc({ paid: "0" }), 1);
  const id = (
    await db.query(
      "select party_id from sales_purchase_documents where id=$1",
      [a.id],
    )
  ).rows[0].party_id;
  const customer = await service.saveCatalog(
    {
      catalogKind: "CUSTOMER",
      catalogId: id,
      revision: 1,
      name: "Updated name",
      phone: "0501234567",
    },
    1,
  );
  assert.equal(String(customer.id), String(id));
  assert.equal(customer.revision, 2);
  await assert.rejects(
    service.saveCatalog(
      { catalogKind: "CUSTOMER", catalogId: id, revision: 1, name: "Old copy" },
      1,
    ),
    /changed/,
  );
  assert.equal(
    (
      await db.query(
        "select party_id from sales_purchase_documents where id=$1",
        [a.id],
      )
    ).rows[0].party_id,
    id,
  );
});
async function setup(t) {
  const db = new PGlite();
  await db.exec(fixture);
  await db.exec(commerceSchema);
  const pool = {
    connect: async () => ({ query: db.query.bind(db), release() {} }),
  };
  t.after(() => db.close());
  return { db, service: commerceService(pool) };
}
async function count(db, table) {
  return Number((await db.query(`select count(*) n from ${table}`)).rows[0].n);
}

test("exact cents, rounding, VAT options and invalid values", () => {
  assert.equal(cents("0.01"), 1);
  assert.equal(
    normalizeDocument(doc({ before: "142.86", paid: "150.00" })).total,
    15000,
  );
  assert.equal(
    normalizeDocument(doc({ before: "0.10", paid: "0", vatMode: "STANDARD" }))
      .vat,
    1,
  );
  assert.equal(
    normalizeDocument(doc({ vatMode: "NONE", paid: "100" })).total,
    10000,
  );
  assert.equal(
    normalizeDocument(doc({ vatMode: "CUSTOM", vat: "2.30", paid: "0" })).total,
    10230,
  );
  for (const value of ["NaN", "Infinity", "-1", "1.001", "", "1e3"])
    assert.throws(() => cents(value));
  assert.throws(() => normalizeDocument(doc({ date: "2026-02-30" })), /date/);
  assert.throws(() => normalizeDocument(doc({ paid: "105.01" })), /exceed/);
  assert.throws(() => normalizeDocument(doc({ staff: " " })), /staff/);
});
test("cash sale creates one linked IN with VAT and one audit record; retry is idempotent", async (t) => {
  const { db, service } = await setup(t),
    body = doc(),
    a = await service.create(body, 1),
    b = await service.create(body, 1);
  assert.equal(a.id, b.id);
  assert.equal(b.replayed, true);
  for (const table of [
    "sales_purchase_documents",
    "sales_purchase_payments",
    "cash_entries",
    "audit_log",
  ])
    assert.equal(await count(db, table), 1);
  const cash = (await db.query("select * from cash_entries")).rows[0];
  assert.equal(cash.direction, "IN");
  assert.equal(Number(cash.amount), 105);
  assert.match(cash.transfer_group, /^SP-/);
  assert.equal(
    Number(
      (await db.query("select opening_cash from cash_days")).rows[0]
        .opening_cash,
    ),
    500,
  );
  await assert.rejects(
    service.create({ ...body, party: "Changed" }, 1),
    /already belongs/,
  );
});
test("cash purchases and expenses post OUT; non-cash methods never touch cash", async (t) => {
  const { db, service } = await setup(t);
  for (const kind of ["PURCHASE", "EXPENSE"])
    await service.create(doc({ kind, vatMode: "NONE", paid: "100" }), 1);
  for (const method of ["Card", "Bank Transfer", "Botim card", "Other"])
    await service.create(doc({ method }), 1);
  const rows = (await db.query("select direction,amount from cash_entries"))
    .rows;
  assert.equal(rows.length, 2);
  assert.ok(
    rows.every((r) => r.direction === "OUT" && Number(r.amount) === 100),
  );
  assert.equal(await count(db, "sales_purchase_payments"), 6);
});
test("credit and split payments use actual settlement date and reject overpayment", async (t) => {
  const { db, service } = await setup(t),
    d = await service.create(doc({ paid: "0" }), 1);
  assert.equal(await count(db, "cash_entries"), 0);
  const p = {
    requestKey: randomUUID(),
    date: "2026-11-10",
    method: "Cash",
    amount: "40",
    reference: "receipt 1",
  };
  await service.pay(d.id, p, 1);
  await service.pay(d.id, p, 1);
  await service.pay(
    d.id,
    { ...p, requestKey: randomUUID(), method: "Card", amount: "65" },
    1,
  );
  assert.equal(await count(db, "cash_entries"), 1);
  assert.equal(await count(db, "sales_purchase_payments"), 2);
  assert.equal(
    (await db.query("select business_date::text date from cash_entries"))
      .rows[0].date,
    "2026-11-10",
  );
  await assert.rejects(
    service.pay(d.id, { ...p, requestKey: randomUUID(), amount: "0.01" }, 1),
    /remaining/,
  );
  await assert.rejects(
    service.pay(
      d.id,
      { ...p, requestKey: randomUUID(), date: "2026-11-08" },
      1,
    ),
    /precede/,
  );
});
test("finalized day rejects posting atomically and prevents invoice void", async (t) => {
  const { db, service } = await setup(t),
    first = await service.create(doc(), 1);
  await db.query("update cash_days set status='FINALIZED'");
  await assert.rejects(service.create(doc(), 1), /Reopen/);
  assert.equal(await count(db, "sales_purchase_documents"), 1);
  assert.equal(await count(db, "cash_entries"), 1);
  await assert.rejects(service.void(first.id, "Correction", 1), /Reopen/);
  assert.equal(
    (await db.query("select status from sales_purchase_documents")).rows[0]
      .status,
    "POSTED",
  );
});
test("void is atomic across cash payments and retains history; repeated void is safe", async (t) => {
  const { db, service } = await setup(t),
    body = doc({ paid: "40" }),
    d = await service.create(body, 1);
  await service.pay(
    d.id,
    {
      requestKey: randomUUID(),
      date: "2026-11-10",
      method: "Cash",
      amount: "65",
    },
    1,
  );
  await service.void(d.id, "Wrong invoice", 1);
  await service.void(d.id, "Wrong invoice", 1);
  for (const table of [
    "sales_purchase_documents",
    "sales_purchase_payments",
    "cash_entries",
  ])
    assert.ok(
      (await db.query(`select status from ${table}`)).rows.every(
        (r) => r.status === "VOID",
      ),
    );
  await assert.rejects(
    service.pay(
      d.id,
      {
        requestKey: randomUUID(),
        date: "2026-11-10",
        method: "Cash",
        amount: "1",
      },
      1,
    ),
    /voided/,
  );
  await service.create({ ...body, requestKey: randomUUID() }, 1);
  assert.equal(await count(db, "sales_purchase_documents"), 2);
});
test("duplicate sale invoices blocked; purchase invoice numbers are supplier-specific", async (t) => {
  const { db, service } = await setup(t),
    a = doc({ invoice: "INV-1" });
  await service.create(a, 1);
  await assert.rejects(
    service.create(
      {
        ...a,
        requestKey: randomUUID(),
        party: "Different customer",
        invoice: " inv-1 ",
      },
      1,
    ),
    /already exists/,
  );
  await service.create(
    doc({ kind: "PURCHASE", invoice: "INV-1", party: "Supplier A" }),
    1,
  );
  await service.create(
    doc({ kind: "PURCHASE", invoice: "INV-1", party: "Supplier B" }),
    1,
  );
  assert.equal(await count(db, "sales_purchase_documents"), 3);
});
test("audit failure rolls back document, payment, cash and opened day", async (t) => {
  const { db, service } = await setup(t);
  await db.query(
    "alter table audit_log add constraint fail_audit check(action<>'POST_SALES_PURCHASE')",
  );
  await assert.rejects(service.create(doc(), 1));
  for (const table of [
    "sales_purchase_documents",
    "sales_purchase_payments",
    "cash_entries",
    "cash_days",
  ])
    assert.equal(await count(db, table), 0);
});
test("new tables deny anonymous access; schema can run twice without duplicating categories", async (t) => {
  const { db } = await setup(t);
  await db.exec(commerceSchema);
  assert.equal(await count(db, "categories"), 3);
  const flags = await db.query(
    "select relrowsecurity from pg_class where relname in ('sales_purchase_documents','sales_purchase_payments')",
  );
  assert.ok(flags.rows.every((r) => r.relrowsecurity));
  await db.exec("set role anon");
  await assert.rejects(
    db.query("select * from sales_purchase_documents"),
    /permission denied/,
  );
  await db.exec("reset role");
});

test("duplicate directory names produce an account-specific error and do not create another account", async (t) => {
  const { db, service } = await setup(t);
  await service.saveCatalog({catalogKind:"CUSTOMER",name:"Same Customer"},1);
  await assert.rejects(service.saveCatalog({catalogKind:"CUSTOMER",name:" same customer "},1), /name already exists in the directory/);
  assert.equal(Number((await db.query("select count(*) n from sales_purchase_catalog where kind='CUSTOMER'")).rows[0].n),1);
});
