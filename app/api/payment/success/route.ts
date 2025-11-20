import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Success URL - редирект после оплаты от ЮKassa
 * Обрабатывает GET запрос от платежной системы
 * ВАЖНО: YooKassa возвращает на этот URL в любом случае (и при успехе, и при отмене)
 * Поэтому нужно проверять статус платежа и перенаправлять на fail, если платеж не прошел
 * Документация: https://yookassa.ru/developers/payment-acceptance/getting-started/payment-process
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    console.log("✅ Success URL called");
    console.log("📋 Params:", Object.fromEntries(searchParams.entries()));
    
    // Параметры от ЮKassa (payment_id - это наш внутренний ID платежа)
    const paymentId = searchParams.get("payment_id");
    
    // Проверяем статус платежа, если он передан
    if (paymentId) {
      try {
        const supabase = await createClient();
        
        const { data: payment, error: paymentError } = await supabase
          .from("payments")
          .select("*")
          .eq("id", paymentId)
          .single();
        
        if (!paymentError && payment) {
          console.log(`📋 Payment status: ${payment.status}`);
          
          // Если платеж failed или canceled - перенаправляем на fail страницу
          if (payment.status === "failed" || payment.status === "canceled") {
            console.log(`❌ Payment ${paymentId} is ${payment.status}, redirecting to fail page`);
            
            const host = request.headers.get("host") || 
                         request.headers.get("x-forwarded-host") || 
                         "vlesser.ru";
            const protocol = request.headers.get("x-forwarded-proto") || 
                             (request.url.startsWith("https") ? "https" : "http");
            
            const queryParams = new URLSearchParams();
            queryParams.set("payment_id", paymentId);
            queryParams.set("error", "Платеж не был завершен");
            
            const redirectPath = `/checkout/fail?${queryParams.toString()}`;
            const redirectUrl = `${protocol}://${host}${redirectPath}`;
            
            console.log("🔄 Redirecting to fail page:", redirectUrl);
            return NextResponse.redirect(redirectUrl, 302);
          }
          
          // Если платеж pending - пользователь вернулся, но не завершил оплату
          // Перенаправляем на fail страницу с сообщением
          if (payment.status === "pending") {
            console.log(`⚠️ Payment ${paymentId} is still pending, redirecting to fail page`);
            
            const host = request.headers.get("host") || 
                         request.headers.get("x-forwarded-host") || 
                         "vlesser.ru";
            const protocol = request.headers.get("x-forwarded-proto") || 
                             (request.url.startsWith("https") ? "https" : "http");
            
            const queryParams = new URLSearchParams();
            queryParams.set("payment_id", paymentId);
            queryParams.set("error", "Платеж не был завершен");
            
            const redirectPath = `/checkout/fail?${queryParams.toString()}`;
            const redirectUrl = `${protocol}://${host}${redirectPath}`;
            
            console.log("🔄 Redirecting to fail page (pending payment):", redirectUrl);
            return NextResponse.redirect(redirectUrl, 302);
          }
          
          // Если платеж completed - продолжаем на success страницу
        }
      } catch (error: any) {
        console.error("❌ Error checking payment status:", error);
        // Продолжаем обработку, даже если не удалось проверить статус
      }
    }

    // Формируем URL для редиректа
    const host = request.headers.get("host") || 
                 request.headers.get("x-forwarded-host") || 
                 "vlesser.ru";
    const protocol = request.headers.get("x-forwarded-proto") || 
                     (request.url.startsWith("https") ? "https" : "http");
    
    // Строим абсолютный URL для редиректа
    const queryParams = new URLSearchParams();
    if (paymentId) {
      queryParams.set("payment_id", paymentId);
    }
    
    const queryString = queryParams.toString();
    const redirectPath = `/checkout/success${queryString ? '?' + queryString : ''}`;
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
    console.error("❌ Error in Success URL handler:", error);
    
    // В случае ошибки редиректим на success страницу
    try {
      const host = request.headers.get("host") || "vlesser.ru";
      const protocol = request.headers.get("x-forwarded-proto") || "https";
      const redirectUrl = `${protocol}://${host}/checkout/success`;
      
      return NextResponse.redirect(redirectUrl, 302);
    } catch (redirectError) {
      console.error("❌ Error creating redirect:", redirectError);
      // Fallback: HTML редирект
      return new NextResponse(
        `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/checkout/success"></head><body><script>window.location.href="/checkout/success";</script></body></html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    }
  }
}

