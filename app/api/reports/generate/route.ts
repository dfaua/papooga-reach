import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase/client";

const API_KEY = process.env.API_KEY;

function validateApiKey(request: NextRequest) {
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey || apiKey !== API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

interface Profile {
  id: string;
  industry: string | null;
  roles: string[];
  pain_points: string[];
  notes: string | null;
}

interface Template {
  id: string;
  profile_id: string;
  name: string;
  content: string;
  type: string;
  is_current: boolean | null;
  notes: string | null;
}

interface Person {
  id: string;
  name: string;
  title: string | null;
  company_name: string | null;
  status: string | null;
  created_at: string | null;
  company_id: string | null;
  email: string | null;
  companies?: {
    industry: string | null;
    employee_count: string | null;
    location: string | null;
  } | null;
}

interface Message {
  id: string;
  person_id: string;
  content: string;
  direction: string;
  type: string;
  created_at: string | null;
}

interface Email {
  id: string;
  person_id: string | null;
  from_email: string;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  direction: string;
  is_reply: boolean | null;
  sent_at: string;
  gmail_thread_id: string | null;
}

interface OutreachLog {
  id: string;
  person_id: string;
  action: string;
  outcome: string | null;
  template_id: string | null;
  created_at: string | null;
}

interface Company {
  id: string;
  name: string;
  industry: string | null;
  employee_count: string | null;
  location: string | null;
}

// POST /api/reports/generate
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Fetch all data within the date range
    const [
      { data: profiles },
      { data: templates },
      { data: people },
      { data: messages },
      { data: emails },
      { data: outreachLogs },
      { data: companies },
    ] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("message_templates").select("*"),
      supabase
        .from("people")
        .select("*, companies(industry, employee_count, location)")
        .gte("created_at", startDate)
        .lte("created_at", endDate),
      supabase
        .from("messages")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("emails")
        .select("*")
        .gte("sent_at", startDate)
        .lte("sent_at", endDate)
        .order("sent_at", { ascending: true }),
      supabase
        .from("outreach_logs")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", endDate),
      supabase.from("companies").select("*"),
    ]);

    // Also fetch all people for conversation context (not just in date range)
    const { data: allPeople } = await supabase
      .from("people")
      .select("*, companies(industry, employee_count, location)");

    const markdown = generateReport({
      startDate,
      endDate,
      profiles: (profiles || []) as Profile[],
      templates: (templates || []) as Template[],
      people: (people || []) as Person[],
      allPeople: (allPeople || []) as Person[],
      messages: (messages || []) as Message[],
      emails: (emails || []) as Email[],
      outreachLogs: (outreachLogs || []) as OutreachLog[],
      companies: (companies || []) as Company[],
    });

    return NextResponse.json({ markdown });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

function generateReport({
  startDate,
  endDate,
  profiles,
  templates,
  people,
  allPeople,
  messages,
  emails,
  outreachLogs,
  companies,
}: {
  startDate: string;
  endDate: string;
  profiles: Profile[];
  templates: Template[];
  people: Person[];
  allPeople: Person[];
  messages: Message[];
  emails: Email[];
  outreachLogs: OutreachLog[];
  companies: Company[];
}): string {
  const lines: string[] = [];
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const start = new Date(startDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const end = new Date(endDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Header
  lines.push("# Outreach Report");
  lines.push(`**Generated:** ${now} | **Period:** ${start} - ${end}`);
  lines.push("");

  // Executive Summary
  lines.push("## Executive Summary");
  lines.push("");

  const totalCompanies = companies.length;
  const totalPeople = people.length;

  // Calculate funnel metrics
  const statusCounts = {
    saved: 0,
    requested: 0,
    accepted: 0,
    messaged: 0,
    replied: 0,
  };

  for (const person of people) {
    const status = person.status || "saved";
    if (status in statusCounts) {
      statusCounts[status as keyof typeof statusCounts]++;
    }
  }

  // Cumulative counts (each stage includes all stages after it)
  const saved = totalPeople;
  const requested =
    statusCounts.requested +
    statusCounts.accepted +
    statusCounts.messaged +
    statusCounts.replied;
  const accepted =
    statusCounts.accepted + statusCounts.messaged + statusCounts.replied;
  const messaged = statusCounts.messaged + statusCounts.replied;
  const replied = statusCounts.replied;

  const connectionRate = requested > 0 ? ((accepted / requested) * 100).toFixed(1) : "0";
  const responseRate = messaged > 0 ? ((replied / messaged) * 100).toFixed(1) : "0";

  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Companies | ${totalCompanies} |`);
  lines.push(`| Total People (in period) | ${totalPeople} |`);
  lines.push(`| Connection Rate | ${connectionRate}% (${accepted}/${requested} requested) |`);
  lines.push(`| Response Rate | ${responseRate}% (${replied}/${messaged} messaged) |`);
  lines.push("");

  // Pipeline Funnel
  lines.push("## Pipeline Funnel");
  lines.push("");
  lines.push("```");
  lines.push(
    `Saved(${saved}) → Requested(${requested}) → Accepted(${accepted}) → Messaged(${messaged}) → Replied(${replied})`
  );
  lines.push("```");
  lines.push("");

  if (requested > 0) {
    lines.push("**Conversion Rates:**");
    lines.push(`- Saved → Requested: ${((requested / saved) * 100).toFixed(1)}%`);
    if (requested > 0)
      lines.push(`- Requested → Accepted: ${((accepted / requested) * 100).toFixed(1)}%`);
    if (accepted > 0)
      lines.push(`- Accepted → Messaged: ${((messaged / accepted) * 100).toFixed(1)}%`);
    if (messaged > 0)
      lines.push(`- Messaged → Replied: ${((replied / messaged) * 100).toFixed(1)}%`);
    lines.push("");
  }

  // Company Analysis
  lines.push("## Company Analysis");
  lines.push("");

  // By Industry
  const industryStats = new Map<string, { count: number; people: Person[] }>();
  for (const person of people) {
    const industry = person.companies?.industry || "Unknown";
    if (!industryStats.has(industry)) {
      industryStats.set(industry, { count: 0, people: [] });
    }
    const stats = industryStats.get(industry)!;
    stats.count++;
    stats.people.push(person);
  }

  lines.push("### By Industry");
  lines.push("");
  lines.push("| Industry | People | Replied | Response Rate |");
  lines.push("|----------|--------|---------|---------------|");

  for (const [industry, stats] of industryStats.entries()) {
    const repliedCount = stats.people.filter((p) => p.status === "replied").length;
    const messagedCount = stats.people.filter(
      (p) => p.status === "messaged" || p.status === "replied"
    ).length;
    const rate = messagedCount > 0 ? ((repliedCount / messagedCount) * 100).toFixed(1) : "-";
    lines.push(`| ${industry} | ${stats.count} | ${repliedCount} | ${rate}% |`);
  }
  lines.push("");

  // By Size
  const sizeStats = new Map<string, { count: number; people: Person[] }>();
  for (const person of people) {
    const size = person.companies?.employee_count || "Unknown";
    if (!sizeStats.has(size)) {
      sizeStats.set(size, { count: 0, people: [] });
    }
    const stats = sizeStats.get(size)!;
    stats.count++;
    stats.people.push(person);
  }

  lines.push("### By Company Size");
  lines.push("");
  lines.push("| Size | People | Replied | Response Rate |");
  lines.push("|------|--------|---------|---------------|");

  for (const [size, stats] of sizeStats.entries()) {
    const repliedCount = stats.people.filter((p) => p.status === "replied").length;
    const messagedCount = stats.people.filter(
      (p) => p.status === "messaged" || p.status === "replied"
    ).length;
    const rate = messagedCount > 0 ? ((repliedCount / messagedCount) * 100).toFixed(1) : "-";
    lines.push(`| ${size} | ${stats.count} | ${repliedCount} | ${rate}% |`);
  }
  lines.push("");

  // Profiles & Templates
  lines.push("---");
  lines.push("");
  lines.push("## Profiles & Templates");
  lines.push("");

  // Calculate template usage from outreach logs
  const templateUsage = new Map<string, { used: number; outcomes: string[]; personIds: string[] }>();
  for (const log of outreachLogs) {
    if (log.template_id) {
      if (!templateUsage.has(log.template_id)) {
        templateUsage.set(log.template_id, { used: 0, outcomes: [], personIds: [] });
      }
      const usage = templateUsage.get(log.template_id)!;
      usage.used++;
      usage.personIds.push(log.person_id);
      if (log.outcome) {
        usage.outcomes.push(log.outcome);
      }
    }
  }

  // Create a map of all people by ID for acceptance tracking
  const allPeopleById = new Map(allPeople.map((p) => [p.id, p]));

  for (const profile of profiles) {
    const profileTemplates = templates.filter((t) => t.profile_id === profile.id);
    const roles = profile.roles.length > 0 ? profile.roles.join(", ") : "Any";
    const industry = profile.industry || "Any Industry";

    lines.push(`### Profile: ${industry} | ${roles}`);
    lines.push("");

    if (profile.pain_points.length > 0) {
      lines.push("**Pain Points:**");
      for (const point of profile.pain_points) {
        lines.push(`- ${point}`);
      }
      lines.push("");
    }

    if (profile.notes) {
      lines.push(`**Notes:** ${profile.notes}`);
      lines.push("");
    }

    // Profile stats - count people that match this profile's criteria
    // (This is approximate - matching by industry)
    const profilePeople = people.filter(
      (p) =>
        !profile.industry ||
        (p.companies?.industry &&
          p.companies.industry.toLowerCase().includes(profile.industry.toLowerCase()))
    );
    const profileReplied = profilePeople.filter((p) => p.status === "replied").length;
    const profileMessaged = profilePeople.filter(
      (p) => p.status === "messaged" || p.status === "replied"
    ).length;
    const profileRate =
      profileMessaged > 0 ? ((profileReplied / profileMessaged) * 100).toFixed(1) : "-";

    lines.push(
      `**Profile Stats:** ${profilePeople.length} people targeted | ${profileRate}% response rate`
    );
    lines.push("");

    if (profileTemplates.length === 0) {
      lines.push("*No templates defined for this profile.*");
      lines.push("");
    } else {
      for (const template of profileTemplates) {
        const usage = templateUsage.get(template.id);
        const usedCount = usage?.used || 0;
        const responses = usage?.outcomes.filter(
          (o) => o === "replied" || o === "positive"
        ).length || 0;
        const responseRate =
          usedCount > 0 ? ((responses / usedCount) * 100).toFixed(1) : "-";

        const currentTag = template.is_current ? " *(current)*" : "";
        lines.push(`#### Template: "${template.name}" (${template.type})${currentTag}`);
        lines.push("");
        lines.push("```");
        lines.push(template.content);
        lines.push("```");
        lines.push("");

        // Build stats line
        let statsLine = `**Stats:** Used ${usedCount}x`;

        // For connection_request templates, show acceptance rate
        if (template.type === "connection_request" && usage && usage.personIds.length > 0) {
          const acceptedCount = usage.personIds.filter((pid) => {
            const person = allPeopleById.get(pid);
            return person && ["accepted", "messaged", "replied"].includes(person.status || "");
          }).length;
          const acceptanceRate = usedCount > 0 ? ((acceptedCount / usedCount) * 100).toFixed(1) : "-";
          statsLine += ` | Accepted: ${acceptedCount} (${acceptanceRate}%)`;
        }

        statsLine += ` | Responses: ${responses} (${responseRate}%)`;
        lines.push(statsLine);

        if (template.notes) {
          lines.push(`**Notes:** ${template.notes}`);
        }
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
  }

  // LinkedIn Conversations
  lines.push("## LinkedIn Conversations");
  lines.push("");

  // Group messages by person
  const messagesByPerson = new Map<string, Message[]>();
  for (const msg of messages) {
    if (!messagesByPerson.has(msg.person_id)) {
      messagesByPerson.set(msg.person_id, []);
    }
    messagesByPerson.get(msg.person_id)!.push(msg);
  }

  const peopleById = new Map(allPeople.map((p) => [p.id, p]));
  let conversationNum = 1;

  if (messagesByPerson.size === 0) {
    lines.push("*No LinkedIn conversations in this period.*");
    lines.push("");
  } else {
    for (const [personId, personMessages] of messagesByPerson.entries()) {
      const person = peopleById.get(personId);
      if (!person) continue;

      const industry = person.companies?.industry || "Unknown Industry";
      const size = person.companies?.employee_count || "Unknown Size";
      const status = (person.status || "saved").toUpperCase();
      const hasReply = personMessages.some((m) => m.direction === "received");
      const outcome = hasReply ? "REPLIED" : "NO REPLY";

      lines.push(
        `### Conversation ${conversationNum} | ${industry}, ${size} | ${outcome}`
      );
      lines.push(`**Person:** ${person.title || "Unknown Title"} at ${person.company_name || "Unknown Company"}`);
      lines.push(`**Status:** ${status}`);
      lines.push("");

      for (const msg of personMessages) {
        const sender = msg.direction === "sent" ? "**You:**" : "**Them:**";
        // Indent message content
        const content = msg.content.split("\n").join("\n> ");
        lines.push(`${sender}`);
        lines.push(`> ${content}`);
        lines.push("");
      }

      lines.push("---");
      lines.push("");
      conversationNum++;
    }
  }

  // Email Conversations
  lines.push("## Email Conversations");
  lines.push("");

  // Group emails by thread
  const emailsByThread = new Map<string, Email[]>();
  const emailsWithoutThread: Email[] = [];

  for (const email of emails) {
    if (email.gmail_thread_id) {
      if (!emailsByThread.has(email.gmail_thread_id)) {
        emailsByThread.set(email.gmail_thread_id, []);
      }
      emailsByThread.get(email.gmail_thread_id)!.push(email);
    } else {
      emailsWithoutThread.push(email);
    }
  }

  if (emailsByThread.size === 0 && emailsWithoutThread.length === 0) {
    lines.push("*No email conversations in this period.*");
    lines.push("");
  } else {
    let threadNum = 1;

    for (const [threadId, threadEmails] of emailsByThread.entries()) {
      // Sort by sent_at
      threadEmails.sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      );

      const firstEmail = threadEmails[0];
      const contactEmail =
        firstEmail.direction === "sent" ? firstEmail.to_email : firstEmail.from_email;
      const person = allPeople.find((p) => p.email === contactEmail);
      const hasReply = threadEmails.some((e) => e.direction === "received");
      const outcome = hasReply ? "REPLIED" : "NO REPLY";

      lines.push(
        `### Thread ${threadNum} | ${contactEmail} | ${threadEmails.length} messages | ${outcome}`
      );
      if (person) {
        lines.push(
          `**Person:** ${person.title || "Unknown"} at ${person.company_name || "Unknown"}`
        );
      }
      lines.push("");

      for (const email of threadEmails) {
        const sender = email.direction === "sent" ? "**You:**" : "**Them:**";
        const date = new Date(email.sent_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        lines.push(`${sender} *(${date})*`);
        lines.push(`**Subject:** ${email.subject || "(No subject)"}`);
        lines.push("");
        if (email.body_text) {
          const body = email.body_text.split("\n").join("\n> ");
          lines.push(`> ${body}`);
        }
        lines.push("");
      }

      lines.push("---");
      lines.push("");
      threadNum++;
    }

    // Single emails without threads
    for (const email of emailsWithoutThread) {
      const contactEmail =
        email.direction === "sent" ? email.to_email : email.from_email;
      const sender = email.direction === "sent" ? "**You:**" : "**Them:**";
      const date = new Date(email.sent_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      lines.push(`### Email ${threadNum} | ${contactEmail}`);
      lines.push(`${sender} *(${date})*`);
      lines.push(`**Subject:** ${email.subject || "(No subject)"}`);
      lines.push("");
      if (email.body_text) {
        const body = email.body_text.split("\n").join("\n> ");
        lines.push(`> ${body}`);
      }
      lines.push("");
      lines.push("---");
      lines.push("");
      threadNum++;
    }
  }

  // Raw Data for AI Analysis
  lines.push("## Raw Data (for AI Analysis)");
  lines.push("");
  lines.push("```json");

  const rawData = {
    period: { startDate, endDate },
    summary: {
      totalCompanies,
      totalPeople,
      connectionRate: parseFloat(connectionRate),
      responseRate: parseFloat(responseRate),
    },
    funnel: {
      saved,
      requested,
      accepted,
      messaged,
      replied,
    },
    industryBreakdown: Object.fromEntries(
      Array.from(industryStats.entries()).map(([industry, stats]) => [
        industry,
        {
          count: stats.count,
          replied: stats.people.filter((p) => p.status === "replied").length,
        },
      ])
    ),
    sizeBreakdown: Object.fromEntries(
      Array.from(sizeStats.entries()).map(([size, stats]) => [
        size,
        {
          count: stats.count,
          replied: stats.people.filter((p) => p.status === "replied").length,
        },
      ])
    ),
    profiles: profiles.map((p) => ({
      industry: p.industry,
      roles: p.roles,
      painPoints: p.pain_points,
      templateCount: templates.filter((t) => t.profile_id === p.id).length,
    })),
    templates: templates.map((t) => {
      const usage = templateUsage.get(t.id);
      return {
        name: t.name,
        type: t.type,
        profileId: t.profile_id,
        used: usage?.used || 0,
        responses: usage?.outcomes.filter((o) => o === "replied" || o === "positive")
          .length || 0,
      };
    }),
    conversationStats: {
      linkedInConversations: messagesByPerson.size,
      emailThreads: emailsByThread.size + emailsWithoutThread.length,
      totalMessages: messages.length,
      totalEmails: emails.length,
    },
  };

  lines.push(JSON.stringify(rawData, null, 2));
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}
