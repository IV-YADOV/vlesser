"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { TelegramUser, getUserIdFromTelegram } from "@/lib/auth";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const token = searchParams.get("token");

        if (!token) {
          setStatus("error");
          setErrorMessage("Токен авторизации не найден");
          return;
        }

        // Отправляем на сервер для авторизации (только токен, данные получаем из БД)
        const response = await fetch("/api/telegramAuth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const error = await response.json();
          setStatus("error");
          setErrorMessage(error.error || "Ошибка авторизации");
          return;
        }

        const result = await response.json();
        if (result.success && result.user) {
          // Формируем объект пользователя для localStorage
          const userData: TelegramUser = {
            id: result.user.id,
            first_name: result.user.first_name,
            last_name: result.user.last_name,
            username: result.user.username,
            photo_url: result.user.photo_url,
            auth_date: Math.floor(Date.now() / 1000),
            hash: token, // Используем токен как hash
          };
          
          // Сохраняем пользователя
          localStorage.setItem("telegram_user", JSON.stringify(userData));
          setStatus("success");
          
          // Обновляем состояние на всех страницах через событие
          window.dispatchEvent(new Event("telegram-auth-success"));
          
          // Редирект на главную через 2 секунды (даём время событию обработаться)
          setTimeout(() => {
            // Сначала редирект, потом перезагрузка
            window.location.href = "/";
          }, 2000);
        } else {
          setStatus("error");
          setErrorMessage("Авторизация не удалась");
        }
      } catch (error: any) {
        console.error("Auth error:", error);
        setStatus("error");
        setErrorMessage(error.message || "Неизвестная ошибка");
      }
    };

    handleAuth();
  }, [searchParams, router]);

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-md">
        <Card>
          <CardContent className="pt-6 text-center">
            {status === "loading" && (
              <>
                <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Авторизация...</h2>
                <p className="text-gray-400">Проверка данных</p>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Успешная авторизация!</h2>
                <p className="text-gray-400 mb-4">Вы будете перенаправлены на главную страницу</p>
                <Link href="/">
                  <Button>Перейти на главную</Button>
                </Link>
              </>
            )}

            {status === "error" && (
              <>
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Ошибка авторизации</h2>
                <p className="text-gray-400 mb-4">{errorMessage}</p>
                <Link href="/">
                  <Button variant="outline">Вернуться на главную</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-md">
          <Card>
            <CardContent className="pt-6 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-400">Загрузка...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}

