import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensurePushSchema,pushPublicKey } from "@/lib/push";
import { ok,fail } from "@/lib/api";

export async function GET(){try{await requireUser();return ok({ready:true,publicKey:await pushPublicKey()})}catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:500)}}
export async function POST(req){try{const user=await requireUser(),body=await req.json(),sub=body.subscription||body;if(!sub?.endpoint||!sub?.keys?.p256dh||!sub?.keys?.auth)throw new Error("Invalid push subscription.");await ensurePushSchema();await query(`insert into push_subscriptions(user_id,endpoint,p256dh,auth,device_label,active,updated_at)
 values($1,$2,$3,$4,$5,true,now()) on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,device_label=excluded.device_label,active=true,updated_at=now()`,[user.id,sub.endpoint,sub.keys.p256dh,sub.keys.auth,String(body.deviceLabel||"Browser").slice(0,180)]);return ok({subscribed:true})}catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:400)}}
export async function DELETE(req){try{const user=await requireUser(),body=await req.json();await ensurePushSchema();await query("update push_subscriptions set active=false,updated_at=now() where endpoint=$1 and user_id=$2",[body.endpoint,user.id]);return ok({subscribed:false})}catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:400)}}
