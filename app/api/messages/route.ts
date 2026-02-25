import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/messages - List messages, optionally filtered by person_id
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("person_id");

  let query = supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (personId) {
    query = query.eq("person_id", personId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/messages - Create a new message
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      person_id: body.person_id,
      type: body.type,
      direction: body.direction,
      content: body.content,
      subject: body.subject || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
