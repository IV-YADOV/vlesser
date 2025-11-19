import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidAdminToken } from "@/lib/admin/token";

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured" }, { status: 500 });
  }

  const token = request.headers.get("x-admin-token");
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "open";
  const limit = Number(searchParams.get("limit") || 50);

  let query = supabaseAdmin
    .from("support_tickets")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[support] list tickets error", error);
    return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });
  }

  return NextResponse.json({ tickets: data ?? [] });
}

