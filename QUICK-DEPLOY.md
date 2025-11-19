# ⚡ Быстрый деплой - шпаргалка

## 📤 1. Отправить на GitHub (локально)

```powershell
git add .
git commit -m "Описание изменений"
git push origin master
```

## 📥 2. Обновить на сервере (Linux)

```bash
cd /path/to/vpn_bot
git pull origin master
npm install --production
pip install -r requirements.txt
npm run build
pm2 restart all
sudo systemctl restart xray-service
```

## 📥 2. Обновить на сервере (Windows)

```powershell
cd C:\path\to\vpn_bot
git pull origin master
npm install --production
pip install -r requirements.txt
npm run build
pm2 restart all
Restart-Service -Name "XrayService"
```

## 🆕 Первый раз на сервере (Linux)

```bash
cd /home/user
git clone https://github.com/IV-YADOV/vlesser.git vpn_bot
cd vpn_bot
npm install --production
pip install -r requirements.txt
npm run build
# Создайте .env.local
nano .env.local
```

## 🆕 Первый раз на сервере (Windows)

```powershell
cd C:\Projects
git clone https://github.com/IV-YADOV/vlesser.git vpn_bot
cd vpn_bot
npm install --production
pip install -r requirements.txt
npm run build
# Создайте .env.local
notepad .env.local
```

---

**💡 Совет:** Можно объединить команды в одну строку:

**Linux:**
```bash
cd /path/to/vpn_bot && git pull && npm install --production && pip install -r requirements.txt && npm run build && pm2 restart all
```

**Windows:**
```powershell
cd C:\path\to\vpn_bot; git pull; npm install --production; pip install -r requirements.txt; npm run build; pm2 restart all
```

