import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plans } from "@/lib/plans";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plan_settings")
      .select("plan_id, price");

    if (error) {
      console.warn("plan_settings fetch error:", error.message);
    }

    const overrideMap = new Map<string, number>();
    data?.forEach((plan) => {
      if (plan.plan_id && typeof plan.price === "number") {
        overrideMap.set(plan.plan_id, Number(plan.price));
      }
    });

    const mergedPlans = plans.map((plan) => ({
      ...plan,
      price: overrideMap.get(plan.id) ?? plan.price,
    }));

    return NextResponse.json({ plans: mergedPlans });
  } catch (error) {
    console.error("Fetch plans error:", error);
    return NextResponse.json({ plans }, { status: 200 });
  }
}


