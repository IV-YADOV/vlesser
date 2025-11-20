import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanById } from "@/lib/plans";
import { addDays } from "date-fns";

function generateVlessLink(): string {
  // Mock VLESS link generation
  // In production, this should generate a real VLESS config
  const uuid = crypto.randomUUID();
  const server = "vpn.example.com";
  const port = 443;
  const flow = "xtls-rprx-vision";

  return `vless://${uuid}@${server}:${port}?flow=${flow}&encryption=none&security=tls&sni=${server}&fp=chrome&pbk=test&sid=test&spx=test&type=tcp&headerType=none#VLESSer`;
}

export async function POST(request: NextRequest) {
  try {
    const { paymentId, userId } = await request.json();

    console.log("📥 completePayment called:", {
      paymentId,
      userId,
      hasPaymentId: !!paymentId,
      hasUserId: !!userId,
    });

    if (!paymentId || !userId) {
      console.error("❌ Missing paymentId or userId in completePayment");
      return NextResponse.json(
        { error: "Missing paymentId or userId" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get payment (don't filter by user_id to allow flexibility)
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("Payment error:", paymentError);
      return NextResponse.json(
        { error: "Payment not found: " + (paymentError?.message || "Unknown") },
        { status: 404 }
      );
    }

    // Ensure user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!existingUser) {
      await supabase
        .from("users")
        .insert({
          id: userId,
          tg_id: userId.startsWith("tg_") ? userId.replace("tg_", "") : null,
        });
    }

    // ВАЖНО: В production режиме completePayment вызывается только после подтверждения оплаты через webhook
    // Статус "completed" устанавливается ТОЛЬКО через webhook от ЮKassa
    // НЕ обновляем статус автоматически - это должен делать только webhook

    // Проверяем статус платежа - в production только completed платежи могут быть обработаны
    if (payment.status !== "completed") {
      console.error("❌ Attempted to complete payment with status:", payment.status);
      console.error("Payment must be marked as 'completed' by YooKassa webhook first");
      console.error("Payment details:", {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        created_at: payment.created_at,
      });
      return NextResponse.json(
        {
          error: "Payment is not completed. Status: " + payment.status + ". Payment must be confirmed by YooKassa webhook first.",
        },
        { status: 400 }
      );
    }

    // ВАЖНО: Всегда создаем новую подписку для каждого платежа
    // Не проверяем существующие подписки - каждый платеж создает новую подписку и xray клиента
    console.log("✅ Payment completed, creating new subscription and xray client...");

    // Get plan
    const plan = getPlanById(payment.plan);
    if (!plan) {
      console.error("❌ Invalid plan:", payment.plan);
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    console.log("📋 Plan details:", {
      planId: plan.id,
      planName: plan.name,
      duration: plan.duration,
      userId: userId,
    });

    // Generate VLESS link через Python сервис
    let vlessLink: string;
    
    const pythonServiceUrl = process.env.PYTHON_XRAY_SERVICE_URL || "http://localhost:5000";
    
    console.log(`🔄 Calling Python xray service: ${pythonServiceUrl}/create-client`);
    console.log("📋 Python service request params:", {
      email: userId,
      days: plan.duration,
    });
    
    try {
      // Вызываем Python сервис для создания клиента в xray
      const response = await fetch(`${pythonServiceUrl}/create-client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userId, // Используем userId как email
          days: plan.duration, // Срок действия из тарифа
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.vless_link) {
          vlessLink = data.vless_link;
          console.log(`✅ Клиент создан в xray: ${userId}, VLESS получен`);
        } else {
          throw new Error(data.error || "Failed to get vless link from Python service");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Python service returned ${response.status}`);
      }
    } catch (error: any) {
      console.error("Ошибка при вызове Python сервиса:", error);
      // Fallback на mock конфиг если Python сервис недоступен
      console.warn("Используем mock конфиг как fallback");
      vlessLink = generateVlessLink();
    }

    // Calculate expiration
    const expiresAt = addDays(new Date(), plan.duration).toISOString();

    // Create subscription
    // Пробуем сначала с payment_id, если ошибка - без него
    let subscriptionData: any = {
      user_id: userId,
      plan: payment.plan,
      expires_at: expiresAt,
      vless_link: vlessLink,
      payment_id: payment.id,
    };

    let { data: newSubscription, error: subError } = await supabase
      .from("subscriptions")
      .insert(subscriptionData)
      .select()
      .single();

    // Если ошибка из-за отсутствующей колонки payment_id, пробуем без неё
    if (subError && (subError.code === "PGRST204" || subError.message?.includes("payment_id"))) {
      console.warn("⚠️ payment_id column not found, creating subscription without it");
      subscriptionData = {
        user_id: userId,
        plan: payment.plan,
        expires_at: expiresAt,
        vless_link: vlessLink,
      };
      
      const { data: subscriptionWithoutPaymentId, error: retryError } = await supabase
        .from("subscriptions")
        .insert(subscriptionData)
        .select()
        .single();

      if (retryError) {
        console.error("Error creating subscription (without payment_id):", retryError);
        return NextResponse.json(
          { error: "Failed to create subscription: " + (retryError.message || "Unknown error") },
          { status: 500 }
        );
      }

      newSubscription = subscriptionWithoutPaymentId;
    } else if (subError) {
      console.error("Error creating subscription:", subError);
      return NextResponse.json(
        { error: "Failed to create subscription: " + (subError.message || "Unknown error") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      vlessLink: newSubscription.vless_link,
      expiresAt: newSubscription.expires_at,
    });
  } catch (error: any) {
    console.error("Complete payment handler error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

