import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/templates - List all templates
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const currentOnly = searchParams.get("current") === "true";
  const profileId = searchParams.get("profile_id");

  let query = supabase
    .from("message_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (profileId) {
    query = query.eq("profile_id", profileId);
  }

  if (type) {
    query = query.eq("type", type);
  }

  if (currentOnly) {
    query = query.eq("is_current", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();

  if (!body.profile_id) {
    return NextResponse.json({ error: "profile_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("message_templates")
    .insert({
      profile_id: body.profile_id,
      name: body.name,
      type: body.type,
      content: body.content,
      is_current: body.is_current ?? false,
      notes: body.notes,
      sequence_number: body.type === "follow_up" ? body.sequence_number : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
