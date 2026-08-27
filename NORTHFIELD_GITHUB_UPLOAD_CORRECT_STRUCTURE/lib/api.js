import { NextResponse } from "next/server";
export function ok(data,status=200){return NextResponse.json(data,{status});}
export function fail(error,status=400){return NextResponse.json({error:String(error)},{status});}
export function money(v){return Number(v||0);}
