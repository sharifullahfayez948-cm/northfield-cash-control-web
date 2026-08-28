import { requireUser, accessForUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

export async function GET(){
  try{
    const user=await requireUser();
    return ok({access:await accessForUser(user),role:user.role});
  }catch(e){
    return fail(e.message,e.message==="UNAUTHORIZED"?401:e.status||500);
  }
}
