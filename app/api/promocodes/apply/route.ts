import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Promocode is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Увеличиваем счетчик использований
    const { error } = await supabase.rpc("increment_promocode_uses", {
      promocode_code: code.toUpperCase(),
    });

    // Если функция не существует, используем прямой запрос
    if (error && error.message.includes("function")) {
      const { data: promocode } = await supabase
        .from("promocodes")
        .select("current_uses")
        .eq("code", code.toUpperCase())
        .single();

      if (promocode) {
        await supabase
          .from("promocodes")
          .update({ current_uses: promocode.current_uses + 1 })
          .eq("code", code.toUpperCase());
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Apply promocode error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

