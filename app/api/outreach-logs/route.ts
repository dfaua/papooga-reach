import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/outreach-logs - List outreach logs
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("person_id");

  let query = supabase
    .from("outreach_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (personId) {
    query = query.eq("person_id", personId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/outreach-logs - Create a new outreach log
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();

  const { data, error } = await supabase
    .from("outreach_logs")
    .insert({
      person_id: body.person_id,
      action: body.action,
      template_id: body.template_id || null,
      details: body.details || {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If this is a note_sent action (connection or message), mark the company as contacted
  if (body.action === "note_sent") {
    // Get the person to find their company_id
    const { data: person } = await supabase
      .from("people")
      .select("company_id")
      .eq("id", body.person_id)
      .single();

    if (person?.company_id) {
      // Mark the company as contacted
      await supabase
        .from("companies")
        .update({ is_contacted: true })
        .eq("id", person.company_id);
    }
  }

  return NextResponse.json(data, { status: 201 });
}
