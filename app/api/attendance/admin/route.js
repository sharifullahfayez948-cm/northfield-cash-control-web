import {
  requireUser,
  hashPassword,
  ensurePermissionsSchema,
  PERMISSION_KEYS,
} from "@/lib/auth";
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { ensureAttendanceSchema } from "@/lib/attendance";
import crypto from "crypto";

function manager(user) {
  if (!["Super Admin", "Manager"].includes(user.role)) {
    const e = new Error("Manager access required.");
    e.status = 403;
    throw e;
  }
}
export async function GET(req) {
  try {
    const user = await requireUser();
    manager(user);
    await ensureAttendanceSchema();
    await query(
      `insert into attendance_site(id,static_token) values(1,$1) on conflict(id) do nothing`,
      [crypto.randomBytes(32).toString("hex")],
    );
    await ensurePermissionsSchema();
    const url = new URL(req.url),
      from =
        url.searchParams.get("from") ||
        new Date().toISOString().slice(0, 8) + "01",
      to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10),
      selected = Number(url.searchParams.get("userId") || 0);
    const [staff, today, records, attempts, site, summary] = await Promise.all([
      query(
        `select u.id,u.display_name,u.username,u.email,u.active,u.role,p.employee_code,p.job_title,p.phone,p.committed_hours,p.shift_start,p.shift_end,p.break_minutes,p.grace_minutes,p.work_days,p.overtime_requires_approval from users u left join employee_profiles p on p.user_id=u.id where u.role<>'Super Admin' order by u.display_name`,
      ),
      query(
        `select u.id,u.display_name,min(a.event_time) filter(where a.event_type='CLOCK_IN') clock_in,max(a.event_time) filter(where a.event_type='CLOCK_OUT') clock_out,max(a.event_type) last_event from users u left join attendance_events a on a.user_id=u.id and a.work_date=(now() at time zone 'Asia/Dubai')::date where u.role<>'Super Admin' group by u.id,u.display_name order by u.display_name`,
      ),
      query(
        `select a.id,a.work_date,u.display_name,u.username,a.event_type,a.event_time,a.distance_meters,a.outside_geofence,a.latitude,a.longitude,a.location_accuracy from attendance_events a join users u on u.id=a.user_id where a.work_date between $1 and $2 and ($3::bigint=0 or a.user_id=$3) order by a.work_date desc,a.event_time desc`,
        [from, to, selected],
      ),
      query(
        `select x.id,x.attempted_at,u.display_name,x.event_type,x.distance_meters,x.accepted,x.reason,x.latitude,x.longitude,x.location_accuracy from attendance_attempts x left join users u on u.id=x.user_id where (x.attempted_at at time zone 'Asia/Dubai')::date between $1 and $2 and ($3::bigint=0 or x.user_id=$3) order by x.attempted_at desc limit 300`,
        [from, to, selected],
      ),
      query(
        "select site_name,latitude,longitude,radius_meters,block_outside from attendance_site where id=1",
      ),
      query(
        `with daily as (select user_id,work_date,min(event_time) filter(where event_type='CLOCK_IN') clock_in,max(event_time) filter(where event_type='CLOCK_OUT') clock_out from attendance_events where work_date between $1 and $2 and ($3::bigint=0 or user_id=$3) group by user_id,work_date) select d.work_date,u.display_name,d.clock_in,d.clock_out,case when d.clock_out is not null then greatest(0,floor(extract(epoch from(d.clock_out-d.clock_in))/60)-coalesce(p.break_minutes,0))::int end worked_minutes,greatest(0,floor(extract(epoch from((d.clock_in at time zone 'Asia/Dubai')-(d.work_date+coalesce(p.shift_start,'09:00'::time))))/60)-coalesce(p.grace_minutes,10))::int late_minutes,case when d.clock_out is not null then greatest(0,(floor(extract(epoch from(d.clock_out-d.clock_in))/60)-coalesce(p.break_minutes,0))-floor(extract(epoch from(coalesce(p.shift_end,'18:00'::time)-coalesce(p.shift_start,'09:00'::time)))/60))::int end overtime_minutes from daily d join users u on u.id=d.user_id left join employee_profiles p on p.user_id=d.user_id order by d.work_date desc,u.display_name`,
        [from, to, selected],
      ),
    ]);
    return ok({
      staff: staff.rows,
      today: today.rows,
      records: records.rows,
      attempts: attempts.rows,
      site: site.rows[0] || null,
      summary: summary.rows,
      from,
      to,
      selected,
    });
  } catch (e) {
    const duplicate = String(e.message).includes("duplicate key");
    return fail(
      duplicate
        ? "That username or employee code is already in use."
        : e.message,
      e.message === "UNAUTHORIZED" ? 401 : e.status || 500,
    );
  }
}
export async function POST(req) {
  try {
    const actor = await requireUser();
    manager(actor);
    await ensureAttendanceSchema();
    const b = await req.json();
    if (b.kind === "site") {
      const latitude = Number(b.latitude),
        longitude = Number(b.longitude),
        radius = Math.max(20, Number(b.radiusMeters || 200));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
        throw new Error("Valid workplace coordinates are required.");
      await query(
        `update attendance_site set site_name=$1,latitude=$2,longitude=$3,radius_meters=$4,block_outside=$5,updated_at=now() where id=1`,
        [
          String(b.siteName || "Northfield Clinic").trim(),
          latitude,
          longitude,
          radius,
          b.blockOutside !== false,
        ],
      );
      return ok({ ok: true });
    }
    if (b.kind === "create_staff") {
      const username = String(b.username || "")
          .trim()
          .toLowerCase(),
        name = String(b.name || "").trim(),
        password = String(b.password || "");
      if (!username || !name || password.length < 8)
        throw new Error(
          "Name, username and an 8+ character password are required.",
        );
      const created = await query(
          `insert into users(username,display_name,email,role,password_hash,active,created_at,updated_at) values($1,$2,$3,'Staff',$4,true,now(),now()) returning id`,
          [
            username,
            name,
            String(b.email || "")
              .trim()
              .toLowerCase() || null,
            hashPassword(password),
          ],
        ),
        userId = created.rows[0].id;
      for (const key of PERMISSION_KEYS)
        await query(
          `insert into user_permissions(user_id,permission_key,allowed,updated_at) values($1,$2,$3,now()) on conflict(user_id,permission_key) do update set allowed=excluded.allowed,updated_at=now()`,
          [userId, key, key === "attendance"],
        );
      await query(
        `insert into employee_profiles(user_id,employee_code,job_title,phone,committed_hours,shift_start,shift_end,break_minutes,grace_minutes,work_days,overtime_requires_approval) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          userId,
          String(b.employeeCode || "").trim() || null,
          String(b.jobTitle || "Staff").trim(),
          String(b.phone || "").trim(),
          Number(b.committedHours || 48),
          b.shiftStart || "09:00",
          b.shiftEnd || "18:00",
          Number(b.breakMinutes ?? 60),
          Number(b.graceMinutes ?? 10),
          String(b.workDays || "1,2,3,4,5,6"),
          b.overtimeRequiresApproval !== false,
        ],
      );
      return ok({ ok: true, userId });
    }
    const userId = Number(b.userId);
    if (!userId) throw new Error("Employee is required.");
    await query(
      `insert into employee_profiles(user_id,employee_code,job_title,phone,committed_hours,shift_start,shift_end,break_minutes,grace_minutes,work_days,overtime_requires_approval,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()) on conflict(user_id) do update set employee_code=excluded.employee_code,job_title=excluded.job_title,phone=excluded.phone,committed_hours=excluded.committed_hours,shift_start=excluded.shift_start,shift_end=excluded.shift_end,break_minutes=excluded.break_minutes,grace_minutes=excluded.grace_minutes,work_days=excluded.work_days,overtime_requires_approval=excluded.overtime_requires_approval,updated_at=now()`,
      [
        userId,
        String(b.employeeCode || "").trim() || null,
        String(b.jobTitle || "Staff").trim(),
        String(b.phone || "").trim(),
        Number(b.committedHours || 48),
        b.shiftStart || "09:00",
        b.shiftEnd || "18:00",
        Number(b.breakMinutes || 0),
        Number(b.graceMinutes || 0),
        String(b.workDays || "1,2,3,4,5,6"),
        b.overtimeRequiresApproval !== false,
      ],
    );
    return ok({ ok: true });
  } catch (e) {
    const duplicate = String(e.message).includes("duplicate key");
    return fail(
      duplicate
        ? "That username or employee code is already in use."
        : e.message,
      e.message === "UNAUTHORIZED" ? 401 : e.status || 400,
    );
  }
}
