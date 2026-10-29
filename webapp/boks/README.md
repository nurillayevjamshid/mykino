Boks bo'limi — NTV × O'zbekiston Boks Federatsiyasi hamkorligi (boks.js, boks.css, boks.json).
Lazy-load: kino.js dagi ensureBoksModule(). Havola: /?section=boks

Admin panel → «Boks» (api/_lib/boks.js, /api/boks, Redis boks:config:v1):
- Efir: YouTube link, sarlavha, izoh, «Jonli» belgisi
- Janglar: YouTube kanal (standart @taylorohiggins1734) — faqat 3 daqiqadan uzun videolar
  (shorts va kliplar chiqmaydi); 20 tagacha jangni pin qilish (mini ilovada eng tepada),
  keraksiz videoni yashirish
- Janglar arxivi Redis'da (boks:fights:v1): YouTube bir so'rovda oxirgi ~300 videoni beradi,
  kanalda esa minglab video bor. Yangilari avtomatik qo'shiladi; eskilarini admin
  «Butun arxivni yuklash» bilan bir marta oladi. Mini ilova qidiruvi serverda, butun arxiv
  bo'yicha (kirill/lotin, o'/g', x/kh farqisiz; "o'zbekiston" → UZB)
- Terma jamoa: rasm, ism, vazn toifasi, natija

Yangiliklar: Telegram @boxinguzbekistan kanalidan avtomatik (t.me/s/ sahifasi, 2 daqiqa kesh).

boks.json (kesh: ~10 daqiqada yangilanadi):
- partner: name, logo (rasm URL, bo'sh bo'lsa qo'lqop belgisi), about, links [{label, url}]
- stats: [{value, label}] — hero kartadagi raqamlar
