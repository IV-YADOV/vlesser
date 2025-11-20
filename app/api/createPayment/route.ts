import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plans, getPlanById } from "@/lib/plans";
import { createYooKassaPayment } from "@/lib/yookassa";

/**
 * Создает платеж через ЮKassa и возвращает URL для редиректа и ID платежа ЮKassa
 */
async function generatePaymentUrl(
  paymentId: string,
  amount: number,
  plan: ReturnType<typeof getPlanById>,
  baseUrl: string,
  userEmail?: string
): Promise<{ url: string; yooKassaPaymentId: string; error?: string }> {
  try {
    // Проверка, что plan не undefined
    if (!plan) {
      console.error("❌ Plan is undefined");
      return { url: "", yooKassaPaymentId: "", error: "Plan is undefined" };
    }

    // ВАЖНО: Убеждаемся, что amount - это число (плавающая точка), а не строка
    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      console.error("❌ Invalid amount:", amount, "type:", typeof amount);
      return { url: "", yooKassaPaymentId: "", error: `Invalid amount: ${amount}` };
    }

    // Получаем настройки ЮKassa
    const shopId = process.env.YOOKASSA_SHOP_ID?.trim() || "";
    const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim() || "";

    console.log("🔑 YooKassa credentials check:", {
      shopIdLength: shopId.length,
      secretKeyLength: secretKey.length,
      shopIdPreview: shopId ? shopId.substring(0, 10) + "..." : "missing",
      hasShopId: !!shopId,
      hasSecretKey: !!secretKey,
    });

    // Детальная проверка параметров
    if (!shopId) {
      console.error("❌ YOOKASSA_SHOP_ID is not set or empty");
      return { url: "", yooKassaPaymentId: "", error: "YOOKASSA_SHOP_ID not configured" };
    }

    if (!secretKey) {
      console.error("❌ YOOKASSA_SECRET_KEY is not set or empty");
      return { url: "", yooKassaPaymentId: "", error: "YOOKASSA_SECRET_KEY not configured" };
    }

    // Проверяем, что plan не undefined (должно быть проверено выше, но TypeScript требует явной проверки)
    if (!plan) {
      console.error("❌ Plan is undefined when creating description");
      return { url: "", yooKassaPaymentId: "", error: "Plan is undefined when creating description" };
    }
    
    // Формируем описание платежа (макс 128 символов для ЮKassa)
    let description = `VLESS VPN подписка: ${plan.name} (${plan.duration} дней)`;
    
    // Обрезаем описание до 128 символов, если оно слишком длинное
    if (description.length > 128) {
      description = description.substring(0, 125) + "...";
    }

    // URL для редиректа после оплаты (YooKassa вернет пользователя на этот URL)
    const returnUrl = `${baseUrl}/api/payment/success?payment_id=${paymentId}`;

    // Формируем receipt для YooKassa (54-ФЗ)
    // Receipt обязателен, если в настройках YooKassa включена обязательная отправка чеков
    let receipt: any = undefined;
    
    // Если есть email пользователя, формируем receipt
    // Если email нет, но YooKassa требует receipt - используем placeholder email
    if (userEmail || process.env.YOOKASSA_REQUIRE_RECEIPT === 'true') {
      const customerEmail = userEmail || `user_${paymentId}@vlesser.ru`; // Placeholder email если нет реального
      
      receipt = {
        customer: {
          email: customerEmail,
        },
        items: [
          {
            description: description.substring(0, 128), // Описание товара/услуги
            quantity: "1.00", // Количество
            amount: {
              value: amountNumber.toFixed(2), // Сумма за единицу
              currency: "RUB",
            },
            vat_code: 1, // НДС 20% (код 1) - для услуг в РФ обычно 20%
            // Если без НДС, используйте vat_code: 0
          },
        ],
      };
      
      console.log("📋 Receipt generated for YooKassa:", {
        customerEmail: customerEmail,
        itemsCount: receipt.items.length,
        totalAmount: amountNumber.toFixed(2),
      });
    }

    console.log("💰 YooKassa payment initialization:", {
      amount: amountNumber.toFixed(2),
      description: description.substring(0, 50) + "...",
      baseUrl: baseUrl,
      returnUrl: returnUrl,
      plan: plan.name,
      hasReceipt: !!receipt,
    });

    // Создаем платеж через ЮKassa API
    console.log("🔄 Calling YooKassa API to create payment...");
    const yooKassaPayment = await createYooKassaPayment({
      amount: amountNumber,
      description,
      returnUrl,
      shopId,
      secretKey,
      receipt: receipt, // Передаем receipt, если он сформирован
      metadata: {
        payment_id: paymentId, // Сохраняем наш внутренний ID платежа
        plan_id: plan.id,
        plan_name: plan.name,
      },
    });

    if (!yooKassaPayment) {
      console.error("❌ YooKassa payment creation returned null or undefined");
      return { url: "", yooKassaPaymentId: "", error: "YooKassa API returned null" };
    }

    if (!yooKassaPayment.confirmation?.confirmation_url) {
      console.error("❌ YooKassa payment created but no confirmation_url", {
        paymentId: yooKassaPayment.id,
        status: yooKassaPayment.status,
        confirmation: yooKassaPayment.confirmation,
      });
      return { 
        url: "", 
        yooKassaPaymentId: yooKassaPayment.id || "", 
        error: "YooKassa payment created but no confirmation URL" 
      };
    }

    const confirmationUrl = yooKassaPayment.confirmation.confirmation_url;

    console.log("✅ YooKassa payment created successfully:", {
      internalPaymentId: paymentId,
      yooKassaPaymentId: yooKassaPayment.id,
      status: yooKassaPayment.status,
      confirmationUrl: confirmationUrl.substring(0, 60) + "...",
      amount: amountNumber.toFixed(2),
    });

    // ВАЖНО: Сохраняем ID платежа ЮKassa в нашу базу для сопоставления с webhook
    // Это делается в вызывающей функции после создания платежа в БД

    return {
      url: confirmationUrl,
      yooKassaPaymentId: yooKassaPayment.id,
    };
  } catch (error: any) {
    console.error("❌ Error creating YooKassa payment:", error);
    console.error("❌ Error details:", {
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause,
      name: error?.name,
    });
    return { 
      url: "", 
      yooKassaPaymentId: "", 
      error: error?.message || "Unknown error creating YooKassa payment" 
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { planId, userId, promocode, userEmail } = await request.json();

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

    // Готовим базовый URL для YooKassa
    // ВАЖНО: В production ВСЕГДА используем SITE_URL из переменных окружения
    const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
    let baseUrl: string;
    
    if (siteUrl) {
      // Убираем завершающий слэш и пробелы
      baseUrl = siteUrl.trim().replace(/\/+$/, "");
      console.log("🌐 Using SITE_URL from env for baseUrl:", baseUrl);
      console.log("🌐 Environment check:", {
        SITE_URL: process.env.SITE_URL ? "✅ Set" : "❌ Not set",
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ? "✅ Set" : "❌ Not set",
        finalBaseUrl: baseUrl,
      });
    } else {
      // Fallback: формируем из заголовков запроса (только для dev/тестов)
      const host = request.headers.get("host") || 
                   request.headers.get("x-forwarded-host") || 
                   "localhost:3000";
      let protocol = request.headers.get("x-forwarded-proto") || "https";
      
      // Для localhost/ngrok используем http
      if (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("ngrok")) {
        protocol = "http";
      } else {
        // В production всегда используем https
        protocol = "https";
      }
      
      baseUrl = `${protocol}://${host}`;
      console.error("❌ SITE_URL not set in env! Using headers as fallback:", baseUrl);
      console.error("❌ Request headers:", {
        host: request.headers.get("host"),
        forwardedHost: request.headers.get("x-forwarded-host"),
        forwardedProto: request.headers.get("x-forwarded-proto"),
      });
      console.error("❌ ВАЖНО: В production необходимо установить SITE_URL в переменных окружения!");
    }
    
    console.log("🔗 Final baseUrl for YooKassa:", baseUrl);

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

        // Создаем платеж через ЮKassa
        const paymentResult = await generatePaymentUrl(paymentFallback.id, finalAmount, plan, baseUrl, userEmail);
        if (!paymentResult || !paymentResult.url) {
          // Детальное логирование ошибки
          const errorDetails = {
            paymentId: paymentFallback.id,
            amount: finalAmount,
            planId: planId,
            hasShopId: !!process.env.YOOKASSA_SHOP_ID,
            hasSecretKey: !!process.env.YOOKASSA_SECRET_KEY,
            baseUrl: baseUrl,
            error: paymentResult?.error || "Unknown error",
          };
          console.error("❌ Failed to generate payment URL (fallback). Details:", errorDetails);
          
          // Возвращаем детальную ошибку
          const errorMessage = paymentResult?.error || "Failed to generate payment URL";
          
          // Проверяем переменные окружения
          if (!process.env.YOOKASSA_SHOP_ID) {
            console.error("❌ YOOKASSA_SHOP_ID is missing in environment variables");
          }
          if (!process.env.YOOKASSA_SECRET_KEY) {
            console.error("❌ YOOKASSA_SECRET_KEY is missing in environment variables");
          }
          
          return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
          );
        }

        // Сохраняем ID платежа ЮKassa в базе (если есть колонка)
        if (paymentResult.yooKassaPaymentId) {
          await supabase
            .from("payments")
            .update({ yookassa_payment_id: paymentResult.yooKassaPaymentId })
            .eq("id", paymentFallback.id)
            .then(({ error }) => {
              if (error && !error.message.includes("column") && error.code !== "PGRST116") {
                console.warn("⚠️ Failed to save YooKassa payment ID:", error.message);
              }
            });
        }

        return NextResponse.json({ 
          paymentId: paymentFallback.id, 
          amount: finalAmount,
          originalAmount: plan.price,
          discount: plan.price - finalAmount,
          promocode: appliedPromocode,
          paymentUrl: paymentResult.url,
        });
      }

      return NextResponse.json(
        { error: "Failed to create payment: " + paymentError.message },
        { status: 500 }
      );
    }

    // Создаем платеж через ЮKassa
    const paymentResult = await generatePaymentUrl(payment.id, finalAmount, plan, baseUrl, userEmail);
    if (!paymentResult || !paymentResult.url) {
      // Детальное логирование ошибки
      const errorDetails = {
        paymentId: payment.id,
        amount: finalAmount,
        planId: planId,
        hasShopId: !!process.env.YOOKASSA_SHOP_ID,
        hasSecretKey: !!process.env.YOOKASSA_SECRET_KEY,
        baseUrl: baseUrl,
        error: paymentResult?.error || "Unknown error",
      };
      console.error("❌ Failed to generate payment URL. Details:", errorDetails);
      
      // Возвращаем детальную ошибку
      const errorMessage = paymentResult?.error || "Failed to generate payment URL";
      
      // Проверяем переменные окружения
      if (!process.env.YOOKASSA_SHOP_ID) {
        console.error("❌ YOOKASSA_SHOP_ID is missing in environment variables");
      }
      if (!process.env.YOOKASSA_SECRET_KEY) {
        console.error("❌ YOOKASSA_SECRET_KEY is missing in environment variables");
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    // Сохраняем ID платежа ЮKassa в базе (если есть колонка yookassa_payment_id)
    if (paymentResult.yooKassaPaymentId) {
      await supabase
        .from("payments")
        .update({ yookassa_payment_id: paymentResult.yooKassaPaymentId })
        .eq("id", payment.id)
        .then(({ error }) => {
          if (error && !error.message.includes("column") && error.code !== "PGRST116") {
            console.warn("⚠️ Failed to save YooKassa payment ID:", error.message);
          } else if (!error) {
            console.log("✅ YooKassa payment ID saved to database:", paymentResult.yooKassaPaymentId);
          }
        });
    }

    return NextResponse.json({ 
      paymentId: payment.id, 
      amount: finalAmount,
      originalAmount: plan.price,
      discount: plan.price - finalAmount,
      promocode: appliedPromocode,
      paymentUrl: paymentResult.url,
    });
  } catch (error: any) {
    console.error("❌ Create payment error:", error);
    console.error("❌ Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    
    // Возвращаем более детальную ошибку для отладки
    const errorMessage = error?.message || "Unknown error";
    return NextResponse.json(
      { 
        error: "Internal server error: " + errorMessage,
        // В production не показываем детали, но логируем их
      },
      { status: 500 }
    );
  }
}

