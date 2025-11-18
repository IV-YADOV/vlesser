import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanById } from "@/lib/plans";
import { addDays } from "date-fns";

function generateVlessLink(): string {
  // Mock VLESS link generation
  // In production, this should generate a real VLESS config
  const uuid = crypto.randomUUID();
  const server = "vpn.example.com";
  const port = 443;
  const flow = "xtls-rprx-vision";

  return `vless://${uuid}@${server}:${port}?flow=${flow}&encryption=none&security=tls&sni=${server}&fp=chrome&pbk=test&sid=test&spx=test&type=tcp&headerType=none#VLESSer`;
}

export async function POST(request: NextRequest) {
  try {
    const { paymentId, userId } = await request.json();

    if (!paymentId || !userId) {
      return NextResponse.json(
        { error: "Missing paymentId or userId" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get payment (don't filter by user_id to allow flexibility)
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("Payment error:", paymentError);
      return NextResponse.json(
        { error: "Payment not found: " + (paymentError?.message || "Unknown") },
        { status: 404 }
      );
    }

    // Ensure user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!existingUser) {
      await supabase
        .from("users")
        .insert({
          id: userId,
          tg_id: userId.startsWith("tg_") ? userId.replace("tg_", "") : null,
        });
    }

    if (payment.status === "completed") {
      // Return existing subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("plan", payment.plan)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (subscription) {
        return NextResponse.json({
          vlessLink: subscription.vless_link,
          expiresAt: subscription.expires_at,
        });
      }
    }

    // Update payment status
    await supabase
      .from("payments")
      .update({ status: "completed" })
      .eq("id", paymentId);

    // Get plan
    const plan = getPlanById(payment.plan);
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Generate VLESS link через Python сервис
    let vlessLink: string;
    
    const pythonServiceUrl = process.env.PYTHON_XRAY_SERVICE_URL || "http://localhost:5000";
    
    try {
      // Вызываем Python сервис для создания клиента в xray
      const response = await fetch(`${pythonServiceUrl}/create-client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userId, // Используем userId как email
          days: plan.duration, // Срок действия из тарифа
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.vless_link) {
          vlessLink = data.vless_link;
          console.log(`✅ Клиент создан в xray: ${userId}, VLESS получен`);
        } else {
          throw new Error(data.error || "Failed to get vless link from Python service");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Python service returned ${response.status}`);
      }
    } catch (error: any) {
      console.error("Ошибка при вызове Python сервиса:", error);
      // Fallback на mock конфиг если Python сервис недоступен
      console.warn("Используем mock конфиг как fallback");
      vlessLink = generateVlessLink();
    }

    // Calculate expiration
    const expiresAt = addDays(new Date(), plan.duration).toISOString();

    // Create subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: payment.plan,
        expires_at: expiresAt,
        vless_link: vlessLink,
      })
      .select()
      .single();

    if (subError) {
      return NextResponse.json(
        { error: "Failed to create subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      vlessLink: subscription.vless_link,
      expiresAt: subscription.expires_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

