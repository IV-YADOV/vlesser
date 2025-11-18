import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Проверка админа
function isAdmin(request: NextRequest): boolean {
  const adminToken = request.headers.get("x-admin-token");
  return adminToken === process.env.ADMIN_SECRET_TOKEN;
}

export async function POST(request: NextRequest) {
  try {
    // Проверка админа
    if (!isAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, discount_type, discount_value, max_uses, expires_at, min_amount } = await request.json();

    if (!code || !discount_type || !discount_value) {
      return NextResponse.json(
        { error: "Missing required fields: code, discount_type, discount_value" },
        { status: 400 }
      );
    }

    if (discount_type !== "percentage" && discount_type !== "fixed") {
      return NextResponse.json(
        { error: "discount_type must be 'percentage' or 'fixed'" },
        { status: 400 }
      );
    }

    if (discount_type === "percentage" && (discount_value < 0 || discount_value > 100)) {
      return NextResponse.json(
        { error: "Percentage discount must be between 0 and 100" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Проверяем, не существует ли уже промокод
    const { data: existing } = await supabase
      .from("promocodes")
      .select("code")
      .eq("code", code.toUpperCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Promocode already exists" },
        { status: 400 }
      );
    }

    // Создаем промокод
    const { data, error } = await supabase
      .from("promocodes")
      .insert({
        code: code.toUpperCase(),
        discount_type,
        discount_value,
        max_uses: max_uses || null,
        current_uses: 0,
        expires_at: expires_at || null,
        min_amount: min_amount || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating promocode:", error);
      return NextResponse.json(
        { error: "Failed to create promocode" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, promocode: data });
  } catch (error: any) {
    console.error("Create promocode error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

