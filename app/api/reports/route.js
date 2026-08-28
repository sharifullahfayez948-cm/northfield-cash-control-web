import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ok,fail } from "@/lib/api";

export async function GET(req){
  try{
    await requireUser();
    const url=new URL(req.url),from=url.searchParams.get("from")||new Date().toISOString().slice(0,8)+"01",to=url.searchParams.get("to")||new Date().toISOString().slice(0,10),scope=url.searchParams.get("scope")||"cash";
    let entries=[],summary={};
    if(scope==="bank"){
      entries=(await query(`select e.business_date date,e.entry_time time,e.direction type,b.name account,c.name category,e.counterparty,e.description,e.reference_no reference,e.amount,e.status from bank_entries e join bank_accounts b on b.id=e.bank_account_id left join categories c on c.id=e.category_id where e.business_date between $1 and $2 order by e.business_date,e.id`,[from,to])).rows;
      summary=(await query(`select coalesce(sum(case when direction='IN' and status='POSTED' then amount else 0 end),0) total_in,coalesce(sum(case when direction='OUT' and status='POSTED' then amount else 0 end),0) total_out from bank_entries where business_date between $1 and $2`,[from,to])).rows[0];
      summary.balance=Number(summary.total_in)-Number(summary.total_out);
    }else if(scope==="transfer"){
      entries=(await query(`select business_date date,entry_time time,direction type,amount_aed,amount_irr,exchange_rate,sender,receiver,payment_channel channel,reference_no reference,description,status from iran_dubai_transfers where business_date between $1 and $2 order by business_date,id`,[from,to])).rows;
      summary=(await query(`select coalesce(sum(case when status='POSTED' then amount_aed else 0 end),0) total_aed,coalesce(sum(case when status='POSTED' then amount_irr else 0 end),0) total_irr,count(*) record_count from iran_dubai_transfers where business_date between $1 and $2`,[from,to])).rows[0];
    }else if(scope==="closing"){
      entries=(await query(`
        with movements as (
          select business_date,
            coalesce(sum(case when direction='IN' and status='POSTED' then amount else 0 end),0) cash_in,
            coalesce(sum(case when direction='OUT' and status='POSTED' then amount else 0 end),0) cash_out
          from cash_entries
          where business_date between $1 and $2
          group by business_date
        )
        select d.business_date date,d.opening_cash,coalesce(m.cash_in,0) cash_in,
          coalesce(m.cash_out,0) cash_out,d.expected_closing,d.actual_cash,d.variance,
          d.status,d.manager_note note,d.finalized_at
        from cash_days d
        left join movements m on m.business_date=d.business_date
        where d.business_date between $1 and $2
        order by d.business_date
      `,[from,to])).rows;
      summary=(await query(`
        with movements as (
          select business_date,
            coalesce(sum(case when direction='IN' and status='POSTED' then amount else 0 end),0) cash_in,
            coalesce(sum(case when direction='OUT' and status='POSTED' then amount else 0 end),0) cash_out
          from cash_entries
          where business_date between $1 and $2
          group by business_date
        )
        select coalesce(sum(m.cash_in),0) total_in,coalesce(sum(m.cash_out),0) total_out,
          coalesce(sum(d.variance),0) total_variance,count(*) day_count,
          count(*) filter(where d.status='FINALIZED') finalized_count
        from cash_days d
        left join movements m on m.business_date=d.business_date
        where d.business_date between $1 and $2
      `,[from,to])).rows[0];
    }else{
      entries=(await query(`select e.business_date date,e.entry_time time,e.direction type,c.name category,e.counterparty,e.description,e.reference_no reference,e.amount,e.status from cash_entries e join categories c on c.id=e.category_id where e.business_date between $1 and $2 order by e.business_date,e.id`,[from,to])).rows;
      summary=(await query(`select coalesce(sum(case when direction='IN' and status='POSTED' then amount else 0 end),0) total_in,coalesce(sum(case when direction='OUT' and status='POSTED' then amount else 0 end),0) total_out,coalesce((select opening_cash from cash_days where business_date between $1 and $2 order by business_date limit 1),0) opening_cash from cash_entries where business_date between $1 and $2`,[from,to])).rows[0];
      summary.running_cash=Number(summary.opening_cash)+Number(summary.total_in)-Number(summary.total_out);
    }
    return ok({scope,from,to,entries,summary});
  }catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:500)}
}
