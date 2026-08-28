import webpush from "web-push";
import { query } from "./db";

let schemaPromise;

export async function ensurePushSchema(){
  if(!schemaPromise)schemaPromise=(async()=>{
    await query(`create table if not exists push_config(
      id smallint primary key,
      public_key text not null,
      private_key text not null,
      created_at timestamptz not null default now()
    )`);
    await query(`create table if not exists push_subscriptions(
      id bigserial primary key,
      user_id bigint not null,
      endpoint text unique not null,
      p256dh text not null,
      auth text not null,
      device_label text,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
    await query(`create table if not exists push_hourly_runs(
      run_key text primary key,
      sent_at timestamptz not null default now()
    )`);
    let config=(await query("select * from push_config where id=1")).rows[0];
    if(!config){
      const keys=webpush.generateVAPIDKeys();
      await query("insert into push_config(id,public_key,private_key) values(1,$1,$2) on conflict(id) do nothing",[keys.publicKey,keys.privateKey]);
      config=(await query("select * from push_config where id=1")).rows[0];
    }
    return config;
  })().catch(e=>{schemaPromise=null;throw e});
  return schemaPromise;
}

export async function pushPublicKey(){return (await ensurePushSchema()).public_key}

export async function sendPush(payload){
  try{
    const config=await ensurePushSchema();
    const rows=(await query("select id,endpoint,p256dh,auth from push_subscriptions where active=true")).rows;
    if(!rows.length)return {sent:0,failed:0};
    webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:info@northfield.ae",config.public_key,config.private_key);
    const body=JSON.stringify({...payload,url:payload.url||"/"});
    const results=await Promise.all(rows.map(async row=>{
      try{await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},body);return true}
      catch(e){if(e?.statusCode===404||e?.statusCode===410)await query("update push_subscriptions set active=false,updated_at=now() where id=$1",[row.id]);return false}
    }));
    return {sent:results.filter(Boolean).length,failed:results.filter(x=>!x).length};
  }catch(e){console.error("Push notification failed:",e.message);return {sent:0,failed:1,error:e.message}}
}

const immediate={
  OPEN_DAY:["Business Day Opened","Today is open and ready. Review the dashboard and begin recording activity."],
  FINALIZE_DAY:["Business Day Closed","Today was finalized. Open Daily Closing to review cash, expected balance and variance."],
  REOPEN_DAY:["Business Day Reopened","A finalized day was reopened by an administrator. Review changes carefully."],
  POST_CASH:["New Cash Transaction","A new cash transaction was recorded. Tap to review the cash ledger."],
  POST_BANK:["New Bank Transaction","A new Emirates Islamic transaction was recorded. Tap to review it."],
  POST_TRANSFER:["New Iran / Dubai Transfer","A new international transfer was recorded. Tap to review it."],
  POST_LINKED_TRANSFER:["Cash / Bank Transfer Recorded","A linked movement between cash and bank was recorded."],
  VOID_CASH:["Cash Transaction Voided","A cash transaction was voided. Tap to review the audit trail."],
  RESTORE_CASH:["Cash Transaction Restored","A previously voided cash transaction was restored."],
  EDIT_CASH:["Cash Transaction Edited","A cash transaction was changed. Tap to review the updated entry."]
};

export async function pushForAudit(action,businessDate,detail){
  const message=immediate[action];if(!message)return;
  await sendPush({title:message[0],body:`${message[1]}${businessDate?` · ${businessDate}`:""}${detail?` · ${detail}`:""}`,tag:`${action}-${businessDate||Date.now()}`,url:"/"});
}
