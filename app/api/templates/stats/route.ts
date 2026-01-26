import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

interface TemplateStats {
  template_id: string;
  total_sent: number;
  pending: number;
  accepted: number;
  replied: number;
  acceptance_rate: number;
  reply_rate: number;
}

// GET /api/templates/stats - Get outreach stats per template
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  // Fetch all outreach logs with template_id
  const { data: logs, error } = await supabase
    .from("outreach_logs")
    .select("template_id, outcome")
    .not("template_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate stats by template_id
  const statsMap = new Map<string, TemplateStats>();

  for (const log of logs || []) {
    if (!log.template_id) continue;

    if (!statsMap.has(log.template_id)) {
      statsMap.set(log.template_id, {
        template_id: log.template_id,
        total_sent: 0,
        pending: 0,
        accepted: 0,
        replied: 0,
        acceptance_rate: 0,
        reply_rate: 0,
      });
    }

    const stats = statsMap.get(log.template_id)!;
    stats.total_sent++;

    if (log.outcome === "pending" || !log.outcome) {
      stats.pending++;
    } else if (log.outcome === "accepted") {
      stats.accepted++;
    } else if (log.outcome === "replied") {
      stats.replied++;
    }
  }

  // Calculate rates
  for (const stats of statsMap.values()) {
    if (stats.total_sent > 0) {
      // Acceptance rate = (accepted + replied) / total
      stats.acceptance_rate = Math.round(
        ((stats.accepted + stats.replied) / stats.total_sent) * 100
      );
      // Reply rate = replied / total
      stats.reply_rate = Math.round((stats.replied / stats.total_sent) * 100);
    }
  }

  return NextResponse.json(Array.from(statsMap.values()));
}
