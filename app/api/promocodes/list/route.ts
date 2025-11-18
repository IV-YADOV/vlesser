import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Проверка админа
function isAdmin(request: NextRequest): boolean {
  const adminToken = request.headers.get("x-admin-token");
  return adminToken === process.env.ADMIN_SECRET_TOKEN;
}

export async function GET(request: NextRequest) {
  try {
    // Проверка админа
    if (!isAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("promocodes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching promocodes:", error);
      return NextResponse.json(
        { error: "Failed to fetch promocodes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ promocodes: data || [] });
  } catch (error: any) {
    console.error("List promocodes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

