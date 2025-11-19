import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidAdminToken } from "@/lib/admin/token";

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

  const { status } = await request.json();
  if (!status) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 });
  }

  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "closed") {
    updates.closed_at = new Date().toISOString();
  } else {
    updates.closed_at = null;
  }

  const { error } = await supabaseAdmin
    .from("support_tickets")
    .update(updates)
    .eq("id", (await context.params).ticketId);

  if (error) {
    console.error("[support] status update error", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

