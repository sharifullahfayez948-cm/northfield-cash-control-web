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
    let cardReminders=[];
    try{
      const due=await query(`select s.id,s.due_date,s.statement_balance,s.created_at,
        coalesce(sum(case when e.status='POSTED' and e.entry_type='PAYMENT' then e.amount else 0 end),0) paid
        from credit_card_statements s left join credit_card_entries e on e.statement_id=s.id
        where s.status='OPEN' and s.due_date<=current_date+5
        group by s.id having s.statement_balance>coalesce(sum(case when e.status='POSTED' and e.entry_type='PAYMENT' then e.amount else 0 end),0)
        order by s.due_date limit 5`);
      cardReminders=due.rows.map(row=>{
        const days=Math.ceil((new Date(`${String(row.due_date).slice(0,10)}T23:59:59`).getTime()-Date.now())/86400000);
        const remaining=Number(row.statement_balance)-Number(row.paid);
        return {id:`card-due-${row.id}`,event_time:row.created_at,action:"CARD_DUE",entity_type:"credit_card_statement",entity_id:String(row.id),business_date:String(row.due_date).slice(0,10),user_name:"Credit card",detail:`${days<0?"Overdue":days===0?"Due today":`Due in ${days} days`} · AED ${remaining.toFixed(2)} remaining`};
      });
    }catch(error){
      if(error?.code!=="42P01") throw error;
    }
    return ok({notifications:[...cardReminders,...result.rows]});
  }catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:500)}
}
