import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import {
  ensureAttendanceSchema,
  nextAttendanceEvent,
  verifyAttendanceToken,
} from "@/lib/attendance";

const dubaiDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export async function GET() {
  try {
    const user = await requireUser();
    await ensureAttendanceSchema();
    const date = dubaiDate();
    const [events, profile, month] = await Promise.all([
      query(
        "select id,event_type,event_time,source,note from attendance_events where user_id=$1 and work_date=$2 order by event_time",
        [user.id, date],
      ),
      query(
        `select p.*,u.display_name,u.username from users u left join employee_profiles p on p.user_id=u.id where u.id=$1`,
        [user.id],
      ),
      query(
        `with daily as (
        select work_date,min(event_time) filter(where event_type='CLOCK_IN') clock_in,max(event_time) filter(where event_type='CLOCK_OUT') clock_out
        from attendance_events where user_id=$1 and work_date>=date_trunc('month',now() at time zone 'Asia/Dubai')::date group by work_date
      ), p as (select shift_start,shift_end,break_minutes,grace_minutes from employee_profiles where user_id=$1)
      select d.*,
        case when d.clock_out is not null then greatest(0,floor(extract(epoch from(d.clock_out-d.clock_in))/60)-coalesce(p.break_minutes,0))::int end worked_minutes,
        greatest(0,floor(extract(epoch from((d.clock_in at time zone 'Asia/Dubai')-(d.work_date+coalesce(p.shift_start,'09:00'::time))))/60)-coalesce(p.grace_minutes,10))::int late_minutes,
        case when d.clock_out is not null then greatest(0,(floor(extract(epoch from(d.clock_out-d.clock_in))/60)-coalesce(p.break_minutes,0))-floor(extract(epoch from(coalesce(p.shift_end,'18:00'::time)-coalesce(p.shift_start,'09:00'::time)))/60))::int end overtime_minutes
      from daily d left join p on true order by d.work_date desc`,
        [user.id],
      ),
    ]);
    return ok({
      date,
      events: events.rows,
      profile: profile.rows[0],
      history: month.rows,
      nextEvent: nextAttendanceEvent(events.rows),
    });
  } catch (e) {
    return fail(e.message, e.message === "UNAUTHORIZED" ? 401 : 500);
  }
}

export async function POST(req) {
  try {
    const user = await requireUser();
    await ensureAttendanceSchema();
    const body = await req.json();
    if (!verifyAttendanceToken(body.token))
      return fail(
        "This QR code has expired. Scan the current code again.",
        400,
      );
    const date = dubaiDate();
    const events = await query(
      "select event_type,event_time from attendance_events where user_id=$1 and work_date=$2 order by event_time",
      [user.id, date],
    );
    const expected = nextAttendanceEvent(events.rows),
      requested = String(body.eventType || expected);
    if (
      requested !== expected &&
      !(expected === "CLOCK_OUT" && requested === "BREAK_START")
    )
      return fail(
        `Next allowed action is ${expected.replaceAll("_", " ")}.`,
        409,
      );
    const r = await query(
      `insert into attendance_events(user_id,event_type,work_date,source,device_label,note) values($1,$2,$3,'QR',$4,$5) returning id,event_type,event_time`,
      [
        user.id,
        requested,
        date,
        String(body.deviceLabel || "").slice(0, 160),
        String(body.note || "").slice(0, 300),
      ],
    );
    return ok({ event: r.rows[0] });
  } catch (e) {
    return fail(e.message, e.message === "UNAUTHORIZED" ? 401 : 500);
  }
}
