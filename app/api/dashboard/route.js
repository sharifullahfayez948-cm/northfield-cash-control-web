import { requireUser } from "@/lib/auth";import { query } from "@/lib/db";import { daySnapshot,bankState,settingsMap } from "@/lib/business";import { ok,fail } from "@/lib/api";
export async function GET(req){try{const u=await requireUser();const date=new URL(req.url).searchParams.get("date")||new Date().toISOString().slice(0,10);const [snap,bank,settings,latest,days]=await Promise.all([
 daySnapshot(date,u.id),bankState(),settingsMap(),
 query(`select e.id,e.business_date,e.entry_time,e.direction,c.name category,e.counterparty,e.reference_no,e.amount,e.status,u.display_name created_by from cash_entries e join categories c on c.id=e.category_id left join users u on u.id=e.created_by where e.business_date=$1 order by e.id desc limit 8`,[date]),
 query(`with calendar as (
   select generate_series(date_trunc('month',$1::date),$1::date,interval '1 day')::date business_date
 ), totals as (
   select business_date,
   coalesce(sum(case when direction='IN' and status='POSTED' then amount else 0 end),0) cash_in,
   coalesce(sum(case when direction='OUT' and status='POSTED' then amount else 0 end),0) cash_out
   from cash_entries where business_date between date_trunc('month',$1::date) and $1::date group by business_date
 ) select to_char(c.business_date,'YYYY-MM-DD') business_day,to_char(c.business_date,'DD') label,to_char(c.business_date,'Dy') weekday,
 coalesce(t.cash_in,0) cash_in,coalesce(t.cash_out,0) cash_out
 from calendar c left join totals t using(business_date) order by c.business_date`,[date])
]);return ok({date,snap,bank,settings,latest:latest.rows,days:days.rows,user:u});}catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:500)}}
