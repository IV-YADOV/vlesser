"use client";
import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { TelegramUser, validateTelegramAuth } from "@/lib/auth";

function SuccessContent() {
  const searchParams = useSearchParams();
  const paymentIdParam = searchParams.get("payment_id"); // Это наш внутренний ID платежа
  const amountParam = searchParams.get("amount");
  const [vlessLink, setVlessLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const paymentIdRef = useRef<string | null>(null);
  const [userData, setUserData] = useState<TelegramUser | null>(null);

  // Загружаем userData из localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("telegram_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (validateTelegramAuth(parsed)) {
          setUserData(parsed);
        }
      } catch {
        // Игнорируем ошибки парсинга
      }
    }
  }, []);

  useEffect(() => {
    // Инициализируем paymentId из параметра URL
    if (paymentIdParam && !paymentIdRef.current) {
      paymentIdRef.current = paymentIdParam;
      console.log(`✅ Initialized paymentId from URL: ${paymentIdParam}`);
    }

    let intervalId: NodeJS.Timeout | null = null;
    let checkCount = 0;
    // В production время ожидания:
    // - 60 проверок для pending платежей (2 минуты) - если пользователь не оплатил
    // - 150 проверок для processing платежей (5 минут) - если платеж обрабатывается
    const maxChecksPending = 60; // 60 проверок по 2 секунды = 2 минуты для pending
    const maxChecksProcessing = 150; // 150 проверок по 2 секунды = 5 минут для processing
    let maxChecks = maxChecksPending;
    let isStopped = false;
    let pendingStartTime = Date.now(); // Время начала ожидания pending платежа

    const checkPaymentStatus = async (forceYooKassaCheck: boolean = false) => {
      // Останавливаемся если достигли лимита проверок или остановка запрошена
      if (isStopped || checkCount >= maxChecks) {
        if (intervalId) {
          clearInterval(intervalId);
        }
        if (checkCount >= maxChecks && !isStopped) {
          const timePassed = (Date.now() - pendingStartTime) / 1000 / 60;
          console.warn(`⚠️ Max checks reached (${checkCount}), stopping polling after ${timePassed.toFixed(1)} minutes`);
          
          // Если прошло много времени и платеж все еще pending, значит пользователь не оплатил
          setLoading(false);
        }
        return;
      }

      checkCount++;
      
      // Определяем, нужно ли проверять через YooKassa API:
      // 1. При первой проверке
      // 2. Принудительно, если указано forceYooKassaCheck
      // 3. Каждые 5 проверок (каждые 10 секунд)
      // 4. Если платеж в pending более 30 секунд
      const shouldCheckYooKassa = forceYooKassaCheck || 
        checkCount === 1 || 
        checkCount % 5 === 0;
      
      console.log(`🔍 Checking payment status (attempt ${checkCount}/${maxChecks}, useYooKassaCheck: ${shouldCheckYooKassa})`);

      try {
        let res: Response;
        const currentPaymentId = paymentIdRef.current || paymentIdParam;
        
        if (!currentPaymentId) {
          console.warn("⚠️ No paymentId available, stopping");
          setLoading(false);
          isStopped = true;
          if (intervalId) {
            clearInterval(intervalId);
          }
          return;
        }

        // Проверяем через ЮKassa API, если нужно
        // ВАЖНО: Для проверки статуса требуется авторизация
        if (shouldCheckYooKassa) {
          if (!userData) {
            console.warn("⚠️ User data not available, skipping YooKassa status check");
            // Пропускаем проверку через YooKassa, если нет авторизации
            res = await fetch(`/api/payments?paymentId=${currentPaymentId}`);
          } else {
            console.log(`🔄 Checking payment status via YooKassa API: ${currentPaymentId}`);
            res = await fetch("/api/payment/checkStatus", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId: currentPaymentId, userData }),
            });
          }
        } else {
          // Обычная проверка через наш API
          // Если есть userData, передаем его в query параметре
          const userDataParam = userData ? `&userData=${encodeURIComponent(JSON.stringify(userData))}` : "";
          console.log(`🔍 Searching by paymentId: ${currentPaymentId}`);
          res = await fetch(`/api/payments?paymentId=${currentPaymentId}${userDataParam}`);
        }

        if (!res) {
          console.error("❌ No response from API");
          return;
        }

        if (res.ok) {
          const data = await res.json();
          
          console.log("📋 Payment data:", {
            paymentId: data.payment?.id,
            status: data.payment?.status || data.status,
            hasSubscription: !!data.subscription,
            hasVlessLink: !!data.subscription?.vless_link,
            yooKassaStatus: data.yooKassaStatus,
            message: data.message,
          });
          
          // Сохраняем paymentId для следующих проверок
          const paymentId = data.payment?.id || currentPaymentId;
          if (paymentId && !paymentIdRef.current) {
            paymentIdRef.current = paymentId;
            console.log(`✅ Saved paymentId: ${paymentId}`);
          }

          // Определяем статус платежа
          // ВАЖНО: Приоритет отдается статусу от YooKassa API, если он есть
          const yooKassaStatus = data.yooKassaStatus;
          const paymentStatus = data.status || data.payment?.status;
          const payment = data.payment || data;

          // Если есть статус от YooKassa, используем его для принятия решений
          // Статус "succeeded" или "waiting_for_capture" от YooKassa означает успешную оплату
          const isYooKassaSucceeded = yooKassaStatus === "succeeded" || yooKassaStatus === "waiting_for_capture";
          const isLocalCompleted = paymentStatus === "completed";

          console.log("🔍 Payment status analysis:", {
            yooKassaStatus,
            localStatus: paymentStatus,
            isYooKassaSucceeded,
            isLocalCompleted,
            message: data.message,
          });

          // Если YooKassa говорит, что платеж succeeded/waiting_for_capture, но локальный статус pending
          // Это означает, что платеж оплачен, но статус еще не обновился в БД
          // В этом случае принудительно вызываем checkStatus, чтобы обновить статус и создать подписку
          if (isYooKassaSucceeded && !isLocalCompleted) {
            console.log(`✅ YooKassa reports payment succeeded (${yooKassaStatus}), but local status is ${paymentStatus}`);
            console.log(`🔄 Forcing status check to update payment and create subscription...`);
            
            // Увеличиваем лимит проверок для processing платежей
            maxChecks = maxChecksProcessing;
            
            // Если это не была проверка через YooKassa API, делаем ее
            if (!shouldCheckYooKassa) {
              return checkPaymentStatus(true);
            }
            
            // Если уже проверяли через YooKassa, но статус не обновился - продолжаем ждать
            // Это может занять несколько секунд (webhook обрабатывается асинхронно)
            const createdAt = new Date(payment?.created_at || new Date());
            const now = new Date();
            const secondsPassed = (now.getTime() - createdAt.getTime()) / 1000;
            
            // Даем до 5 минут для обработки webhook и обновления статуса
            if (secondsPassed < 300) {
              console.log(`⏳ Waiting for payment status to update in DB (${secondsPassed.toFixed(0)}s passed)...`);
              console.log(`📝 Webhook may be processing, will wait up to 5 minutes`);
              return;
            } else {
              console.warn(`⚠️ Payment succeeded in YooKassa but status not updated in DB after ${(secondsPassed/60).toFixed(1)} minutes`);
              // Если прошло много времени - возможно webhook не дошел, но платеж успешен
              // Продолжаем ждать, но показываем предупреждение
            }
          }

          // Если платеж найден, но еще pending - перенаправляем на fail страницу
          // Пользователь не завершил оплату, не нужно ждать
          if (paymentStatus === "pending" && !isYooKassaSucceeded) {
            console.log(`⏳ Payment is pending, redirecting to fail page`);
            
            // Останавливаем polling
            setLoading(false);
            isStopped = true;
            if (intervalId) {
              clearInterval(intervalId);
            }
            
            // Перенаправляем на fail страницу
            const currentPaymentId = payment?.id || paymentIdRef.current || paymentIdParam;
            if (currentPaymentId) {
              window.location.href = `/checkout/fail?payment_id=${currentPaymentId}&error=Платеж не был завершен`;
            } else {
              window.location.href = `/checkout/fail?error=Платеж не был завершен`;
            }
            return;
          }
          
          // Если платеж обрабатывается (succeeded в YooKassa, но еще не completed локально) - даем больше времени
          if (isYooKassaSucceeded && !isLocalCompleted) {
            maxChecks = maxChecksProcessing;
          }

          // Если платеж failed - останавливаемся
          if (paymentStatus === "failed") {
            console.error("❌ Payment failed, stopping");
            setLoading(false);
            isStopped = true;
            if (intervalId) {
              clearInterval(intervalId);
            }
            return;
          }

          // Если платеж completed - проверяем подписку
          if (paymentStatus === "completed") {
            // Если подписка уже есть, показываем VLESS
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

            // Платеж completed, но подписки еще нет
            // Если это первая проверка через ЮKassa API, подписка может создаваться
            // Продолжаем проверки, чтобы дождаться подписки
            const createdAt = new Date(payment?.created_at || new Date());
            const now = new Date();
            const secondsPassed = (now.getTime() - createdAt.getTime()) / 1000;
            
            console.log(`⏳ Payment completed, waiting for subscription... (${secondsPassed.toFixed(0)}s passed)`);
            
            // Если прошло более 30 секунд и подписки все еще нет, продолжаем polling
            // (подписка создается через completePayment при проверке через ЮKassa API)
            if (secondsPassed >= 30 && checkCount > 3) {
              console.warn(`⚠️ Payment completed ${secondsPassed.toFixed(0)}s ago, but subscription not created yet.`);
            }
            
            // Продолжаем polling, чтобы дождаться подписки
            return;
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

    // Первая проверка сразу через ЮKassa API для быстрой проверки статуса
    checkPaymentStatus(true);

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
  }, [paymentIdParam, amountParam, userData]);

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
              Ожидание подтверждения от ЮKassa и создание VLESS конфига
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
        ) : null}
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

