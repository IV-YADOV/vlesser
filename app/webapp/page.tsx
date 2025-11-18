"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Copy, CheckCircle2, Loader2, Shield, Zap } from "lucide-react";
import { Plan } from "@/types/database";
import { usePlans } from "@/hooks/usePlans";
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}
export default function WebAppPage() {
  const { plans: planData } = usePlans();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState<"select" | "payment" | "success">("select");
  const [vlessLink, setVlessLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      if (tgUser) setUser(tgUser);
    }
  }, []);
  const handlePayment = async (planId: string) => {
    const plan = planData.find((p) => p.id === planId);
    if (!plan) return;
    setSelectedPlan(plan);
    setLoading(true);
    try {
      const userId = user?.id?.toString() || "tg_" + Date.now();
      const paymentRes = await fetch("/api/createPayment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, userId }) });
      const paymentData = await paymentRes.json();
      if (!paymentRes.ok) throw new Error(paymentData.error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const completeRes = await fetch("/api/completePayment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: paymentData.paymentId, userId }) });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error);
      setVlessLink(completeData.vlessLink);
      setStep("success");
    } catch (error) {
      console.error("Payment error:", error);
      alert("Ошибка при обработке платежа");
    } finally {
      setLoading(false);
    }
  };
  const copyToClipboard = async () => {
    if (!vlessLink) return;
    await navigator.clipboard.writeText(vlessLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (step === "success" && vlessLink) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-green-500" /></div>
            <h1 className="text-2xl font-bold mb-2">Оплата <span className="gradient-text">успешна!</span></h1>
            <p className="text-gray-400">Ваш VLESS конфиг готов</p>
          </div>
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-lg">Ваш VLESS конфиг</CardTitle><CardDescription>Скопируйте и импортируйте в приложение</CardDescription></CardHeader>
            <CardContent>
              <div className="bg-[#0a0a0a] rounded-lg p-3 mb-3 border border-gray-800"><code className="text-xs text-gray-300 break-all">{vlessLink}</code></div>
              <Button onClick={copyToClipboard} className="w-full" variant={copied ? "secondary" : "default"}>{copied ? (<><CheckCircle2 className="mr-2 w-4 h-4" />Скопировано!</>) : (<><Copy className="mr-2 w-4 h-4" />Скопировать конфиг</>)}</Button>
            </CardContent>
          </Card>
          <a href="/instructions"><Button variant="outline" className="w-full">Инструкция по подключению</Button></a>
        </motion.div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-4"><Shield className="w-8 h-8 text-white" /></div>
          <h1 className="text-3xl font-bold mb-2"><span className="gradient-text">VLESSer</span></h1>
          <p className="text-gray-400">Защищённый доступ за 30 секунд</p>
        </motion.div>
        <div className="space-y-4 mb-6">
          {planData.map((plan) => (
            <Card key={plan.id} className={`cursor-pointer transition-all ${selectedPlan?.id === plan.id ? "border-blue-500 bg-blue-500/10" : "hover:border-gray-700"}`} onClick={() => handlePayment(plan.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                    <p className="text-sm text-gray-400">{plan.duration} дней</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{plan.price}₽</div>
                    {loading && selectedPlan?.id === plan.id && <Loader2 className="w-5 h-5 animate-spin mx-auto mt-2" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/50">
            <CardContent className="p-4 text-center">
              <Zap className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-semibold">Высокая скорость</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/50">
            <CardContent className="p-4 text-center">
              <Shield className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-sm font-semibold">Безопасность</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

