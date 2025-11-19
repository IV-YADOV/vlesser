"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, ArrowLeft } from "lucide-react";
import { Plan } from "@/types/database";
import Link from "next/link";
import { TelegramUser, validateTelegramAuth, getUserIdFromTelegram } from "@/lib/auth";
import { usePlans } from "@/hooks/usePlans";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") || "premium";
  const { plans: planData } = usePlans();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [promocode, setPromocode] = useState("");
  const [promocodeValid, setPromocodeValid] = useState<{
    valid: boolean;
    discount?: number;
    finalAmount?: number;
    error?: string;
  } | null>(null);
  const [validatingPromocode, setValidatingPromocode] = useState(false);

  useEffect(() => {
    const plan = planData.find((p) => p.id === planId);
    setSelectedPlan(plan || null);
  }, [planData, planId]);

  useEffect(() => {
    // Загружаем и валидируем пользователя
    const loadAndValidateUser = async () => {
      const savedUser = localStorage.getItem("telegram_user");
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (validateTelegramAuth(parsed)) {
            const validationRes = await fetch("/api/validateTelegramAuth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed),
            });

            if (validationRes.ok) {
              setUser(parsed);
            } else {
              localStorage.removeItem("telegram_user");
            }
          }
        } catch {
          localStorage.removeItem("telegram_user");
        }
      }
      setCheckingAuth(false);
    };

    loadAndValidateUser();

    // Слушаем событие успешной авторизации
    const handleAuthSuccess = () => {
      loadAndValidateUser();
    };

    window.addEventListener("telegram-auth-success", handleAuthSuccess);
    return () => {
      window.removeEventListener("telegram-auth-success", handleAuthSuccess);
    };
  }, [planId]);

  const validatePromocode = async (code: string) => {
    if (!code || !selectedPlan) return;
    
    setValidatingPromocode(true);
    try {
      const res = await fetch("/api/promocodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, amount: selectedPlan.price }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setPromocodeValid({
          valid: true,
          discount: data.promocode?.discount ?? 0,
          finalAmount: data.promocode?.final_amount ?? selectedPlan.price,
        });
      } else {
        setPromocodeValid({
          valid: false,
          error: data.error || "Промокод недействителен",
        });
      }
    } catch (error) {
      setPromocodeValid({ valid: false, error: "Ошибка проверки промокода" });
    } finally {
      setValidatingPromocode(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedPlan || !user) {
      alert("Требуется авторизация для оформления заказа");
      return;
    }
    
    setLoading(true);
    try {
      const userId = getUserIdFromTelegram(user);
      
      // Создаем платеж и получаем URL для редиректа на Robokassa
      const paymentRes = await fetch("/api/createPayment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          planId: selectedPlan.id, 
          userId,
          promocode: promocodeValid?.valid ? promocode : undefined,
        }),
      });

      if (!paymentRes.ok) {
        const errorText = await paymentRes.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || "Unknown error" };
        }
        throw new Error(errorData.error || `HTTP ${paymentRes.status}`);
      }

      const paymentData = await paymentRes.json();
      
      if (!paymentData.paymentUrl) {
        throw new Error("Payment URL not received");
      }

      if (!paymentData.paymentId) {
        throw new Error("Payment ID not received");
      }

      // Сохраняем paymentId для дальнейшего использования
      setPaymentId(paymentData.paymentId);

      // Редирект на страницу оплаты Robokassa
      window.location.href = paymentData.paymentUrl;
    } catch (error: any) {
      console.error("Payment error:", error);
      alert("Ошибка при обработке платежа: " + (error.message || "Неизвестная ошибка"));
      setLoading(false);
    }
  };


  // Проверка авторизации
  if (checkingAuth) {
    return (
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  // Требуется авторизация
  if (!user) {
    return (
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-2xl">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-2xl mb-4">Требуется авторизация</CardTitle>
              <CardDescription>
                Для оформления заказа необходимо войти через Telegram
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Вернуться на главную
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link href="/pricing">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="mr-2 w-4 h-4" />
                Назад к тарифам
              </Button>
            </Link>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="gradient-text">Оформление заказа</span>
            </h1>
            <p className="text-xl text-gray-400">
              Выберите тариф и завершите покупку
            </p>
          </motion.div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Выберите тариф</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {planData.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedPlan?.id === plan.id
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-semibold mb-1">
                              {plan.name}
                            </h3>
                            <p className="text-gray-400">
                              {plan.duration} дней доступа
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              {plan.price}₽
                            </div>
                            {selectedPlan?.id === plan.id && (
                              <Check className="w-5 h-5 text-blue-500 mx-auto mt-2" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              {selectedPlan && (
                <Card>
                  <CardHeader>
                    <CardTitle>Что вы получите</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {selectedPlan.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-center space-x-2"
                        >
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
            <div>
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Итого</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedPlan ? (
                    <>
                      <div className="space-y-4 mb-6">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Тариф</span>
                          <span className="font-semibold">
                            {selectedPlan.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Срок</span>
                          <span>{selectedPlan.duration} дней</span>
                        </div>
                        <div className="border-t border-gray-800 pt-4 space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Стоимость</span>
                            <span>{selectedPlan.price}₽</span>
                          </div>
                          {promocodeValid?.valid && promocodeValid.discount && (
                            <div className="flex justify-between text-green-500">
                              <span>Скидка</span>
                              <span>-{promocodeValid.discount.toFixed(2)}₽</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-800">
                            <span>К оплате</span>
                            <span className="gradient-text">
                              {promocodeValid?.valid && promocodeValid.finalAmount
                                ? promocodeValid.finalAmount.toFixed(2)
                                : selectedPlan.price}₽
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Промокод"
                            value={promocode}
                            onChange={(e) => {
                              setPromocode(e.target.value.toUpperCase());
                              setPromocodeValid(null);
                            }}
                            onBlur={() => {
                              if (promocode) {
                                validatePromocode(promocode);
                              }
                            }}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (promocode) {
                                validatePromocode(promocode);
                              }
                            }}
                            disabled={validatingPromocode || !promocode}
                          >
                            {validatingPromocode ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Применить"
                            )}
                          </Button>
                        </div>
                        {promocodeValid && (
                          <p
                            className={`text-xs mt-2 ${
                              promocodeValid.valid
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {promocodeValid.valid
                              ? `Промокод применен! Скидка: ${promocodeValid.discount?.toFixed(2)}₽`
                              : promocodeValid.error || "Промокод недействителен"}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={handlePayment}
                        disabled={loading}
                        className="w-full"
                        size="lg"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                            Обработка...
                          </>
                        ) : (
                          "Оплатить"
                        )}
                      </Button>
                      <p className="text-xs text-gray-500 text-center mt-4">
                        Оплата обрабатывается безопасно
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-400 text-center">
                      Выберите тариф для продолжения
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Загрузка...</p>
          </div>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

