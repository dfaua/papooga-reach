import { supabase } from "@/app/lib/supabase/client";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

interface GoogleAuth {
  id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  email: string;
  last_sync_at: string | null;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Get a valid Google access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<{ token: string; email: string } | null> {
  // Get stored auth
  const { data: auth, error } = await (supabase as any).from("google_auth")
    .select("*")
    .single();

  if (error || !auth) {
    console.error("No Google auth found");
    return null;
  }

  const googleAuth = auth as GoogleAuth;
  const expiresAt = new Date(googleAuth.token_expires_at);
  const now = new Date();

  // If token is still valid (with 5 min buffer), return it
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return { token: googleAuth.access_token, email: googleAuth.email };
  }

  // Token expired, refresh it
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error("Google OAuth not configured");
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: googleAuth.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token refresh failed:", errorText);
      return null;
    }

    const tokens: TokenResponse = await response.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Update stored token
    await (supabase as any).from("google_auth")
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", googleAuth.id);

    return { token: tokens.access_token, email: googleAuth.email };
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

/**
 * Update last sync time
 */
export async function updateLastSyncTime(): Promise<void> {
  await (supabase as any).from("google_auth")
    .update({ last_sync_at: new Date().toISOString() })
    .neq("id", "00000000-0000-0000-0000-000000000000");
}
