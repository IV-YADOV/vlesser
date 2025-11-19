import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API для получения информации о платеже
 * GET /api/payments?paymentId=xxx - поиск по UUID платежа
 * GET /api/payments?amount=xxx - поиск по сумме и времени (для InvId от Robokassa)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get("paymentId");
    const amount = searchParams.get("amount");

    const supabase = await createClient();

    let payment = null;

    // Если передан paymentId (UUID), ищем напрямую
    if (paymentId) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (!error && data) {
        payment = data;
      }
    }

    // Если не нашли по paymentId и передан amount, ищем по сумме и времени
    // В production ищем платежи за последний час для надежности
    if (!payment && amount) {
      const amountNum = parseFloat(amount);
      if (!isNaN(amountNum) && amountNum > 0) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        console.log("🔍 Searching payment by amount:", {
          amount: amountNum,
          from: oneHourAgo.toISOString(),
          to: now.toISOString(),
        });

        // Ищем платежи с этой суммой за последний час
        // Сначала без фильтра по статусу (может быть pending или completed)
        const { data: payments, error: timeError } = await supabase
          .from("payments")
          .select("*")
          .eq("amount", amountNum)
          .gte("created_at", oneHourAgo.toISOString())
          .lte("created_at", now.toISOString())
          .order("created_at", { ascending: false })
          .limit(20);

        if (timeError) {
          console.error("❌ Error searching payments:", timeError);
        }

        if (payments && payments.length > 0) {
          console.log(`✅ Found ${payments.length} payment(s) with amount ${amountNum}`);
          // Берем самый последний платеж с точной суммой
          payment = payments.find(p => Math.abs(p.amount - amountNum) < 0.01) || payments[0];
          console.log("✅ Selected payment:", {
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            created_at: payment.created_at,
          });
        } else {
          console.log(`⚠️ No payments found with amount ${amountNum} in last hour`);
        }
      } else {
        console.error("❌ Invalid amount:", amount);
      }
    }

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Ищем подписку для этого платежа
    // Пробуем сначала по payment_id, если колонки нет - пропускаем
    let subscription = null;
    const { data: subscriptionByPaymentId, error: paymentIdError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("payment_id", payment.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Если ошибка из-за отсутствующей колонки payment_id, игнорируем
    if (paymentIdError && (paymentIdError.code === "PGRST204" || paymentIdError.message?.includes("payment_id"))) {
      console.warn("⚠️ payment_id column not found in subscriptions, skipping payment_id search");
    } else if (!paymentIdError && subscriptionByPaymentId) {
      subscription = subscriptionByPaymentId;
    }

    // Если не нашли по payment_id, ищем по user_id и plan
    // ВАЖНО: Проверяем, что подписка создана ПОСЛЕ этого платежа
    // Это предотвращает возврат старых подписок от предыдущих платежей
    if (!subscription) {
      const paymentCreatedAt = new Date(payment.created_at);
      
      const { data: subscriptionByUser } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", payment.user_id)
        .eq("plan", payment.plan)
        .gte("created_at", paymentCreatedAt.toISOString()) // Только подписки, созданные после платежа
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        payment,
        subscription: subscriptionByUser || null,
      });
    }

    return NextResponse.json({
      payment,
      subscription: subscription || null,
    });
  } catch (error: any) {
    console.error("Error fetching payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

