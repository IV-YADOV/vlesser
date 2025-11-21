import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TelegramUser, getUserIdFromTelegram } from "@/lib/auth";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { userData } = await request.json();

    if (!userData) {
      return NextResponse.json(
        { error: "Missing userData" },
        { status: 400 }
      );
    }

    // Валидируем данные пользователя
    if (!userData.id || !userData.first_name || !userData.hash) {
      return NextResponse.json(
        { error: "Invalid user data" },
        { status: 400 }
      );
    }

    // Валидируем токен напрямую (без внутреннего fetch)
    const isBotAuth = userData.hash && userData.hash.length === 64 && /^[a-f0-9]+$/i.test(userData.hash);
    
    if (isBotAuth) {
      const supabase = await createClient();
      
      // Проверяем токен в БД
      const { data: tokenRecord, error: tokenError } = await supabase
        .from("auth_tokens")
        .select("*")
        .eq("token", userData.hash)
        .single();

      if (tokenError || !tokenRecord) {
        return NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        );
      }

      // Проверяем, что токен использован
      if (tokenRecord.status !== "used") {
        return NextResponse.json(
          { error: "Token not used yet" },
          { status: 401 }
        );
      }

      // Проверяем, что telegram_id совпадает
      if (tokenRecord.telegram_id !== userData.id.toString()) {
        return NextResponse.json(
          { error: "Token not bound to this user" },
          { status: 401 }
        );
      }

      // Проверяем срок действия данных
      const authDate = userData.auth_date;
      if (authDate) {
        const currentTime = Math.floor(Date.now() / 1000);
        const TWENTY_FOUR_HOURS = 24 * 60 * 60;

        if (currentTime - authDate > TWENTY_FOUR_HOURS) {
          return NextResponse.json(
            { error: "Auth data expired" },
            { status: 401 }
          );
        }
      }
    } else {
      // Для Telegram Widget проверяем hash через HMAC
      if (!userData.hash || !process.env.TELEGRAM_BOT_TOKEN) {
        return NextResponse.json(
          { error: "Missing hash or bot token" },
          { status: 400 }
        );
      }

      const { hash, ...dataWithoutHash } = userData;
      const checkString = Object.keys(dataWithoutHash)
        .filter((key) => key !== "hash")
        .map((key) => `${key}=${userData[key]}`)
        .sort()
        .join("\n");

      const secretKey = crypto
        .createHash("sha256")
        .update(process.env.TELEGRAM_BOT_TOKEN)
        .digest();
      const hmac = crypto
        .createHmac("sha256", secretKey)
        .update(checkString)
        .digest("hex");

      if (hmac !== hash) {
        return NextResponse.json(
          { error: "Invalid hash" },
          { status: 401 }
        );
      }

      // Проверяем срок действия
      const authDate = userData.auth_date;
      if (authDate) {
        const currentTime = Math.floor(Date.now() / 1000);
        const TWENTY_FOUR_HOURS = 24 * 60 * 60;

        if (currentTime - authDate > TWENTY_FOUR_HOURS) {
          return NextResponse.json(
            { error: "Auth data expired" },
            { status: 401 }
          );
        }
      }
    }

    // Если валидация прошла, получаем подписки
    const supabase = await createClient();
    const userId = getUserIdFromTelegram(userData as TelegramUser);

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading subscriptions:", error);
      return NextResponse.json(
        { error: "Failed to load subscriptions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ subscriptions: data || [] });
  } catch (error: any) {
    console.error("Subscriptions API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

