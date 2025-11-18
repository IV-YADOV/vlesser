"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Copy, CheckCircle2, Calendar, Key, ArrowLeft, LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { TelegramUser, validateTelegramAuth, getUserIdFromTelegram } from "@/lib/auth";

interface Subscription {
  id: string;
  plan: string;
  expires_at: string;
  vless_link: string;
  created_at: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const savedUser = localStorage.getItem("telegram_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (validateTelegramAuth(parsed)) {
          setUser(parsed);
          loadSubscriptions(parsed);
        } else {
          setLoading(false);
        }
      } catch {
        localStorage.removeItem("telegram_user");
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const loadSubscriptions = async (userData: TelegramUser) => {
    try {
      // Валидируем через API
      const validationRes = await fetch("/api/validateTelegramAuth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      if (!validationRes.ok) {
        localStorage.removeItem("telegram_user");
        setUser(null);
        setLoading(false);
        return;
      }

      const userId = getUserIdFromTelegram(userData);
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading subscriptions:", error);
      } else {
        setSubscriptions(data || []);
      }
    } catch (error) {
      console.error("Error loading subscriptions:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-2xl">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-2xl mb-4">Требуется авторизация</CardTitle>
              <CardDescription>
                Для просмотра профиля необходимо войти через Telegram
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
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="mr-2 w-4 h-4" />
                На главную
              </Button>
            </Link>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="gradient-text">Мой профиль</span>
            </h1>
            <div className="flex items-center space-x-4 mb-6">
              {user.photo_url && (
                <img
                  src={user.photo_url}
                  alt={user.first_name}
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <h2 className="text-2xl font-semibold">
                  {user.first_name} {user.last_name || ""}
                </h2>
                {user.username && (
                  <p className="text-gray-400">@{user.username}</p>
                )}
              </div>
            </div>
          </motion.div>

          {subscriptions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Key className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Нет активных подписок</h3>
                <p className="text-gray-400 mb-6">
                  Купите тариф, чтобы получить доступ к VPN
                </p>
                <Link href="/pricing">
                  <Button>Выбрать тариф</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold mb-4">Мои подписки</h3>
              {subscriptions.map((subscription) => {
                const isExpired = new Date(subscription.expires_at) < new Date();
                return (
                  <motion.div
                    key={subscription.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={isExpired ? "opacity-60" : ""}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl capitalize">
                            {subscription.plan}
                          </CardTitle>
                          {isExpired ? (
                            <span className="text-red-500 text-sm font-semibold">
                              Истекла
                            </span>
                          ) : (
                            <span className="text-green-500 text-sm font-semibold flex items-center">
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Активна
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2 text-gray-400">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Действует до:{" "}
                              {format(new Date(subscription.expires_at), "dd.MM.yyyy")}
                            </span>
                          </div>
                          <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400">VLESS конфиг:</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(subscription.vless_link, subscription.id)
                                }
                              >
                                {copied === subscription.id ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                                    Скопировано
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Копировать
                                  </>
                                )}
                              </Button>
                            </div>
                            <code className="text-xs text-gray-300 break-all block">
                              {subscription.vless_link}
                            </code>
                          </div>
                          <Link href="/instructions">
                            <Button variant="outline" className="w-full">
                              Как подключить?
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
          
          <div className="mt-12 pt-8 border-t border-gray-900">
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                localStorage.removeItem("telegram_user");
                window.location.href = "/";
              }}
              className="w-full bg-red-600/10 border-red-600/50 text-red-400 hover:bg-red-600/20 hover:border-red-600 hover:text-red-300"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Выйти из аккаунта
            </Button>
          </div>
        </div>
    </div>
  );
}

