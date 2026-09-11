# Botni VPS'da ishga tushirish (Vercel'siz)

Bu qo'llanma botni **oddiy server/VPS**da ishga tushirish uchun. Bot `/start`
bosganlarni `data/users.json` ga yozadi va admin panel shu fayldan o'qiydi.

---

## Nima o'zgaradi

| | Vercel rejimi (hozirgi) | VPS rejimi (shu qo'llanma) |
| --- | --- | --- |
| `/start` qabul qilish | Webhook (`api/telegram-webhook.js`) | Bot polling (`bot/main.py`) |
| User saqlash joyi | Cloudflare R2 / Blob | `data/users.json` (lokal fayl) |
| Admin panel API | `/api/users` (serverless) | `/api/users` (aiohttp, `bot/webserver.py`) |
| Fayl saqlanishi | Tashqi servis | Serverning o'z diski |

Bot va mini app bitta jarayonda ishlaydi: `bot/main.py` ham Telegram'ga ulanadi,
ham mini app'ni (shu jumladan admin panelni) HTTP orqali tarqatadi.

---

## 1. Serverga ulanish va loyihani olish

```bash
ssh root@<SERVER_IP>
apt update && apt install -y python3 python3-venv python3-pip git
```

```bash
cd /opt
git clone https://github.com/nurillayevjamshid/mykino.git
cd mykino
```

---

## 2. Virtual muhit va kutubxonalar

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 3. `.env` faylini yaratish

```bash
cp .env.example .env
nano .env
```

To'ldirilishi shart bo'lgan qatorlar:

```env
BOT_TOKEN=8123456789:AAF...          # @BotFather'dan
BOT_USERNAME=myntv_bot
WEBAPP_URL=https://<domeningiz>      # oxirida "/" bo'lmasin
WEB_HOST=0.0.0.0
WEB_PORT=8080
ADMIN_PASSWORD=kuchli-parol           # "admin123" QOLDIRMANG
```

Ixtiyoriy (kino katalogi va mini app bo'limlari uchun): `GOOGLE_DRIVE_FOLDER_ID`,
`R2_*`, `YOUTUBE_API_KEY`, `CONTENT_CHANNEL_USERNAME`.

> **Muhim:** `BOT_LAUNCH_DATE` ni **bo'sh qoldiring**, agar eski obunachilarni
> yashirish kerak bo'lmasa. Sana yozsangiz, shu sanadan oldin `/start` bosganlar
> admin panelda ko'rinmaydi (bazada saqlanib qoladi).

---

## 4. Sinab ko'rish

```bash
source .venv/bin/activate
python -m bot.main
```

Kutilgan chiqish:

```
INFO: Mini app server started at http://0.0.0.0:8080
```

Endi Telegram'da botga `/start` bosing. So'ngra boshqa terminalda:

```bash
curl -s http://127.0.0.1:8080/api/users | head -40
```

`data/users.json` faylida yozuv paydo bo'lganini ko'rasiz:

```bash
cat data/users.json
```

---

## 5. Doimiy ishlashi (systemd)

`Ctrl+C` bilan to'xtatib, service yarating:

```bash
nano /etc/systemd/system/ntv-bot.service
```

```ini
[Unit]
Description=NTV Telegram bot va mini app
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mykino
ExecStart=/opt/mykino/.venv/bin/python -m bot.main
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now ntv-bot
systemctl status ntv-bot
```

Loglarni ko'rish:

```bash
journalctl -u ntv-bot -f
```

---

## 6. Admin panelga kirish

Admin panel manzili: `http://<SERVER_IP>:8080/admin`

Uni to'g'ridan-to'g'ri ochish o'rniga **nginx** orqali domen va HTTPS ulang:

```bash
apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/ntv`:

```nginx
server {
    listen 80;
    server_name sizning-domeningiz.uz;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/ntv /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d sizning-domeningiz.uz
```

So'ngra `.env` dagi `WEBAPP_URL` ni `https://sizning-domeningiz.uz` ga
o'zgartirib, botni qayta ishga tushiring:

```bash
systemctl restart ntv-bot
```

Telegram'da @BotFather → `/mybots` → bot → **Bot Settings** → **Menu Button**
→ shu domenni kiriting.

---

## 7. Admin panelda userlar qanday ko'rinadi

Admin panel **Obunachilar** bo'limi `users.json` dagi ma'lumotlarni ko'rsatadi:

| Ustun | Manba maydon |
| --- | --- |
| Ism | `first_name` + `last_name` |
| Username | `username` |
| Telegram ID | `telegram_id` |
| /start sanasi | `started_at` |
| Oxirgi faollik | `last_active` |

Qidiruv, sana filtri va saralash avvalgidek ishlaydi. Qo'shimcha
"Oxirgi faollik bo'yicha" saralash qo'shilgan.

---

## 8. Zaxira (backup)

`users.json` serverda qoladi — uni yo'qotmaslik uchun kunlik nusxa oling:

```bash
crontab -e
```

```cron
0 3 * * * cp /opt/mykino/data/users.json /opt/mykino/data/backups/users-$(date +\%F).json
```

> `data/backups/` papkasini oldindan yarating:
> `mkdir -p /opt/mykino/data/backups`

---

## Eslatmalar

- **Vercel shart emas.** Bot, mini app va admin panel — hammasi shu serverda.
- **Tashqi baza shart emas.** `data/users.json` oddiy JSON fayl.
- **Dependency qo'shilmadi.** Faqat `requirements.txt` dagi to'rtta kutubxona:
  `aiogram`, `aiohttp`, `aiohttp-client-cache`, `python-dotenv`.
- Saytning boshqa bo'limlari (kino katalogi, qidiruv, profil) avvalgidek ishlaydi.
