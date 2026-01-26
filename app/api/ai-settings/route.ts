import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// Type assertion for ai_settings table (not yet in generated types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const aiSettingsTable = () => (supabase as any).from("ai_settings");

// GET /api/ai-settings - Get AI settings (single row)
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { data, error } = await aiSettingsTable()
    .select("*")
    .limit(1)
    .single();

  if (error) {
    // If no row exists, return empty settings
    if (error.code === "PGRST116") {
      return NextResponse.json({
        company_info: "",
        custom_instructions: "",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT /api/ai-settings - Update AI settings (upsert)
export async function PUT(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();

  // First, try to get existing row
  const { data: existing } = await aiSettingsTable()
    .select("id")
    .limit(1)
    .single();

  let result;

  if (existing) {
    // Update existing row
    result = await aiSettingsTable()
      .update({
        company_info: body.company_info,
        custom_instructions: body.custom_instructions,
      })
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    // Insert new row
    result = await aiSettingsTable()
      .insert({
        company_info: body.company_info,
        custom_instructions: body.custom_instructions,
      })
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
