import { redirect } from "next/navigation";import { currentUser } from "@/lib/auth";import { query } from "@/lib/db";import NorthfieldApp from "@/components/NorthfieldApp";
export const dynamic="force-dynamic";
export default async function Home(){const x=await query("select exists(select 1 from users) has_users");if(!x.rows[0].has_users)redirect("/setup");const user=await currentUser();if(!user)redirect("/login");return <NorthfieldApp user={user}/>;}
