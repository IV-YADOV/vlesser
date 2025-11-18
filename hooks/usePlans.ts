"use client";

import { useEffect, useState, useCallback } from "react";
import { Plan } from "@/types/database";
import { plans as defaultPlans } from "@/lib/plans";

export function usePlans() {
  const [planList, setPlanList] = useState<Plan[]>(defaultPlans);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    try {
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
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  return {
    plans: planList,
    loading,
    error,
    refresh: loadPlans,
  };
}


