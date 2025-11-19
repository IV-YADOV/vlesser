import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plans, getPlanById } from "@/lib/plans";
import { generateRobokassaUrl } from "@/lib/robokassa";

/**
 * Генерирует URL для оплаты через Robokassa
 */
async function generatePaymentUrl(
  paymentId: string,
  amount: number,
  plan: ReturnType<typeof getPlanById>,
  baseUrl: string
): Promise<string | null> {
  try {
    // ВАЖНО: Убеждаемся, что amount - это число (плавающая точка), а не строка
    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      console.error("❌ Invalid amount:", amount, "type:", typeof amount);
      return null;
    }

    // Получаем настройки Robokassa
    // ВАЖНО: Убираем все пробелы, включая начальные и конечные
    const merchantLoginRaw = process.env.ROBOKASSA_MERCHANT_LOGIN || "";
    const password_1Raw = process.env.ROBOKASSA_PASSWORD_1 || "";
    const merchantLogin = merchantLoginRaw.trim();
    const password_1 = password_1Raw.trim();
    const isTest = process.env.ROBOKASSA_TEST_MODE === "true";

    // Детальная проверка параметров
    if (!merchantLogin) {
      console.error("❌ ROBOKASSA_MERCHANT_LOGIN is not set or empty");
      console.error("Raw value:", merchantLoginRaw ? `[${merchantLoginRaw.length} chars]` : "undefined");
      return null;
    }

    if (!password_1) {
      console.error("❌ ROBOKASSA_PASSWORD_1 is not set or empty");
      console.error("Raw value:", password_1Raw ? `[${password_1Raw.length} chars]` : "undefined");
      return null;
    }

    // Генерируем уникальный InvId на основе timestamp
    // Robokassa требует неотрицательное целое число (может быть 0 для теста)
    // ВАЖНО: Используем последние 9 цифр (не 10), чтобы избежать слишком больших чисел
    // Максимальное значение: 999999999 (9 цифр), что меньше 2^31-1 (2147483647)
    const timestamp = Date.now();
    let invId = parseInt(timestamp.toString().slice(-9), 10); // Последние 9 цифр timestamp
    
    if (isNaN(invId) || invId < 0) {
      console.error("❌ Invalid InvId generated:", invId, "from timestamp:", timestamp);
      return null;
    }
    
    // Дополнительная проверка: InvId не должен быть слишком большим
    // Согласно документации: InvId может принимать значения от 1 до 9223372036854775807 (2^63 - 1)
    // Для теста может быть 0
    // 9 цифр максимум = 999999999, что намного меньше лимита (9223372036854775807)
    const MAX_INV_ID = 9223372036854775807; // 2^63 - 1
    if (invId > MAX_INV_ID) {
      console.warn("⚠️ InvId too large, using modulo:", invId);
      invId = invId % MAX_INV_ID;
      // Примечание: 0 разрешен для теста согласно документации, но в реальном случае используем минимум 1
      if (invId === 0 && !isTest) {
        invId = 1; // Минимальное значение для реальных платежей (от 1 согласно документации)
      }
    }

    console.log("💰 Payment initialization:", {
      merchantLogin: merchantLogin.substring(0, 3) + "..." + merchantLogin.substring(merchantLogin.length - 3),
      merchantLoginLength: merchantLogin.length,
      password_1Length: password_1.length,
      password_1FirstChar: password_1.substring(0, 1),
      outSum: amountNumber.toFixed(2),
      outSumType: typeof amountNumber,
      outSumValue: amountNumber,
      invId: invId,
      invIdString: String(invId),
      paymentId: paymentId,
      isTest: isTest,
      plan: plan?.name,
    });

    // ВАЖНО: Описание должно быть корректно закодировано для URL
    // Согласно документации: максимальная длина 100 символов
    // Описание должно содержать только символы английского или русского алфавита, цифры и знаки препинания
    // Но в подпись оно НЕ входит, поэтому можно использовать любые символы
    let description = `VLESS VPN подписка: ${plan.name} (${plan.duration} дней)`;
    
    // Обрезаем описание до 100 символов, если оно слишком длинное
    if (description.length > 100) {
      description = description.substring(0, 97) + "...";
    }

    // Генерируем URL для редиректа на Robokassa
    // ВАЖНО: Передаем amountNumber как число (плавающую точку), а не строку
    const paymentUrl = generateRobokassaUrl({
      MerchantLogin: merchantLogin, // Уже обрезанный
      OutSum: amountNumber,         // Число (плавающая точка), будет преобразовано в "99.00" внутри функции
      InvId: invId,                 // Уже валидированное целое число
      Description: description,
      Password_1: password_1,       // Уже обрезанный
      IsTest: isTest,
      Culture: "ru",
      Encoding: "utf-8",
      ResultURL: `${baseUrl}/api/payment/callback`,
      SuccessURL: `${baseUrl}/api/payment/success`,
      FailURL: `${baseUrl}/api/payment/fail`,
    });

    console.log("✅ Payment URL generated successfully:", {
      paymentId,
      invId,
      amount: amountNumber.toFixed(2),
      amountType: typeof amountNumber,
      urlLength: paymentUrl.length,
      urlPreview: paymentUrl.substring(0, 100) + "...",
    });

    return paymentUrl;
  } catch (error: any) {
    console.error("Error generating payment URL:", error);
    return null;
  }
}

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
    let finalAmount: number = Number(plan.price); // Убеждаемся, что это число
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
          // ВАЖНО: Конвертируем final_amount в число (плавающую точку)
          finalAmount = Number(validateData.promocode.final_amount);
          if (isNaN(finalAmount) || finalAmount <= 0) {
            console.warn("⚠️ Invalid final_amount from promocode, using plan.price");
            finalAmount = Number(plan.price);
          }
          appliedPromocode = validateData.promocode.code;
        }
      }
    }

    // Убеждаемся, что finalAmount - это число (плавающая точка)
    finalAmount = Number(finalAmount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount calculated" },
        { status: 400 }
      );
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

        // Генерируем URL для Robokassa
        const paymentUrl = await generatePaymentUrl(paymentFallback.id, finalAmount, plan, baseUrl);
        if (!paymentUrl) {
          return NextResponse.json(
            { error: "Failed to generate payment URL" },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          paymentId: paymentFallback.id, 
          amount: finalAmount,
          originalAmount: plan.price,
          discount: plan.price - finalAmount,
          promocode: appliedPromocode,
          paymentUrl,
        });
      }

      return NextResponse.json(
        { error: "Failed to create payment: " + paymentError.message },
        { status: 500 }
      );
    }

    // Генерируем URL для Robokassa
    const paymentUrl = await generatePaymentUrl(payment.id, finalAmount, plan, baseUrl);
    if (!paymentUrl) {
      return NextResponse.json(
        { error: "Failed to generate payment URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      paymentId: payment.id, 
      amount: finalAmount,
      originalAmount: plan.price,
      discount: plan.price - finalAmount,
      promocode: appliedPromocode,
      paymentUrl,
    });
  } catch (error: any) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

