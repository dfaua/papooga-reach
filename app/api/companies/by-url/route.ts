import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/companies/by-url?url=... - Check if company exists by LinkedIn URL
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("linkedin_url", url)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ exists: false });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exists: true, id: data.id, name: data.name });
}
