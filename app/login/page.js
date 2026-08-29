"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, UserRound, Wifi } from "lucide-react";
import CompanyBrand from "@/components/CompanyBrand";
import FayezSignature from "@/components/FayezSignature";

export default function Login() {
  const r=useRouter();
  const [f,setF]=useState({username:"",password:""});
  const [e,setE]=useState("");
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);

  async function go(x){
    x.preventDefault();setE("");setBusy(true);
    try{
      const res=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(f)});
      const d=await res.json();
      if(res.ok)r.replace("/");else setE(d.error||"Invalid username or password.");
    }catch{setE("Something went wrong. Please try again.")}finally{setBusy(false)}
  }

  return (
    <main className="luxLoginPage">
      <div className="loginGlow loginGlowOne"/><div className="loginGlow loginGlowTwo"/><div className="loginGrid"/>
      <section className="luxLoginShell">
        <aside className="loginShowcase">
          <div className="showcaseTop"><CompanyBrand/><span>FINANCIAL CONTROL SUITE</span></div>
          <div className="showcaseCopy">
            <small><Sparkles size={13}/> PRIVATE FINANCIAL WORKSPACE</small>
            <h1>Clarity for every<br/><em>financial move.</em></h1>
            <p>One secure command center for cash, banking, transfers and daily operations.</p>
          </div>
          <div className="showcaseTrust"><span><ShieldCheck/>Protected access</span><span><Wifi/>Live cloud sync</span></div>
          <div className="showcaseOrbit"><i/><i/><i/></div>
        </aside>

        <form className="luxLoginCard" onSubmit={go}>
          <div className="mobileLoginBrand"><CompanyBrand/></div>
          <div className="loginSecurity"><ShieldCheck size={14}/><span>SECURE PORTAL</span><i/></div>
          <div className="loginHeading"><small>WELCOME BACK</small><h2>Sign in to Northfield</h2><p>Enter your credentials to continue to the control suite.</p></div>
          {e&&<div className="loginError"><ShieldCheck size={15}/><span>{e}</span></div>}
          <label className="luxLoginField"><span>Username</span><div><UserRound size={17}/><input value={f.username} onChange={x=>setF({...f,username:x.target.value})} autoComplete="username" placeholder="Enter your username" required/></div></label>
          <label className="luxLoginField"><span>Password</span><div><LockKeyhole size={17}/><input type={show?"text":"password"} value={f.password} onChange={x=>setF({...f,password:x.target.value})} autoComplete="current-password" placeholder="Enter your password" required/><button type="button" onClick={()=>setShow(!show)} aria-label={show?"Hide password":"Show password"}>{show?<EyeOff/>:<Eye/>}</button></div></label>
          <div className="loginOptions"><label><input type="checkbox"/><i/>Keep me signed in</label><Link href="/forgot-password">Forgot password?</Link></div>
          <button className="luxSignIn" disabled={busy}><span>{busy?"VERIFYING…":"SIGN IN SECURELY"}</span><ArrowRight/></button>
          <div className="loginEncrypted"><LockKeyhole size={12}/> Your session is encrypted and protected</div>
          <FayezSignature/>
        </form>
      </section>
    </main>
  );
}
