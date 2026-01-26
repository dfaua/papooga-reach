import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// GET /api/google/status - Check if Gmail is connected
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { data, error } = await (supabase as any).from("google_auth")
    .select("email, last_sync_at, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({
      connected: false,
      email: null,
      lastSyncAt: null,
    });
  }

  return NextResponse.json({
    connected: true,
    email: data.email,
    lastSyncAt: data.last_sync_at,
    connectedAt: data.created_at,
  });
}
