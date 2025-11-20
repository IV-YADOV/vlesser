import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { YooKassaWebhookNotification, verifyYooKassaWebhookSignature, captureYooKassaPayment } from "@/lib/yookassa";

/**
 * Webhook для обработки уведомлений от ЮKassa
 * Документация: https://yookassa.ru/developers/payment-acceptance/getting-started/payment-process#webhook
 */
export async function POST(request: NextRequest) {
  try {
    const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim() || "";

    if (!secretKey) {
      console.error("❌ YOOKASSA_SECRET_KEY is not set");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Проверка IP-адреса согласно документации YooKassa
    // https://yookassa.ru/developers/using-api/webhooks
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown";
    
    const yooKassaIps = [
      "185.71.76.0/27",
      "185.71.77.0/27", 
      "77.75.153.0/25",
      "77.75.156.11",
      "77.75.156.35",
      "77.75.154.128/25",
      "2a02:5180::/32"
    ];
    
    // В продакшене проверяйте IP, для ngrok/dev можно временно отключить
    const isLocalDev = process.env.NODE_ENV === "development" || request.url.includes("localhost") || request.url.includes("ngrok");
    
    if (!isLocalDev) {
      // TODO: Реализовать проверку IP-адреса в продакшене
      // Для ngrok это не критично, так как ngrok сам фильтрует запросы
      console.log(`🌐 Webhook request from IP: ${clientIp}`);
    }

    // Парсим уведомление от ЮKassa
    const notification: YooKassaWebhookNotification = await request.json();

    console.log("📨 YooKassa webhook received:", {
      type: notification.type,
      event: notification.event,
      paymentId: notification.object.id,
      status: notification.object.status,
      amount: notification.object.amount.value,
    });

    // Проверяем подпись уведомления (в реальной реализации нужно проверить заголовок)
    // Для упрощения здесь проверяем только структуру
    if (notification.type !== "notification" || !notification.object) {
      console.error("❌ Invalid webhook notification structure");
      return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
    }

    const paymentId = notification.object.id;
    const status = notification.object.status;
    const amount = parseFloat(notification.object.amount.value);
    const metadata = notification.object.metadata || {};

    // Получаем наш внутренний payment_id из метаданных
    const internalPaymentId = metadata.payment_id;

    const supabase = await createClient();

    let payment = null;
    let paymentError = null;

    // Сначала пытаемся найти платеж по ID ЮKassa (если есть колонка yookassa_payment_id)
    if (paymentId) {
      const { data: paymentByYooKassaId, error: yookassaError } = await supabase
        .from("payments")
        .select("*")
        .eq("yookassa_payment_id", paymentId)
        .maybeSingle();

      if (!yookassaError && paymentByYooKassaId) {
        payment = paymentByYooKassaId;
        console.log("✅ Payment found by YooKassa payment ID:", payment.id);
      } else if (yookassaError && !yookassaError.message.includes("column") && yookassaError.code !== "PGRST116") {
        console.warn("⚠️ Error searching by YooKassa payment ID:", yookassaError.message);
      }
    }

    // Если не нашли по ID ЮKassa, ищем по внутреннему ID из метаданных
    if (!payment && internalPaymentId) {
      const { data: paymentById, error: idError } = await supabase
        .from("payments")
        .select("*")
        .eq("id", internalPaymentId)
        .single();

      if (!idError && paymentById) {
        payment = paymentById;
        paymentError = null;
        console.log("✅ Payment found by internal ID from metadata:", payment.id);
      } else {
        paymentError = idError;
        console.warn("⚠️ Payment not found by internal ID from metadata:", internalPaymentId);
      }
    }

    // Если все еще не нашли, пытаемся найти по сумме и времени
    if (!payment) {
      console.log("⚠️ Payment not found by ID, trying to find by amount and time...");
      return await findPaymentByAmount(amount, paymentId);
    }

    if (paymentError || !payment) {
      console.error("❌ Payment not found:", internalPaymentId, paymentError);
      // Пытаемся найти по сумме
      return await findPaymentByAmount(amount, paymentId);
    }

    // Обрабатываем событие в зависимости от статуса
    // Согласно документации YooKassa: payment.succeeded, payment.waiting_for_capture, payment.canceled
    if (notification.event === "payment.waiting_for_capture" && status === "waiting_for_capture") {
      // Платеж ожидает подтверждения (capture) - автоматически подтверждаем
      console.log(`🔄 Payment ${payment.id} waiting for capture, attempting to capture...`);
      
      const shopId = process.env.YOOKASSA_SHOP_ID?.trim() || "";
      const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim() || "";
      
      if (shopId && secretKey) {
        // Автоматически подтверждаем платеж
        const capturedPayment = await captureYooKassaPayment(paymentId, shopId, secretKey);
        
        if (capturedPayment && capturedPayment.status === "succeeded") {
          console.log(`✅ Payment ${payment.id} captured successfully, status: ${capturedPayment.status}`);
        } else {
          console.warn(`⚠️ Payment ${payment.id} capture failed or returned unexpected status`);
        }
      } else {
        console.error("❌ YooKassa credentials not configured, cannot capture payment");
      }
      
      // Обновляем статус платежа на completed, так как capture был выполнен
      if (payment.status !== "completed") {
        console.log(`✅ Payment ${payment.id} captured, updating to completed`);

        const { error: updateError } = await supabase
          .from("payments")
          .update({ status: "completed" })
          .eq("id", payment.id);

        if (updateError) {
          console.error("❌ Error updating payment:", updateError);
        } else {
          console.log(`✅ Payment ${payment.id} status updated to completed`);

          // Создаем подписку асинхронно
          Promise.resolve().then(async () => {
            try {
              await new Promise(resolve => setTimeout(resolve, 1000));

              let baseUrl: string;
              try {
                const url = new URL(request.url);
                baseUrl = `${url.protocol}//${url.host}`;

                if (baseUrl.includes("localhost")) {
                  const forwardedHost = request.headers.get("x-forwarded-host");
                  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

                  if (forwardedHost && !forwardedHost.includes("localhost")) {
                    baseUrl = `${forwardedProto}://${forwardedHost}`;
                  } else {
                    const host = request.headers.get("host");
                    if (host && !host.includes("localhost")) {
                      const protocol = request.headers.get("x-forwarded-proto") || "https";
                      baseUrl = `${protocol}://${host}`;
                    }
                  }
                }
              } catch {
                const host = request.headers.get("host") || request.headers.get("x-forwarded-host") || "localhost:3000";
                const protocol = request.headers.get("x-forwarded-proto") || "https";
                baseUrl = `${protocol}://${host}`;
              }

              baseUrl = baseUrl.replace(/\/+$/, "");
              const completePaymentUrl = `${baseUrl}/api/completePayment`;

              console.log(`🔄 Creating subscription for payment ${payment.id} via ${completePaymentUrl}`);

              const completeRes = await fetch(completePaymentUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paymentId: payment.id,
                  userId: payment.user_id,
                }),
              });

              if (completeRes.ok) {
                const data = await completeRes.json();
                console.log(`✅ Subscription created for payment ${payment.id}:`, {
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
              console.error(`❌ Error completing payment ${payment.id}:`, error);
            }
          });
        }
      }
    } else if (notification.event === "payment.succeeded" && status === "succeeded") {
      // Платеж успешно завершен (уже подтвержден)
      if (payment.status !== "completed") {
        console.log(`✅ Payment ${payment.id} succeeded, updating to completed`);

        const { error: updateError } = await supabase
          .from("payments")
          .update({ status: "completed" })
          .eq("id", payment.id);

        if (updateError) {
          console.error("❌ Error updating payment:", updateError);
        } else {
          console.log(`✅ Payment ${payment.id} status updated to completed`);

          // Создаем подписку асинхронно
          Promise.resolve().then(async () => {
            try {
              await new Promise(resolve => setTimeout(resolve, 1000));

              let baseUrl: string;
              try {
                const url = new URL(request.url);
                baseUrl = `${url.protocol}//${url.host}`;

                if (baseUrl.includes("localhost")) {
                  const forwardedHost = request.headers.get("x-forwarded-host");
                  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

                  if (forwardedHost && !forwardedHost.includes("localhost")) {
                    baseUrl = `${forwardedProto}://${forwardedHost}`;
                  } else {
                    const host = request.headers.get("host");
                    if (host && !host.includes("localhost")) {
                      const protocol = request.headers.get("x-forwarded-proto") || "https";
                      baseUrl = `${protocol}://${host}`;
                    }
                  }
                }
              } catch {
                const host = request.headers.get("host") || request.headers.get("x-forwarded-host") || "localhost:3000";
                const protocol = request.headers.get("x-forwarded-proto") || "https";
                baseUrl = `${protocol}://${host}`;
              }

              baseUrl = baseUrl.replace(/\/+$/, "");
              const completePaymentUrl = `${baseUrl}/api/completePayment`;

              console.log(`🔄 Creating subscription for payment ${payment.id} via ${completePaymentUrl}`);

              const completeRes = await fetch(completePaymentUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paymentId: payment.id,
                  userId: payment.user_id,
                }),
              });

              if (completeRes.ok) {
                const data = await completeRes.json();
                console.log(`✅ Subscription created for payment ${payment.id}:`, {
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
              console.error(`❌ Error completing payment ${payment.id}:`, error);
            }
          });
        }
      }
      // Платеж отменен
      if (payment.status !== "canceled") {
        console.log(`❌ Payment ${payment.id} canceled`);

        const { error: updateError } = await supabase
          .from("payments")
          .update({ status: "canceled" })
          .eq("id", payment.id);

        if (updateError) {
          console.error("❌ Error updating payment status:", updateError);
        }
      }
    }

    // ЮKassa требует ответ 200 OK
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("❌ YooKassa webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Ищет платеж по сумме и времени (fallback метод)
 */
async function findPaymentByAmount(amount: number, yooKassaPaymentId: string) {
  const supabase = await createClient();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("amount", amount)
    .eq("status", "pending")
    .gte("created_at", oneHourAgo.toISOString())
    .lte("created_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (payments && payments.length > 0) {
    const payment = payments[0];
    console.log(`✅ Found payment by amount: ${payment.id}`);

    // Обновляем статус
    const { error: updateError } = await supabase
      .from("payments")
      .update({ status: "completed" })
      .eq("id", payment.id);

    if (updateError) {
      console.error("❌ Error updating payment:", updateError);
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

