import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plans } from "@/lib/plans";

function isAdmin(request: NextRequest) {
  const adminToken = request.headers.get("x-admin-token");
  return adminToken && adminToken === process.env.ADMIN_SECRET_TOKEN;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, price } = await request.json();

    if (!planId || typeof price !== "number" || price <= 0) {
      return NextResponse.json(
        { error: "planId and positive price are required" },
        { status: 400 }
      );
    }

    const planExists = plans.some((plan) => plan.id === planId);
    if (!planExists) {
      return NextResponse.json(
        { error: "Unknown plan id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("plan_settings")
      .upsert(
        {
          plan_id: planId,
          price,
        },
        {
          onConflict: "plan_id",
        }
      );

    if (error) {
      console.error("Update plan price error:", error);
      return NextResponse.json(
        { error: "Failed to update plan price" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Plan price update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


