import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/metrics - Get outreach metrics
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const now = new Date();

  // Start of today (midnight)
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // 7 days ago
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  try {
    // Get all messages sent today (both connections and messages count)
    const { data: messagesToday, error: messagesError } = await supabase
      .from("outreach_logs")
      .select("id")
      .eq("action", "note_sent")
      .gte("created_at", todayStart.toISOString());

    if (messagesError) {
      console.error("Messages query error:", messagesError);
    }

    // Get connections in last 7 days using contains for JSONB
    const { data: connectionsWeek, error: connectionsError } = await supabase
      .from("outreach_logs")
      .select("id")
      .eq("action", "note_sent")
      .gte("created_at", sevenDaysAgo.toISOString())
      .contains("details", { message_type: "connection" });

    if (connectionsError) {
      console.error("Connections query error:", connectionsError);
    }

    // Get companies added today
    const { data: companiesToday, error: companiesError } = await supabase
      .from("companies")
      .select("id")
      .gte("created_at", todayStart.toISOString());

    if (companiesError) {
      console.error("Companies query error:", companiesError);
    }

    return NextResponse.json({
      messagesToday: messagesToday?.length || 0,
      connectionsWeek: connectionsWeek?.length || 0,
      companiesToday: companiesToday?.length || 0,
    });
  } catch (error) {
    console.error("Metrics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
