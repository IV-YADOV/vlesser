import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TelegramUser, getUserIdFromTelegram } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Проверяем токен в БД
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("auth_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRecord) {
      console.error("Token not found:", tokenError);
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Проверяем, что токен использован (бот уже обработал его)
    if (tokenRecord.status !== "used") {
      return NextResponse.json(
        { error: "Token not processed by bot yet" },
        { status: 401 }
      );
    }

    // Проверяем, что telegram_id привязан к токену
    if (!tokenRecord.telegram_id) {
      return NextResponse.json(
        { error: "Token not bound to user" },
        { status: 401 }
      );
    }

    // Проверяем, что токен еще не был использован для авторизации на сайте
    if ((tokenRecord as any).site_used_at) {
      return NextResponse.json(
        { error: "Token already used for authentication" },
        { status: 401 }
      );
    }

    // Помечаем токен как использованный на сайте ДО получения данных пользователя
    // Это предотвращает race condition при параллельных запросах
    const siteUsedAt = new Date().toISOString();
    const { error: markUsedError, data: updatedToken } = await supabase
      .from("auth_tokens")
      .update({
        site_used_at: siteUsedAt,
      })
      .eq("token", token)
      .is("site_used_at", null) // Обновляем только если еще не использован (правильная проверка NULL)
      .select()
      .single();

    if (markUsedError) {
      // Если ошибка из-за отсутствия поля site_used_at, пробуем без условия
      if (markUsedError.code === '42703' || markUsedError.message?.includes('site_used_at')) {
        // Поле не существует, обновляем без условия (для обратной совместимости)
        const { error: fallbackError } = await supabase
          .from("auth_tokens")
          .update({
            site_used_at: siteUsedAt,
          })
          .eq("token", token);
        
        if (fallbackError) {
          console.error("Error marking token as used (fallback):", fallbackError);
          // Продолжаем, так как основная проверка уже выполнена выше
        }
      } else {
        // Другая ошибка - проверяем, не использован ли токен
        const { data: recheckToken } = await supabase
          .from("auth_tokens")
          .select("site_used_at")
          .eq("token", token)
          .single();
        
        if (recheckToken?.site_used_at) {
          return NextResponse.json(
            { error: "Token already used for authentication" },
            { status: 401 }
          );
        }
        
        console.error("Error marking token as used:", markUsedError);
        return NextResponse.json(
          { error: "Failed to process token" },
          { status: 500 }
        );
      }
    }

    if (!updatedToken) {
      // Если обновление не вернуло данные, проверяем еще раз
      const { data: recheckToken } = await supabase
        .from("auth_tokens")
        .select("site_used_at")
        .eq("token", token)
        .single();
      
      if (recheckToken?.site_used_at) {
        return NextResponse.json(
          { error: "Token already used for authentication" },
          { status: 401 }
        );
      }
    }

    // Получаем данные пользователя из Supabase
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("tg_id", tokenRecord.telegram_id)
      .single();

    if (userError || !userRecord) {
      console.error("User not found:", userError);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const telegramId = parseInt(tokenRecord.telegram_id);

    // Формируем объект пользователя для localStorage
    // Бот уже сохранил пользователя в БД с полными данными
    // Используем данные из БД или fallback на telegram_id
    const firstName = (userRecord as any).first_name || `User ${tokenRecord.telegram_id}`;
    const lastName = (userRecord as any).last_name || undefined;
    const username = (userRecord as any).username || undefined;
    const photoUrl = (userRecord as any).photo_url || undefined;

    const userData: TelegramUser = {
      id: telegramId,
      first_name: firstName,
      last_name: lastName,
      username: username,
      photo_url: photoUrl,
      auth_date: Math.floor(Date.now() / 1000),
      hash: token, // Используем токен как hash
    };

    // Возвращаем данные для авторизации
    return NextResponse.json({
      success: true,
      user: {
        id: telegramId,
        first_name: firstName,
        last_name: lastName,
        username: username,
        photo_url: photoUrl,
      },
    });
  } catch (error: any) {
    console.error("Telegram auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

