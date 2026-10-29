Boks bo'limi — NTV × O'zbekiston Boks Federatsiyasi hamkorligi (boks.js, boks.css, boks.json).
Lazy-load: kino.js dagi ensureBoksModule(). Havola: /?section=boks

Kontent faqat boks.json da (kesh: ~10 daqiqada yangilanadi):
- partner: name, logo (rasm URL, bo'sh bo'lsa qo'lqop belgisi), about, links [{label, url}]
- stats: [{value, label}] — hero kartadagi raqamlar
- stream: youtubeId (yoki url), title, subtitle, isLive
- videos: [{title, youtubeId, subtitle, date: "YYYY-MM-DD"}]
- news: [{title, date, text, image, url}]
- events: [{name, city, dateFrom, dateTo, url}] — holat (kutilmoqda / davom etmoqda / yakunlangan) sanadan hisoblanadi
- team: [{name, weight, titles: [], photo}]
