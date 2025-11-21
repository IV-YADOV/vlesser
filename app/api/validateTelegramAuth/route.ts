import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data || !data.id || !data.first_name) {
      return NextResponse.json(
        { valid: false, error: "Missing required data" },
        { status: 400 }
      );
    }

    // Если hash - это токен (64 символа hex), то это данные от бота
    // Для данных от бота проверяем токен в БД
    const isBotAuth = data.hash && data.hash.length === 64 && /^[a-f0-9]+$/i.test(data.hash);
    
    if (isBotAuth) {
      const supabase = await createClient();
      
      // Проверяем токен в БД
      const { data: tokenRecord, error: tokenError } = await supabase
        .from("auth_tokens")
        .select("*")
        .eq("token", data.hash)
        .single();

      if (tokenError || !tokenRecord) {
        return NextResponse.json(
          { valid: false, error: "Invalid token" },
          { status: 401 }
        );
      }

      // Проверяем, что токен использован (значит авторизация прошла)
      if (tokenRecord.status !== "used") {
        return NextResponse.json(
          { valid: false, error: "Token not used yet" },
          { status: 401 }
        );
      }

      // Проверяем, что telegram_id совпадает
      if (tokenRecord.telegram_id !== data.id.toString()) {
        return NextResponse.json(
          { valid: false, error: "Token not bound to this user" },
          { status: 401 }
        );
      }

      // Проверяем срок действия данных (не старше 24 часов)
      const authDate = data.auth_date;
      if (authDate) {
        const currentTime = Math.floor(Date.now() / 1000);
        const TWENTY_FOUR_HOURS = 24 * 60 * 60;

        if (currentTime - authDate > TWENTY_FOUR_HOURS) {
          return NextResponse.json(
            { valid: false, error: "Auth data expired" },
            { status: 401 }
          );
        }
      }

      return NextResponse.json({ valid: true });
    }

    // Для Telegram Widget проверяем hash через HMAC
    if (!data.hash || !process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { valid: false, error: "Missing hash or bot token" },
        { status: 400 }
      );
    }

    const { hash, ...dataWithoutHash } = data;
    const checkString = Object.keys(dataWithoutHash)
      .filter((key) => key !== "hash")
      .map((key) => `${key}=${data[key]}`)
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

    if (hmac === hash) {
      const authDate = data.auth_date;
      if (authDate) {
        const currentTime = Math.floor(Date.now() / 1000);
        const TWENTY_FOUR_HOURS = 24 * 60 * 60;

        if (currentTime - authDate > TWENTY_FOUR_HOURS) {
          return NextResponse.json(
            { valid: false, error: "Auth data expired" },
            { status: 401 }
          );
        }
      }

      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json(
        { valid: false, error: "Invalid hash" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Telegram auth validation API error:", error);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

