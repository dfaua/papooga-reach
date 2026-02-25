import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/companies/contact-status
// Returns: { [company_id]: { people: [{id, name, outcome}] } }
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  // Get outreach logs with accepted/replied, joined with people
  const { data: logs, error } = await supabase
    .from("outreach_logs")
    .select("outcome, person_id, people!inner(id, name, company_id)")
    .in("outcome", ["accepted", "replied"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build map: company_id -> people with their best outcome
  const companyMap: Record<string, { id: string; name: string; outcome: string }[]> = {};

  for (const log of logs || []) {
    const person = log.people as unknown as { id: string; name: string; company_id: string | null };
    if (!person?.company_id) continue;

    if (!companyMap[person.company_id]) {
      companyMap[person.company_id] = [];
    }

    const existing = companyMap[person.company_id].find((p) => p.id === person.id);
    if (existing) {
      // Upgrade to replied if currently accepted
      if (log.outcome === "replied" && existing.outcome === "accepted") {
        existing.outcome = "replied";
      }
    } else {
      companyMap[person.company_id].push({
        id: person.id,
        name: person.name,
        outcome: log.outcome || "accepted",
      });
    }
  }

  return NextResponse.json(companyMap);
}
