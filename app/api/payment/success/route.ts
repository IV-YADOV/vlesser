import { NextRequest, NextResponse } from "next/server";
import { verifyRobokassaSignature } from "@/lib/robokassa";

/**
 * Success URL - редирект после успешной оплаты от Robokassa
 * Обрабатывает GET запрос от платежной системы
 * Документация: https://docs.robokassa.ru/pay-interface/
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    console.log("✅ Success URL called");
    console.log("📋 Params:", Object.fromEntries(searchParams.entries()));
    
    // Параметры от Robokassa
    const outSum = searchParams.get("OutSum");
    const invId = searchParams.get("InvId");
    const signature = searchParams.get("SignatureValue");
    const password_1 = process.env.ROBOKASSA_PASSWORD_1?.trim() || "";

    // Проверяем подпись для SuccessURL: MD5(OutSum:InvId:Password_1)
    if (password_1 && outSum && invId && signature) {
      try {
        const isValid = verifyRobokassaSignature(outSum, invId, signature, password_1);
        console.log("🔐 Signature verification:", { isValid, outSum, invId });
        
        if (!isValid) {
          console.error("❌ Invalid Robokassa signature in SuccessURL");
          // Все равно редиректим на страницу успеха (подпись проверяется в Result URL)
        }
      } catch (sigError) {
        console.error("❌ Signature verification error:", sigError);
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
    if (invId) {
      queryParams.set("payment_id", invId);
    }
    if (outSum) {
      queryParams.set("amount", outSum);
    }
    
    const queryString = queryParams.toString();
    const redirectPath = `/checkout/success${queryString ? '?' + queryString : ''}`;
    const redirectUrl = `${protocol}://${host}${redirectPath}`;
    
    console.log("🔄 Redirecting to:", redirectUrl);
    
    // Редирект с сохранением cookies
    const response = NextResponse.redirect(redirectUrl, 302);
    
    // Копируем cookies для сохранения сессии
    try {
      request.cookies.getAll().forEach(cookie => {
        try {
          response.cookies.set(cookie.name, cookie.value, {
            path: cookie.path || '/',
            domain: cookie.domain,
            sameSite: (cookie.sameSite as any) || 'lax',
            secure: cookie.secure !== undefined ? cookie.secure : (protocol === 'https'),
            httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : true,
            maxAge: cookie.maxAge || 60 * 60 * 24 * 7,
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

