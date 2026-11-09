import { requireAnyPermission, requirePermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureDay, postCash, transfer, audit } from "@/lib/business";
import { ok, fail } from "@/lib/api";
export async function GET(req) {
  try {
    await requireAnyPermission(["transactions", "movements"]);
    const u = new URL(req.url),
      date =
        u.searchParams.get("date") || new Date().toISOString().slice(0, 10),
      all = u.searchParams.get("all") === "1",
      search = (u.searchParams.get("search") || "").trim().slice(0, 200),
      page = Math.max(1, Math.floor(Number(u.searchParams.get("page")) || 1));
    const where = `($1::boolean or e.business_date=$2::date) and ($3='' or strpos(lower(concat_ws(' ',e.id::text,e.business_date::text,e.direction,c.name,e.counterparty,e.description,e.reference_no,e.amount::text,e.status,u.display_name)),lower($3))>0)`;
    const joins =
      "from cash_entries e join categories c on c.id=e.category_id left join users u on u.id=e.created_by";
    const [cats, parties, entries, total] = await Promise.all([
      query(
        "select id,name,direction,account_scope from categories where active=true order by sort_order,name",
      ),
      query("select name from counterparties where active=true order by name"),
      query(
        `select e.id,e.business_date::text business_date,e.entry_time,e.direction,e.category_id,c.name category,e.counterparty,e.description,e.reference_no,e.amount,e.status,e.transfer_group,u.display_name created_by ${joins} where ${where} order by e.business_date desc,e.id desc limit 100 offset $4`,
        [all, date, search, (page - 1) * 100],
      ),
      query(`select count(*) count ${joins} where ${where}`, [
        all,
        date,
        search,
      ]),
    ]);
    return ok({
      categories: cats.rows,
      parties: parties.rows.map((x) => x.name),
      entries: entries.rows,
      count: Number(total.rows[0].count),
      page,
    });
  } catch (e) {
    return fail(
      e.message,
      e.message === "UNAUTHORIZED" ? 401 : e.status || 400,
    );
  }
}
export async function POST(req) {
  try {
    const user = await requirePermission("transactions");
    const b = await req.json();
    await ensureDay(b.date, user.id);
    if (
      b.movement === "Deposit to Bank" ||
      b.movement === "Withdraw from Bank"
    ) {
      await transfer({
        date: b.date,
        mode:
          b.movement === "Deposit to Bank"
            ? "Cash → Bank Deposit"
            : "Bank → Cash Withdrawal",
        amount: b.amount,
        counterparty: b.counterparty,
        description: b.description,
        reference: b.reference,
        userId: user.id,
      });
      await audit(
        user.id,
        "POST_LINKED_TRANSFER",
        "transfer",
        null,
        b.date,
        `${b.movement} ${b.amount}`,
      );
    } else {
      const id = await postCash({
        date: b.date,
        direction: b.movement === "Money In" ? "IN" : "OUT",
        amount: b.amount,
        categoryId: b.categoryId,
        counterparty: b.counterparty || "",
        description: b.description || "",
        reference: b.reference || "",
        userId: user.id,
      });
      await audit(
        user.id,
        "POST_CASH",
        "cash_entry",
        id,
        b.date,
        `${b.movement} ${b.amount}`,
      );
    }
    return ok({ ok: true });
  } catch (e) {
    return fail(e.message, 500);
  }
}
