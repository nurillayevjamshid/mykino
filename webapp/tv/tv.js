// TV bo'limi — O'zbek telekanallari jonli efiri (HLS).
// Lazy-load: kino.js ichidagi ensureTvModule() sidebar'dagi "TV" bosilganda yuklaydi.
// Tashqariga: window.__tv = { openTvView, closeTvView }
(function initTvModule() {
  const tvView = document.getElementById("tvView");
  const appShell = document.getElementById("appShell");
  if (!tvView) return;

  // ===== Kanallar ro'yxati (uz.m3u dan) =====
  // group: General/Kids/Movies/Music/Entertainment/News/Documentary/Sports/Family/Undefined
  const TV_CHANNELS = [
    { name: "O'zbekiston", group: "General", logo: "https://i.imgur.com/QUIIhTD.png", url: "https://stream8.cinerama.uz/1001/tracks-v1a1/playlist.m3u8" },
    { name: "Yoshlar", group: "General", logo: "https://i.imgur.com/s4xfUSx.png", url: "https://stream8.cinerama.uz/1002/tracks-v1a1/playlist.m3u8" },
    { name: "Toshkent", group: "General", logo: "https://i.imgur.com/Z9R4nZg.png", url: "https://stream8.cinerama.uz/1003/tracks-v1a1/playlist.m3u8" },
    { name: "Milliy", group: "General", logo: "https://i.imgur.com/v4FBm26.png", url: "https://stream8.cinerama.uz/1014/tracks-v1a1/playlist.m3u8" },
    { name: "MY5", group: "Entertainment", logo: "https://i.imgur.com/bjlzu5k.png", url: "https://st.my5.media/hls/hd/index.m3u8" },
    { name: "Sevimli TV", group: "Family", logo: "https://i.imgur.com/iMwzRlr.png", url: "https://stream8.cinerama.uz/1017/tracks-v1a1/playlist.m3u8" },
    { name: "Zo'r TV", group: "Entertainment", logo: "https://i.imgur.com/NuzyhVM.png", url: "https://stream8.cinerama.uz/1016/tracks-v1a1/mono.m3u8" },
    { name: "Sport", group: "Sports", logo: "https://i.imgur.com/2WJE9CM.png", url: "https://stream8.cinerama.uz/1004/tracks-v1a1/mono.m3u8" },
    { name: "O'zbekiston 24", group: "News", logo: "https://i.imgur.com/VRFhKbw.png", url: "https://stream8.cinerama.uz/1011/tracks-v1a1/playlist.m3u8" },
    { name: "UzReport TV", group: "News", logo: "https://i.imgur.com/Bch2RHc.jpg", url: "https://stream8.cinerama.uz/1015/tracks-v1a1/playlist.m3u8" },
    { name: "Kinoteatr", group: "Movies", logo: "https://i.imgur.com/emH1BgC.png", url: "https://stream8.cinerama.uz/1009/tracks-v1a1/playlist.m3u8" },
    { name: "BIZ Cinema", group: "Movies", logo: "https://biztv.uz/static/media/biz-cinema.286b83dc.png", url: "https://fl.biztv.media/cinema_720_EMfSyXgoRdiIHgldXTZICucKTIeCKO/index.m3u8" },
    { name: "BIZ TV", group: "Entertainment", logo: "https://biztv.uz/static/media/logo.5f993187.png", url: "https://fl.biztv.media/biz_tv_720_uni8jhub4h8fub4idejswh8dh3j94finbu4nidj39inwsj92in3d/index.m3u8" },
    { name: "BIZ Music", group: "Music", logo: "https://i.ibb.co/DfsCJwk/Uz-biz-music-5462.jpg", url: "https://fl.biztv.media/music_720_QAKpGmVUjaPApCNjpsgBxrdqNihAkl/index.m3u8" },
    { name: "FTV", group: "Music", logo: "https://i.imgur.com/7lpISyN.jpg", url: "https://stream8.cinerama.uz/1018/playlist.m3u8" },
    { name: "Navo", group: "General", logo: "https://i.imgur.com/7dZ64y9.png", url: "https://stream8.cinerama.uz/1008/tracks-v1a1/playlist.m3u8" },
    { name: "Bolajon", group: "Kids", logo: "https://i.imgur.com/s7o0ifu.png", url: "https://stream8.cinerama.uz/1007/playlist.m3u8" },
    { name: "Aqlvoy", group: "Kids", logo: "https://i.imgur.com/ekF5cAi.png", url: "https://stream8.cinerama.uz/1205/tracks-v1a1/mono.m3u8" },
    { name: "Cheksiz TV", group: "Entertainment", logo: "https://i.imgur.com/f7hHmmR.jpeg", url: "https://fl.biztv.media/cheksiz_tv_480_unif7hujidth7f4du83jrhuid3k94j8hfj8d93eubych8eju93n4ubt/tracks-v1a1/mono.m3u8" },
    { name: "Makon TV", group: "Entertainment", logo: "https://i.imgur.com/vCc0ED1.png", url: "https://stream8.cinerama.uz/1497/tracks-v1a1/mono.m3u8" },
    { name: "Dunyo bo'ylab", group: "General", logo: "https://i.imgur.com/KArB5U6.png", url: "https://stream8.cinerama.uz/1006/tracks-v1a1/playlist.m3u8" },
    { name: "Madaniyat va ma'rifat", group: "General", logo: "https://i.imgur.com/eeNLXCP.png", url: "https://stream8.cinerama.uz/1005/tracks-v1a1/playlist.m3u8" },
    { name: "O'zbekiston Tarixi", group: "Documentary", logo: "https://i.imgur.com/iTTd3Ir.png", url: "https://stream8.cinerama.uz/1209/tracks-v1a1/playlist.m3u8" },
    { name: "Dasturxon TV", group: "General", logo: "https://i.imgur.com/APM2ej5.jpeg", url: "https://stream8.cinerama.uz/1206/tracks-v1a1/playlist.m3u8" },
    { name: "Renessans TV", group: "General", logo: "https://i.imgur.com/cVlcqCX.png", url: "https://stream8.cinerama.uz/1221/tracks-v1a1/playlist.m3u8" },
    { name: "Taraqqiyot TV", group: "General", logo: "https://i.imgur.com/V3rtPEl.jpg", url: "https://stream8.cinerama.uz/1204/tracks-v1a1/mono.m3u8" },
    { name: "Nurafshon TV", group: "General", logo: "https://i.imgur.com/MMdNyBU.jpeg", url: "https://stream8.cinerama.uz/1220/tracks-v1a1/mono.m3u8" },
    { name: "Mahalla", group: "Undefined", logo: "https://i.imgur.com/GtABiJI.png", url: "https://stream8.cinerama.uz/1013/tracks-v1a1/playlist.m3u8" },
    { name: "Andijon MTRK", group: "General", logo: "https://i.imgur.com/EGPAvom.jpeg", url: "https://stream8.cinerama.uz/1457/tracks-v1a1/mono.m3u8" },
    { name: "Farg'ona MTRK", group: "General", logo: "https://i.imgur.com/RYjQOfo.jpeg", url: "https://stream8.cinerama.uz/1458/tracks-v1a1/mono.m3u8" },
    { name: "Buxoro MTRK", group: "General", logo: "https://i.imgur.com/jmxPtC9.png", url: "https://stream8.cinerama.uz/1459/tracks-v1a1/mono.m3u8" },
    { name: "Navoiy MTRK", group: "General", logo: "https://i.imgur.com/qa4VlYh.png", url: "https://stream8.cinerama.uz/1460/tracks-v1a1/mono.m3u8" },
    { name: "Qaraqalpaqstan", group: "General", logo: "https://i.imgur.com/G3qrUJh.png", url: "https://stream8.cinerama.uz/1467/playlist.m3u8" },
  ];

  // ===== Xalqaro sport kanallari (sports.m3u dan) =====
  // Faqat https va maxsus User-Agent talab qilmaydigan oqimlar olindi —
  // qolganlari brauzer/Telegram webview'da baribir o'ynamaydi.
  const TV_SPORTS_INTL = [
    { name: "30A Golf Kingdom", group: "Sports", logo: "https://i.imgur.com/Lv53nh4.png", url: "https://30a-tv.com/feeds/vidaa/golf.m3u8" },
    { name: "A Spor", group: "Sports", logo: "https://i.imgur.com/ZhkZzLf.png", url: "https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/aspor/aspor.m3u8" },
    { name: "ACCDN", group: "Sports", logo: "https://i.imgur.com/V6Kaqha.png", url: "https://raycom-accdn-firetv.amagi.tv/playlist.m3u8" },
    { name: "ACI Sport TV", group: "Sports", logo: "https://i.imgur.com/U8cHMOt.png", url: "https://webstream.multistream.it/memfs/e2cb3629-c1a2-495b-b43a-9eb386f04ed8.m3u8" },
    { name: "Adjarasport 1", group: "Sports", logo: "https://i.imgur.com/SVV5xHC.png", url: "https://live20.bozztv.com/dvrfl05/gin-adjara/index.m3u8" },
    { name: "ADO TV", group: "Sports", logo: "https://i.imgur.com/pxFamLr.png", url: "https://strhls.streamakaci.tv/ortb/ortb2-multi/playlist.m3u8" },
    { name: "Africa 24 Sport", group: "Sports", logo: "https://i0.wp.com/africa24tv.com/wp-content/uploads/2023/12/LOGO-AFRICASPORT-4-HD-sans-fond.png?fit=512%2C107&ssl=1", url: "https://africa24.vedge.infomaniak.com/livecast/ik:africa24sport/manifest.m3u8" },
    { name: "Al Iraqia Sport", group: "Sports", logo: "https://i.imgur.com/DrrlxTO.png", url: "https://imn-live.esite-lab.com/hls/iraqia-sports-1.m3u8" },
    { name: "Alkass Five", group: "Sports", logo: "https://i.imgur.com/6RGNGsM.png", url: "https://liveeu-gcp.alkassdigital.net/alkass5-p/main.m3u8" },
    { name: "Alkass Four", group: "Sports", logo: "https://i.imgur.com/iDL65Wu.png", url: "https://liveeu-gcp.alkassdigital.net/alkass4-p/main.m3u8" },
    { name: "Alkass One", group: "Sports", logo: "https://i.imgur.com/10mmlha.png", url: "https://liveeu-gcp.alkassdigital.net/alkass1-p/main.m3u8" },
    { name: "Alkass Seven", group: "Sports", logo: "https://i.imgur.com/3eyHP3S.png", url: "https://liveeu-gcp.alkassdigital.net/alkass7-p/main.m3u8" },
    { name: "Alkass SHOOF", group: "Sports", logo: "https://shoof.alkass.net/assets/images/shoof.png", url: "https://liveeu-gcp.alkassdigital.net/shooflive/main.m3u8" },
    { name: "Alkass SHOOF 2", group: "Sports", logo: "https://shoof.alkass.net/assets/images/shoof2.png", url: "https://liveeu-gcp.alkassdigital.net/shooflive2/main.m3u8" },
    { name: "Alkass Six", group: "Sports", logo: "https://i.imgur.com/CrPSPSC.png", url: "https://liveeu-gcp.alkassdigital.net/alkass6-p/main.m3u8" },
    { name: "Alkass Three", group: "Sports", logo: "https://i.imgur.com/d57BdFh.png", url: "https://liveeu-gcp.alkassdigital.net/alkass3-p/main.m3u8" },
    { name: "Alkass Two", group: "Sports", logo: "https://i.imgur.com/8w61kFX.png", url: "https://liveeu-gcp.alkassdigital.net/alkass2-p/main.m3u8" },
    { name: "Arryadia", group: "Sports", logo: "https://i.imgur.com/XjzK3gZ.png", url: "https://stream-lb.livemediama.com/arryadia/hls/master.m3u8" },
    { name: "Arryadia", group: "Sports", logo: "https://i.imgur.com/XjzK3gZ.png", url: "https://snrtworker.kharazbelaid.workers.dev/?id=arryadia.m3u8" },
    { name: "Arryadia HD 1", group: "Sports", logo: "https://i.ibb.co/fYNx6Fk1/image-removebg-preview-1.png", url: "https://stream-lb.livemediama.com/arryadia-hd-01/hls/master.m3u8" },
    { name: "Arryadia HD 2", group: "Sports", logo: "https://i.ibb.co/jPFCVFNS/image-removebg-preview-3.png", url: "https://stream-lb.livemediama.com/arryadia-hd-02/hls/master.m3u8" },
    { name: "Arryadia HD 3", group: "Sports", logo: "https://i.ibb.co/mCnJzvvB/image-removebg-preview-4.png", url: "https://stream-lb.livemediama.com/arryadia-hd-03/hls/master.m3u8" },
    { name: "Arryadia HD TNT", group: "Sports", logo: "https://i.imgur.com/XjzK3gZ.png", url: "https://stream-lb.livemediama.com/arryadia-tnt/hls/master.m3u8" },
    { name: "AS3 Sport TV", group: "Sports", logo: "https://i.ibb.co/bRmGbsyV/A3-SPORTTV.jpg", url: "https://streamtv.as3sport.online:3394/hybrid/play.m3u8" },
    { name: "ATG Live", group: "Sports", logo: "https://i.imgur.com/bPWFXkL.png", url: "https://kanal75xto-llhls.akamaized.net/live/Data/atg-kanal-15-02a-rr/HLS-Legacy-HL/atg-kanal-15-02a-rr.m3u8" },
    { name: "Band Sports", group: "Sports", logo: "https://i.imgur.com/EuPvzJe.png", url: "https://cdn-5.nxplay.com.br/BAND_SPORTS/index.m3u8" },
    { name: "Barca TV", group: "Sports", logo: "https://i.imgur.com/d8x7c8i.png", url: "https://live20.bozztv.com/dvrfl06/astv/astv-barca/index.m3u8" },
    { name: "beIN Sports Haber", group: "Sports", logo: "https://i.imgur.com/QWo0x7S.jpg", url: "https://1nyaler.streamhostingcdn.top/stream/23/index.m3u8" },
    { name: "beIN SPORTS XTRA", group: "Sports", logo: "https://i.ibb.co/HT49GPmB/XTRA-2.png", url: "https://bein-xtra-bein.amagi.tv/playlist.m3u8" },
    { name: "beIN Sports XTRA en Espanol", group: "Sports", logo: "https://i.imgur.com/V562tpO.png", url: "https://dc1644a9jazgj.cloudfront.net/beIN_Sports_Xtra_Espanol.m3u8" },
    { name: "BEK TV Sports West", group: "Sports", logo: "https://i.imgur.com/1l3t5jd.png", url: "https://cdn3.wowza.com/5/ZWQ1K2NYTmpFbGsr/BEK-WOWZA-1/smil:BEKPRIMEW.smil/playlist.m3u8" },
    { name: "Bellator MMA", group: "Sports", logo: "https://i.imgur.com/VBKoLHk.png", url: "https://jmp2.uk/plu-5ebc8688f3697d00072f7cf8.m3u8" },
    { name: "Brøndby TV", group: "Sports", logo: "https://images.pluto.tv/channels/685029cda1e091e16ff57fc8/colorLogoPNG_1750246109707.png", url: "https://jmp2.uk/plu-685029cda1e091e16ff57fc8.m3u8" },
    { name: "Canal+ Foot", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Canal%2BFoot.png", url: "https://test.946985.filegear-sg.me/proxy/ef3174f16d4557d2" },
    { name: "CazeTV", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/6/64/Caz%C3%A9TV_logo.svg/1280px-Caz%C3%A9TV_logo.svg.png", url: "https://dfr80qz435crc.cloudfront.net/MNOP/Amagi/Caze/Caze_TV_BR/Caze_TV.m3u8" },
    { name: "CBS Sports Golazo Network", group: "Sports", logo: "https://i.imgur.com/eMjutHS.png", url: "https://proped3fhg87.airspace-cdn.cbsivideo.com/golazo-live-dai/master/golazo-live-dai.m3u8" },
    { name: "ColimdoT TV", group: "Sports", logo: "https://i.imgur.com/ZeUgLCa.png", url: "https://cnn.livestreaminggroup.info:3132/live/colimdotvlive.m3u8" },
    { name: "Cricket Gold", group: "Sports", logo: "https://resources.cricket-australia.pulselive.com/cricket-australia/photo/2025/07/25/836eddae-4329-4542-ad17-dcd37e9d951a/Cricket-Gold-1920x1080_noBG.png", url: "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8" },
    { name: "CRTV", group: "Sports", logo: "https://i2.paste.pics/bf68b159547597c39574aec9dd7c626a.png", url: "https://stmv2.voxtvhd.com.br/crtvchile/crtvchile/playlist.m3u8" },
    { name: "DAZN Combat", group: "Sports", logo: "https://i.postimg.cc/VsW3Jsrz/logo-DAZN-Combat.png", url: "https://dazn-combat-rakuten.amagi.tv/hls/amagi_hls_data_rakutenAA-dazn-combat-rakuten/CDN/master.m3u8" },
    { name: "DAZN Combat", group: "Sports", logo: "https://i.postimg.cc/VsW3Jsrz/logo-DAZN-Combat.png", url: "https://jmp2.uk/plu-64d626ac9b414d000820e2fc.m3u8" },
    { name: "DAZN Darts x Pluto TV", group: "Sports", logo: "https://images.pluto.tv/channels/64b67f0424ade50008a3be17/colorLogoPNG.png", url: "https://jmp2.uk/plu-64b67f0424ade50008a3be17.m3u8" },
    { name: "DAZN Handball x Pluto TV", group: "Sports", logo: "https://images.pluto.tv/channels/6683f7fe36a2f9000804940c/colorLogoPNG.png", url: "https://jmp2.uk/plu-6683f7fe36a2f9000804940c.m3u8" },
    { name: "DAZN Heldinnen x Pluto TV", group: "Sports", logo: "https://images.pluto.tv/channels/64afe50c5dc16600087f3227/colorLogoPNG.png", url: "https://jmp2.uk/plu-64afe50c5dc16600087f3227.m3u8" },
    { name: "DD Sports SD", group: "Sports", logo: "https://dtil.tmsimg.com/assets/s158255_ld_h15_aa.png?lock=720x540", url: "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8" },
    { name: "DeporTV", group: "Sports", logo: "https://i.imgur.com/THk9ARS.png", url: "https://edgectc.com/DEPORTES_CTC_PLUS/index.m3u8" },
    { name: "DraftKings Network", group: "Sports", logo: "https://i.imgur.com/SFYhgrt.png", url: "https://na.linear.zype.com/e0bd0e23-a958-4e43-8164-4f2fef8876a8/fd3614bd-90bf-4530-a277-65ae3a1720c8-zype/live.m3u8" },
    { name: "DSports", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/DirecTV_Sports_Latin_America_%282018%29.png/960px-DirecTV_Sports_Latin_America_%282018%29.png", url: "https://streamvidex.qzz.io/videx/dsportsar/index.m3u8" },
    { name: "DSports 2", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/DIRECTV_Sports_2_Latin_America_%282018%29.svg/960px-DIRECTV_Sports_2_Latin_America_%282018%29.svg.png", url: "https://streamvidex.qzz.io/videx/dsports2/index.m3u8" },
    { name: "DSports Uruguay", group: "Sports", logo: "https://i.imgur.com/2PoEm1x.png", url: "https://cors-proxy.cooks.fyi/http://147.135.114.221:8001/play/a00m/index.m3u8" },
    { name: "DSports+", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/DirecTV_Sports%2B_Latin_America_%282018%29.png/960px-DirecTV_Sports%2B_Latin_America_%282018%29.png", url: "https://streamvidex.qzz.io/videx/dsportsplus/index.m3u8" },
    { name: "El-Heddaf TV", group: "Sports", logo: "https://i.imgur.com/cDkIDIA.png", url: "https://live.elheddaftv.com:8081/elheddaf/index.mpd" },
    { name: "Equidia", group: "Sports", logo: "https://i.imgur.com/QPpbRcZ.png", url: "https://raw.githubusercontent.com/Paradise-91/ParaTV/main/streams/equidia/live2.m3u8" },
    { name: "ESPN8 The Ocho", group: "Sports", logo: "https://images.fubo.tv/channel-config-ui/station-logos/on-dark/espn_8_the_ocho_bw.png", url: "https://d3b6q2ou5kp8ke.cloudfront.net/ESPNTheOcho.m3u8" },
    { name: "Fast&FunBox", group: "Sports", logo: "https://i.imgur.com/a9ZtP17.png", url: "https://dash3.antik.sk/live/test_fast_and_funbox_medium_atk/playlist.m3u8" },
    { name: "FCK Løvinderne", group: "Sports", logo: "https://images.pluto.tv/channels/68ac5403de4a734954b5ab75/colorLogoPNG_1756124331035.png", url: "https://jmp2.uk/plu-68ac5403de4a734954b5ab75.m3u8" },
    { name: "FIFA+", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png", url: "https://jmp2.uk/plu-660c29b5aec9680008f5b4a4.m3u8" },
    { name: "FIFA+ French", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png", url: "https://37b4c228.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWZyX0ZJRkFQbHVzRnJlbmNoX0hMUw/playlist.m3u8" },
    { name: "FIFA+ German", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png", url: "https://4397879b.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWRlX0ZJRkFQbHVzR2VybWFuX0hMUw/playlist.m3u8" },
    { name: "FIFA+ Hispanic America", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png", url: "https://6c849fb3.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctbXhfRklGQVBsdXNTcGFuaXNoLTFfSExT/playlist.m3u8" },
    { name: "FIFA+ Italy", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png", url: "https://5d95f7d7.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWl0X0ZJRkFQbHVzSXRhbGlhbl9ITFM/playlist.m3u8" },
    { name: "FIFA+ Portuguese", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png", url: "https://e3be9ac5.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctYnJfRklGQVBsdXNQb3J0dWd1ZXNlX0hMUw/playlist.m3u8" },
    { name: "FIFA+ Spain", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png", url: "https://d63fabad.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWVzX0ZJRkFQbHVzU3BhbmlzaF9ITFM/playlist.m3u8" },
    { name: "FIFA+ United States", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png", url: "https://d2w9q46ikgrcwx.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-of5cbk3sav3w5/v1/sysdata_s_p_a_fifa_7/samsungheadend_us/latest/main/hls/playlist.m3u8" },
    { name: "FIFA+ Women", group: "Sports", logo: "https://i.imgur.com/xy9ZxVO.png", url: "https://cffda8ff.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/U2Ftc3VuZy1nYl9GSUZBUGx1c3dvbWVuX0hMUw/playlist.m3u8" },
    { name: "Fight Network", group: "Sports", logo: "https://i.imgur.com/vlKPZHR.png", url: "https://d12a2vxqkkh1bo.cloudfront.net/hls/main.m3u8" },
    { name: "FITE 24/7", group: "Sports", logo: "https://i.imgur.com/ESV6qgH.png", url: "https://d3d85c7qkywguj.cloudfront.net/scheduler/scheduleMaster/263.m3u8" },
    { name: "FloHockey 24/7", group: "Sports", logo: "https://images.fubo.tv/channel-config-ui/station-logos/on-dark/flohockey-white.png", url: "https://amg02278-amg02278c2-flosports-worldwide-9916.playouts.now.amagi.tv/playlist.m3u8" },
    { name: "FloRacing 24/7", group: "Sports", logo: "https://images.fubo.tv/channel-config-ui/station-logos/on-dark/floracing-white.png", url: "https://amg02278-amg02278c1-flosports-worldwide-7592.playouts.now.amagi.tv/playlist.m3u8" },
    { name: "Fox Deportes", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/FOX_Deportes_logo.png/960px-FOX_Deportes_logo.png", url: "https://cors-proxy.cooks.fyi/http://23.237.104.106:8080/USA_FOX_DEPORTES/index.m3u8" },
    { name: "Fox Sports 1", group: "Sports", logo: "https://i.imgur.com/O9BapV9.png", url: "https://streamvidex.qzz.io/videx/fox1usa/index.m3u8" },
    { name: "FTF Sports", group: "Sports", logo: "https://i.imgur.com/yvUjOI3.png", url: "https://1657061170.rsc.cdn77.org/HLS/FTF-LINEAR.m3u8" },
    { name: "FTV", group: "Sports", logo: "https://i.imgur.com/YOr1Oac.png", url: "https://master.tucableip.com/ftvhd/index.m3u8" },
    { name: "fubo Sports Network", group: "Sports", logo: "https://i.imgur.com/qFNRJLb.png", url: "https://dnf08l6u6uxnz.cloudfront.net/master.m3u8" },
    { name: "Fuel TV", group: "Sports", logo: "https://i.imgur.com/I8mviBy.png", url: "https://amg01074-fueltv-fueltvau-samsungau-g09kq.amagi.tv/playlist/amg01074-fueltv-fueltvau-samsungau/playlist.m3u8" },
    { name: "FUEL TV", group: "Sports", logo: "https://i.imgur.com/I8mviBy.png", url: "https://amg01074-fueltv-fueltvemeaen-rakuten-b6j62.amagi.tv/hls/amagi_hls_data_rakutenAA-fueltvemeaen/CDN/master.m3u8" },
    { name: "Fuel TV", group: "Sports", logo: "https://i.imgur.com/I8mviBy.png", url: "https://amg01074-fueltv-amg01074c1-stirr-us-4214.playouts.now.amagi.tv/playlist.m3u8" },
    { name: "Futbol", group: "Sports", logo: "https://i.imgur.com/RngmCDn.png", url: "https://live.teleradiocom.tj/8/3m.m3u8" },
    { name: "Game+", group: "Sports", logo: "https://i.imgur.com/Lj69WbR.png", url: "https://a-cdn.klowdtv.com/live2/fntsy_720p/playlist.m3u8" },
    { name: "ge Fast", group: "Sports", logo: "https://i.ibb.co/WGXHDnF/logo-ge-fast.png", url: "https://amg00716-globo-amg00716c1-tcl-br-9495.playouts.now.amagi.tv/playlist.m3u8" },
    { name: "GEM Fit", group: "Sports", logo: "https://i.imgur.com/7FQxaII.png", url: "https://ca-rt.onetv.app/gemfit/index-0.m3u8?token=onetv202" },
    { name: "GEM Sport", group: "Sports", logo: "https://www.gemgroup.tv/assets/images/channels/icon_34.png", url: "https://steep-wildflower-284d.nhhwkiszzzvcuojxdo.workers.dev/?url=https://gg.hls2.xyz/live/IR+-+GEM+Sport/chunks.m3u8" },
    { name: "GLORY Kickboxing", group: "Sports", logo: "https://i.imgur.com/tS7Ub7i.png", url: "https://6f972d29.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWV1X0dsb3J5S2lja2JveGluZ19ITFM/playlist.m3u8" },
    { name: "Gol Classics", group: "Sports", logo: "https://golstadium.com/_next/image?url=%2Fimg%2Fhome%2Fchannels%2Fthumb-gol-classics.jpg&w=1920&q=75", url: "https://d71gqtnep83vb.cloudfront.net/gol_classics/gol_classics.m3u8" },
    { name: "Golazo Network", group: "Sports", logo: "https://images.pluto.tv/channels/63a0e33a45264d000850ed7e/colorLogoPNG_1731835813404.png", url: "https://jmp2.uk/plu-63a0e33a45264d000850ed7e.m3u8" },
    { name: "Golf Channel", group: "Sports", logo: "https://www.sms.cz/kategorie/televize/bmp/loga/velka/golfchannel.png", url: "https://dash4.antik.sk/live/test_golf_channel/playlist.m3u8" },
    { name: "Horse TV", group: "Sports", logo: "https://i.imgur.com/nK4UUX4.png", url: "https://a-cdn.klowdtv.com/live2/horsetv_720p/playlist.m3u8" },
    { name: "HTSpor TV", group: "Sports", logo: "https://www.htspor.com/images/manifest/social-share-logo.png", url: "https://ciner.daioncdn.net/ht-spor/ht-spor.m3u8?app=web" },
    { name: "INTROUBLE", group: "Sports", logo: "https://i.imgur.com/a40chFI.png", url: "https://amg00861-amg00861c6-stirr-us-8229.playouts.now.amagi.tv/playlist.m3u8" },
    { name: "IRIB3", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/IRIB_TV3_LOGO.svg/960px-IRIB_TV3_LOGO.svg.png", url: "https://ncdn.telewebion.ir/tv3/live/playlist.m3u8" },
    { name: "ITV Deportes", group: "Sports", logo: "https://iili.io/J1kV1Bn.png", url: "https://thm-it-roku.otteravision.com/thm/it/it.m3u8" },
    { name: "K19", group: "Sports", logo: "https://i.imgur.com/l4atkvs.png", url: "https://1853185335.rsc.cdn77.org/K192/tv/playlist.m3u8" },
    { name: "KCMN-LD6", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/QVC_logo_2019.svg/960px-QVC_logo_2019.svg.png", url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg02873-kravemedia-mtrspt1-distrotv/playlist.m3u8" },
    { name: "KSA Sports 1", group: "Sports", logo: "https://i.imgur.com/ONKNOAp.png", url: "https://aloula-redirect.vercel.app/9/playlist.m3u8" },
    { name: "KSA Sports 2", group: "Sports", logo: "https://i.imgur.com/v8ULLqg.png", url: "https://aloula-redirect.vercel.app/10/playlist.m3u8" },
    { name: "KSA Sports 3", group: "Sports", logo: "https://i.imgur.com/BXfCvez.png", url: "https://aloula-redirect.vercel.app/16/playlist.m3u8" },
    { name: "KTV Sport", group: "Sports", logo: "https://i.imgur.com/R1hGX1d.png", url: "https://kwtspta.cdn.mangomolo.com/sp/smil:sp.stream.smil/chunklist.m3u8" },
    { name: "KTV Sport Plus", group: "Sports", logo: "https://i.imgur.com/l4oX0gf.png", url: "https://kwtsplta.cdn.mangomolo.com/spl/smil:spl.stream.smil/chunklist.m3u8" },
    { name: "L'Equipe", group: "Sports", logo: "https://i.imgur.com/t35zhM9.png", url: "https://dshn8inoshngm.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-gac2i63dmu8b7/LEquipe_FR.m3u8" },
    { name: "Lacrosse TV", group: "Sports", logo: "https://yt3.googleusercontent.com/ytc/AIdro_m_xSJFydxZ9QBU-85OuchjmzS0Bo0_Tukmk7to8hBfyl8=s512-c-k-c0x00ffffff-no-rj", url: "https://a-cdn.klowdtv.com/live2/lsn_720p/playlist.m3u8" },
    { name: "Lucha Libre AAA", group: "Sports", logo: "https://i.imgur.com/Nc7K060.png", url: "https://jmp2.uk/plu-5f99a772c54853000797bf18.m3u8" },
    { name: "MadeinBO TV", group: "Sports", logo: "https://i.imgur.com/47X44DD.png", url: "https://srvx1.selftv.video/dmchannel/live/playlist.m3u8" },
    { name: "MMA TV.com", group: "Sports", logo: "https://i.imgur.com/QhdxNsB.png", url: "https://streams2.sofast.tv/vglive-sk-462904/playlist.m3u8" },
    { name: "MNB Sport", group: "Sports", logo: "https://i.imgur.com/z854PC3.png", url: "https://live.mnb.mn/hls/mnb_sport.stream.m3u8" },
    { name: "Monster Jam", group: "Sports", logo: "https://provider-static.plex.tv/epg/cms/production/23824964-562b-4498-9eaa-d6262cb7e0c3/Monster_Jam_Logo_on_Transparent_1500x1000_Casey_Murawski.png", url: "https://jmp2.uk/plu-65bcc9c8d77d450008b34c6b.m3u8" },
    { name: "Monterrico TV", group: "Sports", logo: "https://i.imgur.com/SuVO9T7.png", url: "https://h.jcp.live.opencaster.com/play_src/index.m3u8" },
    { name: "More Than Sports TV", group: "Sports", logo: "https://i.imgur.com/SLrjImc.png", url: "https://mts1.iptv-playoutcenter.de/mts/mts-web/playlist.m3u8" },
    { name: "MTRSPT1", group: "Sports", logo: "https://i.imgur.com/Rb1H5cV.png", url: "https://amg02873-kravemedia-mtrspt1-distrotv-mnsrl.amagi.tv/playlist/amg02873-kravemedia-mtrspt1-distrotv/playlist.m3u8" },
    { name: "MUTV", group: "Sports", logo: "https://d2n0069hmnqmmx.cloudfront.net/epgdata/1.0/newchanlogos/512/512/skychb1834.png", url: "https://bcovlive-a.akamaihd.net/r2d2c4ca5bf57456fb1d16255c1a535c8/eu-west-1/6058004203001/playlist.m3u8" },
    { name: "Nautical Channel", group: "Sports", logo: "https://i.imgur.com/2ByDyzL.png", url: "https://a-cdn.klowdtv.com/live2/nautical_720p/playlist.m3u8" },
    { name: "NBC Sports NOW", group: "Sports", logo: "https://i.imgur.com/EzNf2Yx.png", url: "https://d4whmvwm0rdvi.cloudfront.net/10007/99993008/hls/master.m3u8?ads.xumo_channelId=99993008" },
    { name: "NHL Network", group: "Sports", logo: "https://i.imgur.com/UNZ8bef.png", url: "https://nhl-firetv.amagi.tv/playlist.m3u8" },
    { name: "NHRA TV", group: "Sports", logo: "https://i.imgur.com/jZgcm4k.png", url: "https://d265y4sk8257lt.cloudfront.net/nh.m3u8" },
    { name: "Overtime", group: "Sports", logo: "https://i.imgur.com/9S9k4IK.png", url: "https://d1a8aq6t30gkqj.cloudfront.net/v1/amc_overtime_1/samsungheadend_us/latest/main/hls/playlist_hd.m3u8" },
    { name: "Pac 12 Insider", group: "Sports", logo: "https://i.imgur.com/736QREy.png", url: "https://pac12-firetv.amagi.tv/playlist.m3u8" },
    { name: "PBR RidePass", group: "Sports", logo: "https://i.imgur.com/gUxH97E.png", url: "https://jmp2.uk/plu-60d39387706fe50007fda8e8.m3u8" },
    { name: "Persiana Fight", group: "Sports", logo: "", url: "https://fighthls.persiana.live/hls/stream.m3u8" },
    { name: "PFL MMA", group: "Sports", logo: "https://provider-static.plex.tv/epg/cms/production/96dd0531-b500-4bd4-93ca-763cbf46defe/1500x1000_PFL_SHIELD_DARK_BG_-_Allie_Dinsmore.png", url: "https://jmp2.uk/plu-64f6180130ab3300083d896b.m3u8" },
    { name: "PGA Tour", group: "Sports", logo: "https://i.imgur.com/J0TY9dG.png", url: "https://d11k1mnrgfposz.cloudfront.net/playlist.m3u8" },
    { name: "PK Sports", group: "Sports", logo: "https://raw.githubusercontent.com/songwenhui239/Songwenhui239/refs/heads/main/PK%20Sports.jpeg", url: "https://lbgo.bozztv.com/ssh101/ssh101/pksportshd/playlist.m3u8" },
    { name: "Pluto TV Competition", group: "Sports", logo: "https://images.pluto.tv/channels/603fde9026ecbf0007752c2c/colorLogoPNG.png", url: "https://jmp2.uk/plu-603fde9026ecbf0007752c2c.m3u8" },
    { name: "Pluto TV Deportes", group: "Sports", logo: "https://images.pluto.tv/channels/5dcde07af1c85b0009b18651/colorLogoPNG_1766080575034.png", url: "https://jmp2.uk/plu-5dcde07af1c85b0009b18651.m3u8" },
    { name: "Pluto TV E-Sports", group: "Sports", logo: "https://images.pluto.tv/channels/5ff3934600d4c7000733ff49/colorLogoPNG.png", url: "https://jmp2.uk/plu-5ff3934600d4c7000733ff49.m3u8" },
    { name: "Pluto TV Esportes", group: "Sports", logo: "https://images.pluto.tv/channels/5f32d2db0af67400077f29c4/colorLogoSVG_1780355759776.svg", url: "https://jmp2.uk/plu-5f32d2db0af67400077f29c4.m3u8" },
    { name: "Pluto TV Fishing", group: "Sports", logo: "https://images.pluto.tv/channels/619e1874e0d3a7000729a036/colorLogoPNG.png", url: "https://jmp2.uk/plu-619e1874e0d3a7000729a036.m3u8" },
    { name: "Pluto TV Fútbol", group: "Sports", logo: "https://images.pluto.tv/channels/63c6e37e636b7e0007ccb635/colorLogoPNG_1777492822828.png", url: "https://jmp2.uk/plu-63c6e37e636b7e0007ccb635.m3u8" },
    { name: "Pluto TV Håndbold Highlights", group: "Sports", logo: "https://images.pluto.tv/channels/68dfa431cc3c6cd904053100/colorLogoPNG_1761838112979.png", url: "https://jmp2.uk/plu-68dfa431cc3c6cd904053100.m3u8" },
    { name: "Pluto TV Håndbold Live", group: "Sports", logo: "https://images.pluto.tv/channels/6618f54baec96800081525ec/colorLogoPNG_1762173655031.png", url: "https://jmp2.uk/plu-6618f54baec96800081525ec.m3u8" },
    { name: "Pluto TV Handboll Highlights", group: "Sports", logo: "https://images.pluto.tv/channels/68dfa3e2cc3c6cd904052c41/colorLogoPNG_1761838923264.png", url: "https://jmp2.uk/plu-68dfa3e2cc3c6cd904052c41.m3u8" },
    { name: "Pluto TV Handboll Live", group: "Sports", logo: "https://images.pluto.tv/channels/686faf533ffa5e0c912688e7/colorLogoPNG_1762169254016.png", url: "https://jmp2.uk/plu-686faf533ffa5e0c912688e7.m3u8" },
    { name: "Pluto TV Snooker 900", group: "Sports", logo: "https://images.pluto.tv/channels/68ac5543a1ac0c90f2c8943e/colorLogoPNG_1760517341343.png", url: "https://jmp2.uk/plu-68ac5543a1ac0c90f2c8943e.m3u8" },
    { name: "Pluto TV Snooker 900", group: "Sports", logo: "https://images.pluto.tv/channels/68ac5543a1ac0c90f2c8943e/colorLogoPNG_1760517341343.png", url: "https://jmp2.uk/plu-69148c470155f9b136b5d856.m3u8" },
    { name: "Pluto TV Snooker 900", group: "Sports", logo: "https://images.pluto.tv/channels/68ac5543a1ac0c90f2c8943e/colorLogoPNG_1760517341343.png", url: "https://jmp2.uk/plu-66fd35e44ca31f0008060b77.m3u8" },
    { name: "Pluto TV Snooker 900", group: "Sports", logo: "https://images.pluto.tv/channels/68ac5543a1ac0c90f2c8943e/colorLogoPNG_1760517341343.png", url: "https://jmp2.uk/plu-655b7cbb2c46f300086f0afa.m3u8" },
    { name: "Pluto TV Snooker 900", group: "Sports", logo: "https://images.pluto.tv/channels/68ac5543a1ac0c90f2c8943e/colorLogoPNG_1760517341343.png", url: "https://jmp2.uk/plu-69148c76e9dec35c9269a16c.m3u8" },
    { name: "Pluto TV Snooker 900", group: "Sports", logo: "https://images.pluto.tv/channels/68ac5543a1ac0c90f2c8943e/colorLogoPNG_1760517341343.png", url: "https://jmp2.uk/plu-68ac55bb3efb41cd979a65ec.m3u8" },
    { name: "Pluto TV Snooker 900", group: "Sports", logo: "https://images.pluto.tv/channels/68ac5543a1ac0c90f2c8943e/colorLogoPNG_1760517341343.png", url: "https://jmp2.uk/plu-68ac55fe3efb41cd979a6877.m3u8" },
    { name: "Pluto TV Snooker 900", group: "Sports", logo: "https://images.pluto.tv/channels/68ac5543a1ac0c90f2c8943e/colorLogoPNG_1760517341343.png", url: "https://jmp2.uk/plu-68ac56363efb41cd979a8005.m3u8" },
    { name: "Pluto TV Snooker 900", group: "Sports", logo: "https://images.pluto.tv/channels/639b4f75d3d35c0007d37b30/colorLogoPNG_1759333260607.png", url: "https://jmp2.uk/plu-639b4f75d3d35c0007d37b30.m3u8" },
    { name: "Pluto TV Sport", group: "Sports", logo: "https://images.pluto.tv/channels/608030eff4b6f70007e1684c/colorLogoPNG_1746816937164.png", url: "https://jmp2.uk/plu-608030eff4b6f70007e1684c.m3u8" },
    { name: "Pluto TV Sport", group: "Sports", logo: "https://images.pluto.tv/channels/6357f3de3643ba0007bc0b50/colorLogoPNG_1746816938506.png", url: "https://jmp2.uk/plu-6357f3de3643ba0007bc0b50.m3u8" },
    { name: "Pluto TV Sport", group: "Sports", logo: "https://images.pluto.tv/channels/6357f3de3643ba0007bc0b50/colorLogoPNG_1746816938506.png", url: "https://jmp2.uk/plu-6357f33cb51d2d00077927c6.m3u8" },
    { name: "Pluto TV Sport", group: "Sports", logo: "https://images.pluto.tv/channels/6357f3de3643ba0007bc0b50/colorLogoPNG_1746816938506.png", url: "https://jmp2.uk/plu-62cd74e38f6f0d000798cd93.m3u8" },
    { name: "Poker Go", group: "Sports", logo: "https://i.imgur.com/1603HED.png", url: "https://aegis-cloudfront-1.tubi.video/b474c2bb-b34d-4c53-a94b-c4ffe884563c/playlist.m3u8" },
    { name: "Premier Sports", group: "Sports", logo: "https://i.imgur.com/BURPHzI.png", url: "https://amg19223-amg19223c3-amgplt0351.playout.now3.amagi.tv/playlist/amg19223-amg19223c3-amgplt0351/playlist.m3u8" },
    { name: "Premier Sports 2", group: "Sports", logo: "https://i.imgur.com/UQeXWd2.png", url: "https://amg19223-amg19223c4-amgplt0351.playout.now3.amagi.tv/playlist/amg19223-amg19223c4-amgplt0351/playlist.m3u8" },
    { name: "Premiere FC 1", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Premiere_(2017)_logo.png/960px-Premiere_(2017)_logo.png", url: "https://stm.sinalmycn.com/20000/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "Premiere FC 2", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Premiere_(2017)_logo.png/960px-Premiere_(2017)_logo.png", url: "https://stm.sinalmycn.com/20003/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "Premiere FC 3", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Premiere_(2017)_logo.png/960px-Premiere_(2017)_logo.png", url: "https://stm.sinalmycn.com/20006/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "Premiere FC 4", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Premiere_(2017)_logo.png/960px-Premiere_(2017)_logo.png", url: "https://stm.sinalmycn.com/20009/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "Premiere FC 5", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Premiere_(2017)_logo.png/960px-Premiere_(2017)_logo.png", url: "https://stm.sinalmycn.com/20012/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "Premiere FC 6", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Premiere_(2017)_logo.png/960px-Premiere_(2017)_logo.png", url: "https://stm.sinalmycn.com/20015/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "Premiere FC 7", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Premiere_(2017)_logo.png/960px-Premiere_(2017)_logo.png", url: "https://stm.sinalmycn.com/20018/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "Premiere FC 8", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Premiere_(2017)_logo.png/960px-Premiere_(2017)_logo.png", url: "https://stm.sinalmycn.com/20021/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "PRO Sport International", group: "Sports", logo: "", url: "https://proshls.wns.live/hls/stream.m3u8" },
    { name: "RACER International", group: "Sports", logo: "https://provider-static.plex.tv/epg/cms/production/dd4e5871-4347-49e3-9ea1-a8770ea9c518/RACER_Intl_logo_1500x1000.png", url: "https://amg00378-mavtv-amg00378c2-rakuten-us-1048.playouts.now.amagi.tv/playlist/amg00378-mavtvfast-motorsportsnetwork-rakutenus/playlist.m3u8" },
    { name: "Racer Network", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/en/7/74/Racer_Network.jpg", url: "https://amg00378-mavtv-amg00378c2-samsung-au-1790.playouts.now.amagi.tv/playlist/amg00378-mavtvfast-motorsportsnetwork-samsungau/playlist.m3u8" },
    { name: "Racer Select", group: "Sports", logo: "https://i.imgur.com/CurtYvn.png", url: "https://amg00378-amg00378c4-freelivesports-emea-5637.playouts.now.amagi.tv/playlist.m3u8" },
    { name: "Racing.com", group: "Sports", logo: "https://i.imgur.com/Q55HX1O.png", url: "https://racingvic-i.akamaized.net/hls/live/598695/racingvic/index1500.m3u8" },
    { name: "Rally TV", group: "Sports", logo: "https://i.postimg.cc/WtLq2C7c/logo-Rally-Tv1.png", url: "https://rally-tv-live.akamaized.net/hls/live/2117704/RallyTV-Pri/master.m3u8" },
    { name: "Realitatea Sportiva", group: "Sports", logo: "https://i.imgur.com/BaEyZto.png", url: "https://stream.realitatea.net/realitatea/sportiva_md/ts:playlist.m3u8" },
    { name: "Realmadrid TV", group: "Sports", logo: "https://i.imgur.com/5pMo7dL.png", url: "https://jmp2.uk/plu-63dac28760bc8f0008a7654b.m3u8" },
    { name: "Red Bull TV", group: "Sports", logo: "https://images.pluto.tv/channels/5e7cb84a172a0f0007da69e4/colorLogoPNG.png", url: "https://3ea22335.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWdiX1JlZEJ1bGxUVl9ITFM/playlist.m3u8" },
    { name: "Red Bull TV", group: "Sports", logo: "https://images.pluto.tv/channels/5e7cb84a172a0f0007da69e4/colorLogoPNG.png", url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8" },
    { name: "Red Bull TV AU", group: "Sports", logo: "https://images.pluto.tv/channels/5e7cb84a172a0f0007da69e4/colorLogoPNG.png", url: "https://db34cc6127ac459db55cab5f97cd66b9.mediatailor.us-west-2.amazonaws.com/v1/master/ba62fe743df0fe93366eba3a257d792884136c7f/LINEAR-680-WORBAUENFAST-WHALETVPLUS/680/whaletvplus/hls/master/playlist.m3u8" },
    { name: "Red Bull TV BR", group: "Sports", logo: "https://images.pluto.tv/channels/5e7cb84a172a0f0007da69e4/colorLogoPNG.png", url: "https://d03ae6b5c6724c24867e97a3dc04934a.mediatailor.us-west-2.amazonaws.com/v1/master/ba62fe743df0fe93366eba3a257d792884136c7f/LINEAR-1026-WORBBRPTFAST-WHALETVPLUS/1026/hls/master/playlist.m3u8" },
    { name: "Red Bull TV DE", group: "Sports", logo: "https://images.pluto.tv/channels/5e7cb84a172a0f0007da69e4/colorLogoPNG.png", url: "https://46cfeb23c7f74853bba7a256655a3119.mediatailor.us-west-2.amazonaws.com/v1/master/ba62fe743df0fe93366eba3a257d792884136c7f/LINEAR-582-WORBDACHDEFAST-WHALETVPLUS/582/whaletvplus/hls/master/playlist.m3u8" },
    { name: "Red Bull TV ES", group: "Sports", logo: "https://images.pluto.tv/channels/5e7cb84a172a0f0007da69e4/colorLogoPNG.png", url: "https://886bd3fbc782459f8de7555d32d7e9ce.mediatailor.us-west-2.amazonaws.com/v1/master/ba62fe743df0fe93366eba3a257d792884136c7f/LINEAR-957-WORBLATAMESFAST-WHALETVPLUS/957/whaletvplus/hls/master/playlist.m3u8" },
    { name: "Red Bull TV UK", group: "Sports", logo: "https://images.pluto.tv/channels/5e7cb84a172a0f0007da69e4/colorLogoPNG.png", url: "https://1a3566cb46914c5499fbc86fbc4ac87e.mediatailor.us-west-2.amazonaws.com/v1/master/ba62fe743df0fe93366eba3a257d792884136c7f/LINEAR-932-WORBUKENFAST-WHALETVPLUS/932/whaletvplus/hls/master/playlist.m3u8" },
    { name: "Red Bull TV US", group: "Sports", logo: "https://images.pluto.tv/channels/5e7cb84a172a0f0007da69e4/colorLogoPNG.png", url: "https://0b73ace69ebb45eaa249bb87837cb958.mediatailor.us-west-2.amazonaws.com/v1/master/ba62fe743df0fe93366eba3a257d792884136c7f/LINEAR-644-WORBUSENFAST-LG_US/644/lgtv/hls/master/playlist.m3u8" },
    { name: "REV'N Action", group: "Sports", logo: "https://i.imgur.com/xsm8mMd.png", url: "https://lukentvlive.vgcdn.net/v1/master/cef183924f24adfa3d5d7601c3a17769082c0c2b/Revn/index.m3u8" },
    { name: "S Sport", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a9/S_Sport_logo1.png", url: "https://bcovlive-a.akamaihd.net/540fcb034b144b848e7ff887f61a293a/eu-central-1/6415845530001/profile_0/chunklist.m3u8" },
    { name: "S Sport 2", group: "Sports", logo: "https://i.imgur.com/2jIItAy.png", url: "https://bcovlive-a.akamaihd.net/29c60f23ea4840ba8726925a77fcfd0b/eu-central-1/6415845530001/profile_0/chunklist.m3u8" },
    { name: "San Marino RTV Sport", group: "Sports", logo: "https://i.imgur.com/PGm944g.png", url: "https://d2hrvno5bw6tg2.cloudfront.net/smrtv-ch02/smil:ch-02.smil/master.m3u8" },
    { name: "Sky Racing 1", group: "Sports", logo: "https://i.imgur.com/Hf0EiaW.png", url: "https://636ffd31f0e12.streamlock.net/RacingStream1/RacingStream1/playlist.m3u8" },
    { name: "Sky Racing 2", group: "Sports", logo: "https://i.imgur.com/TxQvFnQ.png", url: "https://636ffd31f0e12.streamlock.net/RacingStream2/RacingStream2/playlist.m3u8" },
    { name: "SOS Kanal Plus", group: "Sports", logo: "https://i.imgur.com/9SD40uH.png", url: "https://53be5ef2d13aa.streamlock.net/soskanalplus/soskanalplus.stream/playlist.m3u8" },
    { name: "Sport", group: "Sports", logo: "https://i.imgur.com/2WJE9CM.png", url: "https://stream8.cinerama.uz/1004/tracks-v1a1/mono.m3u8" },
    { name: "Sportitalia", group: "Sports", logo: "https://i.imgur.com/0CJGGgd.png", url: "https://edge-001.streamup.eu/sportitalia/sihd_abr/playlist.m3u8" },
    { name: "Sportitalia Solocalcio", group: "Sports", logo: "https://i.imgur.com/hu56Ya5.png", url: "https://distribution.sportitalialive.it/sportitalia/sisolocalcio_abr/playlist.m3u8" },
    { name: "Sportivnyy", group: "Sports", logo: "https://i.imgur.com/ujS6mMo.png", url: "https://live-3.otcnet.ru/sportivny/index.m3u8" },
    { name: "Sports Connect", group: "Sports", logo: "https://i.imgur.com/0sNWg54.png", url: "https://streamdot.broadpeak.io/cff02a74da64d1459391ce1f72d58f1a/afxpstr/SportsConnect/index.m3u8" },
    { name: "SporTV", group: "Sports", logo: "https://i.postimg.cc/gr9x3z71/Spor-TV-2021.png", url: "https://stm.sinalmycn.com/21000/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "SporTV 2", group: "Sports", logo: "https://i.imgur.com/pBiUnb2.png", url: "https://stm.sinalmycn.com/21003/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "SporTV 2 Alternativo", group: "Sports", logo: "https://i.imgur.com/aoMlRgP.png", url: "https://stm.sinalmycn.com/19025/video.m3u8" },
    { name: "SporTV 3", group: "Sports", logo: "https://i.imgur.com/mWOR8pi.png", url: "https://stm.sinalmycn.com/21006/video.m3u8?token=EkP2qSi13ckjQRLSIDoxI5rMZsF5rZyEYzqWjxD248ScEUPYQ0" },
    { name: "SporTV Alternativo", group: "Sports", logo: "https://i.imgur.com/8M5dLEb.png", url: "https://stm.sinalmycn.com/19024/video.m3u8" },
    { name: "Sporty TV", group: "Sports", logo: "https://i.imgur.com/Wz5bQKx.jpeg", url: "https://dash2.antik.sk/live/sporty_tv/index.m3u8" },
    { name: "Sqala TV", group: "Sports", logo: "https://i.imgur.com/DJ05m8s.png", url: "https://live-evg8.tv360.bitel.com.pe/bitel/studiotvhuanta/playlist.m3u8" },
    { name: "Stadium", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Stadium_%28sports_network%29_logo.svg/960px-Stadium_%28sports_network%29_logo.svg.png", url: "https://wurl120sports.global.transmit.live/hls/679a907dce42a042c23ace37/v1/stadium_gracenote/samsung_us/latest/main/hls/playlist.m3u8" },
    { name: "Star Sports 1", group: "Sports", logo: "https://i.imgur.com/E5jjKHI.png", url: "https://tvsen7.aynaott.com/sspts1/index.m3u8" },
    { name: "Star Sports 2 HD", group: "Sports", logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_STAR_SPORTS_2/images/LOGO_HD/image.png", url: "https://tvsen7.aynaott.com/ssport2hd/index.m3u8" },
    { name: "Strongman", group: "Sports", logo: "https://i.imgur.com/bVQBF6R.png", url: "https://rightsboosterltd-scl-1-eu.rakuten.wurl.tv/playlist.m3u8" },
    { name: "Strongman Champions League", group: "Sports", logo: "https://i.imgur.com/bVQBF6R.png", url: "https://rightsboosterltd-scl-2-eu.rakuten.wurl.tv/playlist.m3u8" },
    { name: "Strongman Champions League", group: "Sports", logo: "https://images-0.rakuten.tv/storage/global-live-channel/translation/artwork/30ccc088-dca7-4458-ad5a-328fef06e1ca-width200-quality90.png", url: "https://rightsboosterltd-scl-1-be.samsung.wurl.tv/playlist.m3u8" },
    { name: "SuperTennis", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/it/thumb/6/6a/SuperTennis_-_Logo_2016.svg/960px-SuperTennis_-_Logo_2016.svg.png", url: "https://live-embed.supertennix.hiway.media/restreamer/supertennix_client/gpu-a-c0-16/restreamer/outgest/aa3673f1-e178-44a9-a947-ef41db73211a/manifest.m3u8" },
    { name: "Swerve Combat", group: "Sports", logo: "https://i.imgur.com/GT0Yi2T.png", url: "https://linear-253.frequency.stream/mt/roku/253/hls/master/playlist.m3u8" },
    { name: "T Sports", group: "Sports", logo: "https://i.imgur.com/2JzlorD.png", url: "https://tvsen7.aynaott.com/tsports-hd/index.m3u8" },
    { name: "T Sports 7", group: "Sports", logo: "https://i.imgur.com/KyI0s5n.png", url: "https://live-us1.thaimomo.com/live-as/chtsport-1/playlist.m3u8" },
    { name: "talkSPORT", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/en/9/9d/Talksport_logo.png", url: "https://af7a8b4e.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfdGFsa1NQT1JUX0hMUw/playlist.m3u8" },
    { name: "TDM Sports Ch. 93", group: "Sports", logo: "https://i.imgur.com/AsWLf8S.png", url: "https://live3.tdm.com.mo/ch4/sport_ch4.live/playlist.m3u8" },
    { name: "Teletrak", group: "Sports", logo: "https://i.imgur.com/NoJvlig.png", url: "https://unlimited6-cl.dps.live/sportinghd/sportinghd.smil/playlist.m3u8" },
    { name: "Tennis Channel", group: "Sports", logo: "https://i.imgur.com/tsljAnY.png", url: "https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg01444-tennischannelth-tennischannelnl-samsungnl/playlist.m3u8" },
    { name: "TennisChannel 2", group: "Sports", logo: "https://i.imgur.com/tsljAnY.png", url: "https://jmp2.uk/plu-681109b688b9d85d0938c6ba.m3u8" },
    { name: "The Cycling Channel", group: "Sports", logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTpbjHW_j4DfsuAn4278ebtzhibMvY7KSOyow&s", url: "https://cyclingtv.playout.vju.tv/cyclingtv/main.m3u8" },
    { name: "Tigo Sports", group: "Sports", logo: "https://i.imgur.com/6wkmgGM.png", url: "https://master.tucableip.com/Amistoso/index.m3u8" },
    { name: "Tigo Sports", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Tigo_Sports_2025.png/960px-Tigo_Sports_2025.png", url: "https://live.enhdtv.com:8081/8160/index.m3u8" },
    { name: "TJK TV", group: "Sports", logo: "https://i.imgur.com/3zHdkYG.png", url: "https://tjktv-live.tjk.org/tjktv.m3u8" },
    { name: "TNC Sports", group: "Sports", logo: "https://i.imgur.com/jT2VFzA.jpeg", url: "https://streamer1.nexgen.bz/TNC_SPORTS/index.m3u8" },
    { name: "TR Sport", group: "Sports", logo: "https://i.imgur.com/ELXmaqg.png", url: "https://livetr.teleromagna.it/mia/live/playlist.m3u8" },
    { name: "Trace Sport Stars (Australia)", group: "Sports", logo: "https://i.imgur.com/FabFP5A.png", url: "https://lightning-tracesport-samsungau.amagi.tv/playlist.m3u8" },
    { name: "Trace Sport Stars Russia", group: "Sports", logo: "https://i.imgur.com/FabFP5A.png", url: "https://stream8.cinerama.uz/1274/tracks-v1a1/mono.m3u8" },
    { name: "Trace Sport Stars SD", group: "Sports", logo: "https://i.imgur.com/FabFP5A.png", url: "https://channels.trace.plus/Traceprod/TRACE_SPORT_STARS_sd/index.m3u8" },
    { name: "TSN3", group: "Sports", logo: "https://i.imgur.com/AYza8KO.png", url: "https://tsn1.shaanp76.workers.dev/" },
    { name: "TSN The Ocho", group: "Sports", logo: "https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CA1400003R3_20240709T002034SQUARE.png", url: "https://d3pnbvng3bx2nj.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-rds8g35qfqrnv/TSN_The_Ocho.m3u8" },
    { name: "Turf Movil", group: "Sports", logo: "https://i.imgur.com/TwIe4lK.png", url: "https://tvturf4.janus.cl/playlist/stream.m3u8?d=w&id=" },
    { name: "TV Cuatro 4.3", group: "Sports", logo: "https://i.imgur.com/Of044Jx.png", url: "https://5ca3e84a76d30.streamlock.net/tv43gto/tv43gto.smil/.m3u8" },
    { name: "TVMsport+", group: "Sports", logo: "https://i.imgur.com/YIreFti.png", url: "https://stream.smashmalta.com:25463/live/webplayer/livestream/29.m3u8" },
    { name: "TVP Sport", group: "Sports", logo: "https://i.imgur.com/JUZDOCO.png", url: "https://estreams.tv.nej.cz/dash/CH_TVP_SPORT_Portable.ism/playlist.mpd" },
    { name: "TVR Sport", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/TVR_Sport_Logo_2023.svg/960px-TVR_Sport_Logo_2023.svg.png", url: "https://tvr-sport.lg.mncdn.com/tvrsport/smil:tvrsport.smil/playlist.m3u8" },
    { name: "TVS Bowling Network", group: "Sports", logo: "https://www.watchyour.tv/channels/logo/tvs-bowling-network.jpg", url: "https://rpn.bozztv.com/gusa/gusa-tvsbowling/index.m3u8" },
    { name: "TVS Boxing", group: "Sports", logo: "https://i.imgur.com/30ZoF75.png", url: "https://rpn.bozztv.com/gusa/gusa-tvsboxing/index.m3u8" },
    { name: "TVS Classic Sports", group: "Sports", logo: "https://i.imgur.com/auR0Mi6.png", url: "https://rpn.bozztv.com/gusa/gusa-tvs/index.m3u8" },
    { name: "TVS Sports Bureau", group: "Sports", logo: "", url: "https://rpn.bozztv.com/gusa/gusa-tvssportsbureau/index.m3u8" },
    { name: "TVS Turbo", group: "Sports", logo: "https://i.imgur.com/7zYIbU1.png", url: "https://rpn.bozztv.com/gusa/gusa-tvsturbo/index.m3u8" },
    { name: "TVS Women Sports", group: "Sports", logo: "https://i.imgur.com/8hC4PfF.png", url: "https://rpn.bozztv.com/gusa/gusa-tvswsn/index.m3u8" },
    { name: "TyC Sports", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/TyC_Sports_logo.svg/960px-TyC_Sports_logo.svg.png", url: "https://amg26268-amg26268c14-freelivesports-emea-10267.playouts.now.amagi.tv/ts-us-e2-n2/playlist/amg26268-sportsstudio-tycsports-freelivesportsemea/playlist.m3u8" },
    { name: "Unbeaten", group: "Sports", logo: "https://i.imgur.com/LmkNt3v.png", url: "https://lukentvlive.vgcdn.net/v1/master/cef183924f24adfa3d5d7601c3a17769082c0c2b/UnbeatenSports/playlist.m3u8" },
    { name: "Unite8 Sports 2 HD", group: "Sports", logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_SYMANDFLIX_HD/images/LOGO_HD/LOGO_HD_qVrE3q5rN_UNITE8-SPORTS-2_HD_264X144.webp", url: "https://mini.allinonereborn.fun/tata.php?id=11624" },
    { name: "Varzesh TV", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/fa/thumb/f/f5/Iribvarzesh2022.png/960px-Iribvarzesh2022.png", url: "https://ncdn.telewebion.ir/varzesh/live/playlist.m3u8" },
    { name: "viju+ Sport", group: "Sports", logo: "https://i.imgur.com/fXESG0l.png", url: "https://stream8.cinerama.uz/1229/tracks-v1a1/mono.m3u8" },
    { name: "VITAL Drive", group: "Sports", logo: "https://i.imgur.com/XoR9zLh.png", url: "https://autopilot.catcast.tv/content/37909/index.m3u8" },
    { name: "VTV6", group: "Sports", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/VTV6_logo_2026_final.svg/960px-VTV6_logo_2026_final.svg.png", url: "https://live.fptplay53.net/live/media/vtv6/live247-hls-avc/index.m3u8" },
    { name: "W14DK-D 14.5 All Sports Television Network", group: "Sports", logo: "https://i.imgur.com/D4mZ8ll.png", url: "https://2-fss-2.streamhoster.com/pl_118/204972-2205186-1/playlist.m3u8" },
    { name: "Willow Sports", group: "Sports", logo: "https://provider-static.plex.tv/epg/cms/production/acf3d1d8-c53e-49ca-86e9-0d9410b106b4/Willow_Sports_dark_Background_1500_1000_color.png", url: "https://d36r8jifhgsk5j.cloudfront.net/Willow_TV1080p.m3u8" },
    { name: "Willow Sports", group: "Sports", logo: "https://provider-static.plex.tv/epg/cms/production/acf3d1d8-c53e-49ca-86e9-0d9410b106b4/Willow_Sports_dark_Background_1500_1000_color.png", url: "https://d36r8jifhgsk5j.cloudfront.net/Willow_TV.m3u8" },
    { name: "World of Freesports", group: "Sports", logo: "https://i.imgur.com/lta5Mog.png", url: "https://mainstreammedia-worldoffreesportsintl-rakuten.amagi.tv/hls/amagi_hls_data_rakutenAA-mainstreammediafreesportsintl-rakuten/CDN/master.m3u8" },
    { name: "World of Freesports", group: "Sports", logo: "https://i.imgur.com/lta5Mog.png", url: "https://mainstreammedia-worldoffreesportsintl-rakuten.amagi.tv/playlist.m3u8" },
    { name: "World Poker Tour", group: "Sports", logo: "https://i.imgur.com/98kLMjj.png", url: "https://jmp2.uk/plu-5ad9b7aae738977e2c312132.m3u8" },
    { name: "World Poker Tour", group: "Sports", logo: "https://i.imgur.com/98kLMjj.png", url: "https://d39g1vxj2ef6in.cloudfront.net/v1/master/3fec3e5cac39a52b2132f9c66c83dae043dc17d4/prod-rakuten-stitched/playlist.m3u8?ads.xumo_channelId=88883102" },
    { name: "World Poker Tour", group: "Sports", logo: "https://i.imgur.com/98kLMjj.png", url: "https://amg00477-samsungelectron-worldpokertour-samsunguk-81igb.amagi.tv/playlist/amg00477-samsungelectron-worldpokertour-samsunguk/playlist.m3u8" },
    { name: "Астрахань.Ru Sport", group: "Sports", logo: "https://i.imgur.com/BKaEtqL.png", url: "https://streaming.astrakhan.ru/astrakhanrusporthd/playlist.m3u8" },
    { name: "СТАРТ Триумф", group: "Sports", logo: "https://i.imgur.com/L9jTieL.png", url: "https://bl.webcaster.pro/media/playlist/free_fe8dc1b768a84b8b0333db826471f17e_hd/33_85479982/1080p/8666c3e935faf6ef47ffd601e8e48868/4821408969.m3u8" },
  ];
  TV_SPORTS_INTL.forEach((c) => TV_CHANNELS.push(c));

  const GROUP_LABELS = {
    all: "Barchasi",
    General: "Umumiy",
    Entertainment: "Ko'ngilochar",
    Movies: "Kino",
    Music: "Musiqa",
    Kids: "Bolalar",
    News: "Yangiliklar",
    Sports: "Sport",
    Family: "Oila",
    Documentary: "Hujjatli",
    Undefined: "Boshqa",
  };
  const GROUP_ORDER = ["all", "General", "Entertainment", "Movies", "Music", "Kids", "News", "Sports", "Family", "Documentary", "Undefined"];

  let activeGroup = "all";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function channelInitial(name) {
    return String(name || "?").trim().charAt(0).toUpperCase();
  }

  // Logolar rasm-proxy (weserv.nl) orqali yuklanadi — imgur ba'zi hududlarda
  // bloklangan/hotlink'ga 403 qaytaradi. Proxy ishlamasa to'g'ridan-to'g'ri
  // URL'ga, u ham bo'lmasa harfli fallback'ga o'tiladi.
  function logoProxyUrl(url) {
    if (!url) return "";
    return "https://images.weserv.nl/?url=" + encodeURIComponent(url) + "&w=112&h=112&fit=contain";
  }

  function buildChannelCard(ch, idx) {
    const proxied = logoProxyUrl(ch.logo);
    return `
      <button class="tv-card" type="button" data-tv-play="${idx}">
        <span class="tv-card__logo">
          <img src="${esc(proxied)}" data-direct="${esc(ch.logo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"
               onerror="if(this.dataset.direct){this.src=this.dataset.direct;this.removeAttribute('data-direct');}else{this.style.display='none';this.nextElementSibling.style.display='grid';}" />
          <span class="tv-card__fallback" style="display:none;">${esc(channelInitial(ch.name))}</span>
        </span>
        <span class="tv-card__name">${esc(ch.name)}</span>
        <span class="tv-card__live"><span class="tv-card__live-dot"></span>LIVE</span>
      </button>`;
  }

  function visibleChannels() {
    if (activeGroup === "all") return TV_CHANNELS.map((ch, i) => ({ ch, i }));
    return TV_CHANNELS.map((ch, i) => ({ ch, i })).filter(({ ch }) => ch.group === activeGroup);
  }

  function usedGroups() {
    const present = new Set(TV_CHANNELS.map((c) => c.group));
    return GROUP_ORDER.filter((g) => g === "all" || present.has(g));
  }

  function renderTvView() {
    const chips = usedGroups().map((g) =>
      `<button class="tv-chip${g === activeGroup ? " is-active" : ""}" type="button" data-tv-group="${esc(g)}">${esc(GROUP_LABELS[g] || g)}</button>`
    ).join("");
    const cards = visibleChannels().map(({ ch, i }) => buildChannelCard(ch, i)).join("");
    tvView.innerHTML = `
      <header class="tv-head">
        <button class="tv-head__back" type="button" data-tv-back aria-label="Orqaga">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6 9 12l6 6"></path></svg>
        </button>
        <h1 class="tv-head__title">TV kanallar</h1>
        <span class="tv-head__count">${TV_CHANNELS.length} ta</span>
      </header>
      <div class="tv-chips">${chips}</div>
      <div class="tv-grid">${cards}</div>
      <div class="tv-spacer"></div>
    `;
    tvView.querySelector("[data-tv-back]")?.addEventListener("click", () => closeTvView());
    tvView.querySelectorAll("[data-tv-group]").forEach((b) => {
      b.addEventListener("click", () => {
        activeGroup = b.dataset.tvGroup;
        renderTvView();
      });
    });
    tvView.querySelectorAll("[data-tv-play]").forEach((b) => {
      b.addEventListener("click", () => {
        const ch = TV_CHANNELS[Number(b.dataset.tvPlay)];
        if (ch) openTvPlayer(ch);
      });
    });
  }

  // ===== HLS pleyer (fifa.js jonli efir pleyeri naqshi) =====
  let hlsLibLoading = null;
  function loadHlsLib() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLibLoading) return hlsLibLoading;
    hlsLibLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
      s.async = true;
      s.onload = () => resolve(window.Hls);
      s.onerror = () => { hlsLibLoading = null; reject(new Error("hls.js yuklanmadi")); };
      document.head.appendChild(s);
    });
    return hlsLibLoading;
  }

  let activeHls = null;
  let controlsTimer = null;

  function ensurePlayerModal() {
    let modal = document.getElementById("tvPlayerModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "tvPlayerModal";
    modal.hidden = true;
    modal.innerHTML = `
      <video id="tvPlayerVideo" playsinline autoplay></video>
      <div class="tv-player__top">
        <button class="tv-player__icon-btn" type="button" data-tv-player-close aria-label="Yopish">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6 9 12l6 6"></path></svg>
        </button>
        <strong class="tv-player__name" id="tvPlayerName"></strong>
        <span class="tv-player__badge"><span class="tv-player__dot"></span>LIVE</span>
      </div>
      <button class="tv-player__center-btn" type="button" id="tvPlayerPlay" hidden aria-label="Play"></button>
      <div class="tv-player__bottom">
        <button class="tv-player__icon-btn" type="button" id="tvPlayerMute" aria-label="Ovoz"></button>
        <button class="tv-player__icon-btn" type="button" id="tvPlayerFs" aria-label="To'liq ekran">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        </button>
      </div>
      <div class="tv-player__status" id="tvPlayerStatus"></div>
    `;
    document.body.appendChild(modal);

    modal.querySelector("[data-tv-player-close]")?.addEventListener("click", () => closeTvPlayer());
    modal.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      modal.classList.toggle("controls-hidden");
      if (!modal.classList.contains("controls-hidden")) scheduleControlsHide(modal);
    });

    const video = modal.querySelector("#tvPlayerVideo");
    const playBtn = modal.querySelector("#tvPlayerPlay");
    playBtn.addEventListener("click", () => { video.play().catch(() => {}); });
    video.addEventListener("play", () => { playBtn.hidden = true; scheduleControlsHide(modal); });
    video.addEventListener("playing", () => { playBtn.hidden = true; setStatus(""); scheduleControlsHide(modal); });
    video.addEventListener("pause", () => {
      playBtn.hidden = false;
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="m8 5 12 7-12 7z"/></svg>`;
      modal.classList.remove("controls-hidden");
    });

    const muteBtn = modal.querySelector("#tvPlayerMute");
    const syncMuteIcon = () => {
      muteBtn.innerHTML = video.muted
        ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3 2.7-2.7-1.41-1.42-2.7 2.71-2.7-2.71-1.42 1.42 2.71 2.7-2.71 2.7 1.42 1.42 2.7-2.71 2.7 2.71 1.41-1.42-2.7-2.7z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`;
    };
    muteBtn.addEventListener("click", () => { video.muted = !video.muted; syncMuteIcon(); });
    syncMuteIcon();

    modal.querySelector("#tvPlayerFs")?.addEventListener("click", () => {
      const inFs = document.fullscreenElement || document.webkitFullscreenElement;
      if (inFs) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        return;
      }
      if (typeof video.webkitEnterFullscreen === "function" && !video.paused) {
        try { video.webkitEnterFullscreen(); return; } catch (_) {}
      }
      (modal.requestFullscreen || modal.webkitRequestFullscreen)?.call(modal);
    });

    return modal;
  }

  function scheduleControlsHide(modal, delay = 4000) {
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      const v = modal.querySelector("#tvPlayerVideo");
      if (v && !v.paused) modal.classList.add("controls-hidden");
    }, delay);
  }

  function setStatus(text) {
    const el = document.getElementById("tvPlayerStatus");
    if (!el) return;
    el.textContent = text || "";
    el.style.display = text ? "block" : "none";
  }

  function stopPlayback() {
    try { activeHls?.destroy?.(); } catch (_) {}
    activeHls = null;
    const video = document.getElementById("tvPlayerVideo");
    if (video) {
      try { video.pause(); } catch (_) {}
      video.removeAttribute("src");
      try { video.load(); } catch (_) {}
    }
  }

  function openTvPlayer(channel) {
    const modal = ensurePlayerModal();
    const video = modal.querySelector("#tvPlayerVideo");
    const nameEl = modal.querySelector("#tvPlayerName");
    if (nameEl) nameEl.textContent = channel.name;
    modal.hidden = false;
    modal.classList.remove("controls-hidden");
    document.body.classList.add("tv-player-open");
    setStatus("Yuklanmoqda…");
    try { window.tgBackRegister?.("tv-player", () => closeTvPlayer()); } catch (_) {}

    const src = channel.url;
    const tryNative = () => {
      if (!video.canPlayType("application/vnd.apple.mpegurl")) {
        setStatus("Brauzer jonli efirni qo'llab-quvvatlamaydi");
        return;
      }
      video.src = src;
      video.addEventListener("loadedmetadata", () => setStatus(""), { once: true });
      video.addEventListener("error", () => setStatus("Oqimni yuklab bo'lmadi"), { once: true });
      video.play().catch(() => {});
    };

    loadHlsLib().then((Hls) => {
      if (!Hls || !Hls.isSupported()) { tryNative(); return; }
      stopPlayback();
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1500,
        levelLoadingMaxRetry: 4,
      });
      activeHls = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setStatus(""); video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setStatus("Tarmoq xatosi — kanal vaqtincha ishlamayapti");
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); } catch (_) { setStatus("Media xatosi"); }
        } else {
          setStatus("Oqimni yuklab bo'lmadi");
        }
      });
    }).catch(() => tryNative());
  }

  function closeTvPlayer() {
    const modal = document.getElementById("tvPlayerModal");
    if (!modal || modal.hidden) return;
    stopPlayback();
    modal.hidden = true;
    document.body.classList.remove("tv-player-open");
    if (controlsTimer) { clearTimeout(controlsTimer); controlsTimer = null; }
    try { window.tgBackUnregister?.("tv-player"); } catch (_) {}
  }

  // ===== View ochish/yopish =====
  function openTvView() {
    tvView.hidden = false;
    document.body.classList.add("is-tv");
    renderTvView();
    appShell?.scrollTo({ top: 0, behavior: "smooth" });
    try { window.tgBackRegister?.("tv-view", () => closeTvViewAndGoHome()); } catch (_) {}
    try { window.syncSidebarSectionItems?.(); } catch (_) {}
  }

  function closeTvView() {
    closeTvPlayer();
    tvView.hidden = true;
    document.body.classList.remove("is-tv");
    try { window.tgBackUnregister?.("tv-view"); } catch (_) {}
  }

  function closeTvViewAndGoHome() {
    closeTvView();
    try { window.setFilter?.("all"); } catch (_) {}
  }

  window.__tv = { openTvView, closeTvView };
})();
