import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";
import { getValidAccessToken, updateLastSyncTime } from "@/app/lib/google/auth";

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<{ mimeType: string; body?: { data?: string } }>;
    }>;
  };
  internalDate: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

function extractEmail(fromHeader: string): string {
  // Extract email from "Name <email@example.com>" format
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader;
}

function decodeBase64(data: string): string {
  try {
    // Gmail uses URL-safe base64
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(payload: GmailMessage["payload"]): { text: string; html: string } {
  let text = "";
  let html = "";

  // Simple body
  if (payload.body?.data) {
    const decoded = decodeBase64(payload.body.data);
    text = decoded;
  }

  // Multipart body
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text = decodeBase64(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBase64(part.body.data);
      } else if (part.mimeType === "multipart/alternative" && part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === "text/plain" && subpart.body?.data) {
            text = decodeBase64(subpart.body.data);
          } else if (subpart.mimeType === "text/html" && subpart.body?.data) {
            html = decodeBase64(subpart.body.data);
          }
        }
      }
    }
  }

  return { text, html };
}

// POST /api/emails/sync - Sync emails from Gmail for a specific person
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const auth = await getValidAccessToken();
  if (!auth) {
    return NextResponse.json(
      { error: "Gmail not connected" },
      { status: 401 }
    );
  }

  const { token, email: userEmail } = auth;
  const baseUrl = "https://gmail.googleapis.com/gmail/v1/users/me";

  // Get person email to sync from request body
  const body = await request.json().catch(() => ({}));
  const { personEmail, personId } = body;

  if (!personEmail) {
    return NextResponse.json(
      { error: "personEmail is required" },
      { status: 400 }
    );
  }

  try {
    // Get existing message IDs to avoid duplicates
    const { data: existingEmails } = await (supabase as any).from("emails")
      .select("gmail_message_id");
    const existingIds = new Set((existingEmails || []).map((e: any) => e.gmail_message_id));

    // Gmail query to find emails to/from this person
    const gmailQuery = encodeURIComponent(`from:${personEmail} OR to:${personEmail}`);

    // Fetch messages matching the query
    const messagesResponse = await fetch(
      `${baseUrl}/messages?q=${gmailQuery}&maxResults=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!messagesResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch messages from Gmail" },
        { status: 500 }
      );
    }

    const messagesData: GmailListResponse = await messagesResponse.json();
    const allMessageIds = messagesData.messages || [];

    // Filter out existing messages
    const newMessageIds = allMessageIds.filter((m) => !existingIds.has(m.id));

    // Fetch full message details
    const emailsToInsert: any[] = [];
    const threadIds = new Set<string>();

    for (const msg of newMessageIds) {
      const msgResponse = await fetch(
        `${baseUrl}/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!msgResponse.ok) continue;

      const message: GmailMessage = await msgResponse.json();
      const headers = message.payload.headers;
      const from = getHeader(headers, "From");
      const to = getHeader(headers, "To");
      const subject = getHeader(headers, "Subject");
      const { text, html } = extractBody(message.payload);

      const fromEmail = extractEmail(from);
      const toEmail = extractEmail(to);

      // Determine direction based on sender
      const direction = fromEmail.toLowerCase() === userEmail.toLowerCase() ? "sent" : "received";

      threadIds.add(message.threadId);

      emailsToInsert.push({
        person_id: personId,
        gmail_message_id: message.id,
        gmail_thread_id: message.threadId,
        from_email: fromEmail,
        to_email: toEmail,
        subject,
        body_text: text,
        body_html: html || null,
        direction,
        is_reply: false, // Will be updated after insert
        sent_at: new Date(parseInt(message.internalDate)).toISOString(),
      });
    }

    // Insert emails
    if (emailsToInsert.length > 0) {
      const { error: insertError } = await (supabase as any).from("emails")
        .insert(emailsToInsert);

      if (insertError) {
        console.error("Error inserting emails:", insertError);
        return NextResponse.json(
          { error: "Failed to store emails" },
          { status: 500 }
        );
      }

      // Detect replies: if there's both sent and received in same thread, mark received as reply
      for (const threadId of threadIds) {
        const { data: threadEmails } = await (supabase as any).from("emails")
          .select("id, direction")
          .eq("gmail_thread_id", threadId);

        if (threadEmails && threadEmails.length > 1) {
          const hasSent = threadEmails.some((e: any) => e.direction === "sent");
          const receivedIds = threadEmails
            .filter((e: any) => e.direction === "received")
            .map((e: any) => e.id);

          if (hasSent && receivedIds.length > 0) {
            await (supabase as any).from("emails")
              .update({ is_reply: true })
              .in("id", receivedIds);
          }
        }
      }
    }

    // Update last sync time
    await updateLastSyncTime();

    return NextResponse.json({
      success: true,
      synced: emailsToInsert.length,
      skipped: allMessageIds.length - newMessageIds.length,
    });
  } catch (error) {
    console.error("Email sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
