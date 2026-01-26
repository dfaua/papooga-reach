import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface UserInfo {
  email: string;
  verified_email: boolean;
}

// GET /api/google/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/?google_error=" + error, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?google_error=no_code", request.url));
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return NextResponse.redirect(new URL("/?google_error=not_configured", request.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange error:", errorData);
      return NextResponse.redirect(new URL("/?google_error=token_exchange_failed", request.url));
    }

    const tokens: TokenResponse = await tokenResponse.json();

    if (!tokens.refresh_token) {
      console.error("No refresh token received");
      return NextResponse.redirect(new URL("/?google_error=no_refresh_token", request.url));
    }

    // Get user email
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(new URL("/?google_error=user_info_failed", request.url));
    }

    const userInfo: UserInfo = await userResponse.json();

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens in database (upsert - replace if exists)
    // First, delete any existing auth
    await (supabase as any).from("google_auth").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Insert new auth
    const { error: insertError } = await (supabase as any).from("google_auth").insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokenExpiresAt,
      email: userInfo.email,
    });

    if (insertError) {
      console.error("Error storing tokens:", insertError);
      return NextResponse.redirect(new URL("/?google_error=storage_failed", request.url));
    }

    // Redirect back to app with success
    return NextResponse.redirect(new URL("/?google_connected=true", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?google_error=unknown", request.url));
  }
}
