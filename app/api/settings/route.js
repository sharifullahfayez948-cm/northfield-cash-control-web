import { requireUser,hashPassword,ensurePermissionsSchema,PERMISSION_KEYS } from "@/lib/auth";
import { query,db } from "@/lib/db";
import { settingsMap,audit } from "@/lib/business";
import { ok,fail } from "@/lib/api";

function admin(user){if(user.role!=="Super Admin"){const e=new Error("Super Admin required.");e.status=403;throw e}}
const validRole=role=>["Super Admin","Manager","Staff","Viewer"].includes(role);
const cleanEmail=value=>String(value||"").trim().toLowerCase();

export async function GET(){
  try{
    const user=await requireUser();admin(user);await ensurePermissionsSchema();
    const [settings,users,bank,permissions]=await Promise.all([
      settingsMap(),
      query("select id,username,display_name,email,role,active from users order by id"),
      query("select id,name,opening_balance,notes,active from bank_accounts order by id"),
      query("select user_id,permission_key,allowed from user_permissions")
    ]);
    const permissionMap={};
    for(const row of permissions.rows){permissionMap[row.user_id]||={};permissionMap[row.user_id][row.permission_key]=row.allowed}
    return ok({settings,users:users.rows.map(x=>({...x,permissions:permissionMap[x.id]||null})),bank:bank.rows[0]||null,permissionKeys:PERMISSION_KEYS});
  }catch(e){return fail(e.message,e.message==="UNAUTHORIZED"?401:e.status||500)}
}

export async function POST(req){
  try{
    const actor=await requireUser();admin(actor);await ensurePermissionsSchema();
    const body=await req.json();
    if(body.kind==="settings"){
      const allowed=new Set(["company_name","company_address","company_email","company_phone","company_logo","daily_messages","recovery_email","hero_greeting","hero_subtitle","hero_badge_one","hero_badge_two","hero_badge_three"]);
      for(const [key,raw] of Object.entries(body.values||{})){
        if(!allowed.has(key))continue;
        const value=String(raw||"").trim();
        if(key==="company_logo"&&value&&!/^data:image\/(png|jpeg|webp);base64,/.test(value))throw new Error("Logo must be a PNG, JPG or WebP image.");
        if(key==="company_logo"&&value.length>1400000)throw new Error("Logo is too large. Use an image under 1 MB.");
        if((key==="company_email"||key==="recovery_email")&&value&&!/^\S+@\S+\.\S+$/.test(value))throw new Error("Enter a valid email address.");
        await query(`insert into settings(key,value,updated_at) values($1,$2,now()) on conflict(key) do update set value=excluded.value,updated_at=now()`,[key,value]);
      }
      await audit(actor.id,"UPDATE_SETTINGS","settings",null,null,"Company and recovery settings updated");
      return ok({ok:true});
    }
    if(body.kind==="user"){
      const id=body.id?Number(body.id):null,username=String(body.username||"").trim().toLowerCase(),name=String(body.name||"").trim(),email=cleanEmail(body.email),role=String(body.role||"Staff"),active=body.active!==false,password=String(body.password||"");
      if(!username||!name)throw new Error("Username and display name are required.");
      if(!validRole(role))throw new Error("Invalid user role.");
      if(email&&!/^\S+@\S+\.\S+$/.test(email))throw new Error("Enter a valid recovery email.");
      if(!id&&password.length<8)throw new Error("New users require a password of at least 8 characters.");
      if(password&&password.length<8)throw new Error("Password must contain at least 8 characters.");
      if(id===Number(actor.id)&&!active)throw new Error("You cannot deactivate your own account.");
      const client=await db().connect();
      try{
        await client.query("begin");
        let userId=id;
        if(id){
          const current=(await client.query("select role from users where id=$1 for update",[id])).rows[0];
          if(!current)throw new Error("User not found.");
          if(current.role==="Super Admin"&&(role!=="Super Admin"||!active)){
            const count=await client.query("select count(*)::int count from users where role='Super Admin' and active=true and id<>$1",[id]);
            if(!count.rows[0].count)throw new Error("At least one active Super Admin must remain.");
          }
          await client.query("update users set username=$1,display_name=$2,email=$3,role=$4,active=$5,updated_at=now() where id=$6",[username,name,email||null,role,active,id]);
          if(password)await client.query("update users set password_hash=$1 where id=$2",[hashPassword(password),id]);
        }else{
          const created=await client.query("insert into users(username,display_name,email,role,password_hash,active,created_at,updated_at) values($1,$2,$3,$4,$5,$6,now(),now()) returning id",[username,name,email||null,role,hashPassword(password),active]);
          userId=created.rows[0].id;
        }
        if(role!=="Super Admin"){
          for(const key of PERMISSION_KEYS){
            const allowed=body.permissions?.[key]!==false;
            await client.query(`insert into user_permissions(user_id,permission_key,allowed,updated_at) values($1,$2,$3,now()) on conflict(user_id,permission_key) do update set allowed=excluded.allowed,updated_at=now()`,[userId,key,allowed]);
          }
        }else await client.query("delete from user_permissions where user_id=$1",[userId]);
        await client.query("commit");
        await audit(actor.id,id?"UPDATE_USER":"CREATE_USER","user",userId,null,`${username} · ${role}`);
      }catch(e){await client.query("rollback");throw e}finally{client.release()}
      return ok({ok:true});
    }
    if(body.kind==="bank"){
      await query("update bank_accounts set name=$1,opening_balance=$2,notes=$3,updated_at=now() where id=$4",[String(body.name||"").trim(),Number(body.opening||0),String(body.notes||""),body.id]);
      await audit(actor.id,"UPDATE_BANK_SETTINGS","bank_account",body.id,null,"Bank configuration updated");
      return ok({ok:true});
    }
    throw new Error("Invalid settings action.");
  }catch(e){
    const duplicate=String(e.message).includes("duplicate key");
    return fail(duplicate?"That username is already in use.":e.message,e.message==="UNAUTHORIZED"?401:e.status||400);
  }
}
