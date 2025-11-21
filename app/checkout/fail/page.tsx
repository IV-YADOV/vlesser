"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, AlertCircle } from "lucide-react";
import Link from "next/link";

function FailContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id");
  const error = searchParams.get("error") || "Платеж не был завершен";
  const [statusUpdated, setStatusUpdated] = useState(false);

  // Обновляем статус платежа при загрузке страницы, если он еще pending
  useEffect(() => {
    const updatePaymentStatus = async () => {
      if (paymentId && !statusUpdated) {
        try {
          // Проверяем статус платежа через API
          const res = await fetch(`/api/payments?paymentId=${paymentId}`);
          
          if (res.ok) {
            const data = await res.json();
            const paymentStatus = data.payment?.status || data.status;
            
            // Если платеж все еще pending - обновляем на failed через API
            if (paymentStatus === "pending") {
              console.log(`🔄 Updating payment ${paymentId} status from pending to failed`);
              
              try {
                // Обновляем статус через API
                const updateRes = await fetch("/api/payments/cancel", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ paymentId }),
                });
                
              if (updateRes.ok) {
                const updateData = await updateRes.json();
                console.log(`✅ Payment status updated to failed:`, updateData);
                } else {
                  // Пытаемся получить текст ошибки
                  let errorText = "";
                  try {
                    const errorData = await updateRes.json();
                    errorText = errorData.error || errorData.details || JSON.stringify(errorData);
                  } catch {
                    errorText = await updateRes.text().catch(() => `HTTP ${updateRes.status}`);
                  }
                  console.warn("⚠️ Failed to update payment status:", {
                    status: updateRes.status,
                    error: errorText,
                  });
                  // Не критично, продолжаем работу
                }
              } catch (fetchError: any) {
                console.warn("⚠️ Error calling cancel API:", fetchError.message);
                // Не критично, продолжаем работу
              }
            } else {
              console.log(`ℹ️ Payment ${paymentId} already has status: ${paymentStatus}, no update needed`);
            }
          } else {
            console.warn("⚠️ Failed to fetch payment status:", res.status);
          }
        } catch (error: any) {
          console.warn("⚠️ Error updating payment status:", error.message);
          // Продолжаем, даже если не удалось обновить
        } finally {
          setStatusUpdated(true);
        }
      }
    };
    
    updatePaymentStatus();
  }, [paymentId, statusUpdated]);

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Оплата <span className="text-red-500">не завершена</span>
          </h1>
          <p className="text-xl text-gray-400 mb-4">
            {error}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Платеж не был завершен</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-300">
                  <p className="font-medium mb-2 text-blue-400">Если вы уже оплатили:</p>
                  <p className="text-gray-300 mb-2">
                    Если вы завершили оплату на странице ЮKassa, но видите это сообщение, 
                    пожалуйста, обратитесь в поддержку через Telegram-бота.
                  </p>
                  {paymentId && (
                    <p className="text-gray-400 text-xs mt-2">
                      При обращении укажите ID платежа: <code className="bg-gray-800 px-2 py-1 rounded">{paymentId}</code>
                    </p>
                  )}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-sm text-gray-400 mb-3">Если оплата не была завершена:</p>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Оплата была отменена</li>
                  <li>• Оплата не была завершена</li>
                  <li>• Вы можете попробовать оплатить снова</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-4">
          <a 
            href="https://t.me/support" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block w-full"
          >
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Обратиться в поддержку
            </Button>
          </a>
          <Link href="/checkout">
            <Button variant="outline" className="w-full">
              Попробовать снова
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="w-full">
              Вернуться на главную
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-2xl text-center">
          <p className="text-gray-400">Загрузка...</p>
        </div>
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}




