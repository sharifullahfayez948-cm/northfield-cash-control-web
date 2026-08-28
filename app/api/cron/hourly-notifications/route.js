import { query } from "@/lib/db";
import { ensurePushSchema,sendPush } from "@/lib/push";
import { ok,fail } from "@/lib/api";

export async function GET(req){
  try{
    if(!process.env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return fail("UNAUTHORIZED",401);
    await ensurePushSchema();
    const runKey=new Date().toISOString().slice(0,13);
    const claimed=await query("insert into push_hourly_runs(run_key) values($1) on conflict do nothing returning run_key",[runKey]);
    if(!claimed.rows[0])return ok({duplicate:true});
    const [cash,bank,transfer]=await Promise.all([
      query(`select count(*)::int records,coalesce(sum(case when direction='IN' then amount else 0 end),0) total_in,coalesce(sum(case when direction='OUT' then amount else 0 end),0) total_out from cash_entries where created_at>=now()-interval '1 hour' and status='POSTED'`),
      query(`select count(*)::int records,coalesce(sum(case when direction='IN' then amount else 0 end),0) total_in,coalesce(sum(case when direction='OUT' then amount else 0 end),0) total_out from bank_entries where created_at>=now()-interval '1 hour' and status='POSTED'`),
      query(`select count(*)::int records,coalesce(sum(amount_aed),0) total_aed from iran_dubai_transfers where created_at>=now()-interval '1 hour' and status='POSTED'`)
    ]);
    const c=cash.rows[0],b=bank.rows[0],t=transfer.rows[0],count=c.records+b.records+t.records;
    if(!count)return ok({sent:0,activity:0});
    const parts=[];if(c.records)parts.push(`${c.records} cash`);if(b.records)parts.push(`${b.records} bank`);if(t.records)parts.push(`${t.records} transfer`);
    const result=await sendPush({title:"Northfield Hourly Review",body:`${parts.join(" · ")} record${count===1?"":"s"} added in the last hour. Take a quick look at the latest activity.`,tag:`hourly-${runKey}`,url:"/"});
    return ok({activity:count,...result});
  }catch(e){return fail(e.message,500)}
}
