"use client";

import { useEffect } from "react";

export function RobokassaMeta() {
  useEffect(() => {
    // Проверяем, не добавлен ли уже тег
    const existingMeta = document.querySelector('meta[name="selfwork.ru"]');
    if (existingMeta) {
      return;
    }

    // Создаем и добавляем meta-тег
    const meta = document.createElement("meta");
    meta.setAttribute("name", "selfwork.ru");
    meta.setAttribute("content", "Ys4Tjtcwr53LsDgCxwKDnD5UwkEzXwMHZKmKf3xoF46Nv9tORr");
    
    // Добавляем перед закрывающим </head>
    const head = document.head;
    head.appendChild(meta);

    // Cleanup при размонтировании
    return () => {
      const metaToRemove = document.querySelector('meta[name="selfwork.ru"]');
      if (metaToRemove) {
        metaToRemove.remove();
      }
    };
  }, []);

  return null;
}


