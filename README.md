# Kino Bot + Telegram Mini App

Telegram ichida kinolar katalogini ko'rish uchun bot va mini app starter loyihasi.

## Nimalar bor

- Telegram bot user menyusi: kinolar, qidirish, TOP kinolar, premium, profil, bog'lanish.
- Mini app: rasmga o'xshash qorong'i kino katalog UI, til switcher, qidiruv, kategoriya/top filter, profil/premium modal, kino detail oynasi.
- Google Drive katalog integratsiyasi: papkadagi videolar kartalar sifatida chiqadi.
- MP4 (`H.264/AAC`) videolar Mini App ichida eng barqaror ishlaydi, ayniqsa iPhone uchun.
- Kanalga tashlangan video postlardan to'ladigan JSON ma'lumotlar bazasi: `data/movies.json`.

## Ishga tushirish

1. Virtual muhit yarating va paketlarni o'rnating:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Agar `python` buyrug'i topilmasa, Windows uchun Python 3.11+ o'rnating va "Add Python to PATH" opsiyasini yoqing.

2. `.env.example` faylidan `.env` yarating va qiymatlarni yozing:

```powershell
Copy-Item .env.example .env
```

3. Botni ishga tushiring:

```powershell
python -m bot.main
```

4. Botni kino kanaliga postlarni o'qiy oladigan qilib qo'shing. Kanal username'ini `.env` ichida ko'rsating:

```env
CONTENT_CHANNEL_USERNAME=mdtsitsibtaryyarbeaa
```

5. Kanalga kino tashlash uchun caption namunasi:

```text
Nomi: Interstellar
Kod: INT14
Janr: Sci-Fi
Yil: 2014
Reyting: 8.7
Sifat: HD
Premium: yo'q
Top: ha
Tavsif: Qisqa izoh.
```

Faqat video tashlasangiz ham bot uni nomini file nomi yoki captiondan olib qo'shadi.

6. Telegram Mini App faqat HTTPS URL bilan to'liq ishlaydi. Local sinov uchun ngrok/cloudflared orqali `http://localhost:8080` ni HTTPS ga chiqaring va o'sha URL ni `WEBAPP_URL` ga yozing.

7. Google Drive katalog ishlashi uchun `.env` ichida papka ID va service account credential yozing:

```env
GOOGLE_DRIVE_FOLDER_ID=your-google-drive-folder-id
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64=base64-encoded-service-account-json
```

8. YouTube playlist ishlashi uchun `.env` ichida YouTube Data API key va playlist ID yozing:

```env
YOUTUBE_API_KEY=your-youtube-data-api-key
YOUTUBE_PLAYLIST_ID=PLrW0WsV8cL9Rug7pLf8D8NOqEI7YeO6kE
```

## Telegram file_id player

Mini app `telegramVideoFileId`, `video_file_id`, `telegramFileId`, `videoUrl`, `streamUrl`, `embedUrl` yoki `trailerUrl` maydonlarini tekshiradi.

- `telegramVideoFileId` bo'lsa frontend `/api/stream/:fileId` ni `<video>` playerga ulaydi.
- Backend `BOT_TOKEN` bilan Telegram `getFile` chaqirib `file_path` oladi va stream/proxy qiladi.
- Bot token frontendga chiqmaydi.
- Katta video yoki Telegram cheklovi bo'lsa bo'sh ekran chiqmaydi: Mini App fallback xabar va `Telegramda ochish` tugmasini ko'rsatadi.
- `telegramPostUrl` bo'lsa fallback tugmasi shu linkni ochadi.

`streamUrl` maydonlariga faqat o'zingizda huquqi bor yoki legal manbadan olingan video linklarni qo'ying. Hozirgi sample linklar demo/trailer oqimini ko'rsatish uchun.

Hozir Mini App asosiy katalogni `/api/movies` dan oladi va uni Google Drive papkadan to'ldiradi.

## Vercel

Vercel deploy mini app domeni uchun tayyorlangan:

- `/` mini app sahifasini ochadi.
- `/api/youtube/movies` YouTube Data API `playlistItems.list` orqali playlistdagi videolarni qaytaradi.
- `/api/movies` Google Drive papkadan video fayllarni JSON qilib qaytaradi.
- `/api/drive-stream/:fileId` Google Drive video faylini backend orqali stream/proxy qiladi.
- `/api/drive-thumbnail/:fileId` Google Drive thumbnail/poster proxy qiladi.
- `/api/video-url/:fileId` Telegram `file_id` uchun token yashirilgan playable URL qaytaradi.
- `/api/stream/:fileId` Telegram faylini backend orqali stream/proxy qiladi.
- `/api/video-stream/:fileId` Telegram faylini backend orqali stream/proxy qiladi.
- `.env` Vercelga yuborilmaydi.
- Production domen: `https://kino-telegram-mini-app.vercel.app`

Eslatma: kanal public bo'lsa, Vercel `/api/movies` yangi video postlarni taxminan 15 soniya ichida ko'rsatadi, lekin `file_id` faqat bot kanal postini update sifatida olganda saqlanadi. Agar bot ishlamay turganda eski post qo'shilgan bo'lsa, u post qayta yuborilishi yoki keyingi bosqichda database orqali to'ldirilishi kerak. Agar kanal private qilinsa, keyingi bosqichda Supabase yoki Vercel KV kabi umumiy database ulash kerak bo'ladi.

Productionda Google Drive katalog ishlashi uchun Vercel environment variables ichida `GOOGLE_DRIVE_FOLDER_ID` va `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64` bo'lishi shart. Telegram video endpoint ishlashi uchun `BOT_TOKEN` kerak. iPhone uchun eng yaxshi natija beradigan format `MP4 (H.264/AAC)`.

Production deploy:

```powershell
npx vercel --prod
```

## Format tavsiyasi

Google Drive'dan kinolarni Mini App ichida barqaror ko'rsatish uchun videolarni `MP4 (H.264 video + AAC audio)` formatida yuklang. `MKV` va ayrim boshqa container formatlar, ayniqsa iPhone ichidagi Telegram WebView'da sekin ochilishi yoki umuman inline playerda ishlamasligi mumkin.
