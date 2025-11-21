import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API для получения информации о платеже
 * GET /api/payments?paymentId=xxx - поиск по UUID платежа
 * GET /api/payments?amount=xxx - поиск по сумме и времени (fallback метод)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get("paymentId");
    const amount = searchParams.get("amount");
    const userDataParam = searchParams.get("userData");

    // Проверяем авторизацию, если передан userData
    let authUserId: string | undefined = undefined;
    if (userDataParam) {
      try {
        const userData = JSON.parse(userDataParam);
        const { validateAuthFromData } = await import("@/lib/auth-utils");
        const auth = await validateAuthFromData(userData);
        
        if (!auth.isValid) {
          return NextResponse.json(
            { error: auth.error || "Unauthorized" },
            { status: 401 }
          );
        }
        
        authUserId = auth.userId;
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid userData format" },
          { status: 400 }
        );
      }
    } else {
      // Для GET запросов userData может быть необязательным для просмотра статуса платежа
      // Это позволяет пользователям видеть статус платежа после редиректа от YooKassa
      // даже если localStorage очищен. Но операции (отмена, создание) требуют авторизации.
      // Авторизация будет проверена только при проверке владения ресурсом (ниже)
    }

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

    // Проверяем, что платеж принадлежит авторизованному пользователю
    // Если авторизация не предоставлена, разрешаем просмотр статуса платежа
    // (полезно для страниц fail/success после редиректа от YooKassa)
    if (authUserId && payment.user_id !== authUserId) {
      return NextResponse.json(
        { error: "Payment does not belong to this user" },
        { status: 403 }
      );
    }

    // Ищем подписку для этого платежа
    // ВАЖНО: Ищем по user_id и plan с фильтром по времени создания платежа
    // Это гарантирует, что мы найдем подписку, созданную для этого конкретного платежа
    const paymentCreatedAt = new Date(payment.created_at);
    
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", payment.user_id)
      .eq("plan", payment.plan)
      .gte("created_at", paymentCreatedAt.toISOString()) // Только подписки, созданные после или одновременно с платежом
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError && subscriptionError.code !== "PGRST116") {
      console.error("❌ Error searching subscription:", subscriptionError);
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

