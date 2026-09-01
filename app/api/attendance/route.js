import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import {
  ensureAttendanceSchema,
  nextAttendanceEvent,
  distanceMeters,
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
    const [events, profile, month, totals, trend, leaves] = await Promise.all([
      query(
        "select id,event_type,event_time,source,note,distance_meters,outside_geofence,latitude,longitude,location_accuracy from attendance_events where user_id=$1 and work_date=$2 order by event_time",
        [user.id, date],
      ),
      query(
        `select p.*,u.display_name,u.username,u.email,u.role from users u left join employee_profiles p on p.user_id=u.id where u.id=$1`,
        [user.id],
      ),
      query(
        `with ordered as (
        select work_date,event_type,event_time,lead(event_type) over(partition by work_date order by event_time,id) next_type,lead(event_time) over(partition by work_date order by event_time,id) next_time
        from attendance_events where user_id=$1 and work_date>=date_trunc('month',now() at time zone 'Asia/Dubai')::date
      ), daily as (
        select work_date,min(event_time) filter(where event_type='CLOCK_IN') clock_in,
          max(next_time) filter(where event_type='CLOCK_IN' and next_type='CLOCK_OUT') clock_out,
          coalesce(sum(extract(epoch from(next_time-event_time))/60) filter(where event_type='CLOCK_IN' and next_type='CLOCK_OUT'),0)::int worked_minutes
        from ordered group by work_date
      ), p as (select shift_start,shift_end,grace_minutes from employee_profiles where user_id=$1)
      select d.*,
        d.worked_minutes,
        greatest(0,floor(extract(epoch from((d.clock_in at time zone 'Asia/Dubai')-(d.work_date+coalesce(p.shift_start,'09:00'::time))))/60)-coalesce(p.grace_minutes,10))::int late_minutes,
        greatest(0,d.worked_minutes-floor(extract(epoch from(coalesce(p.shift_end,'18:00'::time)-coalesce(p.shift_start,'09:00'::time)))/60))::int overtime_minutes
      from daily d left join p on true order by d.work_date desc`,
        [user.id],
      ),
      query(
        `with ordered as (
          select work_date,event_type,event_time,lead(event_type) over(partition by work_date order by event_time,id) next_type,lead(event_time) over(partition by work_date order by event_time,id) next_time
          from attendance_events where user_id=$1
        ), mins as (
          select work_date,coalesce(sum(greatest(0,extract(epoch from(next_time-event_time))/60)) filter(where event_type='CLOCK_IN' and next_type='CLOCK_OUT'),0)::int worked
          from ordered group by work_date
        ) select
          coalesce(sum(worked) filter(where work_date=(now() at time zone 'Asia/Dubai')::date),0)::int today_minutes,
          coalesce(sum(worked) filter(where date_trunc('month',work_date)=date_trunc('month',now() at time zone 'Asia/Dubai')),0)::int month_minutes,
          coalesce(sum(worked) filter(where date_trunc('year',work_date)=date_trunc('year',now() at time zone 'Asia/Dubai')),0)::int year_minutes
        from mins`,
        [user.id],
      ),
      query(
        `with months as (select generate_series(date_trunc('month',now() at time zone 'Asia/Dubai')-interval '5 months',date_trunc('month',now() at time zone 'Asia/Dubai'),interval '1 month')::date as month_start),
        ordered as (select work_date,event_type,event_time,lead(event_type) over(partition by work_date order by event_time,id) next_type,lead(event_time) over(partition by work_date order by event_time,id) next_time from attendance_events where user_id=$1),
        worked as (select date_trunc('month',work_date)::date as month_start,sum(greatest(0,extract(epoch from(next_time-event_time))/60))::int as minutes from ordered where event_type='CLOCK_IN' and next_type='CLOCK_OUT' group by date_trunc('month',work_date)::date)
        select m.month_start,coalesce(w.minutes,0)::int as minutes from months m left join worked w on w.month_start=m.month_start order by m.month_start`,
        [user.id],
      ),
      query(
        `select id,leave_type,date_from,date_to,note,status,manager_note,created_at from attendance_leave_requests where user_id=$1 order by created_at desc limit 30`,
        [user.id],
      ),
    ]);
    return ok({
      date,
      events: events.rows,
      profile: profile.rows[0],
      history: month.rows,
      totals: totals.rows[0] || {},
      trend: trend.rows,
      leaves: leaves.rows,
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
    if (body.kind === "leave") {
      const type = String(body.leaveType || "OTHER").toUpperCase();
      if (!["ANNUAL", "SICK", "UNPAID", "OTHER"].includes(type))
        return fail("Invalid leave type.", 400);
      if (!body.dateFrom || !body.dateTo)
        return fail("Leave start and end dates are required.", 400);
      const result = await query(
        `insert into attendance_leave_requests(user_id,leave_type,date_from,date_to,note) values($1,$2,$3,$4,$5) returning *`,
        [
          user.id,
          type,
          body.dateFrom,
          body.dateTo,
          String(body.note || "").slice(0, 500),
        ],
      );
      return ok({ leave: result.rows[0] });
    }
    const site = (await query("select * from attendance_site where id=1"))
      .rows[0];
    if (!site || String(body.token) !== String(site.static_token))
      return fail("Invalid workplace QR code.", 400);
    const latitude = Number(body.latitude),
      longitude = Number(body.longitude),
      accuracy = Number(body.accuracy || 0);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      return fail("Location permission is required for attendance.", 400);
    if (site.latitude == null || site.longitude == null)
      return fail(
        "The manager must configure the workplace location first.",
        409,
      );
    const distance = distanceMeters(
      latitude,
      longitude,
      Number(site.latitude),
      Number(site.longitude),
    );
    const outside = distance > Number(site.radius_meters || 200),
      ip = String(
        req.headers.get("x-forwarded-for") ||
          req.headers.get("x-real-ip") ||
          "",
      )
        .split(",")[0]
        .trim();
    const date = dubaiDate();
    const events = await query(
      "select event_type,event_time from attendance_events where user_id=$1 and work_date=$2 order by event_time",
      [user.id, date],
    );
    const expected = nextAttendanceEvent(events.rows),
      requested = String(body.eventType || expected);
    if (requested !== expected)
      return fail(
        `Next allowed action is ${expected.replaceAll("_", " ")}.`,
        409,
      );
    if (outside && site.block_outside) {
      await query(
        `insert into attendance_attempts(user_id,event_type,latitude,longitude,location_accuracy,distance_meters,accepted,reason,ip_address,device_label) values($1,$2,$3,$4,$5,$6,false,'OUTSIDE_GEOFENCE',$7,$8)`,
        [
          user.id,
          requested,
          latitude,
          longitude,
          accuracy,
          distance,
          ip,
          String(body.deviceLabel || "").slice(0, 160),
        ],
      );
      return fail(
        `You are ${distance >= 1000 ? (distance / 1000).toFixed(2) + " km" : Math.round(distance) + " m"} away from the workplace. This attempt was logged.`,
        403,
      );
    }
    const r = await query(
      `insert into attendance_events(user_id,event_type,work_date,source,device_label,note,latitude,longitude,location_accuracy,distance_meters,outside_geofence,ip_address) values($1,$2,$3,'QR',$4,$5,$6,$7,$8,$9,$10,$11) returning id,event_type,event_time,distance_meters,outside_geofence`,
      [
        user.id,
        requested,
        date,
        String(body.deviceLabel || "").slice(0, 160),
        String(body.note || "").slice(0, 300),
        latitude,
        longitude,
        accuracy,
        distance,
        outside,
        ip,
      ],
    );
    await query(
      `insert into attendance_attempts(user_id,event_type,latitude,longitude,location_accuracy,distance_meters,accepted,reason,ip_address,device_label) values($1,$2,$3,$4,$5,$6,true,$7,$8,$9)`,
      [
        user.id,
        requested,
        latitude,
        longitude,
        accuracy,
        distance,
        outside ? "OUTSIDE_ALLOWED" : "WITHIN_GEOFENCE",
        ip,
        String(body.deviceLabel || "").slice(0, 160),
      ],
    );
    return ok({ event: r.rows[0] });
  } catch (e) {
    return fail(e.message, e.message === "UNAUTHORIZED" ? 401 : 500);
  }
}
