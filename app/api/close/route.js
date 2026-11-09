import { pushForAudit } from "@/lib/push";
import { requirePermission } from "@/lib/auth";
import { daySnapshot, audit, settingsMap, ensureDay } from "@/lib/business";
import { query, db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
function admin(user) {
  if (user.role !== "Super Admin")
    throw new Error("Super Admin permission required.");
}
export async function GET(req) {
  try {
    const u = await requirePermission("closing");
    const date =
      new URL(req.url).searchParams.get("date") ||
      new Date().toISOString().slice(0, 10);
    return ok(await daySnapshot(date, u.id));
  } catch (e) {
    return fail(
      e.message,
      e.message === "UNAUTHORIZED" ? 401 : e.status || 500,
    );
  }
}
export async function POST(req) {
  try {
    const u = await requirePermission("closing"),
      b = await req.json(),
      actual = Number(b.actual);
    if (!Number.isFinite(actual) || actual < 0)
      throw new Error("Enter a valid counted cash amount.");
    await ensureDay(b.date, u.id);
    const client = await db().connect();
    let expected, variance;
    try {
      await client.query("begin");
      const day = (
        await client.query(
          "select * from cash_days where business_date=$1 for update",
          [b.date],
        )
      ).rows[0];
      if (day.status === "FINALIZED")
        throw new Error(
          "This day is already finalized. Reopen it before closing again.",
        );
      const sums = (
        await client.query(
          "select coalesce(sum(case when direction='IN' then amount else -amount end),0) net from cash_entries where business_date=$1 and status='POSTED'",
          [b.date],
        )
      ).rows[0];
      expected = Number(day.opening_cash) + Number(sums.net);
      variance = actual - expected;
      await client.query(
        "update cash_days set expected_closing=$1,actual_cash=$2,variance=$3,status='FINALIZED',finalized_by=$4,finalized_at=now(),manager_note=$5,updated_at=now() where business_date=$6",
        [expected, actual, variance, u.id, b.note || "", b.date],
      );
      await client.query(
        "insert into audit_log(event_time,user_id,action,entity_type,business_date,detail) values(now(),$1,'FINALIZE_DAY','cash_day',$2,$3)",
        [u.id, b.date, `Actual cash ${actual}`],
      );
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
    await pushForAudit("FINALIZE_DAY", b.date, `Actual cash ${actual}`).catch(
      () => {},
    );
    return ok({ expected, variance });
  } catch (e) {
    return fail(
      e.message,
      e.message === "UNAUTHORIZED" ? 401 : e.status || 400,
    );
  }
}
export async function PATCH(req) {
  try {
    const u = await requirePermission("closing");
    admin(u);
    const b = await req.json(),
      date = String(b.date || "").slice(0, 10);
    const snap = await daySnapshot(date, u.id);
    if (b.action === "reopen") {
      if (snap.day.status !== "FINALIZED")
        throw new Error("This day is already open.");
      await query(
        `update cash_days set status='OPEN',expected_closing=null,actual_cash=null,variance=null,finalized_by=null,finalized_at=null,updated_at=now() where business_date=$1`,
        [date],
      );
      await audit(
        u.id,
        "REOPEN_DAY",
        "cash_day",
        null,
        date,
        b.reason || "Reopened by administrator",
      );
      return ok({ ok: true });
    }
    if (b.action === "opening" || b.action === "resetOpening") {
      let opening = Number(b.opening);
      if (b.action === "resetOpening") {
        const prev = await query(
          "select actual_cash from cash_days where business_date<$1 and status='FINALIZED' and actual_cash is not null order by business_date desc limit 1",
          [date],
        );
        const settings = await settingsMap();
        opening = prev.rows[0]
          ? Number(prev.rows[0].actual_cash)
          : Number(settings.initial_opening_cash || 0);
      }
      if (!Number.isFinite(opening) || opening < 0)
        throw new Error("Enter a valid opening cash amount.");
      const expected = opening + Number(snap.cashIn) - Number(snap.cashOut),
        variance =
          snap.day.status === "FINALIZED"
            ? Number(snap.day.actual_cash) - expected
            : null;
      await query(
        "update cash_days set opening_cash=$1,expected_closing=case when status='FINALIZED' then $2 else expected_closing end,variance=case when status='FINALIZED' then $3 else variance end,updated_at=now() where business_date=$4",
        [opening, expected, variance, date],
      );
      await audit(
        u.id,
        b.action === "resetOpening" ? "RESET_OPENING" : "EDIT_OPENING",
        "cash_day",
        null,
        date,
        `Opening cash ${opening}`,
      );
      return ok({ ok: true, opening });
    }
    throw new Error("Invalid day action.");
  } catch (e) {
    return fail(
      e.message,
      e.message === "UNAUTHORIZED"
        ? 401
        : e.message.includes("permission")
          ? 403
          : 400,
    );
  }
}
