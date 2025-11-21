import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Fail URL - редирект после неудачной оплаты или отмены от ЮKassa
 * Обрабатывает GET запрос от платежной системы
 * Документация: https://yookassa.ru/developers/payment-acceptance/getting-started/payment-process
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    console.log("❌ Fail URL called");
    console.log("📋 Params:", Object.fromEntries(searchParams.entries()));
    
    // Параметры от ЮKassa (payment_id - это наш внутренний ID платежа)
    const paymentId = searchParams.get("payment_id");
    const error = searchParams.get("error") || searchParams.get("message") || "Платеж не был завершен";
    
    // Обновляем статус платежа на failed, если он еще pending
    if (paymentId) {
      try {
        const supabase = await createClient();
        
        // Получаем текущий платеж
        const { data: payment, error: paymentError } = await supabase
          .from("payments")
          .select("*")
          .eq("id", paymentId)
          .single();
        
        if (!paymentError && payment && payment.status === "pending") {
          console.log(`🔄 Updating payment ${paymentId} status from pending to failed`);
          
          // Обновляем статус на failed (используем failed вместо canceled, так как constraint в БД разрешает только pending/completed/failed)
          const { error: updateError } = await supabase
            .from("payments")
            .update({ status: "failed" })
            .eq("id", paymentId)
            .eq("status", "pending"); // Дополнительная проверка для безопасности
          
          if (updateError) {
            console.error("❌ Error updating payment status:", updateError);
          } else {
            console.log(`✅ Payment ${paymentId} status updated to failed`);
          }
        }
      } catch (error: any) {
        console.error("❌ Error processing payment status update:", error);
        // Продолжаем обработку, даже если не удалось обновить статус
      }
    }

    // Формируем URL для редиректа
    const host = request.headers.get("host") || 
                 request.headers.get("x-forwarded-host") || 
                 "vlesser.ru";
    const protocol = request.headers.get("x-forwarded-proto") || 
                     (request.url.startsWith("https") ? "https" : "http");
    
    const queryParams = new URLSearchParams();
    if (paymentId) {
      queryParams.set("payment_id", paymentId);
    }
    if (error) {
      queryParams.set("error", error);
    }
    
    const queryString = queryParams.toString();
    const redirectPath = `/checkout/fail${queryString ? '?' + queryString : ''}`;
    const redirectUrl = `${protocol}://${host}${redirectPath}`;
    
    console.log("🔄 Redirecting to:", redirectUrl);

    // Редирект с сохранением cookies
    const response = NextResponse.redirect(redirectUrl, 302);
    
    // Копируем cookies для сохранения сессии
    // RequestCookie содержит только name и value, поэтому используем значения по умолчанию
    try {
      request.cookies.getAll().forEach(cookie => {
        try {
          response.cookies.set(cookie.name, cookie.value, {
            path: '/',
            sameSite: 'lax',
            secure: protocol === 'https',
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7, // 7 дней
          });
        } catch (e) {
          // Игнорируем ошибки отдельных cookies
        }
      });
    } catch (e) {
      console.warn("⚠️ Error copying cookies:", e);
    }
    
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");

    return response;
  } catch (error: any) {
    console.error("❌ Error in Fail URL handler:", error);
    
    // В случае ошибки редиректим на fail страницу
    try {
      const host = request.headers.get("host") || "vlesser.ru";
      const protocol = request.headers.get("x-forwarded-proto") || "https";
      const redirectUrl = `${protocol}://${host}/checkout/fail`;
      
      return NextResponse.redirect(redirectUrl, 302);
    } catch (redirectError) {
      console.error("❌ Error creating redirect:", redirectError);
      // Fallback: HTML редирект
      return new NextResponse(
        `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/checkout/fail"></head><body><script>window.location.href="/checkout/fail";</script></body></html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    }
  }
}


