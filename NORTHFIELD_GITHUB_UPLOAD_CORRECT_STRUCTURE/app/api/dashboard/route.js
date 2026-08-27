import { requireUser } from "@/lib/auth";import { query } from "@/lib/db";import { daySnapshot,bankState,settingsMap } from "@/lib/business";import { ok,fail } from "@/lib/api";
export async function GET(req){try{const u=await requireUser();const date=new URL(req.url).searchParams.get("date")||new Date().toISOString().slice(0,10);const [snap,bank,settings,latest,months]=await Promise.all([
 daySnapshot(date,u.id),bankState(),settingsMap(),
 query(`select e.id,e.entry_time,e.direction,c.name category,e.counterparty,e.reference_no,e.amount,e.status,u.display_name created_by from cash_entries e join categories c on c.id=e.category_id left join users u on u.id=e.created_by where e.business_date=$1 order by e.id desc limit 8`,[date]),
 query(`select to_char(date_trunc('month',business_date),'YYYY-MM') ym,to_char(date_trunc('month',business_date),'Mon') mon,
 coalesce(sum(case when direction='IN' and status='POSTED' then amount else 0 end),0) cash_in,
 coalesce(sum(case when direction='OUT' and status='POSTED' then amount else 0 end),0) cash_out
 from cash_entries where business_date>=date_trunc('month',current_date)-interval '5 months' group by 1,2 order by 1`)
]);return ok({date,snap,bank,settings,latest:latest.rows,months:months.rows,user:u});}catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:500)}}
