import { requireUser } from "@/lib/auth";
import { db, query } from "@/lib/db";
import { audit, ensureDay, postBank, postCash } from "@/lib/business";
import { fail, ok } from "@/lib/api";

const TYPES = new Set(["PURCHASE", "PAYMENT", "REFUND", "INTEREST", "LATE_FEE", "OTHER_FEE"]);
const money = value => Math.round(Number(value || 0) * 100) / 100;
const missingSchema = error => error?.code === "42P01" || /credit_card_(accounts|entries|statements)/i.test(error?.message || "");

async function cardState(accountId) {
  const result = await query(`select a.*,
    round((a.opening_balance
      + coalesce(sum(case when e.status='POSTED' and e.entry_type in ('PURCHASE','INTEREST','LATE_FEE','OTHER_FEE') then e.amount else 0 end),0)
      - coalesce(sum(case when e.status='POSTED' and e.entry_type in ('PAYMENT','REFUND') then e.amount else 0 end),0))::numeric,2) outstanding_balance
    from credit_card_accounts a
    left join credit_card_entries e on e.account_id=a.id
    where a.id=$1 and a.active=true group by a.id`, [accountId]);
  return result.rows[0] || null;
}

export async function GET(req) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const accountResult = await query("select id from credit_card_accounts where active=true order by id limit 1");
    const accountId = Number(url.searchParams.get("accountId") || accountResult.rows[0]?.id || 0);
    if (!accountId) {
      const categories = await query("select id,name from categories where active=true and direction in ('OUT','BOTH') order by sort_order,name");
      return ok({ account: null, entries: [], statements: [], categories: categories.rows, reminders: [] });
    }
    const from = url.searchParams.get("from") || "1900-01-01";
    const to = url.searchParams.get("to") || "2999-12-31";
    const [account, entries, statements, categories] = await Promise.all([
      cardState(accountId),
      query(`select e.id,e.business_date date,e.entry_type type,e.category,e.merchant,e.description,
        e.reference_no reference,e.amount,e.settlement_source,e.status,
        coalesce(u.display_name,u.username,'System') created_by
        from credit_card_entries e left join users u on u.id=e.created_by
        where e.account_id=$1 and e.business_date between $2 and $3
        order by e.business_date desc,e.id desc limit 250`, [accountId, from, to]),
      query(`select s.id,s.statement_date,s.due_date,s.statement_balance,s.minimum_due,
        coalesce(sum(case when e.status='POSTED' and e.entry_type='PAYMENT' then e.amount else 0 end),0) paid_amount
        from credit_card_statements s left join credit_card_entries e on e.statement_id=s.id
        where s.account_id=$1 and s.status<>'VOID'
        group by s.id order by s.statement_date desc limit 24`, [accountId]),
      query("select id,name from categories where active=true and direction in ('OUT','BOTH') order by sort_order,name")
    ]);
    const normalizedStatements = statements.rows.map(s => {
      const balance = money(s.statement_balance), paid = money(s.paid_amount);
      return { ...s, statement_balance: balance, minimum_due: money(s.minimum_due), paid_amount: paid,
        remaining: Math.max(0, money(balance - paid)), status: paid >= balance && balance > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "OPEN" };
    });
    const reminders = normalizedStatements.filter(s => s.status !== "PAID").map(s => ({
      statement_id: s.id, due_date: s.due_date, remaining: s.remaining,
      days_until_due: Math.ceil((new Date(`${String(s.due_date).slice(0,10)}T23:59:59`).getTime() - Date.now()) / 86400000)
    })).filter(x => x.days_until_due <= 5).sort((a,b) => a.days_until_due-b.days_until_due);
    return ok({ account: account ? { ...account, credit_limit: money(account.credit_limit), opening_balance: money(account.opening_balance), outstanding_balance: money(account.outstanding_balance), available_credit: Math.max(0, money(account.credit_limit-account.outstanding_balance)) } : null,
      entries: entries.rows.map(e => ({ ...e, amount: money(e.amount) })), statements: normalizedStatements, categories: categories.rows, reminders });
  } catch (error) {
    if (missingSchema(error)) return ok({ setupRequired: true, account: null, entries: [], statements: [], categories: [], reminders: [] });
    return fail(error.message, error.message === "UNAUTHORIZED" ? 401 : 500);
  }
}

export async function POST(req) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const action = body.action || "entry";
    if (action === "account") {
      if (user.role !== "Super Admin") return fail("Super Admin required.", 403);
      const limit = money(body.creditLimit), opening = money(body.openingBalance);
      if (limit < 0 || opening < 0 || opening > limit) return fail("Enter a valid credit limit and opening balance.");
      const digits = String(body.lastFour || "").replace(/\D/g, "");
      if (digits && digits.length !== 4) return fail("Use the last four card digits only.");
      const values = [String(body.name || "Clinic Credit Card").trim(), String(body.bankName || "").trim(), String(body.cardholderName || "").trim(), digits || null, limit, opening, money(body.interestRate), money(body.lateFee), body.statementDay || null, body.dueDay || null, user.id];
      const result = body.id
        ? await query(`update credit_card_accounts set name=$1,bank_name=$2,cardholder_name=$3,last_four=$4,credit_limit=$5,opening_balance=$6,interest_rate=$7,late_fee=$8,statement_day=$9,due_day=$10,updated_by=$11,updated_at=now() where id=$12 returning id`, [...values, Number(body.id)])
        : await query(`insert into credit_card_accounts(name,bank_name,cardholder_name,last_four,credit_limit,opening_balance,interest_rate,late_fee,statement_day,due_day,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) returning id`, values);
      await audit(user.id, body.id ? "EDIT_CARD_ACCOUNT" : "CREATE_CARD_ACCOUNT", "credit_card_account", result.rows[0].id, null, values[0]);
      return ok({ ok: true, id: result.rows[0].id });
    }
    if (action === "statement") {
      const balance = money(body.statementBalance), minimum = money(body.minimumDue);
      if (!body.accountId || !body.statementDate || !body.dueDate || balance < 0 || minimum < 0 || minimum > balance) return fail("Complete the statement details with valid amounts.");
      const result = await query(`insert into credit_card_statements(account_id,statement_date,due_date,statement_balance,minimum_due,created_by)
        values($1,$2,$3,$4,$5,$6)
        on conflict(account_id,statement_date) do update set due_date=excluded.due_date,statement_balance=excluded.statement_balance,minimum_due=excluded.minimum_due,updated_at=now()
        returning id`, [body.accountId, body.statementDate, body.dueDate, balance, minimum, user.id]);
      await audit(user.id, "SAVE_CARD_STATEMENT", "credit_card_statement", result.rows[0].id, body.statementDate, `Balance ${balance}; due ${body.dueDate}`);
      return ok({ ok: true, id: result.rows[0].id });
    }
    if (action === "void") {
      if (user.role !== "Super Admin") return fail("Super Admin required.", 403);
      const client = await db().connect();
      try {
        await client.query("begin");
        const old = (await client.query("select * from credit_card_entries where id=$1 for update", [body.id])).rows[0];
        if (!old) throw new Error("Card transaction not found.");
        await client.query("update credit_card_entries set status='VOID',void_reason=$1,modified_by=$2,modified_at=now() where id=$3", [String(body.reason || "Voided by administrator"), user.id, body.id]);
        if (old.linked_cash_entry_id) await client.query("update cash_entries set status='VOID',void_reason=$1,modified_by=$2,modified_at=now() where id=$3", [String(body.reason || "Linked card settlement voided"), user.id, old.linked_cash_entry_id]);
        if (old.linked_bank_entry_id) await client.query("update bank_entries set status='VOID' where id=$1", [old.linked_bank_entry_id]);
        await client.query("commit");
      } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
      await audit(user.id, "VOID_CARD_ENTRY", "credit_card_entry", body.id, null, String(body.reason || "Voided"));
      return ok({ ok: true });
    }

    const type = String(body.type || "PURCHASE").toUpperCase();
    const amount = money(body.amount);
    if (!TYPES.has(type) || !body.accountId || !body.date || amount <= 0) return fail("Complete the transaction with a positive amount.");
    const isPayment = type === "PAYMENT";
    const source = isPayment ? String(body.settlementSource || "BANK").toUpperCase() : null;
    if (isPayment && !["BANK", "CASH", "OTHER"].includes(source)) return fail("Select a valid payment source.");
    const client = await db().connect();
    let entryId;
    try {
      await client.query("begin");
      let linkedCash = null, linkedBank = null;
      const transferGroup = `CARD-${Date.now()}`;
      if (isPayment && source !== "OTHER") {
        const category = (await client.query("select id from categories where name='Credit Card Settlement' limit 1")).rows[0];
        if (!category) throw new Error("Credit Card Settlement category is missing. Run the credit-card migration.");
        if (source === "BANK") {
          const bank = (await client.query("select id,name from bank_accounts where active=true order by id limit 1")).rows[0];
          if (!bank) throw new Error("No active bank account is configured.");
          linkedBank = await postBank({ date: body.date, bankId: bank.id, direction: "OUT", amount, categoryId: category.id, counterparty: body.merchant || "Credit Card", description: body.description || "Credit card settlement", reference: body.reference || "", userId: user.id, transferGroup }, client);
        } else {
          await ensureDay(body.date, user.id);
          linkedCash = await postCash({ date: body.date, direction: "OUT", amount, categoryId: category.id, counterparty: body.merchant || "Credit Card", description: body.description || "Credit card settlement", reference: body.reference || "", userId: user.id, transferGroup }, client);
        }
      }
      const result = await client.query(`insert into credit_card_entries(account_id,statement_id,business_date,entry_time,entry_type,amount,category,merchant,description,reference_no,settlement_source,status,created_by,linked_cash_entry_id,linked_bank_entry_id)
        values($1,$2,$3,current_time,$4,$5,$6,$7,$8,$9,$10,'POSTED',$11,$12,$13) returning id`,
        [body.accountId, body.statementId || null, body.date, type, amount, String(body.category || ""), String(body.merchant || ""), String(body.description || ""), String(body.reference || ""), source, user.id, linkedCash, linkedBank]);
      entryId = result.rows[0].id;
      await client.query("commit");
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
    await audit(user.id, `POST_CARD_${type}`, "credit_card_entry", entryId, body.date, `${type} ${amount}`);
    return ok({ ok: true, id: entryId });
  } catch (error) {
    if (missingSchema(error)) return fail("Credit-card setup is required. Run docs/NORTHFIELD_CREDIT_CARD_MIGRATION.sql once.", 503);
    return fail(error.message, error.message === "UNAUTHORIZED" ? 401 : 500);
  }
}
