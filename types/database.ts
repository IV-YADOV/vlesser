export type User = {
  id: string;
  tg_id: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan: "start" | "premium" | "unlimited";
  expires_at: string;
  vless_link: string;
  created_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  amount: number;
  plan: "start" | "premium" | "unlimited";
  status: "pending" | "completed" | "failed";
  created_at: string;
};

export type Plan = {
  id: "start" | "premium" | "unlimited";
  name: string;
  price: number;
  duration: number; // days
  features: string[];
  popular?: boolean;
};

