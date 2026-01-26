import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

const ZEROBOUNCE_API_KEY = process.env.ZEROBOUNCE_API_KEY;
const ZEROBOUNCE_API_URL = "https://api.zerobounce.net/v2/validate";

interface ZeroBounceResponse {
  address: string;
  status: string;
  sub_status: string;
  free_email: boolean;
  did_you_mean?: string;
  account: string;
  domain: string;
  domain_age_days?: string;
  smtp_provider?: string;
  mx_found: string;
  mx_record?: string;
  firstname?: string;
  lastname?: string;
  gender?: string;
  country?: string;
  region?: string;
  city?: string;
  zipcode?: string;
  processed_at: string;
  error?: string;
}

// POST /api/zerobounce/verify-email - Verify an email with ZeroBounce
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  if (!ZEROBOUNCE_API_KEY) {
    return NextResponse.json(
      { error: "ZeroBounce API key not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { personId, email } = body;

  if (!personId || !email) {
    return NextResponse.json(
      { error: "personId and email are required" },
      { status: 400 }
    );
  }

  try {
    // Call ZeroBounce API
    const params = new URLSearchParams({
      api_key: ZEROBOUNCE_API_KEY,
      email: email,
    });

    const zbResponse = await fetch(`${ZEROBOUNCE_API_URL}?${params.toString()}`);

    if (!zbResponse.ok) {
      const errorText = await zbResponse.text();
      console.error("ZeroBounce API error:", zbResponse.status, errorText);
      return NextResponse.json(
        { error: `ZeroBounce API error: ${zbResponse.status}` },
        { status: zbResponse.status }
      );
    }

    const zbData: ZeroBounceResponse = await zbResponse.json();

    if (zbData.error) {
      return NextResponse.json(
        { error: zbData.error },
        { status: 400 }
      );
    }

    // Update the person in database with verification results
    const updateData = {
      email_zerobounce_status: zbData.status,
      email_zerobounce_sub_status: zbData.sub_status || null,
      email_zerobounce_at: new Date().toISOString(),
    };

    // Type assertion needed until migration is pushed and types regenerated
    const { data: updatedPerson, error: updateError } = await (supabase
      .from("people") as any)
      .update(updateData)
      .eq("id", personId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating person:", updateError);
      return NextResponse.json(
        { error: "Failed to save verification result" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      verified: true,
      status: zbData.status,
      sub_status: zbData.sub_status,
      free_email: zbData.free_email,
      did_you_mean: zbData.did_you_mean,
      mx_found: zbData.mx_found === "true",
      person: updatedPerson,
    });
  } catch (error) {
    console.error("ZeroBounce verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify email" },
      { status: 500 }
    );
  }
}
