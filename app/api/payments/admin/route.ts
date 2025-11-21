import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    // Проверяем админский токен
    const adminToken = request.headers.get("x-admin-token");
    const expectedToken = process.env.ADMIN_SECRET_TOKEN;

    if (!adminToken || adminToken !== expectedToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading payments:", error);
      return NextResponse.json(
        { error: "Failed to load payments" },
        { status: 500 }
      );
    }

    return NextResponse.json({ payments: data || [] });
  } catch (error: any) {
    console.error("Payments admin API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

