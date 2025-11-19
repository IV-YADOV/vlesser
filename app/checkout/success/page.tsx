"use client";
import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, Loader2 } from "lucide-react";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const paymentIdParam = searchParams.get("payment_id"); // Это InvId от Robokassa
  const amountParam = searchParams.get("amount");
  const [vlessLink, setVlessLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const paymentIdRef = useRef<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let checkCount = 0;
    // В production увеличиваем время ожидания до 5 минут (150 проверок по 2 секунды)
    // Callback от Robokassa может приходить с задержкой
    const maxChecks = 150; // 150 проверок по 2 секунды = 5 минут максимум
    let isStopped = false;

    const checkPaymentStatus = async () => {
      if (isStopped || checkCount >= maxChecks) {
        if (intervalId) {
          clearInterval(intervalId);
        }
        if (checkCount >= maxChecks) {
          console.warn("⚠️ Max checks reached, stopping polling");
          setLoading(false);
        }
        return;
      }

      checkCount++;
      console.log(`🔍 Checking payment status (attempt ${checkCount}/${maxChecks})`);

      try {
        let res: Response;
        const currentPaymentId = paymentIdRef.current;
        
        // Если есть paymentId (UUID), ищем по нему
        if (currentPaymentId) {
          console.log(`🔍 Searching by paymentId: ${currentPaymentId}`);
          res = await fetch(`/api/payments?paymentId=${currentPaymentId}`);
        } 
        // Если есть amount, ищем по сумме
        else if (amountParam) {
          console.log(`🔍 Searching by amount: ${amountParam}`);
          res = await fetch(`/api/payments?amount=${amountParam}`);
        } 
        else {
          console.warn("⚠️ No paymentId or amount provided, stopping");
          setLoading(false);
          isStopped = true;
          if (intervalId) {
            clearInterval(intervalId);
          }
          return;
        }

        if (!res) {
          console.error("❌ No response from API");
          return;
        }

        if (res.ok) {
          const data = await res.json();
          
          console.log("📋 Payment data:", {
            paymentId: data.payment?.id,
            status: data.payment?.status,
            hasSubscription: !!data.subscription,
            hasVlessLink: !!data.subscription?.vless_link,
          });
          
          // Сохраняем paymentId для следующих проверок
          if (data.payment?.id && !paymentIdRef.current) {
            paymentIdRef.current = data.payment.id;
            console.log(`✅ Saved paymentId: ${data.payment.id}`);
          }

          // Если платеж найден, но еще pending - продолжаем ждать callback от Robokassa
          // В production режиме мы полагаемся только на callback (ResultURL) от Robokassa
          if (data.payment?.status === "pending") {
            const createdAt = new Date(data.payment.created_at);
            const now = new Date();
            const minutesPassed = (now.getTime() - createdAt.getTime()) / (1000 * 60);
            
            console.log(`⏳ Payment still pending, waiting for Robokassa callback... (${minutesPassed.toFixed(1)} minutes passed)`);
            
            // В production: если платеж pending очень долго (более 5 минут), показываем сообщение
            if (minutesPassed >= 5) {
              console.warn(`⚠️ Payment pending for ${minutesPassed.toFixed(1)} minutes - callback may be delayed or failed`);
              // Не останавливаемся, продолжаем ждать callback - возможно он все еще придет
            }
            
            return;
          }

          // Если платеж failed - останавливаемся
          if (data.payment?.status === "failed") {
            console.error("❌ Payment failed, stopping");
            setLoading(false);
            isStopped = true;
            if (intervalId) {
              clearInterval(intervalId);
            }
            return;
          }

          if (data.payment?.status === "completed") {
            // Если подписка уже есть, показываем VLESS
            // ВАЖНО: Подписка создается автоматически через callback от Robokassa (ResultURL)
            // Мы просто ждем, пока она появится в БД после обработки callback
            if (data.subscription?.vless_link) {
              console.log("✅ Subscription found with VLESS link");
              setVlessLink(data.subscription.vless_link);
              setLoading(false);
              isStopped = true;
              if (intervalId) {
                clearInterval(intervalId);
              }
              return;
            }

            // Платеж completed, но подписки еще нет - ждем callback от Robokassa
            // Callback автоматически создаст подписку и xray клиента
            const createdAt = new Date(data.payment.created_at);
            const now = new Date();
            const secondsPassed = (now.getTime() - createdAt.getTime()) / 1000;
            
            console.log(`⏳ Payment completed, waiting for Robokassa callback to create subscription... (${secondsPassed.toFixed(0)}s passed)`);
            
            // В production: если платеж completed очень долго (более 2 минут), но подписки нет,
            // возможно callback не пришел - продолжаем ждать, но предупреждаем
            if (secondsPassed >= 120) {
              console.warn(`⚠️ Payment completed ${secondsPassed.toFixed(0)}s ago, but subscription not created yet. Callback may be delayed.`);
              // Продолжаем ждать - callback может прийти позже
            }
            
            // Не вызываем completePayment - это делает только callback от Robokassa
            // Просто продолжаем polling и ждем, пока подписка появится в БД
          }
        } else {
          // Если 404 - платеж еще не найден, продолжаем проверки
          if (res.status === 404) {
            console.log(`⏳ Payment not found yet (404), waiting... (attempt ${checkCount})`);
            // Если после 20 попыток все еще 404, останавливаемся
            if (checkCount >= 20) {
              console.error("❌ Payment not found after 20 attempts, stopping");
              setLoading(false);
              isStopped = true;
              if (intervalId) {
                clearInterval(intervalId);
              }
            }
            return;
          }
          // Другие ошибки
          const errorText = await res.text().catch(() => "Unknown error");
          console.error(`❌ API error: ${res.status} - ${errorText}`);
          
          // Если слишком много ошибок, останавливаемся
          if (checkCount >= 10) {
            console.error("❌ Too many errors, stopping");
            setLoading(false);
            isStopped = true;
            if (intervalId) {
              clearInterval(intervalId);
            }
          }
        }
      } catch (error) {
        console.error("❌ Error fetching payment data:", error);
        // Продолжаем проверки, но останавливаемся после слишком большого количества ошибок
        if (checkCount >= 10) {
          console.error("❌ Too many errors, stopping");
          setLoading(false);
          isStopped = true;
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      }
    };

    // Первая проверка сразу
    checkPaymentStatus();

    // Затем проверяем каждые 2 секунды
    intervalId = setInterval(() => {
      checkPaymentStatus();
    }, 2000);

    // Очистка при размонтировании
    return () => {
      isStopped = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [paymentIdParam, amountParam]);

  const copyToClipboard = async () => {
    if (!vlessLink) return;
    await navigator.clipboard.writeText(vlessLink);
    // Показываем уведомление о копировании
    alert("Конфиг скопирован в буфер обмена!");
  };

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-2xl">
        {loading ? (
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">Обработка платежа...</p>
            <p className="text-sm text-gray-500 mb-2">
              Ожидание подтверждения от Robokassa и создание VLESS конфига
            </p>
            <p className="text-xs text-gray-600">
              Это может занять несколько секунд. Пожалуйста, подождите...
            </p>
          </div>
        ) : vlessLink ? (
          <>
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-4xl font-bold mb-4">
                Оплата <span className="gradient-text">успешна!</span>
              </h1>
              <p className="text-xl text-gray-400">
                Ваш VLESS конфиг готов к использованию
              </p>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Ваш VLESS конфиг</CardTitle>
                <CardDescription>
                  Скопируйте эту ссылку и импортируйте в приложение
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0a0a0a] rounded-lg p-4 mb-4 border border-gray-800">
                  <code className="text-sm text-gray-300 break-all">
                    {vlessLink}
                  </code>
                </div>
                <Button
                  onClick={copyToClipboard}
                  className="w-full"
                >
                  <Copy className="mr-2 w-4 h-4" />
                  Скопировать конфиг
                </Button>
              </CardContent>
            </Card>

            <div className="text-center space-y-4">
              <Link href="/instructions">
                <Button variant="outline" className="w-full">
                  Как подключить? Смотрите инструкцию
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" className="w-full">
                  Перейти в профиль
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" className="w-full">
                  Вернуться на главную
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <Card className="text-center">
            <CardHeader>
              <CardTitle>Оплата успешна!</CardTitle>
              <CardDescription>
                Ожидание подтверждения от Robokassa. Ваш конфиг будет доступен в профиле после обработки платежа.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Обработка платежа может занять несколько минут. Конфиг появится в вашем профиле автоматически после подтверждения от Robokassa.
              </p>
              <Link href="/profile">
                <Button className="w-full">Перейти в профиль</Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" className="w-full">
                  Вернуться на главную
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-2xl text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Загрузка...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

