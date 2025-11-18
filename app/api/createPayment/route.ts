import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plans, getPlanById } from "@/lib/plans";

export async function POST(request: NextRequest) {
  try {
    const { planId, userId, promocode } = await request.json();

    if (!planId || !userId) {
      return NextResponse.json(
        { error: "Missing planId or userId" },
        { status: 400 }
      );
    }

    let plan = getPlanById(planId);
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const supabase = await createClient();

    // Override price if exists in Supabase
    const { data: planSetting } = await supabase
      .from("plan_settings")
      .select("price")
      .eq("plan_id", planId)
      .maybeSingle();

    if (planSetting?.price) {
      plan = { ...plan, price: Number(planSetting.price) };
    }

    // Create or get user
    let user;
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!existingUser) {
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          id: userId,
          tg_id: userId.startsWith("tg_") ? userId.replace("tg_", "") : null,
        })
        .select()
        .single();

      if (userError) {
        console.error("User creation error:", userError);
        // Continue anyway, user might already exist
      }
      user = newUser || { id: userId };
    } else {
      user = existingUser;
    }

    // Валидируем промокод, если указан
    let finalAmount = plan.price;
    let appliedPromocode = null;

    // Готовим базовый URL для внутренних запросов
    const host = request.headers.get("host") || "localhost:3000";
    let protocol = request.headers.get("x-forwarded-proto") || "http";
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      protocol = "http";
    }
    const baseUrl = `${protocol}://${host}`;

    if (promocode) {
      const validateRes = await fetch(`${baseUrl}/api/promocodes/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promocode, amount: plan.price }),
      });

      if (validateRes.ok) {
        const validateData = await validateRes.json();
        if (validateData.valid) {
          finalAmount = validateData.promocode.final_amount;
          appliedPromocode = validateData.promocode.code;
        }
      }
    }

    // Create payment record
    // Сначала пробуем с новыми полями, если ошибка - пробуем без них
    let paymentData: any = {
      user_id: user.id,
      amount: finalAmount,
      plan: planId,
      status: "pending",
    };

    // Добавляем поля промокода только если они есть в таблице
    // Проверяем, отличается ли финальная сумма от оригинальной
    if (finalAmount !== plan.price) {
      paymentData.original_amount = plan.price;
    }
    if (appliedPromocode) {
      paymentData.promocode = appliedPromocode;
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) {
      console.error("Payment creation error:", paymentError);
      
      // Если ошибка из-за отсутствующих колонок, пробуем без них
      if (paymentError.message.includes("column") || paymentError.code === "PGRST116") {
        const { data: paymentFallback, error: fallbackError } = await supabase
          .from("payments")
          .insert({
            user_id: user.id,
            amount: finalAmount,
            plan: planId,
            status: "pending",
          })
          .select()
          .single();

        if (fallbackError) {
          return NextResponse.json(
            { error: "Failed to create payment: " + fallbackError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          paymentId: paymentFallback.id, 
          amount: finalAmount,
          originalAmount: plan.price,
          discount: plan.price - finalAmount,
          promocode: appliedPromocode,
        });
      }

      return NextResponse.json(
        { error: "Failed to create payment: " + paymentError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      paymentId: payment.id, 
      amount: finalAmount,
      originalAmount: plan.price,
      discount: plan.price - finalAmount,
      promocode: appliedPromocode,
    });
  } catch (error: any) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

