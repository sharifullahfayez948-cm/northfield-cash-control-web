import { settingsMap } from "@/lib/business";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await settingsMap();
    return ok({
      company_name: settings.company_name || "Northfield Veterinary Clinic",
      company_logo: settings.company_logo || "",
    });
  } catch (error) {
    return fail(error.message, 500);
  }
}
