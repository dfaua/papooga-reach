import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/companies - List all companies
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/companies - Create a new company
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      linkedin_url: body.linkedin_url,
      name: body.name,
      industry: body.industry,
      employee_count: body.employee_count,
      description: body.description,
      website: body.website,
      location: body.location,
      revenue_range: body.revenue_range,
      is_contacted: body.is_contacted ?? false,
      raw_data: body.raw_data,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate URL
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Company with this LinkedIn URL already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
