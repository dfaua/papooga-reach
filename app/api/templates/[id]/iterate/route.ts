import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";
import { validateApiKey } from "@/app/lib/auth/api-key";

// POST /api/templates/[id]/iterate - Create new version of template
// 1. Sets is_current=false on the original
// 2. Creates a copy with is_current=true and incremented name
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { id } = await params;

  // Get the original template
  const { data: original, error: fetchError } = await supabase
    .from("message_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Deactivate the original
  const { error: updateError } = await supabase
    .from("message_templates")
    .update({ is_current: false })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Generate new name with version increment
  const newName = incrementVersionName(original.name);

  // Create new template as copy
  const { data: newTemplate, error: insertError } = await supabase
    .from("message_templates")
    .insert({
      name: newName,
      profile_id: original.profile_id,
      type: original.type,
      content: original.content,
      is_current: true,
      notes: original.notes,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    original: { ...original, is_current: false },
    new: newTemplate,
  }, { status: 201 });
}

// Helper to increment version in name
// "CEO Intro" -> "CEO Intro v2"
// "CEO Intro v2" -> "CEO Intro v3"
function incrementVersionName(name: string): string {
  const versionMatch = name.match(/^(.+?)\s*v(\d+)$/i);
  if (versionMatch) {
    const baseName = versionMatch[1].trim();
    const version = parseInt(versionMatch[2], 10);
    return `${baseName} v${version + 1}`;
  }
  return `${name} v2`;
}
