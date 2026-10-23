const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractStream, extractYouTube, extractDirectHls, extractDirectWhep, extractIframe } = require('../../api/_lib/stream-extractor');

test('FIFA Universal Stream Extractor Suite', async (t) => {
  await t.test('1. YouTube Live / Shorts / Watch URL extracting', () => {
    const yt1 = extractYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(yt1.success, true);
    assert.equal(yt1.type, 'youtube');
    assert.equal(yt1.video_id, 'dQw4w9WgXcQ');
    assert.equal(yt1.stream_url, 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1');

    const yt2 = extractYouTube('https://youtu.be/ScMzIvxBSi4');
    assert.equal(yt2.video_id, 'ScMzIvxBSi4');

    const ytLive = extractYouTube('https://www.youtube.com/live/ScMzIvxBSi4');
    assert.equal(ytLive.video_id, 'ScMzIvxBSi4');
  });

  await t.test('2. Direct HLS (.m3u8) extracting', () => {
    const hls = extractDirectHls('https://edge.server.net/live/ch1/master.m3u8?token=xyz');
    assert.equal(hls.success, true);
    assert.equal(hls.type, 'hls');
    assert.equal(hls.stream_url, 'https://edge.server.net/live/ch1/master.m3u8?token=xyz');
  });

  await t.test('3. Cloudflare WHEP (WebRTC) extracting', () => {
    const whep = extractDirectWhep('https://customer-xxx.cloudflarestream.com/abc123/webRTC/play');
    assert.equal(whep.success, true);
    assert.equal(whep.type, 'whep');
  });

  await t.test('4. Iframe tag extracting', () => {
    const iframe = extractIframe('<iframe src="https://streamprovider.net/embed/445" width="600"></iframe>');
    assert.equal(iframe.success, true);
    assert.equal(iframe.type, 'iframe');
    assert.equal(iframe.stream_url, 'https://streamprovider.net/embed/445');
  });

  await t.test('5. 3rd-party website stream extraction (world-cup.su)', async () => {
    const res = await extractStream('https://f8.world-cup.su/ru/23/10/2026/dynamo-kyiv-kudrivka/');
    assert.equal(res.success, true);
    assert.equal(res.type, 'iframe');
    assert.match(res.stream_url, /^https:\/\/p\.wcp\.su\/\?id=/);
  });
});
