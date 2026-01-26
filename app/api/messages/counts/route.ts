import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/messages/counts - Get message counts per person
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { data, error } = await supabase.rpc("get_message_counts_per_person");

  if (error) {
    // If the RPC doesn't exist, fall back to a manual query
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("person_id");

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    // Count messages per person manually
    const counts: Record<string, number> = {};
    messages?.forEach((m) => {
      counts[m.person_id] = (counts[m.person_id] || 0) + 1;
    });

    const result = Object.entries(counts).map(([person_id, count]) => ({
      person_id,
      count,
    }));

    return NextResponse.json(result);
  }

  return NextResponse.json(data);
}
