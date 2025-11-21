"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plan } from "@/types/database";
import { plans as defaultPlans } from "@/lib/plans";

export function usePlans() {
  const [planList, setPlanList] = useState<Plan[]>(defaultPlans);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false); // Защита от повторных запросов

  const loadPlans = useCallback(async () => {
    // Предотвращаем повторные запросы
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      const response = await fetch("/api/plans");
      const data = await response.json();

      if (response.ok && Array.isArray(data.plans)) {
        setPlanList(data.plans);
        setError(null);
      } else {
        setError(data.error || "Не удалось загрузить тарифы");
      }
    } catch (err) {
      console.error("Plans fetch error:", err);
      setError("Не удалось загрузить тарифы");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Убираем loadPlans из зависимостей, чтобы избежать повторных вызовов

  return {
    plans: planList,
    loading,
    error,
    refresh: loadPlans,
  };
}


