/*
 * mp4-duration.js
 *
 * MP4 faylning davomiyligini (sekundda) HTTP Range request orqali aniqlaydi.
 * Faqat `moov` atomi fayl boshida (faststart) bo'lgan fayllar uchun.
 * ffmpeg/ffprobe shart emas - sof Node.js.
 */

const PROBE_BYTES = 1024 * 1024; // 1MB - moov atomi shu ichida bo'lishi kerak

function findChildAtom(buffer, parentOffset, parentSize, typeName) {
  const end = parentOffset + parentSize;
  let offset = parentOffset + 8;
  while (offset + 8 <= end && offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === typeName) return { offset, size };
    if (size < 8) return null;
    offset += size;
  }
  return null;
}

function parseMvhdDuration(buffer, mvhdOffset) {
  // mvhd payload starts at mvhdOffset + 8 (atom header)
  const payloadStart = mvhdOffset + 8;
  const version = buffer.readUInt8(payloadStart);
  // skip flags (3 bytes)
  let cursor;
  let timescale;
  let duration;
  if (version === 1) {
    // version 1: 8-byte times. creation_time(8) + modification_time(8) + timescale(4) + duration(8)
    cursor = payloadStart + 4 + 8 + 8;
    timescale = buffer.readUInt32BE(cursor);
    cursor += 4;
    // 64-bit duration; safely read as two 32-bit halves
    const hi = buffer.readUInt32BE(cursor);
    const lo = buffer.readUInt32BE(cursor + 4);
    duration = hi * 0x100000000 + lo;
  } else {
    // version 0: 4-byte times
    cursor = payloadStart + 4 + 4 + 4;
    timescale = buffer.readUInt32BE(cursor);
    cursor += 4;
    duration = buffer.readUInt32BE(cursor);
  }
  if (!timescale || !duration) return 0;
  return duration / timescale;
}

function extractDurationFromBuffer(buffer) {
  // "moov" satrini buyer ichida qidiramiz - oldidagi 4 bayt size bo'lishi kerak
  let searchFrom = 0;
  while (searchFrom < buffer.length - 8) {
    const idx = buffer.indexOf("moov", searchFrom, "ascii");
    if (idx === -1 || idx < 4) return 0;
    const atomOffset = idx - 4;
    const size = buffer.readUInt32BE(atomOffset);
    // moov hech qachon 64-bit size emas (kichkina atom)
    if (size >= 8 && size <= 64 * 1024 * 1024 && atomOffset + size <= buffer.length) {
      const mvhd = findChildAtom(buffer, atomOffset, size, "mvhd");
      if (mvhd) {
        const seconds = parseMvhdDuration(buffer, mvhd.offset);
        if (seconds > 0) return seconds;
      }
    }
    searchFrom = idx + 4;
  }
  return 0;
}

async function fetchRange(url, rangeHeader, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Range: rangeHeader },
      signal: controller.signal,
    });
    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentRange = response.headers.get("content-range") || "";
    const totalSizeMatch = contentRange.match(/\/(\d+)$/);
    const totalSize = totalSizeMatch ? Number(totalSizeMatch[1]) : 0;
    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), totalSize };
  } finally {
    clearTimeout(timer);
  }
}

function findMoovOffsetFromTopLevelScan(buffer) {
  // Top-level atomlarni ketma-ket o'qib, moov joyini hisoblaymiz
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      // 64-bit size
      if (offset + 16 > buffer.length) return { moovOffset: -1, nextOffset: offset };
      const hi = buffer.readUInt32BE(offset + 8);
      const lo = buffer.readUInt32BE(offset + 12);
      size = hi * 0x100000000 + lo;
      headerSize = 16;
    }
    if (type === "moov") return { moovOffset: offset, size };
    if (size < headerSize) return { moovOffset: -1, nextOffset: offset };
    offset += size;
  }
  return { moovOffset: -1, nextOffset: offset };
}

async function parseSecondsFromMoovChunk(buffer) {
  // buffer moov atomidan boshlangani taxmin qilinadi
  if (buffer.length < 16) return 0;
  const size = buffer.readUInt32BE(0);
  const type = buffer.toString("ascii", 4, 8);
  if (type !== "moov") return 0;
  const limit = Math.min(size, buffer.length);
  const mvhd = findChildAtom(buffer, 0, limit, "mvhd");
  if (!mvhd) return 0;
  return parseMvhdDuration(buffer, mvhd.offset);
}

async function getMp4DurationSeconds(url, options = {}) {
  const timeoutMs = options.timeoutMs || 5000;
  const MOOV_PROBE_BYTES = 64 * 1024; // mvhd uchun yetarli

  // 1) Boshini o'qib top-level atomlarni skan qilamiz
  const head = await fetchRange(url, `bytes=0-${PROBE_BYTES - 1}`, timeoutMs);
  let scan = findMoovOffsetFromTopLevelScan(head.buffer);
  if (scan.moovOffset >= 0) {
    const seconds = extractDurationFromBuffer(head.buffer);
    if (seconds) return seconds;
  }

  const totalSize = head.totalSize;
  if (!totalSize) throw new Error("content-range yo'q, fayl hajmini bilolmadik");

  // 2) Bosh chunk moov gacha yetmagan - top-level skanni davom ettirib moov joyini topamiz
  let cursor = scan.nextOffset;
  let safety = 0;
  while (cursor < totalSize && safety < 8) {
    safety += 1;
    // Faqat atom header (16 bayt yetarli) ni o'qiymiz - kichik so'rov
    const end = Math.min(cursor + 32 - 1, totalSize - 1);
    const headerChunk = await fetchRange(url, `bytes=${cursor}-${end}`, timeoutMs);
    if (headerChunk.buffer.length < 8) break;
    let size = headerChunk.buffer.readUInt32BE(0);
    const type = headerChunk.buffer.toString("ascii", 4, 8);
    let headerSize = 8;
    if (size === 1 && headerChunk.buffer.length >= 16) {
      const hi = headerChunk.buffer.readUInt32BE(8);
      const lo = headerChunk.buffer.readUInt32BE(12);
      size = hi * 0x100000000 + lo;
      headerSize = 16;
    }
    if (type === "moov") {
      // Endi moov ning birinchi 64KB sini o'qiymiz va mvhd ni topamiz
      const moovEnd = Math.min(cursor + Math.max(size, MOOV_PROBE_BYTES) - 1, totalSize - 1);
      const moovChunk = await fetchRange(url, `bytes=${cursor}-${Math.min(cursor + MOOV_PROBE_BYTES - 1, moovEnd)}`, timeoutMs);
      const seconds = await parseSecondsFromMoovChunk(moovChunk.buffer);
      if (seconds) return seconds;
      throw new Error("mvhd moov ichida topilmadi");
    }
    if (size < headerSize) break;
    cursor += size;
  }
  throw new Error("moov atomi topilmadi");
}

module.exports = {
  getMp4DurationSeconds,
  extractDurationFromBuffer,
};
