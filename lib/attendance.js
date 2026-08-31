import crypto from "crypto";
import { query } from "./db";

const qrSecret = () =>
  process.env.ATTENDANCE_QR_SECRET ||
  process.env.SESSION_SECRET ||
  "change-me-immediately";

export async function ensureAttendanceSchema() {
  await query(`create table if not exists employee_profiles(
    user_id bigint primary key references users(id) on delete cascade,
    employee_code text unique,
    shift_start time not null default '09:00',
    shift_end time not null default '18:00',
    break_minutes integer not null default 60,
    grace_minutes integer not null default 10,
    work_days text not null default '1,2,3,4,5,6',
    overtime_requires_approval boolean not null default true,
    updated_at timestamptz not null default now()
  )`);
  await query(`create table if not exists attendance_events(
    id bigserial primary key,
    user_id bigint not null references users(id) on delete cascade,
    event_type text not null check(event_type in ('CLOCK_IN','BREAK_START','BREAK_END','CLOCK_OUT')),
    event_time timestamptz not null default now(),
    work_date date not null,
    source text not null default 'QR',
    device_label text,
    note text,
    created_at timestamptz not null default now()
  )`);
  await query(
    `alter table employee_profiles add column if not exists job_title text`,
  );
  await query(
    `alter table employee_profiles add column if not exists phone text`,
  );
  await query(
    `alter table employee_profiles add column if not exists committed_hours numeric(6,2) not null default 48`,
  );
  await query(
    `alter table attendance_events add column if not exists latitude numeric(10,7)`,
  );
  await query(
    `alter table attendance_events add column if not exists longitude numeric(10,7)`,
  );
  await query(
    `alter table attendance_events add column if not exists location_accuracy numeric(10,2)`,
  );
  await query(
    `alter table attendance_events add column if not exists distance_meters numeric(12,2)`,
  );
  await query(
    `alter table attendance_events add column if not exists outside_geofence boolean not null default false`,
  );
  await query(
    `alter table attendance_events add column if not exists ip_address text`,
  );
  await query(`create table if not exists attendance_site(
    id smallint primary key default 1 check(id=1),
    site_name text not null default 'Northfield Clinic',
    latitude numeric(10,7),longitude numeric(10,7),
    radius_meters integer not null default 200,
    block_outside boolean not null default true,
    static_token text not null,
    updated_at timestamptz not null default now()
  )`);
  await query(`create table if not exists attendance_attempts(
    id bigserial primary key,user_id bigint references users(id) on delete set null,
    attempted_at timestamptz not null default now(),event_type text,
    latitude numeric(10,7),longitude numeric(10,7),location_accuracy numeric(10,2),
    distance_meters numeric(12,2),accepted boolean not null default false,
    reason text,ip_address text,device_label text
  )`);
  await query(`create table if not exists attendance_leave_requests(
    id bigserial primary key,
    user_id bigint not null references users(id) on delete cascade,
    leave_type text not null check(leave_type in ('ANNUAL','SICK','UNPAID','OTHER')),
    date_from date not null,
    date_to date not null,
    note text,
    status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
    manager_note text,
    decided_by bigint references users(id) on delete set null,
    decided_at timestamptz,
    created_at timestamptz not null default now(),
    constraint attendance_leave_dates check(date_to >= date_from)
  )`);
  await query(
    `create index if not exists attendance_events_user_date_idx on attendance_events(user_id,work_date,event_time)`,
  );
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = (x) => (Number(x) * Math.PI) / 180,
    R = 6371000;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function makeAttendanceToken() {
  const slot = Math.floor(Date.now() / 45000);
  const payload = Buffer.from(
    JSON.stringify({ slot, site: "northfield" }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", qrSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAttendanceToken(token) {
  try {
    const [payload, sig] = String(token || "").split(".");
    if (!payload || !sig) return false;
    const expected = crypto
      .createHmac("sha256", qrSecret())
      .update(payload)
      .digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      data.site === "northfield" &&
      Math.abs(Math.floor(Date.now() / 45000) - data.slot) <= 1
    );
  } catch {
    return false;
  }
}

export function nextAttendanceEvent(events = []) {
  const last = events[events.length - 1]?.event_type;
  if (!last || last === "CLOCK_OUT") return "CLOCK_IN";
  if (last === "CLOCK_IN" || last === "BREAK_END" || last === "BREAK_START")
    return "CLOCK_OUT";
  return "CLOCK_IN";
}
