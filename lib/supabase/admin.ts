import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.warn("⚠️ SUPABASE_SERVICE_KEY или NEXT_PUBLIC_SUPABASE_URL не заданы. Админ-функции поддержки недоступны.");
}

export const supabaseAdmin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey)
  : null;

