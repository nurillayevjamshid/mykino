# Kino Bot + Telegram Mini App

Telegram ichida kinolar katalogini ko'rish uchun bot va mini app starter loyihasi.

## Nimalar bor

- Telegram bot user menyusi: kinolar, qidirish, TOP kinolar, premium, profil, bog'lanish.
- Admin panel inline menyusi: kinolar, kategoriyalar, majburiy obuna, foydalanuvchilar, statistika va boshqalar.
- Mini app: rasmga o'xshash qorong'i kino katalog UI, til switcher, qidiruv, kategoriya/top filter, profil/premium modal, kino detail oynasi.
- YouTube playlist integratsiyasi: playlistdagi Public/Unlisted videolar kartalar sifatida chiqadi va iframe playerda ochiladi.
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

4. Botni kino kanaliga admin qiling. Kanal username'ini `.env` ichida ko'rsating:

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

Admin sifatida eski yoki bot ishlamay turganda o'tib ketgan postlarni tortish:

```text
/sync
```

6. Telegram Mini App faqat HTTPS URL bilan to'liq ishlaydi. Local sinov uchun ngrok/cloudflared orqali `http://localhost:8080` ni HTTPS ga chiqaring va o'sha URL ni `WEBAPP_URL` ga yozing.

7. YouTube playlist ishlashi uchun `.env` ichida YouTube Data API key va playlist ID yozing:

```env
YOUTUBE_API_KEY=your-youtube-data-api-key
YOUTUBE_PLAYLIST_ID=PLrW0WsV8cL9Rug7pLf8D8NOqEI7YeO6kE
```

## Muhim

`streamUrl` maydonlariga faqat o'zingizda huquqi bor yoki legal manbadan olingan video linklarni qo'ying. Hozirgi sample linklar demo/trailer oqimini ko'rsatish uchun.

Mini app player `video_file_id`, `telegramFileId`, `videoUrl`, `streamUrl`, `embedUrl` yoki `trailerUrl` maydonlarini tekshiradi. Direct `.mp4/.webm/.ogg` linklar `<video>` orqali, YouTube linklar iframe orqali ochiladi. Telegram kanal videosi uchun frontend faqat `file_id` yuboradi; backend `BOT_TOKEN` bilan `getFile` chaqirib `/api/video-stream/:fileId` orqali videoni proxy qiladi. Bot token frontendga chiqmaydi.

Hozir Mini App asosiy katalogni `/api/youtube/movies` dan oladi. YouTube videolar Public yoki Unlisted bo'lishi va `Allow embedding` yoqilgan bo'lishi kerak. Private video iframe orqali ishlamaydi.

## Vercel

Vercel deploy mini app domeni uchun tayyorlangan:

- `/` mini app sahifasini ochadi.
- `/api/youtube/movies` YouTube Data API `playlistItems.list` orqali playlistdagi videolarni qaytaradi.
- `/api/movies` public Telegram kanalini o'qib video postlarni JSON qilib qaytaradi.
- `/api/video-url/:fileId` Telegram `file_id` uchun token yashirilgan playable URL qaytaradi.
- `/api/video-stream/:fileId` Telegram faylini backend orqali stream/proxy qiladi.
- `.env` Vercelga yuborilmaydi.
- Production domen: `https://kino-telegram-mini-app.vercel.app`

Eslatma: kanal public bo'lsa, Vercel `/api/movies` yangi video postlarni taxminan 15 soniya ichida ko'rsatadi, lekin `file_id` faqat bot kanal postini update sifatida olganda saqlanadi. Agar bot ishlamay turganda eski post qo'shilgan bo'lsa, u post qayta yuborilishi yoki keyingi bosqichda database orqali to'ldirilishi kerak. Agar kanal private qilinsa, keyingi bosqichda Supabase yoki Vercel KV kabi umumiy database ulash kerak bo'ladi.

Productionda YouTube playlist ishlashi uchun Vercel environment variables ichida `YOUTUBE_API_KEY` va `YOUTUBE_PLAYLIST_ID` bo'lishi shart. Telegram video endpoint ishlashi uchun `BOT_TOKEN` kerak.

Production deploy:

```powershell
npx vercel --prod
```
