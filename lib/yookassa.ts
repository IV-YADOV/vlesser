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
  expires_at?: string; // ISO 8601 - время истечения платежа (обычно 15 минут после создания)
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

  // Формируем базовый запрос на создание платежа
  const paymentRequest: any = {
    amount: {
      value: amountValue,
      currency: "RUB",
    },
    description: description.substring(0, 128), // Обрезаем до 128 символов
    confirmation: {
      type: "redirect",
      return_url: returnUrl,
    },
    // ВАЖНО: capture: true означает автоматическое подтверждение платежа после оплаты
    // Если false - платеж будет в статусе waiting_for_capture и потребует ручного подтверждения
    capture: true, // Автоматическое подтверждение (capture) после оплаты
  };

  // Добавляем receipt в запрос, если он передан
  // ВАЖНО: Если YooKassa требует receipt (обязательная отправка чеков), он должен быть валидным
  if (receipt && typeof receipt === 'object') {
    // Проверяем, что receipt валиден
    if (Array.isArray(receipt.items) && receipt.items.length > 0) {
      // Проверяем, что все обязательные поля присутствуют
      const firstItem = receipt.items[0];
      if (firstItem.description && firstItem.quantity && firstItem.amount && firstItem.amount.value && firstItem.amount.currency) {
        paymentRequest.receipt = receipt;
        console.log("📋 Receipt included in payment request:", {
          itemsCount: receipt.items.length,
          customerEmail: receipt.customer?.email || "not provided",
          totalAmount: firstItem.amount.value,
          vatCode: firstItem.vat_code || "not set",
        });
      } else {
        console.error("❌ Receipt items are invalid, missing required fields");
        console.error("❌ Required fields: description, quantity, amount.value, amount.currency");
      }
    } else {
      console.error("❌ Receipt items array is empty or invalid");
    }
  } else {
    // Receipt не передан - это нормально, если YooKassa не требует его
    console.log("📋 Receipt not included in payment request");
    console.log("📋 Note: If YooKassa requires receipts, you need to pass valid receipt with customer and items");
  }

  // Добавляем metadata только если она передана
  if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
    paymentRequest.metadata = metadata;
  }

  // Логируем запрос без sensitive данных
  console.log("📋 YooKassa payment request:", {
    amount: amountValue,
    description: description.substring(0, 50) + "...",
    returnUrl: returnUrl.substring(0, 50) + "...",
    shopId: shopId.substring(0, 10) + "...",
    hasReceipt: !!paymentRequest.receipt,
    hasMetadata: !!paymentRequest.metadata,
    requestKeys: Object.keys(paymentRequest),
  });
  
  // Логируем полный запрос для отладки (без sensitive данных)
  const debugRequest = JSON.stringify(paymentRequest, null, 2);
  console.log("📋 Full YooKassa payment request (for debug):", debugRequest.substring(0, 500));

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
      let errorDetails: any;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      
      console.error("❌ YooKassa API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        errorDetails: errorDetails,
        shopId: shopId ? shopId.substring(0, 10) + "..." : "missing",
        hasSecretKey: !!secretKey,
      });
      
      const errorMessage = typeof errorDetails === 'object' && errorDetails?.description 
        ? errorDetails.description 
        : `YooKassa API error: ${response.status} ${response.statusText}`;
      
      throw new Error(errorMessage);
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
 * Проверяет подпись webhook уведомления от ЮKassa
 * YooKassa использует HMAC-SHA256 подпись в заголовке "signature" или "X-Content-HMAC-SHA256"
 * Формат подписи: "v1 <payment_id> <algorithm> <signature_base64>" или просто hex/base64 строка
 * Документация: https://yookassa.ru/developers/using-api/webhooks#security
 */
export function verifyYooKassaWebhookSignature(
  requestBody: string, // Тело запроса как строка (до парсинга JSON)
  receivedSignature: string | null, // Подпись из заголовка
  secretKey: string
): boolean {
  if (!receivedSignature) {
    console.error("❌ YooKassa webhook signature missing");
    return false;
  }

  if (!secretKey) {
    console.error("❌ YooKassa secret key is not set");
    return false;
  }

  // Парсим полученную подпись
  let receivedSignatureBytes: Buffer;
  let calculatedSignatureBytes: Buffer;
  let signatureFormat: "v1" | "hex" | "base64" = "hex";
  
  // Проверяем формат "v1 <payment_id> <algorithm> <signature_base64>"
  const v1FormatMatch = receivedSignature.match(/^v1\s+(\S+)\s+(\d+)\s+(.+)$/);
  
  if (v1FormatMatch) {
    // Новый формат YooKassa: v1 <payment_id> <algorithm> <signature_base64>
    const [, paymentId, algorithm, signatureBase64] = v1FormatMatch;
    signatureFormat = "v1";
    
    console.log("📋 Detected YooKassa v1 signature format:", {
      paymentId,
      algorithm,
      signatureLength: signatureBase64.length,
    });
    
    // Проверяем алгоритм (1 = HMAC-SHA256)
    if (algorithm !== "1") {
      console.error("❌ Unsupported signature algorithm:", algorithm);
      return false;
    }
    
    try {
      // Декодируем base64 подпись в байты
      receivedSignatureBytes = Buffer.from(signatureBase64, "base64");
    } catch (error) {
      console.error("❌ Error decoding base64 signature:", error);
      return false;
    }
    
    // Для формата v1 вычисляем подпись в base64
    const calculatedSignatureBase64 = crypto
      .createHmac("sha256", secretKey)
      .update(requestBody, "utf-8")
      .digest("base64");
    
    try {
      calculatedSignatureBytes = Buffer.from(calculatedSignatureBase64, "base64");
    } catch (error) {
      console.error("❌ Error converting calculated base64 signature to Buffer:", error);
      return false;
    }
  } else {
    // Старый формат: hex строка (64 символа) или base64
    const receivedSignatureTrimmed = receivedSignature.trim();
    
    // Проверяем, является ли это hex строкой (64 символа)
    if (/^[a-f0-9]{64}$/i.test(receivedSignatureTrimmed)) {
      signatureFormat = "hex";
      
      try {
        receivedSignatureBytes = Buffer.from(receivedSignatureTrimmed, "hex");
      } catch (error) {
        console.error("❌ Error converting hex signature to Buffer:", error);
        return false;
      }
      
      // Для hex формата вычисляем подпись в hex
      const calculatedSignatureHex = crypto
        .createHmac("sha256", secretKey)
        .update(requestBody, "utf-8")
        .digest("hex")
        .toLowerCase();
      
      try {
        calculatedSignatureBytes = Buffer.from(calculatedSignatureHex, "hex");
      } catch (error) {
        console.error("❌ Error converting calculated hex signature to Buffer:", error);
        return false;
      }
    } else {
      // Пробуем как base64 (без префикса v1)
      signatureFormat = "base64";
      
      try {
        receivedSignatureBytes = Buffer.from(receivedSignatureTrimmed, "base64");
      } catch (error) {
        console.error("❌ Invalid signature format (not v1, not hex, not base64):", {
          receivedLength: receivedSignatureTrimmed.length,
          receivedPreview: receivedSignatureTrimmed.substring(0, 30) + "...",
        });
        return false;
      }
      
      // Для base64 формата вычисляем подпись в base64
      const calculatedSignatureBase64 = crypto
        .createHmac("sha256", secretKey)
        .update(requestBody, "utf-8")
        .digest("base64");
      
      try {
        calculatedSignatureBytes = Buffer.from(calculatedSignatureBase64, "base64");
      } catch (error) {
        console.error("❌ Error converting calculated base64 signature to Buffer:", error);
        return false;
      }
    }
  }
  
  // Проверяем длину буферов
  if (calculatedSignatureBytes.length !== receivedSignatureBytes.length) {
    console.error("❌ Signature length mismatch:", {
      format: signatureFormat,
      calculated: calculatedSignatureBytes.length,
      received: receivedSignatureBytes.length,
    });
    return false;
  }
  
  // Используем timingSafeEqual для защиты от timing attacks
  const isValid = crypto.timingSafeEqual(calculatedSignatureBytes, receivedSignatureBytes);

  console.log("🔐 YooKassa webhook signature verification:", {
    format: signatureFormat,
    isValid,
    bodyLength: requestBody.length,
    signatureLength: receivedSignatureBytes.length,
  });

  return isValid;
}

/**
 * Подтверждает (capture) платеж в YooKassa
 * Используется для платежей в статусе waiting_for_capture
 * Документация: https://yookassa.ru/developers/api#capture_payment
 */
export async function captureYooKassaPayment(
  paymentId: string,
  shopId: string,
  secretKey: string,
  amount?: { value: string; currency: string }
): Promise<YooKassaPaymentResponse | null> {
  try {
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    const requestBody: any = {};
    if (amount) {
      requestBody.amount = amount;
    }

    const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID(),
        "Authorization": `Basic ${auth}`,
      },
      body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails: any;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      
      console.error("❌ YooKassa capture payment error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        errorDetails: errorDetails,
      });
      
      return null;
    }

    const paymentData: YooKassaPaymentResponse = await response.json();

    console.log("✅ YooKassa payment captured:", {
      id: paymentData.id,
      status: paymentData.status,
      amount: paymentData.amount?.value,
    });

    return paymentData;
  } catch (error: any) {
    console.error("❌ Error capturing YooKassa payment:", error);
    return null;
  }
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

