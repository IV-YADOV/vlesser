import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyRobokassaSignature } from "@/lib/robokassa";

/**
 * Result URL - для асинхронных уведомлений от Robokassa
 * POST/GET запрос с данными о статусе платежа
 * Документация: https://docs.robokassa.ru/pay-interface/
 */
export async function POST(request: NextRequest) {
  try {
    // Robokassa отправляет данные как form-data или URL encoded
    let params: Record<string, string> = {};
    
    try {
      const formData = await request.formData();
      for (const [key, value] of formData.entries()) {
        params[key] = value.toString();
      }
    } catch {
      // Если не form-data, пробуем URL encoded
      try {
        const text = await request.text();
        const urlParams = new URLSearchParams(text);
        for (const [key, value] of urlParams.entries()) {
          params[key] = value;
        }
      } catch {
        // Пробуем JSON
        try {
          const jsonData = await request.json();
          Object.assign(params, jsonData);
        } catch (e) {
          console.error("Failed to parse request body:", e);
        }
      }
    }

    console.log("Robokassa callback received:", params);

    // Параметры от Robokassa
    const outSum = params.OutSum;
    const invId = params.InvId;
    const signature = params.SignatureValue;
    const password_2Raw = process.env.ROBOKASSA_PASSWORD_2 || "";
    const password_2 = password_2Raw.trim();

    console.log("📋 Robokassa callback params:", {
      outSum,
      invId,
      signature: signature ? signature.substring(0, 8) + "..." : "missing",
      password_2Length: password_2.length,
      password_2RawLength: password_2Raw.length,
      password_2FirstChar: password_2.substring(0, 1),
      password_2LastChar: password_2.substring(password_2.length - 1),
    });

    if (!outSum || !invId || !signature) {
      console.error("Missing required parameters in Robokassa callback");
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (!password_2) {
      console.error("❌ ROBOKASSA_PASSWORD_2 is not set or empty");
      console.error("Raw value:", password_2Raw ? `[${password_2Raw.length} chars]` : "undefined");
      return NextResponse.json({ error: "Server configuration error: Password_2 not set" }, { status: 500 });
    }

    // Проверка подписи Robokassa: MD5(OutSum:InvId:Password_2)
    if (!verifyRobokassaSignature(outSum, invId, signature, password_2)) {
      console.error("❌ Invalid Robokassa signature in callback");
      console.error("Make sure ROBOKASSA_PASSWORD_2 is set correctly in your .env.local file");
      console.error("Password_2 should be the 'Пароль #2' from Robokassa technical settings");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Находим платеж по сумме и статусу pending за последний час
    const amount = parseFloat(outSum);
    const invIdNum = parseInt(invId);

    const supabase = await createClient();

    console.log("🔍 Robokassa callback - searching payment:", { 
      invId, 
      invIdNum, 
      outSum, 
      amount 
    });

    const now = new Date();
    // В production ищем платежи за последний час для надежности
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Сначала ищем pending платежи за последний час
    let { data: payments, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("amount", amount)
      .eq("status", "pending")
      .gte("created_at", oneHourAgo.toISOString())
      .lte("created_at", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(20);

    console.log(`🔍 Found ${payments?.length || 0} pending payment(s) with amount ${amount}`);

    // Если не нашли pending платежи, ищем любые платежи с этой суммой (может быть уже completed)
    if ((!payments || payments.length === 0) && !paymentError) {
      console.log("⚠️ No pending payments found, searching all payments with this amount");
      const { data: allPayments, error: allPaymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("amount", amount)
        .gte("created_at", oneHourAgo.toISOString())
        .lte("created_at", now.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (!allPaymentsError && allPayments && allPayments.length > 0) {
        console.log(`✅ Found ${allPayments.length} payment(s) (any status) with amount ${amount}`);
        // Берем pending платеж, если есть, иначе любой
        payments = allPayments.filter(p => p.status === "pending");
        if (payments.length === 0) {
          // Если все платежи уже completed, берем самый последний
          payments = [allPayments[0]];
          console.log(`⚠️ All payments already completed, using most recent: ${payments[0].id}`);
        }
        paymentError = null;
      }
    }

    if (paymentError || !payments || payments.length === 0) {
      console.error("❌ Payment not found for InvId:", invId, "amount:", amount);
      console.error("Search parameters:", {
        amount,
        status: "pending",
        from: oneHourAgo.toISOString(),
        to: now.toISOString(),
      });
      // Robokassa требует ответ OK даже если платеж не найден
      return new NextResponse("OK", { 
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    // Берем самый последний pending платеж с точной суммой
    const payment = payments.find(p => Math.abs(p.amount - amount) < 0.01) || payments[0];
    
    // Проверяем, существует ли уже подписка для этого платежа
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", payment.user_id)
      .eq("plan", payment.plan)
      .gte("created_at", payment.created_at) // Только подписки, созданные после этого платежа
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Если платеж уже completed и подписка существует, просто возвращаем OK
    if (payment.status === "completed" && existingSubscription?.vless_link) {
      console.log(`⚠️ Payment ${payment.id} already completed and subscription exists, skipping`);
      return new NextResponse("OK", { 
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    // Обновляем статус платежа на "completed"
    let shouldCreateSubscription = false;
    if (payment.status !== "completed") {
      console.log(`✅ Found payment: ${payment.id}, updating to completed`);
      
      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "completed" })
        .eq("id", payment.id);

      if (updateError) {
        console.error("❌ Error updating payment:", updateError);
        // Продолжаем выполнение, даже если обновление не удалось
      } else {
        console.log(`✅ Payment ${payment.id} status updated to completed`);
        shouldCreateSubscription = true;
      }
    } else if (!existingSubscription) {
      // Платеж уже completed, но подписки нет - нужно создать подписку
      console.log(`⚠️ Payment ${payment.id} already completed, but subscription missing, will create`);
      shouldCreateSubscription = true;
    }

    // Если платеж успешен (completed), создаем подписку и xray клиента асинхронно
    // ВАЖНО: Xray клиент создается один раз при получении успешного callback
    if (shouldCreateSubscription || (payment.status === "completed" && !existingSubscription)) {
      // ВАЖНО: Используем правильный URL для вызова completePayment
      // Robokassa отправляет callback на наш сервер (ngrok или production URL)
      // Нужно использовать тот же URL, на который пришел callback
      Promise.resolve().then(async () => {
        try {
          // Небольшая задержка для гарантии обновления статуса в БД (если был обновлен)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // ВАЖНО: Всегда используем URL из request.url (тот же URL, на который пришел callback)
          // Это гарантирует, что мы используем правильный ngrok URL или production URL
          let baseUrl: string;
          try {
            const url = new URL(request.url);
            baseUrl = `${url.protocol}//${url.host}`;
            
            // Если это localhost, проверяем заголовки от ngrok или proxy
            if (baseUrl.includes("localhost")) {
              const forwardedHost = request.headers.get("x-forwarded-host");
              const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
              
              // Используем заголовки, если они есть и не localhost
              if (forwardedHost && !forwardedHost.includes("localhost")) {
                baseUrl = `${forwardedProto}://${forwardedHost}`;
                console.log(`🔄 Using forwarded headers for completePayment: ${baseUrl}`);
              } else {
                // Fallback: если нет заголовков, используем host из заголовков запроса
                const host = request.headers.get("host");
                if (host && !host.includes("localhost")) {
                  const protocol = request.headers.get("x-forwarded-proto") || 
                                   (request.url.startsWith("https") ? "https" : "http");
                  baseUrl = `${protocol}://${host}`;
                  console.log(`🔄 Using host header for completePayment: ${baseUrl}`);
                }
              }
            }
          } catch {
            // Fallback на заголовки
            const host = request.headers.get("host") || request.headers.get("x-forwarded-host") || "localhost:3000";
            const protocol = request.headers.get("x-forwarded-proto") || 
                             (request.url.startsWith("https") ? "https" : "http");
            baseUrl = `${protocol}://${host}`;
          }
          
          // Убираем trailing slash из baseUrl, чтобы избежать двойного слэша
          baseUrl = baseUrl.replace(/\/+$/, "");
          
          const completePaymentUrl = `${baseUrl}/api/completePayment`;
          console.log(`🔄 Creating subscription and xray client for payment ${payment.id} via ${completePaymentUrl}`);
          
          // Используем абсолютный URL для fetch
          const completeRes = await fetch(completePaymentUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              paymentId: payment.id,
              userId: payment.user_id,
            }),
          });
          
          if (completeRes.ok) {
            const data = await completeRes.json();
            console.log(`✅ Subscription and xray client created for payment ${payment.id}:`, {
              vlessLink: data.vlessLink ? "generated" : "missing",
              expiresAt: data.expiresAt,
            });
          } else {
            const errorText = await completeRes.text();
            console.error(`❌ Error completing payment ${payment.id}:`, {
              status: completeRes.status,
              error: errorText,
            });
          }
        } catch (error: any) {
          console.error(`❌ Error completing payment ${payment.id}:`, {
            message: error.message || error,
            stack: error.stack,
          });
        }
      }).catch(error => {
        console.error(`❌ Error in payment completion promise ${payment.id}:`, error);
      });
    }

    // Robokassa требует текстовый ответ "OK" в случае успешной обработки
    return new NextResponse("OK", { 
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
    
  } catch (error: any) {
    console.error("Payment callback error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Также поддерживаем GET для совместимости
export async function GET(request: NextRequest) {
  return POST(request);
}

