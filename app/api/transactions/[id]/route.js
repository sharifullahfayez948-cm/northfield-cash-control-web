import { requireUser } from "@/lib/auth";
import { query,db } from "@/lib/db";
import { ensureDay,audit } from "@/lib/business";
import { ok,fail } from "@/lib/api";

function admin(user){if(user.role!=="Super Admin")throw new Error("Super Admin permission required.")}
function dateOnly(value){if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);const raw=String(value||"");const iso=raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];if(iso)return iso;const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))throw new Error("Invalid transaction date.");return parsed.toISOString().slice(0,10)}
async function entry(id){const r=await query("select * from cash_entries where id=$1 limit 1",[id]);if(!r.rows[0])throw new Error("Transaction not found.");return r.rows[0]}
async function openDay(date){const r=await query("select status from cash_days where business_date=$1 limit 1",[date]);if(r.rows[0]?.status==="FINALIZED")throw new Error("Reopen this business day before changing its transactions.")}

export async function PATCH(req,{params}){try{
  const user=await requireUser();admin(user);const {id}=await params,b=await req.json(),old=await entry(id);
  if(old.transfer_group)throw new Error("Linked bank transfers cannot be edited here. Void the transfer and post it again.");
  const date=String(b.date||"").slice(0,10),direction=String(b.direction||"").toUpperCase(),amount=Number(b.amount),categoryId=Number(b.categoryId);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!["IN","OUT"].includes(direction)||!Number.isFinite(amount)||amount<=0||!categoryId)throw new Error("Enter a valid date, direction, category and amount.");
  await openDay(dateOnly(old.business_date));await ensureDay(date,user.id);await openDay(date);
  const category=await query("select id from categories where id=$1 and active=true and account_scope in('CASH','BOTH') limit 1",[categoryId]);if(!category.rows[0])throw new Error("Invalid cash category.");
  const time=/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(b.time||""))?String(b.time):String(old.entry_time);
  await query(`update cash_entries set business_date=$1,entry_time=$2,direction=$3,amount=$4,category_id=$5,counterparty=$6,description=$7,reference_no=$8,modified_by=$9,modified_at=now() where id=$10`,[date,time,direction,amount,categoryId,String(b.counterparty||""),String(b.description||""),String(b.reference||""),user.id,id]);
  await audit(user.id,"EDIT_CASH","cash_entry",id,date,`Edited transaction ${id}`);return ok({ok:true});
}catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:e.message.includes("permission")?403:400)}}

export async function DELETE(req,{params}){try{
  const user=await requireUser();admin(user);const {id}=await params,old=await entry(id);await openDay(dateOnly(old.business_date));
  if(old.status==="VOID")throw new Error("Transaction is already voided.");const reason=new URL(req.url).searchParams.get("reason")||"Voided by administrator";
  const client=await db().connect();try{await client.query("begin");await client.query("update cash_entries set status='VOID',void_reason=$1,modified_by=$2,modified_at=now() where id=$3",[reason,user.id,id]);if(old.transfer_group)await client.query("update bank_entries set status='VOID' where transfer_group=$1",[old.transfer_group]);await client.query("commit")}catch(e){await client.query("rollback");throw e}finally{client.release()}
  await audit(user.id,"VOID_CASH","cash_entry",id,old.business_date,reason);return ok({ok:true});
}catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:e.message.includes("permission")?403:400)}}

export async function POST(req,{params}){try{
  const user=await requireUser();admin(user);const {id}=await params,old=await entry(id),b=await req.json();if(b.action!=="restore")throw new Error("Invalid action.");await openDay(dateOnly(old.business_date));if(old.status!=="VOID")throw new Error("Only voided transactions can be restored.");
  const client=await db().connect();try{await client.query("begin");await client.query("update cash_entries set status='POSTED',void_reason=null,modified_by=$1,modified_at=now() where id=$2",[user.id,id]);if(old.transfer_group)await client.query("update bank_entries set status='POSTED' where transfer_group=$1",[old.transfer_group]);await client.query("commit")}catch(e){await client.query("rollback");throw e}finally{client.release()}
  await audit(user.id,"RESTORE_CASH","cash_entry",id,old.business_date,"Restored voided transaction");return ok({ok:true});
}catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:e.message.includes("permission")?403:400)}}
