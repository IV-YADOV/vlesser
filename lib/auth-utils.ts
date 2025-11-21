import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * Интерфейс для данных пользователя Telegram
 */
export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Результат проверки авторизации
 */
export interface AuthResult {
  isValid: boolean;
  userId?: string;
  userData?: TelegramUserData;
  error?: string;
}

/**
 * Проверяет авторизацию пользователя из userData
 * Использует ту же логику, что и /api/validateTelegramAuth, но без внутреннего fetch
 * @param userData - данные пользователя Telegram
 */
export async function validateAuthFromData(
  userData: TelegramUserData | null
): Promise<AuthResult> {
  try {
    if (!userData || !userData.id || !userData.first_name) {
      return {
        isValid: false,
        error: "Missing user data",
      };
    }

    // Если hash - это токен (64 символа hex), то это данные от бота
    // Для данных от бота проверяем токен в БД
    const isBotAuth = userData.hash && userData.hash.length === 64 && /^[a-f0-9]+$/i.test(userData.hash);
    
    if (isBotAuth) {
      // Для данных от бота проверяем токен в БД
      const supabase = await createClient();
      
      // Проверяем токен в БД
      const { data: tokenRecord, error: tokenError } = await supabase
        .from("auth_tokens")
        .select("*")
        .eq("token", userData.hash)
        .single();

      if (tokenError || !tokenRecord) {
        return {
          isValid: false,
          error: "Invalid token",
        };
      }

      // Проверяем, что токен использован (значит авторизация прошла)
      if (tokenRecord.status !== "used") {
        return {
          isValid: false,
          error: "Token not used yet",
        };
      }

      // Проверяем, что telegram_id совпадает
      if (tokenRecord.telegram_id !== userData.id.toString()) {
        return {
          isValid: false,
          error: "Token not bound to this user",
        };
      }

      // Проверяем срок действия данных (не старше 24 часов)
      const authDate = userData.auth_date;
      if (authDate) {
        const currentTime = Math.floor(Date.now() / 1000);
        const TWENTY_FOUR_HOURS = 24 * 60 * 60;

        if (currentTime - authDate > TWENTY_FOUR_HOURS) {
          return {
            isValid: false,
            error: "Auth data expired",
          };
        }
      }
    } else {
      // Для Telegram Widget проверяем hash через HMAC
      if (!userData.hash || !process.env.TELEGRAM_BOT_TOKEN) {
        return {
          isValid: false,
          error: "Missing hash or bot token",
        };
      }

      const { hash, ...dataWithoutHash } = userData;
      const checkString = Object.keys(dataWithoutHash)
        .filter((key) => key !== "hash")
        .map((key) => `${key}=${userData[key as keyof TelegramUserData]}`)
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
        return {
          isValid: false,
          error: "Invalid hash",
        };
      }

      // Проверяем срок действия данных
      const authDate = userData.auth_date;
      if (authDate) {
        const currentTime = Math.floor(Date.now() / 1000);
        const TWENTY_FOUR_HOURS = 24 * 60 * 60;

        if (currentTime - authDate > TWENTY_FOUR_HOURS) {
          return {
            isValid: false,
            error: "Auth data expired",
          };
        }
      }
    }

    // Формируем userId в формате tg_<telegram_id>
    const userId = `tg_${userData.id}`;

    return {
      isValid: true,
      userId,
      userData,
    };
  } catch (error: any) {
    console.error("Error validating auth:", error);
    return {
      isValid: false,
      error: error.message || "Internal server error",
    };
  }
}

/**
 * Проверяет авторизацию пользователя из запроса
 * Извлекает userData из body запроса и валидирует его
 */
export async function validateAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Пытаемся получить userData из body запроса
    let userData: TelegramUserData | null = null;
    
    try {
      const body = await request.json();
      userData = body.userData || body;
    } catch {
      // Если не удалось распарсить JSON, пробуем получить из headers
      const userDataHeader = request.headers.get("x-user-data");
      if (userDataHeader) {
        try {
          userData = JSON.parse(userDataHeader);
        } catch {
          // Игнорируем ошибку парсинга
        }
      }
    }

    return await validateAuthFromData(userData);
  } catch (error: any) {
    console.error("Error validating auth:", error);
    return {
      isValid: false,
      error: error.message || "Internal server error",
    };
  }
}

/**
 * Middleware для проверки авторизации в API routes
 * Возвращает NextResponse с ошибкой, если авторизация не прошла
 */
export async function requireAuth(request: NextRequest): Promise<{
  auth: AuthResult;
  response?: NextResponse;
}> {
  const auth = await validateAuth(request);
  
  if (!auth.isValid) {
    return {
      auth,
      response: NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return { auth };
}
