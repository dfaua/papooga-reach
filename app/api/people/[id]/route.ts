import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/people/[id] - Get a single person
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { id } = await params;

  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT /api/people/[id] - Update a person
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  // Only update fields that are provided in the body
  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    "name",
    "title",
    "linkedin_profile_url",
    "company_id",
    "company_name",
    "company_linkedin_url",
    "status",
    "notes",
    "raw_data",
    "warm_intro_referrer",
    "connections_count",
    "followers_count",
    // Apollo enrichment fields
    "email",
    "email_status",
    "phone_number",
    "photo_url",
    "headline",
    "city",
    "state",
    "country",
    "seniority",
    "twitter_url",
    "github_url",
    "facebook_url",
    "departments",
    "apollo_id",
    "apollo_enriched_at",
    // ZeroBounce verification fields
    "email_zerobounce_status",
    "email_zerobounce_sub_status",
    "email_zerobounce_at",
  ];

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  console.log("Updating person:", id, "with data:", updateData);

  const { data, error } = await supabase
    .from("people")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating person:", error);
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/people/[id] - Delete a person
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { id } = await params;

  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
