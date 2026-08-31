import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { ensureAttendanceSchema } from "@/lib/attendance";

function manager(user) {
  if (!["Super Admin", "Manager"].includes(user.role)) {
    const e = new Error("Manager access required.");
    e.status = 403;
    throw e;
  }
}
export async function GET() {
  try {
    const user = await requireUser();
    manager(user);
    await ensureAttendanceSchema();
    const [staff, today] = await Promise.all([
      query(
        `select u.id,u.display_name,u.username,u.active,p.employee_code,p.shift_start,p.shift_end,p.break_minutes,p.grace_minutes,p.work_days,p.overtime_requires_approval from users u left join employee_profiles p on p.user_id=u.id where u.role<>'Super Admin' order by u.display_name`,
      ),
      query(
        `select u.id,u.display_name,min(a.event_time) filter(where a.event_type='CLOCK_IN') clock_in,max(a.event_time) filter(where a.event_type='CLOCK_OUT') clock_out,max(a.event_type) last_event from users u left join attendance_events a on a.user_id=u.id and a.work_date=(now() at time zone 'Asia/Dubai')::date where u.role<>'Super Admin' group by u.id,u.display_name order by u.display_name`,
      ),
    ]);
    return ok({ staff: staff.rows, today: today.rows });
  } catch (e) {
    return fail(
      e.message,
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
    const userId = Number(b.userId);
    if (!userId) throw new Error("Employee is required.");
    await query(
      `insert into employee_profiles(user_id,employee_code,shift_start,shift_end,break_minutes,grace_minutes,work_days,overtime_requires_approval,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,now()) on conflict(user_id) do update set employee_code=excluded.employee_code,shift_start=excluded.shift_start,shift_end=excluded.shift_end,break_minutes=excluded.break_minutes,grace_minutes=excluded.grace_minutes,work_days=excluded.work_days,overtime_requires_approval=excluded.overtime_requires_approval,updated_at=now()`,
      [
        userId,
        String(b.employeeCode || "").trim() || null,
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
    return fail(
      e.message,
      e.message === "UNAUTHORIZED" ? 401 : e.status || 400,
    );
  }
}
