#!/usr/bin/env python3
"""
Xray API Service для создания VLESS конфигов
Запуск: python xray_service.py
"""

import requests
import json
import uuid
import time
import os
from urllib3.exceptions import InsecureRequestWarning
from flask import Flask, request, jsonify
from flask_cors import CORS

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для запросов с сайта

# Настройки из переменных окружения или значения по умолчанию
BASE_URL = os.getenv("XRAY_BASE_URL", "https://217.195.153.13:48404/ssrgMOLXrbIm3I2")
USERNAME = os.getenv("XRAY_USERNAME", "HellMoth")
PASSWORD = os.getenv("XRAY_PASSWORD", "zvxcqa228008")
INBOUND_ID = int(os.getenv("XRAY_INBOUND_ID", "1"))

# Глобальная сессия
session = requests.Session()
session.verify = False


def login():
    """Авторизация в xray панели"""
    try:
        r = session.post(f"{BASE_URL}/login", json={
            "username": USERNAME,
            "password": PASSWORD
        })
        
        if "success" in r.text.lower():
            print("✅ Успешно залогинились в xray")
            return True
        else:
            print(f"❌ Ошибка логина: {r.text}")
            return False
    except Exception as e:
        print(f"❌ Ошибка при логине: {e}")
        return False


def get_inbound(id_):
    """Получить информацию об инбаунде"""
    try:
        url = f"{BASE_URL}/panel/api/inbounds/get/{id_}"
        r = session.get(url)
        return r.json().get("obj", None)
    except Exception as e:
        print(f"❌ Ошибка при получении inbound: {e}")
        return None


def update_inbound(inbound):
    """Обновить инбаунд"""
    try:
        url = f"{BASE_URL}/panel/api/inbounds/update/{inbound['id']}"
        r = session.post(url, json=inbound)
        return r.json().get("success", False)
    except Exception as e:
        print(f"❌ Ошибка при обновлении inbound: {e}")
        return False


def get_existing_clients():
    """Получить список существующих клиентов из инбаунда"""
    inbound = get_inbound(INBOUND_ID)
    if not inbound:
        return []
    
    try:
        settings = json.loads(inbound["settings"])
        clients = settings.get("clients", [])
        return clients
    except Exception as e:
        print(f"❌ Ошибка при получении клиентов: {e}")
        return []


def generate_unique_email(base_email):
    """Генерирует уникальный email в формате base_email_1, base_email_2 и т.д."""
    existing_clients = get_existing_clients()
    existing_emails = {client.get("email", "") for client in existing_clients}
    
    # Если базовый email свободен, используем его
    if base_email not in existing_emails:
        return base_email
    
    # Ищем первый свободный номер
    counter = 1
    while True:
        new_email = f"{base_email}_{counter}"
        if new_email not in existing_emails:
            return new_email
        counter += 1
        
        # Защита от бесконечного цикла
        if counter > 1000:
            print(f"⚠️ Достигнут лимит попыток для {base_email}")
            return f"{base_email}_{counter}"


def add_client(email, days):
    """Добавить клиента в инбаунд с уникальным email"""
    inbound = get_inbound(INBOUND_ID)
    if not inbound:
        print("❌ Не найден inbound")
        return None

    settings = json.loads(inbound["settings"])

    # Генерируем уникальный email
    unique_email = generate_unique_email(email)
    if unique_email != email:
        print(f"ℹ️ Email {email} уже существует, используем {unique_email}")

    new_uuid = str(uuid.uuid4())

    # Вычисление expiryTime
    if days > 0:
        expiry_timestamp = int((time.time() + days * 86400) * 1000)
    else:
        expiry_timestamp = 0

    new_client = {
        "id": new_uuid,
        "email": unique_email,
        "flow": "xtls-rprx-vision",
        "limitIp": 0,
        "totalGB": 0,
        "expiryTime": expiry_timestamp,
        "enable": True
    }

    settings.setdefault("clients", []).append(new_client)
    inbound["settings"] = json.dumps(settings)

    if update_inbound(inbound):
        print(f"✅ Клиент успешно создан: {unique_email}")
        return new_client
    else:
        print("❌ Ошибка обновления inbound")
        return None


def find_client_by_email(email):
    """Найти клиента в инбаунде по email"""
    inbound = get_inbound(INBOUND_ID)
    if not inbound:
        return None
    
    try:
        settings = json.loads(inbound["settings"])
        clients = settings.get("clients", [])
        
        for client in clients:
            if client.get("email") == email:
                return client
        return None
    except Exception as e:
        print(f"❌ Ошибка при поиске клиента: {e}")
        return None


def get_client_vless_link(email):
    """Получить VLESS ссылку клиента из xray панели (используя реальные данные из xray)"""
    try:
        # Получаем инбаунд из xray
        inbound = get_inbound(INBOUND_ID)
        if not inbound:
            print("❌ Не удалось получить inbound из xray")
            return None
        
        # Находим клиента в инбаунде по email (используем реальные данные из xray)
        client = find_client_by_email(email)
        if not client:
            print(f"❌ Клиент {email} не найден в xray")
            return None
        
        # Получаем реальные данные из xray
        host = BASE_URL.split("://")[1].split(":")[0]
        port = inbound["port"]  # Реальный порт из xray
        stream = json.loads(inbound["streamSettings"])
        security = stream.get("security", "none")  # Реальная security из xray
        network = stream.get("network", "tcp")  # Реальная network из xray
        
        # Используем реальные данные клиента из xray
        client_id = client.get("id", "")  # Реальный UUID клиента из xray
        client_flow = client.get("flow", "")  # Реальный flow клиента из xray
        client_email = client.get("email", email)  # Реальный email клиента из xray
        
        # Собираем параметры для VLESS ссылки
        params = []
        params.append(f"type={network}")
        params.append(f"security={security}")
        
        # Если security = reality, добавляем параметры Reality
        if security == "reality":
            reality_settings = stream.get("realitySettings", {})
            
            # Публичный ключ сервера (pbk) - фиксированное значение
            pbk = "w2nO9tdj5CxS3aAxNjgSA1EEiBjnbzjMWWl5Qr0U-Gk"
            params.append(f"pbk={pbk}")
            
            # Fingerprint (fp)
            fp = reality_settings.get("fingerprint", "")
            if not fp:
                # Пробуем получить из tlsSettings
                tls_settings = stream.get("tlsSettings", {})
                fp = tls_settings.get("fingerprint", "random")
            if not fp:
                fp = "random"
            params.append(f"fp={fp}")
            
            # Server Name (sni) - фиксированное значение
            sni = "www.google.com"
            params.append(f"sni={sni}")
            
            # Short ID (sid) - может быть в массиве, берем первый
            short_ids = reality_settings.get("shortIds", [])
            if short_ids and len(short_ids) > 0:
                sid = short_ids[0]
                params.append(f"sid={sid}")
            else:
                # Если нет в настройках, используем значение по умолчанию
                sid = "19"
                params.append(f"sid={sid}")
            
            # Server Path (spx) - обычно для WebSocket
            spx = None
            network_settings = stream.get("wsSettings", {})
            if not network_settings:
                network_settings = stream.get("httpSettings", {})
            if network_settings:
                path = network_settings.get("path", "")
                if path:
                    # URL encode для path
                    import urllib.parse
                    spx = urllib.parse.quote(path, safe='')
            
            # Если не нашли path, используем значение по умолчанию
            if not spx:
                spx = "%2F"
            params.append(f"spx={spx}")
        
        # Добавляем flow в конец, если есть
        if client_flow:
            params.append(f"flow={client_flow}")
        
        # Собираем финальную VLESS ссылку
        query_string = "&".join(params)
        vless_link = f"vless://{client_id}@{host}:{port}?{query_string}#{client_email}"
        
        print(f"📋 VLESS ссылка получена из реальных данных xray:")
        print(f"   ✅ ID клиента из xray: {client_id}")
        print(f"   ✅ Flow из xray: {client_flow}")
        print(f"   ✅ Email из xray: {client_email}")
        print(f"   ✅ Host: {host}")
        print(f"   ✅ Port из xray: {port}")
        print(f"   ✅ Security из xray: {security}")
        print(f"   ✅ Network из xray: {network}")
        if security == "reality":
            print(f"   ✅ Reality параметры добавлены")
        
        return vless_link
    except Exception as e:
        print(f"❌ Ошибка при получении VLESS ссылки из xray: {e}")
        import traceback
        traceback.print_exc()
        return None


@app.route("/health", methods=["GET"])
def health():
    """Проверка работоспособности сервиса"""
    return jsonify({"status": "ok", "service": "xray-api"})


@app.route("/create-client", methods=["POST"])
def create_client():
    """Создать клиента в xray и вернуть VLESS ссылку"""
    try:
        data = request.json
        email = data.get("email")
        days = data.get("days", 0)

        if not email:
            return jsonify({"error": "Email (userId) is required"}), 400

        # Логинимся если нужно (сессия может истечь)
        if not login():
            return jsonify({"error": "Failed to login to xray panel"}), 500

        # Создаём клиента
        created_client = add_client(email, days)
        if not created_client:
            return jsonify({"error": "Failed to create client in xray"}), 500

        # Получаем созданного клиента из xray и его VLESS ссылку
        unique_email = created_client["email"]
        
        # Получаем VLESS ссылку из xray (используя реальные данные клиента)
        vless_link = get_client_vless_link(unique_email)
        if not vless_link:
            return jsonify({"error": "Failed to get VLESS link from xray"}), 500

        # Получаем данные клиента для ответа
        client = find_client_by_email(unique_email)
        if not client:
            return jsonify({"error": "Created client not found in inbound"}), 500

        return jsonify({
            "success": True,
            "vless_link": vless_link,
            "client_id": client["id"],
            "email": client["email"],
            "expiry_time": client["expiryTime"]
        })

    except Exception as e:
        print(f"❌ Ошибка в create_client: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("🚀 Запуск Xray API Service...")
    print(f"📍 URL: {BASE_URL}")
    print(f"👤 Username: {USERNAME}")
    print(f"🔢 Inbound ID: {INBOUND_ID}")
    
    # Логинимся при старте
    if login():
        print("✅ Сервис готов к работе!")
        print("📡 API доступен на http://localhost:5000")
        print("\nEndpoints:")
        print("  GET  /health - проверка работоспособности")
        print("  POST /create-client - создать клиента")
        print("\nПример запроса:")
        print('  curl -X POST http://localhost:5000/create-client \\')
        print('    -H "Content-Type: application/json" \\')
        print('    -d \'{"email": "user123", "days": 30}\'')
        print("\n" + "="*50 + "\n")
        
        # Запускаем Flask сервер
        app.run(host="0.0.0.0", port=5000, debug=False)
    else:
        print("❌ Не удалось авторизоваться в xray панели")
        print("Проверьте настройки в переменных окружения")

