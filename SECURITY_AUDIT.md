# Руководство по тестированию уязвимостей для аудита безопасности

## Оглавление

1. [Обзор системы](#обзор-системы)
2. [Методы тестирования](#методы-тестирования)
3. [Тестирование авторизации](#тестирование-авторизации)
4. [Тестирование API endpoints](#тестирование-api-endpoints)
5. [Тестирование платежной системы](#тестирование-платежной-системы)
6. [Тестирование webhook endpoints](#тестирование-webhook-endpoints)
7. [Тестирование XSS](#тестирование-xss)
8. [Тестирование CSRF](#тестирование-csrf)
9. [Тестирование SQL Injection](#тестирование-sql-injection)
10. [Тестирование Rate Limiting](#тестирование-rate-limiting)
11. [Чеклист для аудита](#чеклист-для-аудита)

---

## Обзор системы

### Технологии

- **Frontend**: Next.js 16 (React), TypeScript
- **Backend**: Next.js API Routes
- **База данных**: Supabase (PostgreSQL)
- **Платежная система**: YooKassa
- **Авторизация**: Telegram Bot API с одноразовыми токенами

### Основные компоненты безопасности

1. **Система авторизации через Telegram**
   - Одноразовые токены (64 hex символа)
   - Токены привязаны к `telegram_id`
   - Токены одноразовые (проверка `site_used_at`)
   - Срок действия токенов: 10 минут

2. **Защищенные API endpoints**
   - `/api/subscriptions` - получение подписок
   - `/api/createPayment` - создание платежа
   - `/api/payments/cancel` - отмена платежа
   - `/api/payments` - получение информации о платеже
   - `/api/payment/checkStatus` - проверка статуса платежа

3. **Webhook endpoints**
   - `/api/payment/webhook` - webhook от YooKassa (защита по IP)

---

## Методы тестирования

### Инструменты

1. **HTTP клиенты**:
   - `curl` / `wget`
   - Postman
   - Burp Suite
   - Insomnia

2. **Для тестирования браузера**:
   - DevTools (Console, Network)
   - Browser Extensions (EditThisCookie, LocalStorage Manager)

3. **Для анализа трафика**:
   - Burp Suite Proxy
   - OWASP ZAP
   - mitmproxy

---

## Тестирование авторизации

### 1. Подделка userData

**Цель**: Попытка подделать `userData` и получить несанкционированный доступ.

**Тест 1.1: Подделка userData в localStorage**

```javascript
// В консоли браузера
const fakeUserData = {
  id: 123456789,
  first_name: "Hacker",
  hash: "a".repeat(64), // Поддельный токен
  auth_date: Math.floor(Date.now() / 1000)
};
localStorage.setItem("telegram_user", JSON.stringify(fakeUserData));
// Затем попытаться получить подписки или создать платеж
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 401 "Invalid token"

**Тест 1.2: Подделка userData в API запросе**

```bash
curl -X POST https://your-domain.com/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "userData": {
      "id": 123456789,
      "first_name": "Hacker",
      "hash": "a".repeat(64),
      "auth_date": '$(date +%s)'
    }
  }'
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 401 "Invalid token"

### 2. Replay атака

**Цель**: Повторное использование старых данных авторизации.

**Тест 2.1: Использование старых данных**

```bash
# Данные старше 24 часов
curl -X POST https://your-domain.com/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "userData": {
      "id": 123456789,
      "first_name": "User",
      "hash": "valid_token_here",
      "auth_date": '$(($(date +%s) - 25 * 60 * 60))'  # 25 часов назад
    }
  }'
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 401 "Auth data expired"

**Тест 2.2: Повторное использование токена**

```bash
# Использовать один и тот же токен дважды
TOKEN="valid_token_here"

# Первое использование
curl -X POST https://your-domain.com/api/subscriptions \
  -H "Content-Type: application/json" \
  -d "{\"userData\": {\"id\": 123456789, \"first_name\": \"User\", \"hash\": \"$TOKEN\", \"auth_date\": $(date +%s)}}"

# Второе использование того же токена
curl -X POST https://your-domain.com/api/subscriptions \
  -H "Content-Type: application/json" \
  -d "{\"userData\": {\"id\": 123456789, \"first_name\": \"User\", \"hash\": \"$TOKEN\", \"auth_date\": $(date +%s)}}"
```

**Ожидаемый результат**: ❌ Второй запрос должен быть отклонен с ошибкой 401 "Token already used for authentication"

### 3. Привязка токена к пользователю

**Цель**: Попытка использовать токен с другим `telegram_id`.

**Тест 3.1: Использование чужого токена**

```bash
# Получить токен пользователя A
TOKEN_USER_A="token_from_user_a"

# Попытаться использовать его с telegram_id пользователя B
curl -X POST https://your-domain.com/api/subscriptions \
  -H "Content-Type: application/json" \
  -d "{
    \"userData\": {
      \"id\": 987654321,  # Другой telegram_id
      \"first_name\": \"User B\",
      \"hash\": \"$TOKEN_USER_A\",  # Токен пользователя A
      \"auth_date\": $(date +%s)
    }
  }"
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 401 "Token not bound to this user"

---

## Тестирование API endpoints

### 1. Несанкционированный доступ к ресурсам

**Цель**: Попытка получить доступ к чужим ресурсам.

**Тест 1.1: Доступ к чужим подпискам**

```bash
# Получить подписки другого пользователя
curl -X POST https://your-domain.com/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "userData": {
      "id": 123456789,  # Ваш telegram_id
      "first_name": "Your Name",
      "hash": "your_valid_token",
      "auth_date": '$(date +%s)'
    }
  }'
```

**Ожидаемый результат**: ✅ Должны вернуться только ваши подписки

**Примечание**: Это нормальное поведение, но нужно проверить, что нельзя получить подписки другого пользователя.

**Тест 1.2: Отмена чужого платежа**

```bash
# Попытка отменить платеж другого пользователя
curl -X POST https://your-domain.com/api/payments/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "payment_id_from_another_user",
    "userData": {
      "id": 123456789,  # Ваш telegram_id
      "first_name": "Your Name",
      "hash": "your_valid_token",
      "auth_date": '$(date +%s)'
    }
  }'
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 403 "Payment does not belong to this user"

**Тест 1.3: Проверка статуса чужого платежа**

```bash
# Попытка проверить статус платежа другого пользователя
curl -X POST https://your-domain.com/api/payment/checkStatus \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "payment_id_from_another_user",
    "userData": {
      "id": 123456789,
      "first_name": "Your Name",
      "hash": "your_valid_token",
      "auth_date": '$(date +%s)'
    }
  }'
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 403 "Payment does not belong to this user"

### 2. Отсутствие авторизации

**Цель**: Попытка использовать защищенные endpoints без авторизации.

**Тест 2.1: Запрос без userData**

```bash
# Попытка создать платеж без авторизации
curl -X POST https://your-domain.com/api/createPayment \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "premium",
    "userId": "tg_123456789"
  }'
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 401 "Missing userData. Authentication required."

**Тест 2.2: Запрос с пустым userData**

```bash
curl -X POST https://your-domain.com/api/createPayment \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "premium",
    "userId": "tg_123456789",
    "userData": null
  }'
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 401 "Missing user data"

---

## Тестирование платежной системы

### 1. Подделка платежей

**Цель**: Попытка создать платеж с подделанными данными.

**Тест 1.1: Создание платежа с подделанным userId**

```bash
# Попытка создать платеж от имени другого пользователя
curl -X POST https://your-domain.com/api/createPayment \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "premium",
    "userId": "tg_987654321",  # Другой пользователь
    "userData": {
      "id": 123456789,  # Ваш telegram_id
      "first_name": "Your Name",
      "hash": "your_valid_token",
      "auth_date": '$(date +%s)'
    }
  }'
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 403 "User ID mismatch"

**Тест 1.2: Создание платежа с отрицательной суммой**

```bash
# Попытка создать платеж с отрицательной суммой (если есть возможность)
```

**Примечание**: Нужно проверить валидацию суммы на сервере.

### 2. Манипуляция с промокодами

**Цель**: Попытка использовать промокоды несанкционированно.

**Тест 2.1: Использование недействительного промокода**

```bash
curl -X POST https://your-domain.com/api/createPayment \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "premium",
    "userId": "tg_123456789",
    "promocode": "FAKE_PROMOCODE",
    "userData": {
      "id": 123456789,
      "first_name": "Your Name",
      "hash": "your_valid_token",
      "auth_date": '$(date +%s)'
    }
  }'
```

**Ожидаемый результат**: ✅ Запрос должен пройти, но промокод должен быть отклонен (или запрос отклонен, если промокод проверяется до создания платежа)

**Тест 2.2: Использование истекшего промокода**

```bash
# Промокод с expires_at в прошлом
```

**Ожидаемый результат**: ❌ Промокод должен быть отклонен

---

## Тестирование webhook endpoints

### 1. Подделка webhook запросов

**Цель**: Попытка подделать webhook от YooKassa.

**Тест 1.1: Webhook запрос с неавторизованного IP**

```bash
# Запрос с IP, не входящего в список разрешенных IP YooKassa
curl -X POST https://your-domain.com/api/payment/webhook \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 1.2.3.4" \
  -d '{
    "type": "notification",
    "event": "payment.succeeded",
    "object": {
      "id": "fake_payment_id",
      "status": "succeeded",
      "amount": {"value": "100.00", "currency": "RUB"}
    }
  }'
```

**Ожидаемый результат**:
- ❌ В production: запрос должен быть отклонен с ошибкой 403 "Unauthorized IP address"
- ⚠️ В dev режиме: может быть пропущен (если `ALLOW_WEBHOOK_FROM_ANY_IP=true` или URL содержит "ngrok")

**Тест 1.2: Webhook запрос с подделанным платежом**

```bash
# Попытка подделать webhook с несуществующим платежом
curl -X POST https://your-domain.com/api/payment/webhook \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 77.75.154.206" \
  -d '{
    "type": "notification",
    "event": "payment.succeeded",
    "object": {
      "id": "fake_yookassa_payment_id",
      "status": "succeeded",
      "amount": {"value": "10000.00", "currency": "RUB"},
      "metadata": {
        "internalPaymentId": "fake_payment_id"
      }
    }
  }'
```

**Ожидаемый результат**: ✅ Запрос должен вернуть 200, но платеж не должен быть найден (логирование ошибки)

---

## Тестирование XSS

### 1. Отраженный XSS

**Цель**: Попытка внедрить вредоносный JavaScript через входные данные.

**Тест 1.1: XSS в параметрах URL**

```javascript
// Попытка внедрить XSS через параметры URL
https://your-domain.com/checkout/fail?payment_id=<script>alert('XSS')</script>&error=<img src=x onerror=alert('XSS')>
```

**Ожидаемый результат**: ✅ JavaScript не должен выполняться (React автоматически экранирует)

**Тест 1.2: XSS в данных пользователя**

```javascript
// Попытка сохранить XSS в localStorage
const maliciousUserData = {
  id: 123456789,
  first_name: "<script>alert('XSS')</script>",
  hash: "valid_token",
  auth_date: Math.floor(Date.now() / 1000)
};
localStorage.setItem("telegram_user", JSON.stringify(maliciousUserData));
// Затем загрузить страницу профиля
```

**Ожидаемый результат**: ✅ JavaScript не должен выполняться (React экранирует)

**Тест 1.3: XSS в промокодах**

```bash
curl -X POST https://your-domain.com/api/createPayment \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "premium",
    "userId": "tg_123456789",
    "promocode": "<script>alert(\"XSS\")</script>",
    "userData": {...}
  }'
```

**Ожидаемый результат**: ✅ JavaScript не должен выполняться при отображении на странице

---

## Тестирование CSRF

### 1. Cross-Site Request Forgery

**Цель**: Попытка выполнить запрос от имени авторизованного пользователя с другого сайта.

**Тест 1.1: CSRF атака через форму**

Создать HTML страницу на другом домене:

```html
<!DOCTYPE html>
<html>
<body>
  <form id="csrf-form" action="https://your-domain.com/api/createPayment" method="POST">
    <input type="hidden" name="planId" value="premium">
    <input type="hidden" name="userId" value="tg_123456789">
    <input type="hidden" name="userData" value='{"id":123456789,"first_name":"User","hash":"token"}'>
  </form>
  <script>
    // Автоматическая отправка формы
    document.getElementById('csrf-form').submit();
  </script>
</body>
</html>
```

**Ожидаемый результат**: ✅ Запрос должен быть отклонен (если нет CSRF токена или проверки Origin)

**Текущее состояние**: ⚠️ Нет CSRF защиты - это уязвимость!

**Рекомендация**: Добавить CSRF токены или проверку Origin/Referer

**Тест 1.2: CSRF через img тег**

```html
<img src="https://your-domain.com/api/createPayment?planId=premium&userId=tg_123456789" />
```

**Ожидаемый результат**: ❌ Запрос не должен выполняться (GET запросы должны быть отклонены для создания платежа)

---

## Тестирование SQL Injection

### 1. SQL Injection через параметры

**Цель**: Попытка внедрить SQL код через входные данные.

**Тест 1.1: SQL Injection в paymentId**

```bash
# Попытка SQL injection через paymentId
curl -X POST https://your-domain.com/api/payments/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "1\"; DROP TABLE payments; --",
    "userData": {...}
  }'
```

**Ожидаемый результат**: ✅ Запрос должен быть безопасно обработан (Supabase использует параметризованные запросы)

**Тест 1.2: SQL Injection в userId**

```bash
curl -X POST https://your-domain.com/api/createPayment \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "premium",
    "userId": "tg_123\"; DROP TABLE users; --",
    "userData": {...}
  }'
```

**Ожидаемый результат**: ✅ Запрос должен быть безопасно обработан

---

## Тестирование Rate Limiting

### 1. Отсутствие Rate Limiting

**Цель**: Проверить защиту от брутфорса и DDoS атак.

**Тест 1.1: Множественные запросы на авторизацию**

```bash
# Отправить 100 запросов подряд
for i in {1..100}; do
  curl -X POST https://your-domain.com/api/validateTelegramAuth \
    -H "Content-Type: application/json" \
    -d '{"id": 123456789, "first_name": "User", "hash": "token"}'
done
```

**Ожидаемый результат**: ⚠️ Все запросы могут пройти (если нет rate limiting)

**Рекомендация**: Добавить rate limiting (например, через middleware или nginx)

**Тест 1.2: Множественные запросы на создание платежей**

```bash
# Попытка создать 100 платежей подряд
for i in {1..100}; do
  curl -X POST https://your-domain.com/api/createPayment \
    -H "Content-Type: application/json" \
    -d '{"planId": "premium", "userId": "tg_123456789", "userData": {...}}'
done
```

**Ожидаемый результат**: ⚠️ Все запросы могут пройти (если нет rate limiting)

---

## Тестирование конфиденциальности данных

### 1. Утечка информации

**Цель**: Проверить, не раскрываются ли чувствительные данные.

**Тест 1.1: Проверка ответов API на наличие чувствительных данных**

```bash
# Проверить, не возвращаются ли секретные ключи в ответах
curl -X POST https://your-domain.com/api/createPayment \
  -H "Content-Type: application/json" \
  -d '{"planId": "premium", "userId": "tg_123456789", "userData": {...}}' \
  | jq .
```

**Ожидаемый результат**: ✅ Секретные ключи (`YOOKASSA_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`) не должны присутствовать в ответах

**Тест 1.2: Проверка логов на наличие чувствительных данных**

**Метод**: Проверить логи сервера на наличие секретных ключей или токенов.

**Ожидаемый результат**: ✅ Секретные ключи должны быть замаскированы в логах (например, `secretKey.substring(0, 10) + "..."`)

---

## Тестирование валидации входных данных

### 1. Некорректные входные данные

**Цель**: Проверить обработку некорректных входных данных.

**Тест 1.1: Отрицательная сумма платежа**

```bash
# Если есть возможность установить сумму напрямую
```

**Тест 1.2: Несуществующий план**

```bash
curl -X POST https://your-domain.com/api/createPayment \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "nonexistent_plan",
    "userId": "tg_123456789",
    "userData": {...}
  }'
```

**Ожидаемый результат**: ❌ Запрос должен быть отклонен с ошибкой 400 "Invalid plan"

**Тест 1.3: Очень большое значение суммы**

```bash
# Попытка создать платеж с очень большой суммой
# (если есть возможность установить сумму напрямую)
```

**Ожидаемый результат**: ❌ Должна быть валидация максимального значения

---

## Чеклист для аудита

### Авторизация

- [ ] Проверка токена в БД перед авторизацией
- [ ] Проверка одноразовости токена (`site_used_at`)
- [ ] Проверка привязки токена к `telegram_id`
- [ ] Проверка срока действия токена (10 минут)
- [ ] Проверка срока действия данных авторизации (24 часа)
- [ ] Проверка владения ресурсом (платежи, подписки)

### API Endpoints

- [ ] Все защищенные endpoints требуют `userData`
- [ ] Проверка авторизации на сервере (не на клиенте)
- [ ] Проверка владения ресурсом перед выполнением операций
- [ ] Валидация входных данных
- [ ] Обработка ошибок без раскрытия чувствительной информации

### Webhook Endpoints

- [ ] Проверка IP адреса отправителя (в production)
- [ ] Валидация структуры webhook уведомлений
- [ ] Обработка дублирующихся уведомлений (идемпотентность)

### XSS Защита

- [ ] React автоматически экранирует вывод
- [ ] Нет использования `dangerouslySetInnerHTML` с пользовательскими данными
- [ ] Content-Security-Policy заголовки (если настроены)

### CSRF Защита

- [ ] ⚠️ **ТРЕБУЕТСЯ**: Добавить CSRF токены для форм
- [ ] Проверка Origin/Referer заголовков
- [ ] Использование SameSite cookies

### SQL Injection Защита

- [ ] Использование параметризованных запросов (Supabase ORM)
- [ ] Нет конкатенации SQL запросов со строковыми значениями

### Rate Limiting

- [ ] ⚠️ **ТРЕБУЕТСЯ**: Добавить rate limiting для API endpoints
- [ ] Rate limiting для авторизации
- [ ] Rate limiting для создания платежей

### Конфиденциальность данных

- [ ] Секретные ключи не возвращаются в ответах API
- [ ] Секретные ключи замаскированы в логах
- [ ] HTTPS используется везде (в production)
- [ ] Переменные окружения не коммитятся в Git

### Валидация данных

- [ ] Валидация всех входных данных на сервере
- [ ] Проверка типов данных
- [ ] Проверка диапазонов значений
- [ ] Санитизация пользовательского ввода

---

## Примеры тестовых скриптов

### Скрипт для тестирования авторизации

```bash
#!/bin/bash

# Тест 1: Подделка userData
echo "Test 1: Fake userData"
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "userData": {
      "id": 999999999,
      "first_name": "Hacker",
      "hash": "a".repeat(64),
      "auth_date": '$(date +%s)'
    }
  }'

echo -e "\n\nTest 2: Expired auth data"
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "userData": {
      "id": 123456789,
      "first_name": "User",
      "hash": "valid_token",
      "auth_date": '$(($(date +%s) - 25 * 60 * 60))'
    }
  }'

echo -e "\n\nTest 3: Missing userData"
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Скрипт для тестирования доступа к чужим ресурсам

```bash
#!/bin/bash

YOUR_TELEGRAM_ID=123456789
YOUR_TOKEN="your_valid_token"
ANOTHER_PAYMENT_ID="payment_id_from_another_user"

echo "Test: Access to another user payment"
curl -X POST http://localhost:3000/api/payments/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "'$ANOTHER_PAYMENT_ID'",
    "userData": {
      "id": '$YOUR_TELEGRAM_ID',
      "first_name": "Your Name",
      "hash": "'$YOUR_TOKEN'",
      "auth_date": '$(date +%s)'
    }
  }'
```

---

## Отчет о тестировании

### Шаблон отчета

```markdown
# Отчет о тестировании безопасности

## Дата проведения
[Дата]

## Тестировщик
[Имя]

## Область тестирования
[Описание]

## Найденные уязвимости

### Критичность: Высокая

#### 1. [Название уязвимости]
**Описание**: [Описание]
**Шаги воспроизведения**: [Шаги]
**Воздействие**: [Воздействие]
**Рекомендации**: [Рекомендации]

### Критичность: Средняя

#### 2. [Название уязвимости]
...

### Критичность: Низкая

#### 3. [Название уязвимости]
...

## Пройденные тесты

### ✅ Безопасные компоненты

- [ ] Авторизация через Telegram работает корректно
- [ ] Токены одноразовые и привязаны к пользователям
- [ ] Доступ к чужим ресурсам запрещен
- [ ] SQL Injection защита работает
- [ ] XSS защита работает (через React)

### ⚠️ Требует улучшения

- [ ] CSRF защита отсутствует
- [ ] Rate limiting отсутствует
- [ ] Content-Security-Policy не настроен

## Рекомендации

1. Добавить CSRF защиту для всех форм
2. Добавить rate limiting для API endpoints
3. Настроить Content-Security-Policy заголовки
4. Добавить мониторинг подозрительной активности
5. Регулярно проводить аудит безопасности
```

---

## Список известных уязвимостей

### Текущие уязвимости

1. **CSRF уязвимость** (Средняя критичность)
   - **Описание**: Отсутствует CSRF защита для POST запросов
   - **Воздействие**: Злоумышленник может выполнить запросы от имени авторизованного пользователя
   - **Рекомендации**: Добавить CSRF токены или проверку Origin/Referer

2. **Отсутствие Rate Limiting** (Средняя критичность)
   - **Описание**: Нет ограничения на количество запросов
   - **Воздействие**: Возможность DDoS атак или брутфорса
   - **Рекомендации**: Добавить rate limiting через middleware или nginx

3. **Отсутствие Content-Security-Policy** (Низкая критичность)
   - **Описание**: CSP заголовки не настроены
   - **Воздействие**: Дополнительная защита от XSS отсутствует
   - **Рекомендации**: Настроить CSP заголовки

---

## Контакты

При обнаружении уязвимости безопасности, пожалуйста, сообщите об этом через:
- Email: security@vlesser.ru
- Telegram: @support

**НЕ публикуйте уязвимости публично до исправления!**

