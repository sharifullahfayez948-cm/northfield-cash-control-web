import { createHash } from "node:crypto";
import {
  normalizeDocument,
  cents,
  decimal,
  validDate,
  requestKey,
  textField,
  PAYMENT_METHODS,
  normalizePayments,
} from "./commerce-model.mjs";
const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const childKey = (key, index) => {
  const h = fingerprint([key, index]);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const dateOnly = (value) =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);

export function commerceService(pool) {
  async function atomic(run) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await run(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      if (error.code === "23505")
        throw new Error(
          error.constraint === "sp_catalog_name_unique"
            ? "This name already exists in the directory. Select the existing account or use a distinct name."
            : "This invoice / reference already exists for this client or supplier.",
        );
      throw error;
    } finally {
      client.release();
    }
  }
  async function audit(client, userId, action, id, date, detail) {
    await client.query(
      `insert into audit_log(event_time,user_id,action,entity_type,entity_id,business_date,detail) values(now(),$1,$2,'sales_purchase_document',$3,$4,$5)`,
      [userId, action, String(id), date, detail],
    );
  }
  async function replay(client, key, hash, table) {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      key,
    ]);
    const old = (
      await client.query(
        `select id,request_hash from ${table} where request_key=$1`,
        [key],
      )
    ).rows[0];
    if (old && old.request_hash !== hash)
      throw new Error(
        "This save request already belongs to another entry. Reload before creating a new entry.",
      );
    return old;
  }
  async function cashDay(client, date, userId, create = true) {
    if (create)
      await client.query(
        `insert into cash_days(business_date,opening_cash,status,opened_by,created_at,updated_at)
   values($1,coalesce((select actual_cash from cash_days where business_date<$1 and status='FINALIZED' and actual_cash is not null order by business_date desc limit 1),(select value::numeric from settings where key='initial_opening_cash'),0),'OPEN',$2,now(),now()) on conflict(business_date) do nothing`,
        [date, userId],
      );
    const day = (
      await client.query(
        "select status from cash_days where business_date=$1 for update",
        [date],
      )
    ).rows[0];
    if (!day || day.status === "FINALIZED")
      throw new Error(
        "Reopen this cash day before recording or voiding its payments.",
      );
  }
  async function catalog(client, kind, name, id, userId) {
    if (id) {
      const row = (
        await client.query(
          "select * from sales_purchase_catalog where id=$1 and kind=$2 and active=true",
          [id, kind],
        )
      ).rows[0];
      if (!row)
        throw new Error("Select an active doctor, category or account.");
      return row;
    }
    return (
      await client.query(
        `insert into sales_purchase_catalog(kind,name,created_by) values($1,$2,$3) on conflict(kind,(lower(trim(name)))) do update set name=sales_purchase_catalog.name returning *`,
        [kind, name, userId],
      )
    ).rows[0];
  }
  async function documentCatalogs(client, d, userId) {
    const party = await catalog(
      client,
      d.kind === "SALE" ? "CUSTOMER" : "SUPPLIER",
      d.party,
      d.partyId,
      userId,
    );
    const staff =
      d.kind === "SALE"
        ? await catalog(client, "STAFF", d.staff, d.staffId, userId)
        : null;
    const category = await catalog(
      client,
      d.kind === "SALE" ? "SALE_CATEGORY" : "BUY_CATEGORY",
      d.category,
      d.categoryId,
      userId,
    );
    if (!party.active || !category.active || (staff && !staff.active))
      throw new Error("This doctor, category or account is inactive.");
    return { party, staff, category };
  }
  async function insertPayment(client, doc, p, userId) {
    let cashId = null;
    if (p.method === "Cash") {
      await cashDay(client, p.date, userId);
      const name =
        doc.kind === "SALE"
          ? "Sales Receipt"
          : doc.kind === "PURCHASE"
            ? "Purchase Payment"
            : "Expense Payment";
      const direction = doc.kind === "SALE" ? "IN" : "OUT";
      const cat = (
        await client.query(
          "select id from categories where name=$1 and active=true and direction=$2 and account_scope in ('CASH','BOTH')",
          [name, direction],
        )
      ).rows[0];
      if (!cat)
        throw new Error(
          "The cash category for this payment is unavailable. Contact the administrator.",
        );
      const r = await client.query(
        `insert into cash_entries(business_date,entry_time,direction,amount,category_id,counterparty,description,reference_no,status,created_by,created_at,transfer_group)
    values($1,(now() at time zone 'Asia/Dubai')::time,$2,$3,$4,$5,$6,$7,'POSTED',$8,now(),$9) returning id`,
        [
          p.date,
          direction,
          decimal(p.amount),
          cat.id,
          doc.party,
          `${doc.kind} ${doc.invoice_no} · ${doc.category}${doc.staff_name ? " · " + doc.staff_name : ""}`,
          doc.invoice_no,
          userId,
          `SP-${doc.id}-${p.key}`,
        ],
      );
      cashId = r.rows[0].id;
    }
    return (
      await client.query(
        `insert into sales_purchase_payments(document_id,request_key,request_hash,business_date,method,amount,reference_no,cash_entry_id,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [
          doc.id,
          p.key,
          p.hash,
          p.date,
          p.method,
          decimal(p.amount),
          p.reference || "",
          cashId,
          userId,
        ],
      )
    ).rows[0];
  }
  return {
    async create(body, userId) {
      const d = normalizeDocument(body),
        hash = fingerprint(d);
      return atomic(async (client) => {
        const old = await replay(
          client,
          d.key,
          hash,
          "sales_purchase_documents",
        );
        if (old) return { id: old.id, replayed: true };
        const refs = await documentCatalogs(client, d, userId);
        const doc = (
          await client.query(
            `insert into sales_purchase_documents(request_key,request_hash,kind,business_date,invoice_no,party,staff_name,category,before_vat,vat,total,remarks,created_by,party_id,staff_id,category_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *,business_date::text as business_date`,
            [
              d.key,
              hash,
              d.kind,
              d.date,
              d.invoice,
              refs.party.name,
              refs.staff?.name || "",
              refs.category.name,
              decimal(d.before),
              decimal(d.vat),
              decimal(d.total),
              d.remarks,
              userId,
              refs.party.id,
              refs.staff?.id || null,
              refs.category.id,
            ],
          )
        ).rows[0];
        for (const [index, part] of d.payments.entries())
          await insertPayment(
            client,
            doc,
            {
              key: childKey(d.key, index),
              hash,
              date: d.paymentDate,
              method: part.method,
              amount: part.amount,
              reference: part.reference,
            },
            userId,
          );
        await audit(
          client,
          userId,
          "POST_SALES_PURCHASE",
          doc.id,
          d.date,
          `${d.kind} ${d.invoice}; total ${decimal(d.total)}; paid ${decimal(d.paid)}`,
        );
        return { id: doc.id };
      });
    },
    async pay(id, body, userId) {
      const p = {
        key: requestKey(body.requestKey),
        date: validDate(body.date),
        method: body.method,
        amount: cents(body.amount, "Payment"),
        reference: textField(body.reference, "Payment reference", false),
      };
      if (!PAYMENT_METHODS.includes(p.method) || p.amount <= 0)
        throw new Error("Choose a payment method and a positive amount.");
      p.hash = fingerprint({ id: String(id), ...p });
      return atomic(async (client) => {
        const old = await replay(
          client,
          p.key,
          p.hash,
          "sales_purchase_payments",
        );
        if (old) return { id: old.id, replayed: true };
        const doc = (
          await client.query(
            "select *,business_date::text as business_date from sales_purchase_documents where id=$1 for update",
            [id],
          )
        ).rows[0];
        if (!doc || doc.status !== "POSTED")
          throw new Error("This invoice is unavailable or voided.");
        if (p.date < dateOnly(doc.business_date))
          throw new Error("Payment date cannot precede the invoice date.");
        const paid = (
          await client.query(
            "select coalesce(sum(amount),0) paid from sales_purchase_payments where document_id=$1 and status='POSTED'",
            [id],
          )
        ).rows[0].paid;
        if (p.amount + cents(paid) > cents(doc.total))
          throw new Error("Payment exceeds the remaining balance.");
        const result = await insertPayment(client, doc, p, userId);
        await audit(
          client,
          userId,
          "PAY_SALES_PURCHASE",
          id,
          p.date,
          `${p.method} ${decimal(p.amount)}`,
        );
        return result;
      });
    },
    async settleAccount(body, userId) {
      const key = requestKey(body.requestKey),
        date = validDate(body.date),
        parts = normalizePayments(body.payments),
        amount = parts.reduce((n, p) => n + p.amount, 0);
      const ids = [...new Set((body.documentIds || []).map(String))].sort(
        (a, b) => Number(a) - Number(b),
      );
      if (
        !ids.length ||
        ids.length > 200 ||
        ids.some((id) => !/^\d+$/.test(id)) ||
        amount <= 0
      )
        throw new Error("Select up to 200 invoices and enter a payment.");
      const hash = fingerprint({
        key,
        date,
        parts,
        ids,
        accountId: body.accountId,
        kind: body.kind,
      });
      return atomic(async (client) => {
        const prior = await replay(client, key, hash, "sales_purchase_batches");
        if (prior)
          return (
            await client.query(
              "select result from sales_purchase_batches where id=$1",
              [prior.id],
            )
          ).rows[0].result;
        const docs = (
          await client.query(
            "select *,business_date::text as business_date from sales_purchase_documents where id=any($1::bigint[]) order by id for update",
            [ids],
          )
        ).rows;
        if (
          docs.length !== ids.length ||
          docs.some(
            (d) =>
              String(d.party_id) !== String(body.accountId) ||
              d.status !== "POSTED" ||
              (body.kind === "SALE" ? d.kind !== "SALE" : d.kind === "SALE"),
          )
        )
          throw new Error("Select posted invoices from this account only.");
        const balances = [];
        for (const doc of docs) {
          if (date < doc.business_date)
            throw new Error(
              "Payment date cannot precede any selected invoice.",
            );
          const paid = (
            await client.query(
              "select coalesce(sum(amount),0) paid from sales_purchase_payments where document_id=$1 and status='POSTED'",
              [doc.id],
            )
          ).rows[0].paid;
          balances.push({ doc, balance: cents(doc.total) - cents(paid) });
        }
        balances.sort(
          (a, b) =>
            a.doc.business_date.localeCompare(b.doc.business_date) ||
            Number(a.doc.id) - Number(b.doc.id),
        );
        if (amount > balances.reduce((n, b) => n + b.balance, 0))
          throw new Error(
            "Payment exceeds the selected outstanding balance. Refresh and try again.",
          );
        let index = 0;
        const result = { paid: decimal(amount), invoiceIds: [] };
        for (const part of parts) {
          let remaining = part.amount;
          for (const b of balances) {
            if (!remaining) break;
            if (!b.balance) continue;
            const applied = Math.min(remaining, b.balance);
            await insertPayment(
              client,
              b.doc,
              {
                key: childKey(key, index++),
                hash,
                date,
                method: part.method,
                amount: applied,
                reference: part.reference,
              },
              userId,
            );
            await audit(
              client,
              userId,
              "PAY_SALES_PURCHASE",
              b.doc.id,
              date,
              `${part.method} ${decimal(applied)}; account settlement`,
            );
            b.balance -= applied;
            remaining -= applied;
            if (!result.invoiceIds.includes(b.doc.id))
              result.invoiceIds.push(b.doc.id);
          }
        }
        await client.query(
          "insert into sales_purchase_batches(request_key,request_hash,result) values($1,$2,$3::jsonb)",
          [key, hash, JSON.stringify(result)],
        );
        return result;
      });
    },
    async saveCatalog(body, userId) {
      const kinds = [
        "CUSTOMER",
        "SUPPLIER",
        "STAFF",
        "SALE_CATEGORY",
        "BUY_CATEGORY",
      ];
      if (!kinds.includes(body.catalogKind))
        throw new Error("Invalid directory type.");
      const name = textField(body.name, "Name", true),
        phone = textField(body.phone, "Phone", false, 80),
        address = textField(body.address, "Address", false, 500),
        tax = textField(body.taxNo, "Tax number", false, 80);
      return atomic(async (client) => {
        let row;
        if (body.catalogId) {
          const old = (
            await client.query(
              "select * from sales_purchase_catalog where id=$1 and kind=$2 for update",
              [body.catalogId, body.catalogKind],
            )
          ).rows[0];
          if (!old || Number(old.revision) !== Number(body.revision))
            throw new Error(
              "This directory entry changed. Refresh it before editing.",
            );
          row = (
            await client.query(
              "update sales_purchase_catalog set name=$1,phone=$2,address=$3,tax_no=$4,revision=revision+1 where id=$5 returning *",
              [name, phone, address, tax, old.id],
            )
          ).rows[0];
          await audit(
            client,
            userId,
            "EDIT_COMMERCE_DIRECTORY",
            row.id,
            null,
            JSON.stringify({ before: old, after: row }),
          );
        } else {
          row = (
            await client.query(
              "insert into sales_purchase_catalog(kind,name,phone,address,tax_no,created_by) values($1,$2,$3,$4,$5,$6) returning *",
              [body.catalogKind, name, phone, address, tax, userId],
            )
          ).rows[0];
          await audit(
            client,
            userId,
            "ADD_COMMERCE_DIRECTORY",
            row.id,
            null,
            `${body.catalogKind}: ${name}`,
          );
        }
        return row;
      });
    },
    async edit(id, body, userId) {
      const d = normalizeDocument({ ...body, paid: "0", payments: [] }),
        reason = textField(body.reason, "Edit reason", true, 1000);
      return atomic(async (client) => {
        const old = (
          await client.query(
            "select *,business_date::text as business_date from sales_purchase_documents where id=$1 for update",
            [id],
          )
        ).rows[0];
        if (!old || old.status !== "POSTED")
          throw new Error("This invoice is unavailable or voided.");
        if (Number(old.revision) !== Number(body.revision))
          throw new Error("This invoice changed. Refresh it before editing.");
        if (old.kind !== d.kind)
          throw new Error("The invoice type cannot be changed.");
        const payments = (
          await client.query(
            "select *,business_date::text as business_date from sales_purchase_payments where document_id=$1 and status='POSTED' order by sales_purchase_payments.business_date",
            [id],
          )
        ).rows;
        if (payments.reduce((sum, p) => sum + cents(p.amount), 0) > d.total)
          throw new Error(
            "The total cannot be less than payments already recorded. Correct the payment first.",
          );
        if (payments.some((p) => p.business_date < d.date))
          throw new Error(
            "The invoice date cannot follow an existing payment.",
          );
        for (const date of [
          ...new Set(
            payments
              .filter((p) => p.method === "Cash")
              .map((p) => p.business_date),
          ),
        ])
          await cashDay(client, date, userId, false);
        const refs = await documentCatalogs(client, d, userId);
        await client.query(
          `update sales_purchase_documents set business_date=$1,invoice_no=$2,party=$3,staff_name=$4,category=$5,before_vat=$6,vat=$7,total=$8,remarks=$9,party_id=$10,staff_id=$11,category_id=$12,revision=revision+1 where id=$13`,
          [
            d.date,
            d.invoice,
            refs.party.name,
            refs.staff?.name || "",
            refs.category.name,
            decimal(d.before),
            decimal(d.vat),
            decimal(d.total),
            d.remarks,
            refs.party.id,
            refs.staff?.id || null,
            refs.category.id,
            id,
          ],
        );
        await client.query(
          `update cash_entries set counterparty=$1,reference_no=$2,description=$3,modified_by=$4,modified_at=now() where id in(select cash_entry_id from sales_purchase_payments where document_id=$5 and status='POSTED')`,
          [
            refs.party.name,
            d.invoice,
            `${d.kind} ${d.invoice} · ${refs.category.name}${refs.staff ? " · " + refs.staff.name : ""}`,
            userId,
            id,
          ],
        );
        await audit(
          client,
          userId,
          "EDIT_SALES_PURCHASE",
          id,
          d.date,
          JSON.stringify({ reason, before: old, after: d }),
        );
        return { id };
      });
    },
    async editPayment(id, body, userId) {
      const p = {
        key: requestKey(body.requestKey),
        date: validDate(body.date),
        method: body.method,
        amount: cents(body.amount, "Payment"),
        reference: textField(body.reference, "Reference", false),
      };
      const reason = textField(body.reason, "Edit reason", true, 1000);
      if (!PAYMENT_METHODS.includes(p.method) || p.amount <= 0)
        throw new Error("Choose a payment method and positive amount.");
      p.hash = fingerprint({ id, paymentId: body.paymentId, ...p, reason });
      return atomic(async (client) => {
        const replayed = await replay(
          client,
          p.key,
          p.hash,
          "sales_purchase_payments",
        );
        if (replayed) return { id: replayed.id, replayed: true };
        const doc = (
          await client.query(
            "select *,business_date::text as business_date from sales_purchase_documents where id=$1 for update",
            [id],
          )
        ).rows[0];
        if (!doc || doc.status !== "POSTED")
          throw new Error("This invoice is unavailable or voided.");
        const old = (
          await client.query(
            "select *,business_date::text as business_date from sales_purchase_payments where id=$1 and document_id=$2 and status='POSTED' for update",
            [body.paymentId, id],
          )
        ).rows[0];
        if (!old)
          throw new Error(
            "This payment has already been changed. Refresh the invoice.",
          );
        if (p.date < doc.business_date)
          throw new Error("Payment date cannot precede the invoice date.");
        const others = (
          await client.query(
            "select coalesce(sum(amount),0) paid from sales_purchase_payments where document_id=$1 and id<>$2 and status='POSTED'",
            [id, old.id],
          )
        ).rows[0].paid;
        if (cents(others) + p.amount > cents(doc.total))
          throw new Error("Payment exceeds the remaining balance.");
        const dates = [
          ...new Set([
            ...(old.method === "Cash" ? [old.business_date] : []),
            ...(p.method === "Cash" ? [p.date] : []),
          ]),
        ].sort();
        for (const date of dates) await cashDay(client, date, userId);
        if (old.cash_entry_id)
          await client.query(
            "update cash_entries set status='VOID',void_reason=$1,modified_by=$2,modified_at=now() where id=$3",
            [reason, userId, old.cash_entry_id],
          );
        await client.query(
          "update sales_purchase_payments set status='VOID' where id=$1",
          [old.id],
        );
        const result = await insertPayment(client, doc, p, userId);
        await audit(
          client,
          userId,
          "EDIT_SALES_PURCHASE_PAYMENT",
          id,
          p.date,
          JSON.stringify({
            reason,
            before: old,
            replacement: result.id,
            after: p,
          }),
        );
        return result;
      });
    },
    async void(id, reason, userId) {
      reason = textField(reason, "Void reason", true, 1000);
      return atomic(async (client) => {
        const doc = (
          await client.query(
            "select *,business_date::text as business_date from sales_purchase_documents where id=$1 for update",
            [id],
          )
        ).rows[0];
        if (!doc) throw new Error("Invoice not found.");
        if (doc.status === "VOID") return { id, replayed: true };
        const days = await client.query(
          "select distinct business_date::text as business_date from sales_purchase_payments where document_id=$1 and status='POSTED' and method='Cash' order by business_date",
          [id],
        );
        for (const day of days.rows)
          await cashDay(client, dateOnly(day.business_date), userId, false);
        await client.query(
          `update cash_entries set status='VOID',void_reason=$1,modified_by=$2,modified_at=now() where id in(select cash_entry_id from sales_purchase_payments where document_id=$3 and status='POSTED' and cash_entry_id is not null)`,
          [reason, userId, id],
        );
        await client.query(
          "update sales_purchase_payments set status='VOID' where document_id=$1",
          [id],
        );
        await client.query(
          "update sales_purchase_documents set status='VOID',void_reason=$1,voided_by=$2,voided_at=now() where id=$3",
          [reason, userId, id],
        );
        await audit(
          client,
          userId,
          "VOID_SALES_PURCHASE",
          id,
          dateOnly(doc.business_date),
          reason,
        );
        return { id };
      });
    },
  };
}
