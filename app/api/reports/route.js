import { requirePermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/api";

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const dateKey = (v) =>
  v instanceof Date
    ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
    : String(v ?? "").slice(0, 10);

// Cash in the drawer at the start of `from`: the last finalized physical count
// before `from`, plus every posted movement after that count and before `from`.
async function openingBefore(from) {
  const last = (
    await query(
      `select business_date,actual_cash from cash_days where business_date<$1 and status='FINALIZED' and actual_cash is not null order by business_date desc limit 1`,
      [from],
    )
  ).rows[0];
  let base, after;
  if (last) {
    base = Number(last.actual_cash);
    after = last.business_date;
  } else {
    const s = (
      await query(`select value from settings where key='initial_opening_cash' limit 1`)
    ).rows[0];
    base = Number(s?.value || 0);
    after = null;
  }
  const net = (
    await query(
      `select coalesce(sum(case when direction='IN' then amount else -amount end),0) net from cash_entries where status='POSTED' and business_date<$1 and ($2::date is null or business_date>$2::date)`,
      [from, after],
    )
  ).rows[0];
  return round2(base + Number(net.net));
}

// Day-by-day cash: each day opens with the previous day's closing cash.
// A finalized day closes on its counted cash; an open day on its expected cash.
async function cashDays(from, to, entries) {
  const dayRows = (
    await query(
      `select business_date,opening_cash,actual_cash,expected_closing,variance,status,manager_note,finalized_at from cash_days where business_date between $1 and $2`,
      [from, to],
    )
  ).rows;
  const meta = Object.fromEntries(dayRows.map((r) => [dateKey(r.business_date), r]));
  const moves = {};
  for (const e of entries) {
    const k = dateKey(e.date);
    moves[k] ||= { cash_in: 0, cash_out: 0, count: 0 };
    moves[k].count++;
    if (e.status !== "POSTED") continue;
    if (e.type === "IN") moves[k].cash_in += Number(e.amount);
    else moves[k].cash_out += Number(e.amount);
  }
  const keys = [...new Set([...Object.keys(meta), ...Object.keys(moves)])].sort();
  let carry = await openingBefore(from);
  return keys.map((k) => {
    const m = moves[k] || { cash_in: 0, cash_out: 0, count: 0 },
      d = meta[k],
      opening = carry,
      expected = round2(opening + m.cash_in - m.cash_out),
      finalized = d?.status === "FINALIZED" && d.actual_cash != null,
      closing = finalized ? round2(d.actual_cash) : expected;
    carry = closing;
    return {
      date: k,
      opening,
      cash_in: round2(m.cash_in),
      cash_out: round2(m.cash_out),
      expected,
      counted: finalized ? round2(d.actual_cash) : null,
      variance: finalized ? round2(closing - expected) : 0,
      closing,
      status: d?.status || "OPEN",
      records: m.count,
      note: d?.manager_note || "",
      finalized_at: d?.finalized_at || null,
    };
  });
}

export async function GET(req) {
  try {
    await requirePermission("reports");
    const url = new URL(req.url),
      from =
        url.searchParams.get("from") ||
        new Date().toISOString().slice(0, 8) + "01",
      to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10),
      scope = url.searchParams.get("scope") || "cash";
    let entries = [],
      summary = {};
    if (scope === "bank") {
      entries = (
        await query(
          `select e.business_date date,e.entry_time time,e.direction type,b.name account,c.name category,e.counterparty,e.description,e.reference_no reference,e.amount,e.status from bank_entries e join bank_accounts b on b.id=e.bank_account_id left join categories c on c.id=e.category_id where e.business_date between $1 and $2 order by e.business_date,e.id`,
          [from, to],
        )
      ).rows;
      summary = (
        await query(
          `select coalesce(sum(case when direction='IN' and status='POSTED' then amount else 0 end),0) total_in,coalesce(sum(case when direction='OUT' and status='POSTED' then amount else 0 end),0) total_out from bank_entries where business_date between $1 and $2`,
          [from, to],
        )
      ).rows[0];
      const ob = (
        await query(
          `select coalesce((select sum(opening_balance) from bank_accounts where active=true),0)
            + coalesce((select sum(case when e.direction='IN' then e.amount else -e.amount end)
                from bank_entries e join bank_accounts b on b.id=e.bank_account_id
                where b.active=true and e.status='POSTED' and e.business_date<$1),0) opening`,
          [from],
        )
      ).rows[0];
      summary.opening_balance = round2(ob.opening);
      summary.balance = round2(Number(summary.total_in) - Number(summary.total_out));
      summary.closing_balance = round2(summary.opening_balance + summary.balance);
    } else if (scope === "transfer") {
      entries = (
        await query(
          `select business_date date,entry_time time,direction type,amount_aed,amount_irr,exchange_rate,sender,receiver,payment_channel channel,reference_no reference,description,status from iran_dubai_transfers where business_date between $1 and $2 order by business_date,id`,
          [from, to],
        )
      ).rows;
      summary = (
        await query(
          `select coalesce(sum(case when status='POSTED' then amount_aed else 0 end),0) total_aed,coalesce(sum(case when status='POSTED' then amount_irr else 0 end),0) total_irr,count(*) record_count from iran_dubai_transfers where business_date between $1 and $2`,
          [from, to],
        )
      ).rows[0];
    } else if (scope === "closing") {
      // Same day-by-day carry-forward as the cash report, so both agree.
      const cash = (
        await query(
          `select business_date date,direction type,amount,status from cash_entries where business_date between $1 and $2 order by business_date,id`,
          [from, to],
        )
      ).rows;
      entries = await cashDays(from, to, cash);
      const sum = (k) => round2(entries.reduce((t, x) => t + Number(x[k] || 0), 0));
      summary = {
        opening_cash: entries.length ? entries[0].opening : await openingBefore(from),
        total_in: sum("cash_in"),
        total_out: sum("cash_out"),
        total_variance: sum("variance"),
        day_count: entries.length,
        finalized_count: entries.filter((x) => x.status === "FINALIZED").length,
      };
      summary.final_cash = entries.length
        ? entries[entries.length - 1].closing
        : summary.opening_cash;
    } else {
      entries = (
        await query(
          `select e.business_date date,e.entry_time time,e.direction type,c.name category,e.counterparty,e.description,e.reference_no reference,e.amount,e.status from cash_entries e join categories c on c.id=e.category_id where e.business_date between $1 and $2 order by e.business_date,e.id`,
          [from, to],
        )
      ).rows;
      summary = (
        await query(
          `select coalesce(sum(case when direction='IN' and status='POSTED' then amount else 0 end),0) total_in,coalesce(sum(case when direction='OUT' and status='POSTED' then amount else 0 end),0) total_out,coalesce((select opening_cash from cash_days where business_date between $1 and $2 order by business_date limit 1),0) opening_cash from cash_entries where business_date between $1 and $2`,
          [from, to],
        )
      ).rows[0];
      const days = await cashDays(from, to, entries);
      summary.opening_cash = days.length ? days[0].opening : await openingBefore(from);
      summary.running_cash = days.length
        ? days[days.length - 1].closing
        : Number(summary.opening_cash);
      summary.day_count = days.length;
      return ok({ scope, from, to, entries, summary, days });
    }
    return ok({ scope, from, to, entries, summary });
  } catch (e) {
    return fail(e.message, e.message === "UNAUTHORIZED" ? 401 : 500);
  }
}
