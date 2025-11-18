import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TelegramUser, getUserIdFromTelegram } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token, userData } = await request.json();

    if (!token || !userData) {
      return NextResponse.json(
        { error: "Missing token or userData" },
        { status: 400 }
      );
    }

    // Валидируем данные пользователя
    if (!userData.id || !userData.first_name) {
      return NextResponse.json(
        { error: "Invalid user data" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Сохраняем пользователя
    const userId = getUserIdFromTelegram(userData as TelegramUser);
    const { error: userError } = await supabase.from("users").upsert({
      id: userId,
      tg_id: userData.id.toString(),
    });

    if (userError) {
      console.error("Error saving user:", userError);
    }

    // Возвращаем данные для авторизации
    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
        photo_url: userData.photo_url,
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

