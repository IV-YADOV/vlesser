import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Проверка админа
function isAdmin(request: NextRequest): boolean {
  const adminToken = request.headers.get("x-admin-token");
  return adminToken === process.env.ADMIN_SECRET_TOKEN;
}

export async function DELETE(request: NextRequest) {
  try {
    // Проверка админа
    if (!isAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Promocode ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("promocodes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting promocode:", error);
      return NextResponse.json(
        { error: "Failed to delete promocode" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete promocode error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

