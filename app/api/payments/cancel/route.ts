import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API endpoint для отмены платежа (установка статуса failed)
 * Используется когда пользователь выходит из процесса оплаты
 * Примечание: используем статус "failed" вместо "canceled", так как constraint в БД разрешает только pending/completed/failed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, userData } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required" },
        { status: 400 }
      );
    }

    // Проверяем авторизацию
    if (userData) {
      const { validateAuthFromData } = await import("@/lib/auth-utils");
      const auth = await validateAuthFromData(userData);
      
      if (!auth.isValid) {
        return NextResponse.json(
          { error: auth.error || "Unauthorized" },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Missing userData. Authentication required." },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Получаем текущий платеж
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, status, user_id")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("❌ Payment not found:", paymentError);
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Проверяем, что платеж принадлежит авторизованному пользователю
    const { validateAuthFromData } = await import("@/lib/auth-utils");
    const auth = await validateAuthFromData(userData);
    
    if (auth.userId && payment.user_id !== auth.userId) {
      return NextResponse.json(
        { error: "Payment does not belong to this user" },
        { status: 403 }
      );
    }

    // Обновляем статус на failed только если он еще pending
    if (payment.status !== "pending") {
      console.log(`ℹ️ Payment ${paymentId} already has status: ${payment.status}, skipping update`);
      return NextResponse.json({
        success: true,
        message: `Payment already has status: ${payment.status}`,
        paymentId,
        status: payment.status,
      });
    }

    // Обновляем статус на failed (используем failed вместо canceled, так как constraint в БД разрешает только pending/completed/failed)
    const { data: updatedPayments, error: updateError } = await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("id", paymentId)
      .eq("status", "pending") // Дополнительная проверка для безопасности
      .select("id, status");

    if (updateError) {
      console.error("❌ Error updating payment status:", updateError);
      return NextResponse.json(
        { error: "Failed to update payment status", details: updateError.message },
        { status: 500 }
      );
    }

    // Проверяем, был ли обновлен платеж
    if (!updatedPayments || updatedPayments.length === 0) {
      console.log(`ℹ️ Payment ${paymentId} was not updated (status may have changed or payment not found)`);
      // Получаем актуальный статус платежа
      const { data: currentPayment } = await supabase
        .from("payments")
        .select("id, status")
        .eq("id", paymentId)
        .single();
      
      return NextResponse.json({
        success: true,
        message: `Payment status: ${currentPayment?.status || "unknown"}`,
        paymentId,
        status: currentPayment?.status || "unknown",
      });
    }

    const updatedPayment = updatedPayments[0];
    console.log(`✅ Payment ${paymentId} status updated to failed`);

    return NextResponse.json({
      success: true,
      message: "Payment canceled successfully",
      paymentId: updatedPayment.id,
      status: updatedPayment.status,
    });
  } catch (error: any) {
    console.error("❌ Error canceling payment:", error);
    const errorMessage = error?.message || String(error) || "Unknown error";
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

