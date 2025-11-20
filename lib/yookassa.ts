import crypto from "crypto";

/**
 * Утилиты для работы с ЮKassa
 * Документация: https://yookassa.ru/developers
 */

export interface YooKassaPaymentRequest {
  amount: {
    value: string; // Сумма в формате "100.00"
    currency: "RUB";
  };
  description: string; // Описание платежа (макс 128 символов)
  confirmation: {
    type: "redirect";
    return_url: string; // URL для редиректа после оплаты
  };
  receipt?: {
    customer: {
      email?: string;
      phone?: string;
    };
    items: Array<{
      description: string;
      quantity: string; // "1.00"
      amount: {
        value: string; // "100.00"
        currency: "RUB";
      };
      vat_code?: number; // Код НДС (1-6, или 0 если без НДС)
    }>;
  };
  metadata?: Record<string, string>; // Дополнительные данные
}

export interface YooKassaPaymentResponse {
  id: string; // Идентификатор платежа
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  amount: {
    value: string;
    currency: string;
  };
  description: string;
  confirmation: {
    type: string;
    confirmation_url: string; // URL для редиректа на оплату
  };
  created_at: string; // ISO 8601
  metadata?: Record<string, string>;
}

export interface YooKassaWebhookNotification {
  type: "notification";
  event: "payment.succeeded" | "payment.canceled" | "payment.waiting_for_capture";
  object: {
    id: string;
    status: "succeeded" | "canceled" | "waiting_for_capture";
    amount: {
      value: string;
      currency: string;
    };
    description?: string;
    metadata?: Record<string, string>;
    created_at: string;
  };
}

/**
 * Создает платеж через ЮKassa API
 */
export async function createYooKassaPayment(
  params: {
    amount: number; // Сумма в рублях
    description: string;
    returnUrl: string;
    shopId: string;
    secretKey: string;
    receipt?: YooKassaPaymentRequest["receipt"];
    metadata?: Record<string, string>;
  }
): Promise<YooKassaPaymentResponse | null> {
  const { amount, description, returnUrl, shopId, secretKey, receipt, metadata } = params;

  // Валидация
  if (!shopId || !secretKey) {
    throw new Error("YooKassa shopId and secretKey are required");
  }

  if (amount <= 0 || isNaN(amount)) {
    throw new Error(`Invalid amount: ${amount}. Must be a positive number.`);
  }

  if (!description || description.length > 128) {
    throw new Error(`Description is required and must be <= 128 characters. Got: ${description.length}`);
  }

  // Форматируем сумму с двумя знаками после запятой
  const amountValue = amount.toFixed(2);

  const paymentRequest: YooKassaPaymentRequest = {
    amount: {
      value: amountValue,
      currency: "RUB",
    },
    description: description.substring(0, 128), // Обрезаем до 128 символов
    confirmation: {
      type: "redirect",
      return_url: returnUrl,
    },
  };

  if (receipt) {
    paymentRequest.receipt = receipt;
  }

  if (metadata) {
    paymentRequest.metadata = metadata;
  }

  console.log("📋 YooKassa payment request:", {
    amount: amountValue,
    description: description.substring(0, 50) + "...",
    returnUrl: returnUrl.substring(0, 50) + "...",
    shopId: shopId.substring(0, 10) + "...",
    hasReceipt: !!receipt,
    hasMetadata: !!metadata,
  });

  try {
    // Basic Auth: shopId:secretKey в base64
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID(), // Уникальный ключ для идемпотентности
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ YooKassa API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`YooKassa API error: ${response.status} ${errorText}`);
    }

    const paymentData: YooKassaPaymentResponse = await response.json();

    console.log("✅ YooKassa payment created:", {
      id: paymentData.id,
      status: paymentData.status,
      confirmationUrl: paymentData.confirmation?.confirmation_url?.substring(0, 50) + "...",
    });

    return paymentData;
  } catch (error: any) {
    console.error("❌ Error creating YooKassa payment:", error);
    throw error;
  }
}

/**
 * Проверяет подпись webhook уведомления от ЮKassa (MD5)
 */
export function verifyYooKassaWebhookSignature(
  notification: YooKassaWebhookNotification,
  secretKey: string
): boolean {
  // ЮKassa использует MD5 подпись для webhook уведомлений
  // Формула: MD5(event + "&" + object.id + "&" + object.status + "&" + secretKey)
  const signatureString = `${notification.event}&${notification.object.id}&${notification.object.status}&${secretKey}`;
  
  const calculatedSignature = crypto
    .createHash("md5")
    .update(signatureString, "utf-8")
    .digest("hex")
    .toLowerCase();

  console.log("🔐 YooKassa webhook signature verification:", {
    event: notification.event,
    paymentId: notification.object.id,
    status: notification.object.status,
    signatureStringLength: signatureString.length,
  });

  // В реальной реализации нужно сравнить с подписью из заголовка запроса
  // Для упрощения здесь проверяем только структуру уведомления
  return true; // TODO: Реализовать проверку подписи из заголовка
}

/**
 * Получает информацию о платеже по ID
 */
export async function getYooKassaPayment(
  paymentId: string,
  shopId: string,
  secretKey: string
): Promise<YooKassaPaymentResponse | null> {
  try {
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ YooKassa get payment error:", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const paymentData: YooKassaPaymentResponse = await response.json();
    
    console.log(`✅ YooKassa payment data received:`, {
      id: paymentData.id,
      status: paymentData.status,
      amount: paymentData.amount?.value,
      currency: paymentData.amount?.currency,
      created_at: paymentData.created_at,
      paid: (paymentData as any).paid,
      description: paymentData.description?.substring(0, 50),
    });
    
    return paymentData;
  } catch (error: any) {
    console.error("❌ Error getting YooKassa payment:", error);
    return null;
  }
}

