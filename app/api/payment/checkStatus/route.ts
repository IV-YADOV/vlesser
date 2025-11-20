import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getYooKassaPayment } from "@/lib/yookassa";

/**
 * Проверяет статус платежа через ЮKassa API и обновляет статус в БД
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json();

    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing paymentId" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Получаем платеж из БД
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Если платеж уже completed, возвращаем текущий статус
    if (payment.status === "completed") {
      // Проверяем, есть ли уже подписка
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", payment.user_id)
        .eq("plan", payment.plan)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        status: "completed",
        payment,
        subscription: subscription || null,
      });
    }

    // Получаем ID платежа ЮKassa (из колонки или из metadata)
    let yooKassaPaymentId: string | null = null;

    // Пробуем получить из колонки yookassa_payment_id
    if ((payment as any).yookassa_payment_id) {
      yooKassaPaymentId = (payment as any).yookassa_payment_id;
    }

    // Если нет ID ЮKassa, не можем проверить статус
    if (!yooKassaPaymentId) {
      return NextResponse.json({
        status: payment.status,
        payment,
        subscription: null,
        message: "YooKassa payment ID not found, waiting for webhook",
      });
    }

    // Получаем настройки ЮKassa
    const shopId = process.env.YOOKASSA_SHOP_ID?.trim() || "";
    const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim() || "";

    if (!shopId || !secretKey) {
      return NextResponse.json(
        { error: "YooKassa credentials not configured" },
        { status: 500 }
      );
    }

    // Проверяем статус платежа через API ЮKassa
    console.log(`🔍 Checking YooKassa payment status: ${yooKassaPaymentId}`);
    console.log(`📋 Current payment status in DB: ${payment.status}`);
    
    const yooKassaPayment = await getYooKassaPayment(yooKassaPaymentId, shopId, secretKey);

    if (!yooKassaPayment) {
      console.error(`❌ Failed to get payment status from YooKassa for ${yooKassaPaymentId}`);
      return NextResponse.json({
        status: payment.status,
        payment,
        subscription: null,
        message: "Failed to get payment status from YooKassa",
      });
    }

    console.log(`📋 YooKassa payment status: ${yooKassaPayment.status}`);
    console.log(`📋 YooKassa payment details:`, {
      id: yooKassaPayment.id,
      status: yooKassaPayment.status,
      amount: yooKassaPayment.amount.value,
      currency: yooKassaPayment.amount.currency,
      created_at: yooKassaPayment.created_at,
      paid: (yooKassaPayment as any).paid,
    });

    // Обрабатываем различные статусы от YooKassa
    // Статус "succeeded" - платеж успешно завершен
    // Статус "waiting_for_capture" - платеж оплачен, ожидает подтверждения (capture)
    // В большинстве случаев для автоматического capture статус сразу становится "succeeded"
    
    if ((yooKassaPayment.status === "succeeded" || yooKassaPayment.status === "waiting_for_capture") && payment.status !== "completed") {
      const statusMessage = yooKassaPayment.status === "succeeded" ? "succeeded" : "waiting_for_capture (will be treated as succeeded)";
      console.log(`✅ Payment ${payment.id} ${statusMessage}, updating to completed`);

      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "completed" })
        .eq("id", payment.id);

      if (updateError) {
        console.error("❌ Error updating payment status:", updateError);
        return NextResponse.json({
          status: payment.status,
          payment,
          subscription: null,
          error: "Failed to update payment status",
        });
      }

      // Обновляем локальный объект платежа
      const updatedPayment = { ...payment, status: "completed" };

      // Создаем подписку, если ее еще нет
      const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", payment.user_id)
        .eq("plan", payment.plan)
        .gte("created_at", payment.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existingSubscription) {
        // Вызываем completePayment для создания подписки
        const completePaymentUrl = new URL("/api/completePayment", request.url);
        
        try {
          const completeRes = await fetch(completePaymentUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId: payment.id,
              userId: payment.user_id,
            }),
          });

          if (completeRes.ok) {
            const completeData = await completeRes.json();
            console.log(`✅ Subscription created for payment ${payment.id}`);

            // Получаем созданную подписку
            const { data: newSubscription } = await supabase
              .from("subscriptions")
              .select("*")
              .eq("user_id", payment.user_id)
              .eq("plan", payment.plan)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            return NextResponse.json({
              status: "completed",
              payment: updatedPayment,
              subscription: newSubscription || null,
              message: "Payment completed and subscription created",
            });
          } else {
            console.error("❌ Error completing payment:", await completeRes.text());
          }
        } catch (error: any) {
          console.error("❌ Error calling completePayment:", error);
        }
      }

      // Возвращаем обновленный статус
      return NextResponse.json({
        status: "completed",
        payment: updatedPayment,
        subscription: existingSubscription || null,
        message: "Payment completed",
      });
    }

    // Возвращаем текущий статус на основе данных от YooKassa
    // ВАЖНО: Статус всегда берется от YooKassa, а не из БД
    let finalStatus = payment.status;
    let shouldUpdate = false;

    // Если платеж успешен или ожидает подтверждения - обновляем на completed
    if ((yooKassaPayment.status === "succeeded" || yooKassaPayment.status === "waiting_for_capture") && payment.status !== "completed") {
      console.log(`🔄 Updating payment status from ${payment.status} to completed (YooKassa status: ${yooKassaPayment.status})`);
      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "completed" })
        .eq("id", payment.id);

      if (updateError) {
        console.error("❌ Error updating payment status:", updateError);
      } else {
        console.log(`✅ Payment status updated to completed`);
        finalStatus = "completed";
        shouldUpdate = true;
      }
    } else if (yooKassaPayment.status === "canceled" && payment.status !== "failed" && payment.status !== "canceled") {
      console.log(`🔄 Updating payment status from ${payment.status} to failed (YooKassa status: canceled)`);
      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment.id);

      if (updateError) {
        console.error("❌ Error updating payment status:", updateError);
      } else {
        finalStatus = "failed";
        shouldUpdate = true;
      }
    }

    // Возвращаем обновленный платеж с актуальным статусом
    const updatedPayment = shouldUpdate ? { ...payment, status: finalStatus } : payment;

    console.log(`📤 Returning payment status:`, {
      dbStatus: payment.status,
      yooKassaStatus: yooKassaPayment.status,
      finalStatus: finalStatus,
      wasUpdated: shouldUpdate,
    });

    return NextResponse.json({
      status: finalStatus,
      payment: updatedPayment,
      subscription: null,
      yooKassaStatus: yooKassaPayment.status,
      message: yooKassaPayment.status === "pending" 
        ? "Payment is still pending. Waiting for user to complete payment."
        : `Payment status from YooKassa: ${yooKassaPayment.status}`,
    });
  } catch (error: any) {
    console.error("❌ Error checking payment status:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

