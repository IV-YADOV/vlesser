import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { YooKassaWebhookNotification, captureYooKassaPayment } from "@/lib/yookassa";

/**
 * Webhook для обработки уведомлений от ЮKassa
 * Документация: https://yookassa.ru/developers/payment-acceptance/getting-started/payment-process#webhook
 */
/**
 * Проверяет, принадлежит ли IP-адрес диапазонам YooKassa
 */
function isYooKassaIP(ip: string): boolean {
  // Список IP-адресов и диапазонов YooKassa
  // Документация: https://yookassa.ru/developers/using-api/webhooks#security
  const yooKassaRanges = [
    { start: "185.71.76.0", end: "185.71.76.31" }, // 185.71.76.0/27
    { start: "185.71.77.0", end: "185.71.77.31" }, // 185.71.77.0/27
    { start: "77.75.153.0", end: "77.75.153.127" }, // 77.75.153.0/25
    { start: "77.75.154.128", end: "77.75.154.255" }, // 77.75.154.128/25
  ];
  
  const yooKassaSingleIPs = [
    "77.75.156.11",
    "77.75.156.35",
  ];

  // Проверяем точные совпадения
  if (yooKassaSingleIPs.includes(ip)) {
    return true;
  }

  // Проверяем диапазоны (упрощенная проверка для IPv4)
  const ipParts = ip.split(".").map(Number);
  if (ipParts.length !== 4) {
    return false; // Не IPv4, пропускаем проверку (можно добавить проверку IPv6)
  }

  for (const range of yooKassaRanges) {
    const [start1, start2, start3, start4] = range.start.split(".").map(Number);
    const [end1, end2, end3, end4] = range.end.split(".").map(Number);
    
    if (
      ipParts[0] >= start1 && ipParts[0] <= end1 &&
      ipParts[1] >= start2 && ipParts[1] <= end2 &&
      ipParts[2] >= start3 && ipParts[2] <= end3 &&
      ipParts[3] >= start4 && ipParts[3] <= end4
    ) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim() || "";

    if (!secretKey) {
      console.error("❌ YOOKASSA_SECRET_KEY is not set");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Получаем тело запроса
    const requestBody = await request.text();
    
    if (!requestBody) {
      console.error("❌ Empty webhook request body");
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    // Проверка IP-адреса согласно документации YooKassa
    // Документация: https://yookassa.ru/developers/using-api/webhooks#security
    // YooKassa рекомендует проверять IP-адрес отправителя для защиты от поддельных уведомлений
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     request.headers.get("x-real-ip") || 
                     request.headers.get("cf-connecting-ip") || // Cloudflare
                     "unknown";
    
    // В продакшене проверяем IP, для ngrok/dev можно временно отключить
    const isLocalDev = process.env.NODE_ENV === "development" || 
                       request.url.includes("localhost") || 
                       request.url.includes("ngrok") ||
                       process.env.ALLOW_WEBHOOK_FROM_ANY_IP === "true";
    
    if (!isLocalDev) {
      // В production проверяем IP-адрес согласно документации YooKassa
      const isValidIP = isYooKassaIP(clientIp);
      if (!isValidIP) {
        console.error("❌ Webhook request from unauthorized IP:", clientIp);
        console.error("❌ Allowed IP ranges: 185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25, 77.75.154.128/25, 77.75.156.11, 77.75.156.35");
        return NextResponse.json(
          { error: "Unauthorized IP address" },
          { status: 403 }
        );
      }
      console.log(`✅ Webhook request from authorized YooKassa IP: ${clientIp}`);
    } else {
      console.log(`🌐 Webhook request from IP: ${clientIp} (dev mode, IP check skipped)`);
    }
    
    // Дополнительно рекомендуется проверить статус объекта после получения уведомления
    // (см. документацию: https://yookassa.ru/developers/using-api/webhooks#security)

    // Парсим уведомление от ЮKassa
    let notification: YooKassaWebhookNotification;
    try {
      notification = JSON.parse(requestBody);
    } catch (error) {
      console.error("❌ Invalid JSON in webhook body:", error);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    console.log("📨 YooKassa webhook received:", {
      type: notification.type,
      event: notification.event,
      paymentId: notification.object.id,
      status: notification.object.status,
      amount: notification.object.amount.value,
    });

    // Проверяем структуру уведомления
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
    } else if (notification.event === "payment.canceled" && status === "canceled") {
      // Платеж отменен YooKassa
      // Используем статус "failed" вместо "canceled", так как constraint в БД разрешает только pending/completed/failed
      if (payment.status !== "failed" && payment.status !== "canceled") {
        console.log(`❌ Payment ${payment.id} canceled by YooKassa, updating status to failed`);

        const { error: updateError } = await supabase
          .from("payments")
          .update({ status: "failed" })
          .eq("id", payment.id);

        if (updateError) {
          console.error("❌ Error updating payment status:", updateError);
        } else {
          console.log(`✅ Payment ${payment.id} status updated to failed`);
        }
      } else {
        console.log(`ℹ️ Payment ${payment.id} already has status: ${payment.status}`);
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

