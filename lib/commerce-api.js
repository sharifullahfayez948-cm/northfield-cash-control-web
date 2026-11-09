import { requirePermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureCommerceSchema, commerce } from "@/lib/commerce";
import {
  businessToday,
  validDate,
  cents,
  decimal,
} from "@/lib/commerce-model.mjs";
import { ok, fail } from "@/lib/api";

function scope(kind) {
  if (!["SALE", "PURCHASE", "EXPENSE", "BUYING"].includes(kind))
    throw new Error("Choose a valid register.");
  return kind === "SALE" ? "sales" : "purchases";
}
function errorResponse(e) {
  return fail(
    ["42P01", "42703", "42501"].includes(e.code)
      ? "The sales and purchases workspace needs database setup. Contact the administrator."
      : e.message,
    e.message === "UNAUTHORIZED" ? 401 : e.status || 400,
  );
}
const joins = `left join sales_purchase_catalog a on a.id=d.party_id left join sales_purchase_catalog s on s.id=d.staff_id left join sales_purchase_catalog c on c.id=d.category_id`;
const paid = `coalesce((select sum(p.amount) from sales_purchase_payments p where p.document_id=d.id and p.status='POSTED'),0)`;
const fields = `d.*,d.business_date::text date,coalesce(a.name,d.party) party,coalesce(s.name,d.staff_name) staff_name,coalesce(c.name,d.category) category,${paid} paid,d.total-${paid} balance`;
const find = `lower(concat_ws(' ',d.id::text,'TX-'||d.id,d.invoice_no,a.name,a.phone,d.party,s.name,d.staff_name,c.name,d.category,d.remarks,d.total::text,d.status))`;
async function catalogList(sales) {
  return (
    await query(
      "select * from sales_purchase_catalog where active=true and kind=any($1::text[]) order by name",
      [
        sales
          ? ["CUSTOMER", "STAFF", "SALE_CATEGORY"]
          : ["SUPPLIER", "BUY_CATEGORY"],
      ],
    )
  ).rows;
}

export async function GET(req) {
  try {
    const u = new URL(req.url),
      kind = u.searchParams.get("kind") || "SALE",
      sales = kind === "SALE",
      user = await requirePermission(scope(kind));
    await ensureCommerceSchema(user);
    if (u.searchParams.get("catalog") === "1")
      return ok({ catalog: await catalogList(sales) });
    if (u.searchParams.has("id")) {
      const id = u.searchParams.get("id");
      if (!/^\d+$/.test(id)) throw new Error("Invalid invoice.");
      const doc = (
        await query(
          `select ${fields},a.phone,a.address,a.tax_no from sales_purchase_documents d ${joins} where d.id=$1`,
          [id],
        )
      ).rows[0];
      if (!doc) throw new Error("Invoice not found.");
      await requirePermission(scope(doc.kind));
      const payments = (
        await query(
          "select id,business_date::text date,method,amount,reference_no,cash_entry_id,status from sales_purchase_payments where document_id=$1 order by business_date,id",
          [id],
        )
      ).rows;
      return ok({ document: doc, payments });
    }
    if (u.searchParams.get("accounts") === "1") {
      const search = (u.searchParams.get("search") || "").trim().slice(0, 200),
        page = Math.max(1, Math.floor(Number(u.searchParams.get("page")) || 1));
      const rows = (
        await query(
          `with balances as (
   select a.*,coalesce(sum(d.total) filter(where d.status='POSTED'),0) charged,coalesce(sum(${paid}) filter(where d.status='POSTED'),0) paid,
   coalesce(sum(d.total-${paid}) filter(where d.status='POSTED'),0) balance,
   count(d.id) filter(where d.status='POSTED' and d.total>${paid}) open_invoices,
   coalesce(max(greatest(0,$3::date-d.business_date)) filter(where d.status='POSTED' and d.total>${paid}),0) oldest_days,
   coalesce(sum(d.total-${paid}) filter(where d.status='POSTED' and $3::date-d.business_date<=30),0) age30,
   coalesce(sum(d.total-${paid}) filter(where d.status='POSTED' and $3::date-d.business_date between 31 and 60),0) age60,
   coalesce(sum(d.total-${paid}) filter(where d.status='POSTED' and $3::date-d.business_date>60),0) age_over60
   from sales_purchase_catalog a left join sales_purchase_documents d on d.party_id=a.id
   where a.kind=$1 and ($2='' or strpos(lower(concat_ws(' ',a.name,a.phone,a.id,(case when a.kind='CUSTOMER' then 'CUS-' else 'SUP-' end)||lpad(a.id::text,6,'0'))),lower($2))>0 or exists(select 1 from sales_purchase_documents x where x.party_id=a.id and (strpos(lower(x.invoice_no||' TX-'||x.id),lower($2))>0 or x.id::text=$2 or exists(select 1 from sales_purchase_payments pp where pp.document_id=x.id and strpos(lower(concat_ws(' ',pp.reference_no,'PAY-'||pp.id,'CASH-'||pp.cash_entry_id)),lower($2))>0))))
   group by a.id
  ) select * from balances order by balance desc,name`,
          [sales ? "CUSTOMER" : "SUPPLIER", search, businessToday()],
        )
      ).rows;
      const age = u.searchParams.get("age") || "ALL",
        outstanding = u.searchParams.get("outstanding") === "1";
      const filtered = rows.filter(
        (r) =>
          (!outstanding || Number(r.balance) > 0) &&
          (age !== "OVER30" || Number(r.oldest_days) > 30) &&
          (age !== "NO_PHONE" || !r.phone),
      );
      if (u.searchParams.get("sort") === "NAME")
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      const totals = filtered.reduce(
        (sum, r) => {
          for (const key of ["balance", "age30", "age60", "age_over60"])
            sum[key] += cents(r[key]);
          sum.open_invoices += Number(r.open_invoices);
          return sum;
        },
        { balance: 0, age30: 0, age60: 0, age_over60: 0, open_invoices: 0 },
      );
      for (const key of ["balance", "age30", "age60", "age_over60"])
        totals[key] = decimal(totals[key]);
      return ok({
        accounts: filtered.slice((page - 1) * 50, page * 50),
        count: filtered.length,
        page,
        totals,
      });
    }
    if (u.searchParams.has("accountId")) {
      const id = u.searchParams.get("accountId");
      if (!/^\d+$/.test(id)) throw new Error("Invalid account.");
      const account = (
        await query(
          "select * from sales_purchase_catalog where id=$1 and kind=$2",
          [id, sales ? "CUSTOMER" : "SUPPLIER"],
        )
      ).rows[0];
      if (!account) throw new Error("Account not found.");
      const docs = (
        await query(
          `select ${fields} from sales_purchase_documents d ${joins} where d.party_id=$1 order by d.business_date,d.id limit 10001`,
          [id],
        )
      ).rows;
      if (docs.length > 10000)
        throw new Error(
          "This account exceeds the 10,000 invoice statement limit. Contact the administrator.",
        );
      const payments = (
        await query(
          `select p.id,p.document_id,p.business_date::text date,p.method,p.amount,p.reference_no,p.status,d.invoice_no from sales_purchase_payments p join sales_purchase_documents d on d.id=p.document_id where d.party_id=$1 order by p.business_date,p.id`,
          [id],
        )
      ).rows;
      const ledger = [
        ...docs
          .filter((d) => d.status === "POSTED")
          .map((d) => ({
            date: d.date,
            type: d.kind,
            reference: d.invoice_no,
            document_id: d.id,
            debit: sales ? d.total : "0",
            credit: sales ? "0" : d.total,
            order: 0,
            id: d.id,
          })),
        ...payments
          .filter((p) => p.status === "POSTED")
          .map((p) => ({
            date: p.date,
            type: p.method,
            reference: p.invoice_no,
            document_id: p.document_id,
            debit: sales ? "0" : p.amount,
            credit: sales ? p.amount : "0",
            order: 1,
            id: p.id,
          })),
      ].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.order - b.order ||
          Number(a.id) - Number(b.id),
      );
      let balance = 0;
      for (const row of ledger) {
        balance += (cents(row.debit) - cents(row.credit)) * (sales ? 1 : -1);
        row.balance = decimal(balance);
      }
      return ok({
        account,
        documents: docs,
        payments,
        ledger,
        balance: decimal(balance),
      });
    }
    const today = businessToday(),
      all = u.searchParams.get("all") === "1",
      from = validDate(
        all
          ? "1900-01-01"
          : u.searchParams.get("from") || `${today.slice(0, 7)}-01`,
      ),
      to = validDate(all ? "2999-12-31" : u.searchParams.get("to") || today);
    if (from > to)
      throw new Error("The start date must not follow the end date.");
    const staff = (u.searchParams.get("staff") || "").trim(),
      search = (u.searchParams.get("search") || "").trim().slice(0, 200),
      page = Math.max(1, Math.floor(Number(u.searchParams.get("page")) || 1)),
      exporting = u.searchParams.get("export") === "1",
      kinds = sales
        ? ["SALE"]
        : kind === "BUYING"
          ? ["PURCHASE", "EXPENSE"]
          : [kind];
    const params = [kinds, from, to, staff, search];
    const searchClause = `($5='' or strpos(${find},lower($5))>0 or exists(select 1 from sales_purchase_payments pp where pp.document_id=d.id and strpos(lower(concat_ws(' ',pp.method,pp.reference_no,'PAY-'||pp.id,'CASH-'||pp.cash_entry_id)),lower($5))>0))`;
    const common = `d.kind=any($1::text[]) and ($4='' or coalesce(s.name,d.staff_name)=$4) and ${searchClause}`;
    const where = `${common} and d.business_date between $2::date and $3::date`;
    const [rows, totals, doctors, categories, payments, catalog] =
      await Promise.all([
        query(
          `select ${fields} from sales_purchase_documents d ${joins} where ${where} order by d.business_date desc,d.id desc limit $6 offset $7`,
          [...params, exporting ? 10001 : 50, exporting ? 0 : (page - 1) * 50],
        ),
        query(
          `select count(*) count,count(*) filter(where d.status='POSTED') posted_count,coalesce(sum(d.before_vat) filter(where d.status='POSTED'),0) before_vat,coalesce(sum(d.vat) filter(where d.status='POSTED'),0) vat,coalesce(sum(d.total) filter(where d.status='POSTED'),0) total,coalesce(sum(${paid}) filter(where d.status='POSTED'),0) paid from sales_purchase_documents d ${joins} where ${where}`,
          params,
        ),
        query(
          `select coalesce(s.name,d.staff_name) staff_name,count(*) entries,sum(d.before_vat) before_vat,sum(d.vat) vat,sum(d.total) total,sum(${paid}) paid from sales_purchase_documents d ${joins} where ${where} and d.status='POSTED' group by coalesce(s.name,d.staff_name) order by total desc`,
          params,
        ),
        query(
          `select coalesce(c.name,d.category) category,count(*) entries,sum(d.before_vat) before_vat,sum(d.vat) vat,sum(d.total) total from sales_purchase_documents d ${joins} where ${where} and d.status='POSTED' group by coalesce(c.name,d.category) order by total desc`,
          params,
        ),
        query(
          `select p.method,sum(p.amount) amount from sales_purchase_payments p join sales_purchase_documents d on d.id=p.document_id ${joins} where ${common} and p.business_date between $2::date and $3::date and p.status='POSTED' and d.status='POSTED' group by p.method order by p.method`,
          params,
        ),
        catalogList(sales),
      ]);
    if (exporting && rows.rows.length > 10000)
      throw new Error(
        "Choose a shorter period to export at most 10,000 entries.",
      );
    return ok({
      rows: rows.rows,
      totals: totals.rows[0],
      doctors: doctors.rows,
      categories: categories.rows,
      payments: payments.rows,
      catalog,
      staff: catalog.filter((r) => r.kind === "STAFF").map((r) => r.name),
      categoryOptions: catalog
        .filter((r) => r.kind.endsWith("_CATEGORY"))
        .map((r) => r.name),
      page,
      pageSize: 50,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req) {
  try {
    const b = await req.json(),
      user = await requirePermission(scope(b.kind));
    if (user.role === "Viewer")
      return fail("View-only accounts cannot change financial entries.", 403);
    await ensureCommerceSchema(user);
    if (b.action === "catalog") {
      const required = ["CUSTOMER", "STAFF", "SALE_CATEGORY"].includes(
        b.catalogKind,
      )
        ? "sales"
        : "purchases";
      await requirePermission(required);
      return ok(await commerce().saveCatalog(b, user.id));
    }
    if (b.action === "create") return ok(await commerce().create(b, user.id));
    if (b.action === "settle")
      return ok(await commerce().settleAccount(b, user.id));
    if (!/^\d+$/.test(String(b.id))) throw new Error("Invalid invoice.");
    const doc = (
      await query("select kind from sales_purchase_documents where id=$1", [
        b.id,
      ])
    ).rows[0];
    if (!doc) throw new Error("Invoice not found.");
    await requirePermission(scope(doc.kind));
    if (b.action === "pay") return ok(await commerce().pay(b.id, b, user.id));
    if (b.action === "edit") return ok(await commerce().edit(b.id, b, user.id));
    if (b.action === "editPayment")
      return ok(await commerce().editPayment(b.id, b, user.id));
    if (b.action === "void") {
      if (user.role !== "Super Admin")
        return fail("Super Admin permission required to void an invoice.", 403);
      return ok(await commerce().void(b.id, b.reason, user.id));
    }
    throw new Error("Invalid action.");
  } catch (e) {
    return errorResponse(e);
  }
}
