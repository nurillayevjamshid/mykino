# Botni almashtirish — Vercel qo'llanmasi

Yangi botga o'tish uchun quyidagi tartibni bajaring. Har bir qadamdan keyin
tekshirish buyrug'i bor.

---

## 0. Tayyorgarlik

Yangi botni **@BotFather** dan yaratib, tokenini oling va mini app'ni ulang.

Terminalni loyiha papkasida oching:

```bash
cd "C:/Users/user/WorkBuddy AI/2026-09-11-17-48-23/mykino"
```

Vercel CLI o'rnatilganini tekshiring:

```bash
npx vercel --version
```

> Vercel hisobingizga ulanmagan bo'lsangiz: `npx vercel login`

---

## 1. Production'ni bog'lash

```bash
npx vercel link
```

So'ralganda mavjud loyihani tanlang (`kino-telegram-mini-app`).

---

## 2. Hozirgi qiymatlarni ko'rish

```bash
npx vercel env ls
```

`BOT_TOKEN` va `WEBAPP_URL` borligini tasdiqlang. Har biri **uchta muhitda**
alohida turadi: `Production`, `Preview`, `Development`.

---

## 3. Eski BOT_TOKEN'ni o'chirish

**Muhim:** Vercel'da bir xil nomli o'zgaruvchi ustiga yozib bo'lmaydi.
Avval eskisini o'chirish kerak, aks holda eski token qolib ketadi.

```bash
npx vercel env rm BOT_TOKEN production
npx vercel env rm BOT_TOKEN preview
npx vercel env rm BOT_TOKEN development
```

Har biri tasdiq so'raydi — `y` bosing.

---

## 4. Yangi BOT_TOKEN'ni qo'shish

```bash
npx vercel env add BOT_TOKEN production
```

So'ralganda **yangi token**ni joylashtiring (masalan `8123456789:AAF...`) va Enter.

```bash
npx vercel env add BOT_TOKEN preview
npx vercel env add BOT_TOKEN development
```

Uch muhit uchun ham xuddi shu tokenni bering.

> Diqqat: qiymatni yozganda ko'rinmaydi. Xato qilmaganingizga ishonch hosil qiling —
> tokendagi bo'sh joy yoki qator oxiridagi belgi botni ishlamay qo'yadi.

---

## 5. WEBAPP_URL ni tekshirish

Agar domen **o'zgarmagan** bo'lsa (ya'ni `https://kino-telegram-mini-app.vercel.app`
bo'lib qolsa) — bu qadamni o'tkazib yuboring.

Domen o'zgargan bo'lsa:

```bash
npx vercel env rm WEBAPP_URL production
npx vercel env add WEBAPP_URL production
# qiymat: https://yangi-domen.vercel.app  (oxirida "/" yo'q!)
```

Preview va Development uchun ham takrorlang.

---

## 6. Tekshirish

```bash
npx vercel env ls
```

`BOT_TOKEN` va `WEBAPP_URL` yangi qiymatlar bilan turganini tasdiqlang.

---

## 7. Qayta deploy

O'zgaruvchilar **build vaqtida** o'qiladi — shuning uchun qayta deploy shart:

```bash
npx vercel --prod
```

---

## 8. Botni ulash

Yangi bot uchun webhook o'rnatish (agar webhook ishlatilsa):

```bash
curl "https://api.telegram.org/bot<YANGI_TOKEN>/setWebhook?url=https://kino-telegram-mini-app.vercel.app/api/telegram-webhook"
```

Javobda `"ok":true` bo'lishi kerak.

Bot @BotFather'da mini app tugmasini yangi domenga ulang:
`/mybots` → botni tanlang → **Bot Settings** → **Menu Button** → URL kiriting.

---

## 9. Eskisini ishlamaydigan qilish

Yangi bot ishlayotganini tasdiqlagandan **keyin**:

1. **@BotFather** → `/mybots` → **eski bot** → **API Token** → **Revoke current token**.
   Shu bilan eski token butunlay o'lik bo'ladi.
2. Eski botning **Menu Button**'ini olib tashlang yoki yangi domenga yo'naltiring.
3. Telegram'da eski botni `/deletebot` bilan o'chiring (ixtiyoriy).

> Ketma-ketlik muhim: avval yangisini to'liq ishga tushiring, keyin eskisini
> o'chiring. Aks holda foydalanuvchilar bir zumda boshqa joyga tushib qoladi.

---

## Tez-tez uchraydigan xatolar

| Belgisi | Sababi | Yechimi |
| --- | --- | --- |
| Mini app ochilmaydi | `WEBAPP_URL` eski domenda qolgan | 5 va 7-qadamlar |
| Bot javob bermaydi | `BOT_TOKEN` yangilanmagan yoki deploy qilinmagan | 3, 4, 7-qadamlar |
| `401` xatosi | Webhook eski tokenga bog'langan | 8-qadam |
| Rasm yuklanmaydi | R2 o'zgaruvchilari to'liq emas | `.env.example` dagi R2 bo'limi |
| Ulashish havolasi eski botga chiqadi | `window.MYKINO_BOT_USERNAME` yangilanmagan | `webapp/index.html` |
