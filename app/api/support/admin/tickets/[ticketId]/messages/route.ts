import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidAdminToken } from "@/lib/admin/token";

type RouteParams = {
  ticketId: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured" }, { status: 500 });
  }

  const token = request.headers.get("x-admin-token");
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = await context.params;

  const [ticketRes, messagesRes] = await Promise.all([
    supabaseAdmin.from("support_tickets").select("*").eq("id", ticketId).maybeSingle(),
    supabaseAdmin
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
  ]);

  if (ticketRes.error) {
    console.error("[support] load ticket error", ticketRes.error);
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }

  if (!ticketRes.data) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (messagesRes.error) {
    console.error("[support] load messages error", messagesRes.error);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }

  return NextResponse.json({
    ticket: ticketRes.data,
    messages: messagesRes.data ?? [],
  });
}

