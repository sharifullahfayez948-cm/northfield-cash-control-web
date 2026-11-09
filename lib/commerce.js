import { db, query } from "./db";
import { commerceSchema } from "./commerce-schema.mjs";
import { commerceService } from "./commerce-service.mjs";
import { SALES_CATEGORIES, PURCHASE_CATEGORIES } from "./commerce-model.mjs";

let schemaReady;
export async function ensureCommerceSchema(user) {
  if (schemaReady) return schemaReady;
  const exists = (
    await query(
      "select to_regclass('public.sales_purchase_documents') documents,to_regclass('public.sales_purchase_catalog') payments",
    )
  ).rows[0];
  if (exists.documents && exists.payments) {
    schemaReady = Promise.resolve();
    return;
  }
  if (user.role !== "Super Admin")
    throw new Error(
      "Ask the administrator to open Sales once to initialize this workspace.",
    );
  schemaReady = (async () => {
    const client = await db().connect();
    try {
      await client.query("begin");
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended('northfield-sales-purchases-v1',0))",
      );
      await client.query(commerceSchema);
      for (const [kind, names] of [
        ["SALE_CATEGORY", SALES_CATEGORIES],
        ["BUY_CATEGORY", PURCHASE_CATEGORIES],
      ]) {
        await client.query(
          "insert into sales_purchase_catalog(kind,name) select $1,unnest($2::text[]) on conflict do nothing",
          [kind, names],
        );
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  })();
  try {
    await schemaReady;
  } catch (e) {
    schemaReady = undefined;
    throw e;
  }
}
export const commerce = () => commerceService(db());
