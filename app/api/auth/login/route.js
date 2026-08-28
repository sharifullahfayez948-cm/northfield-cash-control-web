import { authenticate,setSession } from "@/lib/auth";
import { ok,fail } from "@/lib/api";
import { audit } from "@/lib/business";
export async function POST(req){try{const {username,password}=await req.json();const u=await authenticate(username,password);if(!u)return fail("Invalid username or password.",401);await setSession(u);await audit(u.id,"LOGIN","session",null,null,"Signed in successfully").catch(()=>{});return ok({user:{id:u.id,name:u.display_name,role:u.role}});}catch(e){return fail(e.message,500)}}
