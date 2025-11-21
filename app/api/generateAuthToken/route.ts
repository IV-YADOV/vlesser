import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Генерируем уникальный токен
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 минут

    // Сохраняем токен в Supabase со статусом "waiting"
    const { error } = await supabase.from("auth_tokens").insert({
      token,
      expires_at: expiresAt,
      status: "waiting", // новый токен, ожидает использования
    });

    if (error) {
      console.error("Error saving auth token:", error);
      // Если таблицы нет или нет нужных полей, возвращаем ошибку
      // Необходимо выполнить миграцию supabase_auth_tokens_migration.sql
      return NextResponse.json(
        { 
          error: "Failed to save token. Please run supabase_auth_tokens_migration.sql migration.",
          details: error.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      token,
      expiresAt,
    });
  } catch (error: any) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}

