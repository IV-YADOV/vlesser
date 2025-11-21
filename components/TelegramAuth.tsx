"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TelegramUser, validateTelegramAuth } from "@/lib/auth";
import { LogIn, User } from "lucide-react";
import Link from "next/link";

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

interface TelegramAuthProps {
  onLinkClick?: () => void; // Callback для закрытия меню при клике на ссылку
}

export function TelegramAuth({ onLinkClick }: TelegramAuthProps) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [loading, setLoading] = useState(true);
  const validatingRef = useRef(false); // Защита от повторных запросов валидации

  // Функция проверки пользователя
  const checkSavedUser = async (skipValidation = false) => {
    const savedUser = localStorage.getItem("telegram_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (validateTelegramAuth(parsed)) {
          // Сначала устанавливаем пользователя для мгновенного отображения
          setUser(parsed);
          setLoading(false);
          
          // Если skipValidation = true, пропускаем API валидацию (для быстрого отображения)
          if (skipValidation) {
            return;
          }
          
          // Предотвращаем повторные запросы валидации
          if (validatingRef.current) return;
          
          // Затем валидируем через API в фоне (только если не пропущено)
          try {
            validatingRef.current = true;
            const validationRes = await fetch("/api/validateTelegramAuth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed),
            });

            if (validationRes.ok) {
              const result = await validationRes.json();
              if (!result.valid) {
                // Если валидация не прошла, удаляем данные
                localStorage.removeItem("telegram_user");
                setUser(null);
              }
            } else {
              // Если ошибка валидации, удаляем данные
              localStorage.removeItem("telegram_user");
              setUser(null);
            }
          } catch (error) {
            console.error("Validation error:", error);
            // При ошибке оставляем пользователя (может быть временная проблема с сетью)
          } finally {
            validatingRef.current = false;
          }
        } else {
          localStorage.removeItem("telegram_user");
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        console.error("Parse error:", error);
        localStorage.removeItem("telegram_user");
        setUser(null);
        setLoading(false);
      }
    } else {
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    // При первом монтировании проверяем быстро (без API валидации для мгновенного отображения)
    // Затем делаем полную валидацию в фоне
    const savedUser = localStorage.getItem("telegram_user");
    if (savedUser) {
      // Быстрая проверка без API для мгновенного отображения
      checkSavedUser(true);
      // Полная валидация в фоне (с небольшой задержкой, чтобы не блокировать UI)
      // Используем requestIdleCallback если доступен, иначе setTimeout
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        requestIdleCallback(() => checkSavedUser(false), { timeout: 500 });
      } else {
        setTimeout(() => checkSavedUser(false), 100);
      }
    } else {
      checkSavedUser(false);
    }

    // Слушаем событие успешной авторизации
    const handleAuthSuccess = () => {
      checkSavedUser(false);
    };

    window.addEventListener("telegram-auth-success", handleAuthSuccess);
    
    // Также слушаем storage события (на случай если данные сохранены в другой вкладке)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "telegram_user") {
        checkSavedUser(false);
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      window.removeEventListener("telegram-auth-success", handleAuthSuccess);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const handleLogin = async () => {
    try {
      // Генерируем уникальный токен для авторизации
      const response = await fetch("/api/generateAuthToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert("Ошибка при создании токена авторизации: " + (errorData.error || "Неизвестная ошибка"));
        return;
      }

      const { token } = await response.json();
      
      if (!token) {
        alert("Не удалось получить токен авторизации");
        return;
      }
      
      // Открываем бота в Telegram с токеном
      const botUsername = "vpn_securebot";
      const telegramUrl = `https://t.me/${botUsername}?start=${token}`;
      
      // Для мобильных устройств используем прямой переход
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        // Пытаемся открыть через tg:// протокол для нативного приложения
        const tgProtocolUrl = `tg://resolve?domain=${botUsername}&start=${token}`;
        
        // Сначала пытаемся открыть через tg://
        const fallback = setTimeout(() => {
          // Если через 500мс не открылось, открываем через https
          window.location.href = telegramUrl;
        }, 500);
        
        // Пытаемся открыть через tg://
        window.location.href = tgProtocolUrl;
        
        // Отменяем fallback если открылось
        setTimeout(() => clearTimeout(fallback), 1000);
      } else {
        // Для десктопа открываем в новой вкладке
        window.open(telegramUrl, "_blank");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Ошибка при авторизации. Проверьте консоль для деталей.");
    }
  };

  const saveUserToSupabase = async (userData: TelegramUser) => {
    try {
      // Сохранение пользователя теперь происходит в боте
      // Эта функция оставлена для обратной совместимости, но не используется
      // Можно удалить в будущем
    } catch (error) {
      console.error("Error saving user to Supabase:", error);
    }
  };

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <LogIn className="w-4 h-4 mr-2" />
        Загрузка...
      </Button>
    );
  }

  if (user) {
    return (
      <Link 
        href="/profile"
        onClick={onLinkClick}
      >
        <Button variant="ghost" size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500">
          <User className="w-4 h-4 mr-2" />
          Профиль
        </Button>
      </Link>
    );
  }

  return (
    <Button variant="default" size="sm" onClick={handleLogin}>
      <LogIn className="w-4 h-4 mr-2" />
      Войти через Telegram
    </Button>
  );
}

