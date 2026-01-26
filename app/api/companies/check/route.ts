import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// POST /api/companies/check - Bulk check which company URLs exist in DB
// Used by extension to show badges on search results
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();
  const urls: string[] = body.urls;

  if (!Array.isArray(urls)) {
    return NextResponse.json(
      { error: "urls must be an array" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("companies")
    .select("linkedin_url, is_contacted")
    .in("linkedin_url", urls);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return a map of URL -> { exists: boolean, is_contacted: boolean }
  const result: Record<string, { exists: boolean; is_contacted: boolean }> = {};

  for (const url of urls) {
    const company = data?.find((c) => c.linkedin_url === url);
    result[url] = {
      exists: !!company,
      is_contacted: company?.is_contacted ?? false,
    };
  }

  return NextResponse.json(result);
}
