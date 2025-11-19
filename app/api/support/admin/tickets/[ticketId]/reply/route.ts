import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidAdminToken } from "@/lib/admin/token";

async function sendTelegramMessage(tgId: string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: tgId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Failed to send Telegram message", body);
  }
}

type RouteParams = {
  ticketId: string;
};

export async function POST(
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

  const { message, adminName = "Администратор" } = await request.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const { ticketId } = await context.params;

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const { error: insertError } = await supabaseAdmin.from("support_messages").insert({
    ticket_id: ticketId,
    author_type: "admin",
    author_id: "admin",
    author_name: adminName,
    message,
  });

  if (insertError) {
    console.error("[support] admin reply error", insertError);
    return NextResponse.json({ error: "Failed to save reply" }, { status: 500 });
  }

  await supabaseAdmin
    .from("support_tickets")
    .update({
      status: "pending",
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assigned_admin: adminName,
    })
    .eq("id", ticketId);

  await sendTelegramMessage(
    ticket.tg_id,
    `📬 Ответ по тикету ${ticket.subject}\n\n_${adminName}_:\n${message}\n\nОтветьте в боте, чтобы продолжить диалог.`
  );

  return NextResponse.json({ success: true });
}

