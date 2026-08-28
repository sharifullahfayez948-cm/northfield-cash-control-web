import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ok,fail } from "@/lib/api";

export async function GET(){
  try{
    await requireUser();
    const result=await query(`select a.id,a.event_time,a.action,a.entity_type,a.entity_id,a.business_date,a.detail,
      coalesce(u.display_name,u.username,'System') user_name
      from audit_log a left join users u on u.id=a.user_id
      order by a.event_time desc limit 40`);
    return ok({notifications:result.rows});
  }catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:500)}
}
