import { Plan } from "@/types/database";

export const plans: Plan[] = [
  {
    id: "start",
    name: "Старт",
    price: 99,
    duration: 30,
    features: [
      "30 дней доступа",
      "Неограниченный трафик",
      "Высокая скорость",
      "Поддержка 24/7",
    ],
  },
  {
    id: "premium",
    name: "Премиум",
    price: 199,
    duration: 90,
    features: [
      "90 дней доступа",
      "Неограниченный трафик",
      "Максимальная скорость",
      "Приоритетная поддержка",
      "Резервные серверы",
    ],
    popular: true,
  },
  {
    id: "unlimited",
    name: "Безлимит",
    price: 599,
    duration: 365,
    features: [
      "365 дней доступа",
      "Неограниченный трафик",
      "Максимальная скорость",
      "VIP поддержка",
      "Резервные серверы",
      "Персональный менеджер",
    ],
  },
];

export function getPlanById(id: string): Plan | undefined {
  return plans.find((plan) => plan.id === id);
}

