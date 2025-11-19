"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import Link from "next/link";

function FailContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Платеж не был завершен";

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Оплата <span className="text-red-500">не удалась</span>
          </h1>
          <p className="text-xl text-gray-400">
            {error}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Что делать дальше?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-gray-300">
              <li>• Проверьте данные платежной карты</li>
              <li>• Убедитесь, что на карте достаточно средств</li>
              <li>• Попробуйте другой способ оплаты</li>
              <li>• Если проблема сохраняется, обратитесь в поддержку</li>
            </ul>
          </CardContent>
        </Card>

        <div className="text-center space-y-4">
          <Link href="/checkout">
            <Button className="w-full">Попробовать снова</Button>
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


