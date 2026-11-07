"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, CreditCard, FileDown, History, Plus, Receipt, Settings2, WalletCards, X } from "lucide-react";
import * as XLSX from "xlsx";
import { aed, createLuxuryReport, dayLabel, loadBrand, money as luxMoney } from "@/lib/luxuryPdf";

const today = () => new Date().toISOString().slice(0,10);
const monthStart = () => `${today().slice(0,7)}-01`;
const money = value => `AED ${Number(value || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dateLabel = value => value ? new Date(`${String(value).slice(0,10)}T00:00:00`).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";

async function request(url, options) {
  const response = await fetch(url,{cache:"no-store",...options});
  if (response.status === 401) { location.href="/login"; throw new Error("Login required"); }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function Modal({title,kicker,children,onClose,wide=false}) {
  return <div className="modalShade creditShade" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <section className={`luxModal creditModal ${wide?"wide":""}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modalHead"><div><small>{kicker}</small><h3>{title}</h3></div><button type="button" onClick={onClose}><X size={18}/></button></div>
      {children}
    </section>
  </div>;
}

function EmptySetup({canManage,onOpen}) {
  return <div className="creditSetup card"><CreditCard/><div><small>ONE-TIME SETUP</small><h2>Credit-card workspace is ready</h2><p>Create the clinic card after running the safe database migration. Existing Northfield records are not changed.</p></div>{canManage&&<button className="btn btnPrimary" onClick={onOpen}><Plus size={15}/> ADD CARD</button>}</div>;
}

export default function CreditCardCenter({user}) {
  const canManage = user?.role === "Super Admin";
  const [data,setData] = useState(null), [mode,setMode] = useState(""), [busy,setBusy] = useState(false), [error,setError] = useState("");
  const [range,setRange] = useState({from:monthStart(),to:today()});
  const [account,setAccount] = useState({name:"Boss Navid – Clinic Credit Card",bankName:"",cardholderName:"Boss Navid",lastFour:"",creditLimit:"",openingBalance:"",interestRate:"",lateFee:"",statementDay:"",dueDay:""});
  const [entry,setEntry] = useState({kind:"PURCHASE",chargeType:"INTEREST",date:today(),amount:"",merchant:"",category:"",reference:"",description:"",settlementSource:"BANK",statementId:""});
  const [statement,setStatement] = useState({statementDate:today(),dueDate:"",statementBalance:"",minimumDue:""});
  const [selected,setSelected] = useState(null), [voidReason,setVoidReason] = useState("");

  async function load() {
    setError("");
    try {
      const result = await request(`/api/credit-cards?from=${range.from}&to=${range.to}`);
      setData(result);
      if (result.account) setAccount({id:result.account.id,name:result.account.name||"",bankName:result.account.bank_name||"",cardholderName:result.account.cardholder_name||"",lastFour:result.account.last_four||"",creditLimit:String(result.account.credit_limit||""),openingBalance:String(result.account.opening_balance||""),interestRate:String(result.account.interest_rate||""),lateFee:String(result.account.late_fee||""),statementDay:String(result.account.statement_day||""),dueDay:String(result.account.due_day||"")});
      const open = result.statements?.find(item=>item.status!=="PAID");
      if (open) setEntry(current=>({...current,statementId:String(open.id)}));
    } catch (cause) { setError(cause.message); }
  }
  useEffect(()=>{load()},[range.from,range.to]);

  const currentStatement = data?.statements?.[0];
  const visibleType = entry.kind === "CHARGE" ? entry.chargeType : entry.kind;
  const rows = data?.entries || [];
  const reportSummary = useMemo(()=>rows.filter(x=>x.status==="POSTED").reduce((sum,row)=>{
    const amount=Number(row.amount||0);
    if (["PURCHASE","INTEREST","LATE_FEE","OTHER_FEE"].includes(row.type)) sum.charges+=amount;
    if (row.type==="PAYMENT") sum.payments+=amount;
    if (row.type==="REFUND") sum.refunds+=amount;
    return sum;
  },{charges:0,payments:0,refunds:0}),[rows]);

  async function post(body,message) {
    setBusy(true);setError("");
    try {
      await request("/api/credit-cards",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      window.dispatchEvent(new CustomEvent("northfield:toast",{detail:{message,type:"success"}}));
      setMode("");await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  const saveAccount = event => {event.preventDefault();post({action:"account",...account,creditLimit:Number(account.creditLimit),openingBalance:Number(account.openingBalance),interestRate:Number(account.interestRate),lateFee:Number(account.lateFee),statementDay:account.statementDay?Number(account.statementDay):null,dueDay:account.dueDay?Number(account.dueDay):null},"Credit-card account saved.")};
  const saveEntry = event => {event.preventDefault();post({action:"entry",accountId:data.account.id,type:visibleType,date:entry.date,amount:Number(entry.amount),merchant:entry.merchant,category:entry.category,reference:entry.reference,description:entry.description,settlementSource:entry.settlementSource,statementId:entry.statementId?Number(entry.statementId):null},visibleType==="PAYMENT"?"Card payment recorded.":"Card transaction recorded.")};
  const saveStatement = event => {event.preventDefault();post({action:"statement",accountId:data.account.id,statementDate:statement.statementDate,dueDate:statement.dueDate,statementBalance:Number(statement.statementBalance),minimumDue:Number(statement.minimumDue)},"Card statement saved.")};
  const voidEntry = () => post({action:"void",id:selected.id,reason:voidReason},"Card transaction safely voided.");

  function excel() {
    const workbook=XLSX.utils.book_new();
    const summary=XLSX.utils.aoa_to_sheet([["NORTHFIELD CREDIT CARD REPORT"],[`${range.from} to ${range.to}`],[],["Outstanding",data.account.outstanding_balance],["Available Credit",data.account.available_credit],["Period Charges",reportSummary.charges],["Period Payments",reportSummary.payments],["Period Refunds",reportSummary.refunds]]);
    XLSX.utils.book_append_sheet(workbook,summary,"Summary");XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(rows),"Card Ledger");XLSX.writeFile(workbook,`Northfield_Credit_Card_${range.from}_${range.to}.xlsx`);
  }
  async function pdf() {
    const brand=await loadBrand();
    const r=createLuxuryReport({brand,title:"CREDIT CARD STATEMENT",subtitle:[data.account.name,data.account.last_four?`CARD ${data.account.last_four}`:""].filter(Boolean).join("  ·  ").toUpperCase(),from:range.from,to:range.to});
    const {C}=r;
    let y=r.cards([
      {label:"OUTSTANDING",value:luxMoney(data.account.outstanding_balance),color:C.RED,note:`Available ${luxMoney(data.account.available_credit)}`},
      {label:"CHARGES",value:luxMoney(reportSummary.charges),color:C.NAVY2,note:"Purchases, interest and fees"},
      {label:"PAYMENTS",value:luxMoney(reportSummary.payments),color:C.GREEN,note:"Settled to the card"},
      {label:"REFUNDS",value:luxMoney(reportSummary.refunds),color:C.GOLD,note:"Credited back"},
    ]);
    y=r.heading("CARD LEDGER",`Credit limit ${luxMoney(data.account.credit_limit)}`,y+10);
    const credit=t=>["PAYMENT","REFUND"].includes(t);
    let lastDay="";
    r.table({startY:y,
      head:[["DATE","TYPE","CATEGORY","MERCHANT / BANK","REFERENCE","CHARGE","CREDIT","STATUS"]],
      body:rows.length?rows.map(row=>{const k=String(row.date).slice(0,10),ok=row.status==="POSTED",dim=ok?{}:{textColor:[170,170,170],fontStyle:"italic"},cr=credit(row.type);
        const out=[{content:k===lastDay?"":dayLabel(k),styles:{fontStyle:"bold",textColor:C.NAVY,...dim}},
          {content:row.type.replaceAll("_"," "),styles:{fontStyle:"bold",textColor:cr?C.GREEN:C.RED,...dim}},
          {content:row.category||"",styles:dim},{content:row.merchant||"",styles:dim},{content:row.reference||"",styles:{textColor:C.MUTED,...dim}},
          {content:cr?"":aed(row.amount),styles:{halign:"right",fontStyle:"bold",textColor:C.RED,...dim}},
          {content:cr?aed(row.amount):"",styles:{halign:"right",fontStyle:"bold",textColor:C.GREEN,...dim}},
          {content:row.status,styles:{halign:"center",fontStyle:"bold",textColor:ok?C.GREEN:C.MUTED}}];
        lastDay=k;return out;})
        :[[{content:"No card transactions in this period.",colSpan:8,styles:{textColor:C.MUTED,fontStyle:"italic",halign:"center"}}]],
      foot:[[{content:`${rows.length} TRANSACTIONS`,colSpan:5},{content:aed(reportSummary.charges),styles:{halign:"right"}},{content:aed(reportSummary.payments+reportSummary.refunds),styles:{halign:"right"}},""]],
      columnStyles:{0:{cellWidth:20},1:{cellWidth:20},5:{cellWidth:22},6:{cellWidth:22},7:{cellWidth:17}}});
    r.signatures();
    r.save(`Northfield_Credit_Card_${range.from}_${range.to}.pdf`);
  }

  if (!data) return <div className="loading"><span className="spinner"/>Loading…</div>;
  if (data.setupRequired) return <><div className="pageHead"><div><h2>Credit Card</h2><p>Clinic card expenses and settlements in one controlled ledger.</p></div></div><div className="notice error">Run <b>docs/NORTHFIELD_CREDIT_CARD_MIGRATION.sql</b> once in the existing Northfield Supabase SQL Editor.</div></>;
  if (!data.account) return <><div className="pageHead"><div><h2>Credit Card</h2><p>Clinic card expenses and settlements in one controlled ledger.</p></div></div><EmptySetup canManage={canManage} onOpen={()=>setMode("account")}/>{mode==="account"&&<AccountModal account={account} setAccount={setAccount} busy={busy} error={error} onSave={saveAccount} onClose={()=>setMode("")}/>}</>;

  return <>
    <div className="pageHead creditPageHead"><div><h2>Credit Card</h2><p>Purchases, statements and repayments without affecting the cash ledger incorrectly.</p></div><button className="btn btnSoft" onClick={load}><History size={15}/> REFRESH</button></div>
    {data.reminders?.map(item=><div className={`creditReminder ${item.days_until_due<0?"overdue":""}`} key={item.statement_id}><CalendarClock/><div><b>{item.days_until_due<0?"Payment overdue":item.days_until_due===0?"Payment due today":`Payment due in ${item.days_until_due} days`}</b><span>{money(item.remaining)} remaining · Due {dateLabel(item.due_date)}</span></div></div>)}
    <section className="creditHero">
      <div className="creditIdentity"><span><CreditCard/></span><div><small>{data.account.bank_name||"CLINIC PAYMENT ACCOUNT"}</small><h3>{data.account.name}</h3><p>{data.account.cardholder_name}{data.account.last_four?` · •••• ${data.account.last_four}`:""}</p></div></div>
      <div className="creditFigures"><div><small>OUTSTANDING</small><b>{money(data.account.outstanding_balance)}</b></div><div><small>AVAILABLE CREDIT</small><b>{money(data.account.available_credit)}</b></div><div><small>CREDIT LIMIT</small><b>{money(data.account.credit_limit)}</b></div></div>
      {canManage&&<button className="creditSettings" onClick={()=>setMode("account")} title="Card settings"><Settings2/></button>}
    </section>
    <div className="creditCommandBar">
      <button className="primary" onClick={()=>setMode("entry")}><Plus/><span><b>ADD TRANSACTION</b><small>Purchase, payment or charge</small></span></button>
      <button onClick={()=>setMode("statement")}><Receipt/><span><b>NEW STATEMENT</b><small>Balance and due date</small></span></button>
      <button onClick={()=>setMode("report")}><FileDown/><span><b>REPORT</b><small>PDF or Excel</small></span></button>
    </div>
    {currentStatement&&<section className="statementStrip"><div><small>LATEST STATEMENT</small><b>{dateLabel(currentStatement.statement_date)}</b></div><div><small>STATEMENT BALANCE</small><b>{money(currentStatement.statement_balance)}</b></div><div><small>PAID</small><b>{money(currentStatement.paid_amount)}</b></div><div><small>DUE DATE</small><b>{dateLabel(currentStatement.due_date)}</b></div><span className={`statementStatus ${currentStatement.status.toLowerCase()}`}>{currentStatement.status}</span></section>}
    <section className="card creditLedger"><div className="cardHeader"><div><div className="sectionTitle">Credit Card Ledger</div><div className="sectionSub">Only clinic-related card activity</div></div><span className="softBadge">{rows.length} RECORDS</span></div>
      {rows.length?<div className="creditRows">{rows.map(row=><button className={row.status==="VOID"?"void":""} key={row.id} onClick={()=>{setSelected(row);setMode("view")}}><span className={`creditType ${row.type.toLowerCase()}`}>{row.type==="PAYMENT"?<WalletCards/>:<Receipt/>}</span><div><b>{row.merchant||row.category||row.type.replaceAll("_"," ")}</b><small>{dateLabel(row.date)} · {row.type.replaceAll("_"," ")}{row.reference?` · ${row.reference}`:""}</small></div><strong className={["PAYMENT","REFUND"].includes(row.type)?"credit":"debit"}>{["PAYMENT","REFUND"].includes(row.type)?"−":"+"}{money(row.amount)}</strong></button>)}</div>:<div className="notice emptyState"><Receipt/><span>No card transactions in this period.</span></div>}
    </section>
    {error&&<div className="notice error">{error}</div>}

    {mode==="account"&&<AccountModal account={account} setAccount={setAccount} busy={busy} error={error} onSave={saveAccount} onClose={()=>setMode("")}/>} 
    {mode==="entry"&&<Modal title="Add Card Transaction" kicker="CREDIT CARD LEDGER" onClose={()=>setMode("")}><form onSubmit={saveEntry}><div className="creditMode">{[["PURCHASE","Purchase"],["PAYMENT","Payment"],["CHARGE","Other"]].map(([value,label])=><button type="button" className={entry.kind===value?"active":""} onClick={()=>setEntry({...entry,kind:value})} key={value}>{label}</button>)}</div>{entry.kind==="CHARGE"&&<div className="field"><label>Type</label><select value={entry.chargeType} onChange={e=>setEntry({...entry,chargeType:e.target.value})}><option value="INTEREST">Interest</option><option value="LATE_FEE">Late payment fee</option><option value="OTHER_FEE">Other bank fee</option><option value="REFUND">Refund</option></select></div>}<div className="formGrid creditForm"><div className="field"><label>Date</label><input required type="date" value={entry.date} onChange={e=>setEntry({...entry,date:e.target.value})}/></div><div className="field"><label>Amount AED</label><input required min=".01" step=".01" type="number" value={entry.amount} onChange={e=>setEntry({...entry,amount:e.target.value})}/></div>{entry.kind==="PAYMENT"?<><div className="field"><label>Paid From</label><select value={entry.settlementSource} onChange={e=>setEntry({...entry,settlementSource:e.target.value})}><option value="BANK">Operating Bank</option><option value="CASH">Clinic Cash</option><option value="OTHER">Recorded Elsewhere</option></select></div><div className="field"><label>Statement</label><select value={entry.statementId} onChange={e=>setEntry({...entry,statementId:e.target.value})}><option value="">General payment</option>{data.statements.filter(s=>s.status!=="PAID").map(s=><option value={s.id} key={s.id}>{dateLabel(s.statement_date)} · {money(s.remaining)} due</option>)}</select></div></>:<><div className="field"><label>{entry.kind==="PURCHASE"?"Supplier":"Bank"}</label><input value={entry.merchant} onChange={e=>setEntry({...entry,merchant:e.target.value})}/></div><div className="field"><label>Category</label><input list="cardCategories" value={entry.category} onChange={e=>setEntry({...entry,category:e.target.value})}/><datalist id="cardCategories">{data.categories.map(x=><option value={x.name} key={x.id}/>)}</datalist></div></>}<div className="field"><label>Reference</label><input value={entry.reference} onChange={e=>setEntry({...entry,reference:e.target.value})}/></div><div className="field"><label>Note</label><input value={entry.description} onChange={e=>setEntry({...entry,description:e.target.value})}/></div></div><div className="modalActions"><button type="button" className="btn btnSoft" onClick={()=>setMode("")}>CANCEL</button><button disabled={busy} className="btn btnPrimary">{busy?"SAVING…":"SAVE TRANSACTION"}</button></div></form></Modal>}
    {mode==="statement"&&<Modal title="Record Statement" kicker="MONTHLY CONTROL" onClose={()=>setMode("")}><form onSubmit={saveStatement}><div className="formGrid creditForm"><div className="field"><label>Statement Date</label><input required type="date" value={statement.statementDate} onChange={e=>setStatement({...statement,statementDate:e.target.value})}/></div><div className="field"><label>Payment Due Date</label><input required min={statement.statementDate} type="date" value={statement.dueDate} onChange={e=>setStatement({...statement,dueDate:e.target.value})}/></div><div className="field"><label>Statement Balance AED</label><input required min="0" step=".01" type="number" value={statement.statementBalance} onChange={e=>setStatement({...statement,statementBalance:e.target.value})}/></div><div className="field"><label>Minimum Due AED</label><input required min="0" step=".01" type="number" value={statement.minimumDue} onChange={e=>setStatement({...statement,minimumDue:e.target.value})}/></div></div><div className="modalActions"><button type="button" className="btn btnSoft" onClick={()=>setMode("")}>CANCEL</button><button disabled={busy} className="btn btnPrimary">{busy?"SAVING…":"SAVE STATEMENT"}</button></div></form></Modal>}
    {mode==="report"&&<Modal title="Credit Card Report" kicker="CONTROLLED REPORT" wide onClose={()=>setMode("")}><div className="creditReportControls"><div className="field"><label>From</label><input type="date" value={range.from} onChange={e=>setRange({...range,from:e.target.value})}/></div><div className="field"><label>To</label><input type="date" value={range.to} onChange={e=>setRange({...range,to:e.target.value})}/></div><button className="btn btnPrimary" onClick={pdf}><FileDown/> PDF</button><button className="btn btnSoft" onClick={excel}>EXCEL</button></div><div className="creditReportSummary"><span>Charges <b>{money(reportSummary.charges)}</b></span><span>Payments <b>{money(reportSummary.payments)}</b></span><span>Refunds <b>{money(reportSummary.refunds)}</b></span></div><div className="creditMiniTable">{rows.slice(0,40).map(row=><div key={row.id}><span>{dateLabel(row.date)}</span><span>{row.type.replaceAll("_"," ")}</span><span>{row.merchant||row.category||"—"}</span><b>{money(row.amount)}</b></div>)}</div></Modal>}
    {mode==="view"&&selected&&<Modal title="Transaction Details" kicker={`ENTRY #${selected.id}`} onClose={()=>setMode("")}><div className="creditDetail"><span><small>Date</small><b>{dateLabel(selected.date)}</b></span><span><small>Type</small><b>{selected.type.replaceAll("_"," ")}</b></span><span><small>Amount</small><b>{money(selected.amount)}</b></span><span><small>Supplier / Bank</small><b>{selected.merchant||"—"}</b></span><span><small>Category</small><b>{selected.category||"—"}</b></span><span><small>Reference</small><b>{selected.reference||"—"}</b></span></div>{selected.description&&<p className="creditNote">{selected.description}</p>}{canManage&&selected.status!=="VOID"&&<><div className="field"><label>Reason for void</label><input value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="Required for audit history"/></div><div className="modalActions"><button className="btn btnSoft" onClick={()=>setMode("")}>CLOSE</button><button disabled={busy||!voidReason.trim()} className="btn btnDanger" onClick={voidEntry}>VOID SAFELY</button></div></>}</Modal>}
  </>;
}

function AccountModal({account,setAccount,busy,error,onSave,onClose}) {
  return <Modal title={account.id?"Card Settings":"Add Clinic Card"} kicker="SECURE ACCOUNT" onClose={onClose}><form onSubmit={onSave}><div className="formGrid creditForm"><div className="field full"><label>Account Name</label><input required value={account.name} onChange={e=>setAccount({...account,name:e.target.value})}/></div><div className="field"><label>Bank</label><input value={account.bankName} onChange={e=>setAccount({...account,bankName:e.target.value})}/></div><div className="field"><label>Cardholder</label><input value={account.cardholderName} onChange={e=>setAccount({...account,cardholderName:e.target.value})}/></div><div className="field"><label>Last Four Digits</label><input inputMode="numeric" maxLength="4" value={account.lastFour} onChange={e=>setAccount({...account,lastFour:e.target.value.replace(/\D/g,"").slice(0,4)})}/></div><div className="field"><label>Credit Limit AED</label><input required min="0" step=".01" type="number" value={account.creditLimit} onChange={e=>setAccount({...account,creditLimit:e.target.value})}/></div><div className="field full"><label>Clinic Opening Outstanding AED</label><input required min="0" step=".01" type="number" value={account.openingBalance} onChange={e=>setAccount({...account,openingBalance:e.target.value})}/></div></div><details className="creditAdvanced"><summary>Interest, fees and usual dates</summary><div className="formGrid creditForm"><div className="field"><label>Annual Interest %</label><input min="0" step=".001" type="number" value={account.interestRate} onChange={e=>setAccount({...account,interestRate:e.target.value})}/></div><div className="field"><label>Late Fee AED</label><input min="0" step=".01" type="number" value={account.lateFee} onChange={e=>setAccount({...account,lateFee:e.target.value})}/></div><div className="field"><label>Statement Day</label><input min="1" max="31" type="number" value={account.statementDay} onChange={e=>setAccount({...account,statementDay:e.target.value})}/></div><div className="field"><label>Usual Due Day</label><input min="1" max="31" type="number" value={account.dueDay} onChange={e=>setAccount({...account,dueDay:e.target.value})}/></div></div></details><div className="creditSecurity"><CheckCircle2/> Store only the last four digits. Never enter CVV, PIN or OTP.</div>{error&&<div className="notice error">{error}</div>}<div className="modalActions"><button type="button" className="btn btnSoft" onClick={onClose}>CANCEL</button><button disabled={busy} className="btn btnPrimary">{busy?"SAVING…":"SAVE CARD"}</button></div></form></Modal>;
}
