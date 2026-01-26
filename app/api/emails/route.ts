import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";
import { getValidAccessToken } from "@/app/lib/google/auth";

// GET /api/emails - List emails
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("person_id");
  const direction = searchParams.get("direction");
  const limit = parseInt(searchParams.get("limit") || "50");

  // Type assertion needed until migration is pushed and types regenerated
  let query = (supabase as any).from("emails")
    .select(`
      *,
      people:person_id (
        id,
        name,
        email,
        company_name
      )
    `)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (personId) {
    query = query.eq("person_id", personId);
  }

  if (direction) {
    query = query.eq("direction", direction);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/emails - Send a new email
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
  const body = await request.json();
  const { to, subject, bodyText, bodyHtml, personId } = body;

  if (!to || !subject || !bodyText) {
    return NextResponse.json(
      { error: "to, subject, and bodyText are required" },
      { status: 400 }
    );
  }

  try {
    // Create the email in RFC 2822 format
    const messageParts = [
      `From: ${userEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      bodyText,
    ];

    const message = messageParts.join("\r\n");

    // Encode to base64url
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send via Gmail API
    const sendResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedMessage }),
      }
    );

    if (!sendResponse.ok) {
      const errorData = await sendResponse.text();
      console.error("Gmail send error:", errorData);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    const sentMessage = await sendResponse.json();

    // Store in database
    const { data: email, error: insertError } = await (supabase as any).from("emails")
      .insert({
        person_id: personId || null,
        gmail_message_id: sentMessage.id,
        gmail_thread_id: sentMessage.threadId,
        from_email: userEmail,
        to_email: to,
        subject,
        body_text: bodyText,
        body_html: bodyHtml || null,
        direction: "sent",
        is_reply: false,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing sent email:", insertError);
      // Email was sent but not stored - not a critical error
    }

    return NextResponse.json({
      success: true,
      messageId: sentMessage.id,
      threadId: sentMessage.threadId,
      email,
    });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
