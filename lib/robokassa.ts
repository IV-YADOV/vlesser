import crypto from "crypto";

/**
 * Утилиты для работы с Robokassa
 * Документация: https://docs.robokassa.ru/pay-interface/
 */

/**
 * Генерирует подпись для инициализации платежа
 * MD5(MerchantLogin:OutSum:InvId:Password_1)
 * 
 * ВАЖНО: Формула подписи НЕ включает дополнительные параметры (shp_),
 * так как они не используются в нашем коде
 */
export function generateRobokassaSignature(
  merchantLogin: string,
  outSum: number | string,
  invId: number | string,
  password_1: string
): string {
  // ВАЛИДАЦИЯ: Проверяем обязательные параметры
  if (!merchantLogin || typeof merchantLogin !== "string") {
    throw new Error("MerchantLogin is required and must be a string");
  }
  
  if (!password_1 || typeof password_1 !== "string") {
    throw new Error("Password_1 is required and must be a string");
  }

  // Убираем пробелы в начале и конце (критично!)
  const merchantLoginStr = String(merchantLogin).trim();
  const password_1Str = String(password_1).trim();

  // Проверяем, что после trim остались значения
  if (!merchantLoginStr) {
    throw new Error("MerchantLogin cannot be empty after trimming spaces");
  }
  
  if (!password_1Str) {
    throw new Error("Password_1 cannot be empty after trimming spaces");
  }

  // OutSum должен быть в формате числа с точкой как разделителем (например: "123.45")
  // Согласно документации: "Формат представления — число, разделитель — точка, например: 123.45"
  // ВАЖНО: В подписи и в URL должен быть ОДИНАКОВЫЙ формат!
  let outSumStr: string;
  if (typeof outSum === "string") {
    // Если строка, проверяем формат и нормализуем
    const num = parseFloat(outSum);
    if (isNaN(num) || num <= 0) {
      throw new Error(`Invalid OutSum format: ${outSum}. Must be a positive number.`);
    }
    // Форматируем с двумя знаками после точки (разделитель - точка)
    outSumStr = num.toFixed(2);
  } else {
    // Если число, проверяем и приводим к строке с точкой как разделителем
    if (isNaN(outSum) || outSum <= 0) {
      throw new Error(`Invalid OutSum value: ${outSum}. Must be a positive number.`);
    }
    // Форматируем с двумя знаками после точки (разделитель - точка)
    outSumStr = outSum.toFixed(2);
  }
  
  // Убеждаемся, что разделитель - точка, а не запятая
  if (outSumStr.includes(',')) {
    outSumStr = outSumStr.replace(',', '.');
  }

  // InvId должен быть положительным числом или строкой с числом
  // ВАЖНО: Robokassa принимает InvId как целое число (может быть 0 для теста)
  let invIdStr: string;
  let invIdNum: number;
  
  if (typeof invId === "number") {
    if (isNaN(invId) || invId < 0) {  // Разрешаем 0 для теста
      throw new Error(`Invalid InvId value: ${invId}`);
    }
    invIdNum = Math.floor(invId); // Убеждаемся, что это целое число
    invIdStr = String(invIdNum);
  } else {
    invIdNum = parseInt(String(invId), 10);
    if (isNaN(invIdNum) || invIdNum < 0) {  // Разрешаем 0 для теста
      throw new Error(`Invalid InvId format: ${invId}`);
    }
    invIdStr = String(invIdNum);
  }

  // Формируем строку подписи: MerchantLogin:OutSum:InvId:Password_1
  // ВАЖНО: Порядок параметров имеет значение!
  // Согласно документации: "База для расчёта контрольной суммы: MerchantLogin:OutSum:InvId:Пароль#1"
  // Формула: MD5(MerchantLogin:OutSum:InvId:Password_1)
  // Примечание: пользовательские параметры (shp_) не используются в нашем коде
  const signatureString = `${merchantLoginStr}:${outSumStr}:${invIdStr}:${password_1Str}`;

  console.log("🔐 Signature calculation:", {
    merchantLogin: merchantLoginStr,
    merchantLoginLength: merchantLoginStr.length,
    outSum: outSumStr,
    outSumType: typeof outSumStr,
    invId: invIdStr,
    invIdType: typeof invIdStr,
    password_1Length: password_1Str.length,
    password_1FirstChar: password_1Str.substring(0, 1),
    password_1LastChar: password_1Str.substring(password_1Str.length - 1),
    signatureString: signatureString, // Полная строка для отладки (БЕЗ ПАРОЛЯ в логах!)
    signatureStringLength: signatureString.length,
    signatureStringBytes: Buffer.from(signatureString, "utf-8").length,
  });

  // Вычисляем MD5 хеш
  // ВАЖНО: Используем UTF-8 кодировку (по умолчанию в Node.js)
  // Согласно документации: "Контрольная сумма — хэш, число в 16-ричной форме и любом регистре (0-9, A-F)"
  const hash = crypto.createHash("md5").update(signatureString, "utf-8").digest("hex");

  // Проверяем, что хеш правильной длины (MD5 всегда 32 символа в hex)
  if (hash.length !== 32) {
    throw new Error(`Invalid MD5 hash length: ${hash.length} (expected 32)`);
  }

  // Проверяем, что хеш содержит только 16-ричные символы (0-9, A-F, a-f)
  if (!/^[0-9a-fA-F]{32}$/.test(hash)) {
    throw new Error(`Invalid MD5 hash format: ${hash}. Must contain only hexadecimal characters.`);
  }

  console.log("✅ Generated signature:", {
    hash: hash,
    hashLength: hash.length,
    hashFirst8: hash.substring(0, 8),
    hashLast8: hash.substring(24),
    // Проверка: хеш должен быть в нижнем регистре (MD5 всегда lowercase hex)
    isLowercase: hash === hash.toLowerCase(),
    // Проверка формата: только 16-ричные символы
    isValidHex: /^[0-9a-fA-F]{32}$/.test(hash),
  });

  // Возвращаем хеш в нижнем регистре (для единообразия)
  // Документация говорит "в любом регистре", но для единообразия используем lowercase
  return hash.toLowerCase();
}

/**
 * Проверяет подпись от Robokassa
 * Для ResultURL: MD5(OutSum:InvId:Password_2)
 * Для SuccessURL: MD5(OutSum:InvId:Password_1)
 */
export function verifyRobokassaSignature(
  outSum: string | number,
  invId: string | number,
  signature: string,
  password: string
): boolean {
  // ВАЖНО: OutSum должен быть использован ТОЧНО в том формате, как пришло от Robokassa
  // Robokassa в callback может отправлять OutSum как '199' или '199.00'
  // Нужно использовать OutSum как есть, без нормализации!
  let outSumStr: string;
  if (typeof outSum === "string") {
    // Используем OutSum как пришло от Robokassa (может быть '199' или '199.00')
    // Но убеждаемся, что это валидное число
    const num = parseFloat(outSum);
    if (isNaN(num) || num <= 0) {
      console.error("Invalid OutSum format in signature verification:", outSum);
      return false;
    }
    // ВАЖНО: Используем OutSum как пришло (без форматирования через toFixed)
    // Robokassa использует тот же формат для расчета подписи
    // Только заменяем запятую на точку, если есть
    outSumStr = String(outSum).replace(',', '.');
  } else {
    // Если число, приводим к строке с точкой как разделителем
    if (isNaN(outSum) || outSum <= 0) {
      console.error("Invalid OutSum value in signature verification:", outSum);
      return false;
    }
    // Для чисел форматируем с точкой как разделителем
    outSumStr = outSum.toFixed(2);
  }

  // InvId должен быть целым числом (может быть 0 для теста)
  let invIdStr: string;
  if (typeof invId === "number") {
    if (isNaN(invId) || invId < 0) {
      console.error("Invalid InvId value in signature verification:", invId);
      return false;
    }
    invIdStr = String(Math.floor(invId));
  } else {
    const invIdNum = parseInt(String(invId), 10);
    if (isNaN(invIdNum) || invIdNum < 0) {
      console.error("Invalid InvId format in signature verification:", invId);
      return false;
    }
    invIdStr = String(invIdNum);
  }

  // Убираем пробелы из пароля (критично!)
  const passwordStr = String(password).trim();
  if (!passwordStr) {
    console.error("Password is empty in signature verification");
    return false;
  }

  // Формируем строку для проверки: OutSum:InvId:Password
  // ВАЖНО: Формат должен точно соответствовать формату при генерации подписи
  const signatureString = `${outSumStr}:${invIdStr}:${passwordStr}`;

  console.log("🔐 Signature verification:", {
    outSum: outSumStr,
    invId: invIdStr,
    passwordLength: passwordStr.length,
    passwordFirstChar: passwordStr.substring(0, 1),
    passwordLastChar: passwordStr.substring(passwordStr.length - 1),
    signatureStringLength: signatureString.length,
    signatureString: signatureString, // ВАЖНО: для отладки (БЕЗ ПАРОЛЯ в production!)
  });

  // Вычисляем MD5 хеш
  const calculatedSignature = crypto
    .createHash("md5")
    .update(signatureString, "utf-8")
    .digest("hex")
    .toLowerCase();

  // Сравниваем в нижнем регистре
  const receivedSignature = signature.toLowerCase();
  const isValid = calculatedSignature === receivedSignature;

  if (!isValid) {
    console.error("❌ Signature verification failed:", {
      outSum: outSumStr,
      invId: invIdStr,
      received: receivedSignature,
      calculated: calculatedSignature,
      signatureString,
      match: calculatedSignature === receivedSignature,
    });
  } else {
    console.log("✅ Signature verification successful");
  }

  return isValid;
}

/**
 * Генерирует URL для редиректа на Robokassa
 * Документация: https://docs.robokassa.ru/pay-interface/
 */
export function generateRobokassaUrl(params: {
  MerchantLogin: string;
  OutSum: number;
  InvId: number;
  Description: string;
  Password_1: string;
  IsTest?: boolean;
  Culture?: string;
  Encoding?: string;
  ResultURL?: string;
  SuccessURL?: string;
  FailURL?: string;
  Email?: string;
  ExpirationDate?: string;
  Receipt?: string;
}): string {
  const {
    MerchantLogin,
    OutSum,
    InvId,
    Description,
    Password_1,
    IsTest = false,
    Culture = "ru",
    Encoding = "utf-8",
    ResultURL,
    SuccessURL,
    FailURL,
    Email,
    ExpirationDate,
    Receipt,
  } = params;

  // ВАЛИДАЦИЯ: Description согласно документации
  // "Описание покупки, можно использовать только символы английского или русского алфавита, цифры и знаки препинания. Максимальная длина — 100 символов."
  if (!Description || typeof Description !== "string") {
    throw new Error("Description is required and must be a string");
  }
  if (Description.length > 100) {
    throw new Error(`Description too long (max 100 characters). Got: ${Description.length}`);
  }

  // ВАЛИДАЦИЯ: Проверяем обязательные параметры ПЕРЕД генерацией подписи
  // Убираем все пробелы из MerchantLogin и Password_1
  const merchantLoginStr = String(MerchantLogin).trim();
  if (!merchantLoginStr) {
    throw new Error("MerchantLogin is required and cannot be empty");
  }
  
  const password_1Str = String(Password_1).trim();
  if (!password_1Str) {
    throw new Error("Password_1 is required and cannot be empty");
  }
  
  // ВАЖНО: InvId может быть 0 для теста (согласно документации)
  if (InvId === undefined || InvId === null || isNaN(Number(InvId)) || InvId < 0) {
    throw new Error(`InvId must be a non-negative number. Got: ${InvId}`);
  }
  
  if (!OutSum || OutSum <= 0 || isNaN(Number(OutSum))) {
    throw new Error(`OutSum must be a positive number. Got: ${OutSum}`);
  }

  // ВАЖНО: OutSum должен быть в формате числа с точкой как разделителем (например: "123.45")
  // Согласно документации: "Формат представления — число, разделитель — точка, например: 123.45"
  // И в URL, и в подписи должен быть ОДИНАКОВЫЙ формат
  let outSumString: string;
  if (typeof OutSum === "string") {
    const num = parseFloat(OutSum);
    if (isNaN(num) || num <= 0) {
      throw new Error(`Invalid OutSum format: ${OutSum}. Must be a positive number.`);
    }
    outSumString = num.toFixed(2);
  } else {
    if (isNaN(OutSum) || OutSum <= 0) {
      throw new Error(`Invalid OutSum value: ${OutSum}. Must be a positive number.`);
    }
    outSumString = OutSum.toFixed(2);
  }
  
  // Убеждаемся, что разделитель - точка, а не запятая
  if (outSumString.includes(',')) {
    outSumString = outSumString.replace(',', '.');
  }

  // Убеждаемся, что InvId - целое неотрицательное число
  // ВАЖНО: Используем parseInt с явным указанием radix=10
  // ВАЖНО: InvId может быть 0 для теста (согласно документации Robokassa)
  const invIdNum = parseInt(String(InvId), 10);
  if (isNaN(invIdNum) || invIdNum < 0) {
    throw new Error(`InvId must be a non-negative integer. Got: ${InvId}`);
  }
  
  // Проверяем, что InvId не слишком большой
  // Согласно документации: InvId может принимать значения от 1 до 9223372036854775807 (2^63 - 1)
  // Но для теста может быть 0
  const MAX_INV_ID = 9223372036854775807; // 2^63 - 1
  if (invIdNum > MAX_INV_ID) {
    throw new Error(`InvId too large (max ${MAX_INV_ID}). Got: ${InvId}`);
  }
  
  // Для реальных платежей InvId должен быть >= 1 (0 только для теста)
  if (invIdNum === 0 && !IsTest) {
    console.warn("⚠️ InvId is 0, but IsTest is false. InvId=0 is only allowed in test mode.");
  }

  console.log("📋 Robokassa URL generation params:", {
    merchantLogin: merchantLoginStr,
    merchantLoginLength: merchantLoginStr.length,
    outSum: outSumString,
    invId: invIdNum,
    password_1Length: password_1Str.length,
    isTest: IsTest,
  });

  // Генерируем подпись с правильным форматом OutSum
  // ВАЖНО: Передаем ОБРЕЗАННЫЕ значения без пробелов
  const SignatureValue = generateRobokassaSignature(
    merchantLoginStr, // Уже обрезанный
    outSumString,     // Уже в формате "99.00"
    invIdNum,         // Уже целое число
    password_1Str     // Уже обрезанный
  );

  // Формируем параметры URL
  // ВАЖНО: Используем те же значения, что и в подписи!
  const urlParams = new URLSearchParams({
    MerchantLogin: merchantLoginStr,
    OutSum: outSumString,        // Тот же формат, что в подписи
    InvId: invIdNum.toString(),   // Тот же InvId, что в подписи
    Description: encodeURIComponent(Description),
    SignatureValue,
    Culture,
    Encoding,
  });

  if (IsTest) {
    urlParams.set("IsTest", "1");
  }

  if (ResultURL) {
    urlParams.set("ResultURL", ResultURL);
  }

  if (SuccessURL) {
    urlParams.set("SuccessURL", SuccessURL);
  }

  if (FailURL) {
    urlParams.set("FailURL", FailURL);
  }

  if (Email) {
    urlParams.set("Email", Email);
  }

  if (ExpirationDate) {
    urlParams.set("ExpirationDate", ExpirationDate);
  }

  if (Receipt) {
    urlParams.set("Receipt", Receipt);
  }

  const finalUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${urlParams.toString()}`;
  
  // Финальное логирование для отладки (без пароля)
  console.log("🔗 Final Robokassa URL (masked):", {
    baseUrl: "https://auth.robokassa.ru/Merchant/Index.aspx",
    params: {
      MerchantLogin: merchantLoginStr,
      OutSum: outSumString,
      InvId: invIdNum.toString(),
      Description: Description.substring(0, 50) + "...",
      SignatureValue: SignatureValue.substring(0, 8) + "...",
      Culture,
      Encoding,
      IsTest: IsTest ? "1" : undefined,
      ResultURL: ResultURL ? ResultURL.substring(0, 50) + "..." : undefined,
      SuccessURL: SuccessURL ? SuccessURL.substring(0, 50) + "..." : undefined,
      FailURL: FailURL ? FailURL.substring(0, 50) + "..." : undefined,
    },
    urlLength: finalUrl.length,
  });
  
  return finalUrl;
}

