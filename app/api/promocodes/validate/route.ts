import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { code, amount } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Promocode is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Ищем промокод
    const { data: promocode, error } = await supabase
      .from("promocodes")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .single();

    if (error || !promocode) {
      return NextResponse.json(
        { valid: false, error: "Promocode not found or inactive" },
        { status: 200 }
      );
    }

    // Проверяем срок действия
    if (promocode.expires_at && new Date(promocode.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false, error: "Promocode expired" },
        { status: 200 }
      );
    }

    // Проверяем количество использований
    if (promocode.max_uses && promocode.current_uses >= promocode.max_uses) {
      return NextResponse.json(
        { valid: false, error: "Promocode usage limit reached" },
        { status: 200 }
      );
    }

    // Проверяем минимальную сумму
    if (promocode.min_amount && amount && amount < promocode.min_amount) {
      return NextResponse.json(
        { valid: false, error: `Minimum amount is ${promocode.min_amount}₽` },
        { status: 200 }
      );
    }

    // Вычисляем скидку
    let discount = 0;
    if (promocode.discount_type === "percentage") {
      discount = amount ? (amount * promocode.discount_value) / 100 : 0;
    } else {
      discount = promocode.discount_value;
    }

    const finalAmount = amount ? Math.max(0, amount - discount) : 0;

    return NextResponse.json({
      valid: true,
      promocode: {
        id: promocode.id,
        code: promocode.code,
        discount_type: promocode.discount_type,
        discount_value: promocode.discount_value,
        discount,
        final_amount: finalAmount,
      },
    });
  } catch (error: any) {
    console.error("Validate promocode error:", error);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

