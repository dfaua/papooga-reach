import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = "https://api.apollo.io/api/v1/people/match";

interface ApolloPersonResponse {
  person?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
    email_status?: string;
    phone_numbers?: Array<{ raw_number: string; sanitized_number: string }>;
    title?: string;
    headline?: string;
    linkedin_url?: string;
    photo_url?: string;
    twitter_url?: string;
    github_url?: string;
    facebook_url?: string;
    city?: string;
    state?: string;
    country?: string;
    seniority?: string;
    departments?: string[];
    organization?: {
      id?: string;
      name?: string;
      website_url?: string;
      linkedin_url?: string;
      industry?: string;
      estimated_num_employees?: number;
    };
  };
}

// POST /api/apollo/enrich-person - Enrich a person with Apollo data
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: "Apollo API key not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { personId } = body;

  if (!personId) {
    return NextResponse.json(
      { error: "personId is required" },
      { status: 400 }
    );
  }

  // Get the person from database
  const { data: person, error: personError } = await supabase
    .from("people")
    .select("*")
    .eq("id", personId)
    .single();

  if (personError || !person) {
    return NextResponse.json(
      { error: "Person not found" },
      { status: 404 }
    );
  }

  // Build Apollo API request params
  const params = new URLSearchParams();

  // Use linkedin_profile_url if available (preferred)
  if (person.linkedin_profile_url) {
    params.append("linkedin_url", person.linkedin_profile_url);
  } else if (person.linkedin_url) {
    // Try sales nav URL as fallback
    params.append("linkedin_url", person.linkedin_url);
  }

  // Add name
  if (person.name) {
    params.append("name", person.name);
  }

  // Add company/organization info
  if (person.company_name) {
    params.append("organization_name", person.company_name);
  }

  // Request personal emails and phone numbers
  params.append("reveal_personal_emails", "true");

  try {
    const apolloResponse = await fetch(`${APOLLO_API_URL}?${params.toString()}`, {
      method: "POST",
      headers: {
        "x-api-key": APOLLO_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!apolloResponse.ok) {
      const errorText = await apolloResponse.text();
      console.error("Apollo API error:", apolloResponse.status, errorText);
      return NextResponse.json(
        { error: `Apollo API error: ${apolloResponse.status}` },
        { status: apolloResponse.status }
      );
    }

    const apolloData: ApolloPersonResponse = await apolloResponse.json();

    if (!apolloData.person) {
      return NextResponse.json(
        { error: "No match found in Apollo", enriched: false },
        { status: 200 }
      );
    }

    const apolloPerson = apolloData.person;

    // Prepare update data
    const updateData: Record<string, unknown> = {
      apollo_id: apolloPerson.id,
      apollo_enriched_at: new Date().toISOString(),
    };

    // Only update fields that have values from Apollo
    if (apolloPerson.email) updateData.email = apolloPerson.email;
    if (apolloPerson.email_status) updateData.email_status = apolloPerson.email_status;
    if (apolloPerson.phone_numbers?.[0]?.sanitized_number) {
      updateData.phone_number = apolloPerson.phone_numbers[0].sanitized_number;
    }
    if (apolloPerson.photo_url) updateData.photo_url = apolloPerson.photo_url;
    if (apolloPerson.headline) updateData.headline = apolloPerson.headline;
    if (apolloPerson.city) updateData.city = apolloPerson.city;
    if (apolloPerson.state) updateData.state = apolloPerson.state;
    if (apolloPerson.country) updateData.country = apolloPerson.country;
    if (apolloPerson.seniority) updateData.seniority = apolloPerson.seniority;
    if (apolloPerson.twitter_url) updateData.twitter_url = apolloPerson.twitter_url;
    if (apolloPerson.github_url) updateData.github_url = apolloPerson.github_url;
    if (apolloPerson.facebook_url) updateData.facebook_url = apolloPerson.facebook_url;
    if (apolloPerson.departments) updateData.departments = apolloPerson.departments;

    // Update linkedin_profile_url if we got a better one from Apollo
    if (apolloPerson.linkedin_url && !person.linkedin_profile_url) {
      updateData.linkedin_profile_url = apolloPerson.linkedin_url;
    }

    // Update title if not set
    if (apolloPerson.title && !person.title) {
      updateData.title = apolloPerson.title;
    }

    // Update the person in database
    const { data: updatedPerson, error: updateError } = await supabase
      .from("people")
      .update(updateData)
      .eq("id", personId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating person:", updateError);
      return NextResponse.json(
        { error: "Failed to update person with enriched data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      enriched: true,
      person: updatedPerson,
      apolloData: apolloPerson,
    });
  } catch (error) {
    console.error("Apollo enrichment error:", error);
    return NextResponse.json(
      { error: "Failed to enrich person" },
      { status: 500 }
    );
  }
}
