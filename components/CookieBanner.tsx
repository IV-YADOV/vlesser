"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Проверяем, согласился ли пользователь с cookies
    const cookieConsent = localStorage.getItem("cookie_consent");
    if (!cookieConsent) {
      // Показываем баннер с небольшой задержкой
      setTimeout(() => {
        setShow(true);
      }, 1000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie_consent", "true");
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie_consent", "false");
    setShow(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <Card className="max-w-4xl mx-auto shadow-2xl border-gray-800 bg-[#1a1a1a]">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                    <Cookie className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    Мы используем cookies
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Мы используем cookies для улучшения работы сайта, сохранения ваших настроек и обеспечения безопасности. 
                    Продолжая использовать сайт, вы соглашаетесь с использованием cookies.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleAccept} size="sm">
                      Принять
                    </Button>
                    <Button onClick={handleDecline} variant="outline" size="sm">
                      Отклонить
                    </Button>
                  </div>
                </div>
                <button
                  onClick={handleDecline}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

