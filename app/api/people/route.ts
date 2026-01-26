import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/people - List all people
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const companyId = searchParams.get("company_id");

  let query = supabase
    .from("people")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/people - Create a new person
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();

  const { data, error } = await supabase
    .from("people")
    .insert({
      linkedin_url: body.linkedin_url,
      linkedin_profile_url: body.linkedin_profile_url,
      name: body.name,
      title: body.title,
      company_id: body.company_id,
      company_name: body.company_name,
      company_linkedin_url: body.company_linkedin_url,
      status: body.status ?? "saved",
      notes: body.notes,
      connections_count: body.connections_count,
      followers_count: body.followers_count,
      raw_data: body.raw_data,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate URL
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Person with this LinkedIn URL already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
