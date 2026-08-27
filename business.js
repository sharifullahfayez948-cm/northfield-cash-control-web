import { query, db } from "./db";

export async function settingsMap() {
  const r=await query("select key,value from settings");
  return Object.fromEntries(r.rows.map(x=>[x.key,x.value]));
}
export async function ensureDay(date,userId){
  let r=await query("select * from cash_days where business_date=$1 limit 1",[date]);
  if(r.rows[0]) return r.rows[0];
  const prev=await query("select actual_cash from cash_days where business_date<$1 and status='FINALIZED' and actual_cash is not null order by business_date desc limit 1",[date]);
  const settings=await settingsMap();
  const opening=prev.rows[0]?Number(prev.rows[0].actual_cash):Number(settings.initial_opening_cash||0);
  r=await query(`insert into cash_days(business_date,opening_cash,status,opened_by,created_at,updated_at)
                 values($1,$2,'OPEN',$3,now(),now()) returning *`,[date,opening,userId]);
  return r.rows[0];
}
export async function daySnapshot(date,userId){
  const day=await ensureDay(date,userId);
  const t=await query(`select
    coalesce(sum(case when direction='IN' and status='POSTED' then amount else 0 end),0) cash_in,
    coalesce(sum(case when direction='OUT' and status='POSTED' then amount else 0 end),0) cash_out
    from cash_entries where business_date=$1`,[date]);
  const cashIn=Number(t.rows[0].cash_in), cashOut=Number(t.rows[0].cash_out), opening=Number(day.opening_cash);
  return {day,opening,cashIn,cashOut,expected:opening+cashIn-cashOut};
}
export async function bankState(){
  const r=await query(`select b.*,
    b.opening_balance
    +coalesce(sum(case when e.direction='IN' and e.status='POSTED' then e.amount else 0 end),0)
    -coalesce(sum(case when e.direction='OUT' and e.status='POSTED' then e.amount else 0 end),0) balance
    from bank_accounts b left join bank_entries e on e.bank_account_id=b.id
    where b.active=true group by b.id order by b.id limit 1`);
  return r.rows[0]||null;
}
export async function categoryId(name){
  const r=await query("select id from categories where name=$1 limit 1",[name]);
  if(!r.rows[0]) throw new Error(`Category not configured: ${name}`);
  return r.rows[0].id;
}
export async function audit(userId,action,entityType,entityId=null,businessDate=null,detail=""){
  await query(`insert into audit_log(event_time,user_id,action,entity_type,entity_id,business_date,detail)
               values(now(),$1,$2,$3,$4,$5,$6)`,[userId,action,entityType,entityId?String(entityId):null,businessDate,detail]);
}
export async function postCash({date,direction,amount,categoryId,counterparty="",description="",reference="",userId,transferGroup=null}, client=null){
  const q=client?client.query.bind(client):async(t,p)=>(await query(t,p));
  const d=await q("select status from cash_days where business_date=$1 limit 1",[date]);
  if(d.rows?.[0]?.status==="FINALIZED") throw new Error("This day is finalized.");
  const r=await q(`insert into cash_entries(business_date,entry_time,direction,amount,category_id,counterparty,description,reference_no,status,created_by,created_at,transfer_group)
                   values($1,current_time,$2,$3,$4,$5,$6,$7,'POSTED',$8,now(),$9) returning id`,
                 [date,direction,Number(amount),categoryId,counterparty,description,reference,userId,transferGroup]);
  return r.rows[0].id;
}
export async function postBank({date,bankId,direction,amount,categoryId,counterparty="",description="",reference="",userId,transferGroup=null},client=null){
  const q=client?client.query.bind(client):async(t,p)=>(await query(t,p));
  const r=await q(`insert into bank_entries(business_date,entry_time,bank_account_id,direction,amount,category_id,counterparty,description,reference_no,status,created_by,created_at,transfer_group)
                   values($1,current_time,$2,$3,$4,$5,$6,$7,$8,'POSTED',$9,now(),$10) returning id`,
                 [date,bankId,direction,Number(amount),categoryId,counterparty,description,reference,userId,transferGroup]);
  return r.rows[0].id;
}
export async function transfer({date,mode,amount,counterparty,description,reference,userId}){
  const client=await db().connect();
  try{
    await client.query("begin");
    const bank=(await client.query("select * from bank_accounts where active=true order by id limit 1")).rows[0];
    if(!bank) throw new Error("No active bank configured.");
    const tg=`TRF-${Date.now()}`;
    const cid=async n=>(await client.query("select id from categories where name=$1 limit 1",[n])).rows[0]?.id;
    if(mode==="Cash → Bank Deposit"){
      await postCash({date,direction:"OUT",amount,categoryId:await cid("Cash Deposit to Emirates Islamic"),counterparty:counterparty||bank.name,description:description||"Cash deposited to bank",reference,userId,transferGroup:tg},client);
      await postBank({date,bankId:bank.id,direction:"IN",amount,categoryId:await cid("Cash Deposit from Reception"),counterparty:counterparty||"Reception Cash",description:description||"Cash deposit from reception",reference,userId,transferGroup:tg},client);
    } else {
      await postBank({date,bankId:bank.id,direction:"OUT",amount,categoryId:await cid("Bank Withdrawal to Reception"),counterparty:counterparty||"Reception Cash",description:description||"Cash withdrawal to reception",reference,userId,transferGroup:tg},client);
      await postCash({date,direction:"IN",amount,categoryId:await cid("Cash Withdrawal from Emirates Islamic"),counterparty:counterparty||bank.name,description:description||"Cash withdrawal from bank",reference,userId,transferGroup:tg},client);
    }
    await client.query("commit");
  }catch(e){await client.query("rollback");throw e;}finally{client.release();}
}
