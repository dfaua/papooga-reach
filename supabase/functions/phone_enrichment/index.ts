import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface ApolloPhoneWebhook {
  status: string;
  people: Array<{
    id: string;
    status: string;
    phone_numbers?: Array<{
      raw_number: string;
      sanitized_number: string;
      confidence_cd?: string;
      status_cd?: string;
      type_cd?: string;
    }>;
  }>;
}

Deno.serve(async (req) => {
  // Apollo sends POST with JSON payload
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: ApolloPhoneWebhook = await req.json();
    console.log("Apollo phone webhook received:", JSON.stringify(payload));

    if (!payload.people || payload.people.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No people in payload" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: string[] = [];

    for (const person of payload.people) {
      if (!person.phone_numbers || person.phone_numbers.length === 0) {
        results.push(`${person.id}: no phone numbers`);
        continue;
      }

      // Pick the best phone number: prefer high confidence, then first available
      const bestPhone =
        person.phone_numbers.find((p) => p.confidence_cd === "high") ||
        person.phone_numbers[0];

      // Update person by apollo_id
      const { error } = await supabase
        .from("people")
        .update({ phone_number: bestPhone.sanitized_number })
        .eq("apollo_id", person.id);

      if (error) {
        console.error(`Failed to update person ${person.id}:`, error);
        results.push(`${person.id}: error - ${error.message}`);
      } else {
        results.push(`${person.id}: updated with ${bestPhone.sanitized_number}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: "Failed to process webhook" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
