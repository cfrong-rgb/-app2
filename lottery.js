/**
 * 統一發票對獎：抓取第三方 JSON（invoice.98goto.com）並比對備註／發票欄位中的發票號碼。
 * 依交易日期推算期別（ROC 年 + 雙月期別），與開獎資料比對後回傳中文說明。
 */
(function (global) {
  "use strict";

  var LOTTERY_URL = "https://invoice.98goto.com/api/echo_json";
  var CACHE_MS = 6 * 60 * 60 * 1000;
  var memoryCache = { at: 0, list: null };

  var PRIZE_AMOUNTS = {
    特別獎: 10000000,
    特獎: 2000000,
    頭獎: 200000,
    二獎: 40000,
    三獎: 10000,
    四獎: 4000,
    五獎: 1000,
    六獎: 200,
  };

  /** 西元 YYYY-MM-DD → 期別鍵：ROC3位 + 期別2位（1～2月=01…11～12月=06） */
  function ymdToInvTermKey(ymd) {
    var m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
    var roc = y - 1911;
    var period = Math.ceil(mo / 2);
    return String(roc).padStart(3, "0") + String(period).padStart(2, "0");
  }

  function normalizeRocPeriodKey(roc, monthStart) {
    var p = Math.ceil(Number(monthStart) / 2);
    return String(roc).padStart(3, "0") + String(p).padStart(2, "0");
  }

  /** 從 API 標題「115年 01~02月」取得期別鍵 */
  function parsePeriodTitle(title) {
    var t = String(title || "").replace(/<[^>]+>/g, " ");
    var m = t.match(/(\d{2,3})\s*年\s*(\d{1,2})\s*[~～]\s*(\d{1,2})\s*月/);
    if (!m) return null;
    var roc = Number(m[1]);
    var m1 = Number(m[2]);
    return normalizeRocPeriodKey(roc, m1);
  }

  function concatDigits(htmlSlice) {
    return String(htmlSlice || "").replace(/[^0-9]/g, "");
  }

  function parsePrizeBlock(html) {
    var special = "";
    var grand = "";
    var first = [];
    var m0 = html.match(/特別獎[^0-9]*<span[^>]*>([0-9]{8})<\/span>/);
    if (m0) special = m0[1];
    var i特 = html.indexOf("特獎");
    var i頭 = html.indexOf("頭獎");
    if (i特 >= 0 && i頭 > i特) {
      var chunk = html.slice(i特, i頭);
      var d = concatDigits(chunk);
      if (d.length >= 8) grand = d.slice(0, 8);
      var re = /([0-9]{2,5})<span[^>]*class="red"[^>]*>([0-9]{3})<\/span>/g;
      var mm;
      while ((mm = re.exec(chunk))) {
        var n = (mm[1] + mm[2]).replace(/\D/g, "");
        if (n.length === 8) grand = n;
      }
    }
    if (i頭 >= 0) {
      var tail = html.slice(i頭);
      var re2 = /([0-9]{2,5})<span[^>]*class="red"[^>]*>([0-9]{3})<\/span>/g;
      var m2;
      while ((m2 = re2.exec(tail))) {
        var num = (m2[1] + m2[2]).replace(/\D/g, "");
        if (num.length === 8) first.push(num);
      }
    }
    return { special: special, grand: grand, first: first };
  }

  function flattenApiPayload(data) {
    var out = [];
    function push(obj) {
      if (!obj || !obj.title) return;
      var key = parsePeriodTitle(obj.title);
      var prizes = parsePrizeBlock(obj.description || "");
      if (key && (prizes.special || prizes.grand || (prizes.first && prizes.first.length)))
        out.push({ invTermKey: key, prizes: prizes });
    }
    var i;
    var arr = data.new || [];
    for (i = 0; i < arr.length; i++) push(arr[i]);
    var old = data.old || [];
    for (i = 0; i < old.length; i++) {
      var batch = old[i];
      if (Array.isArray(batch)) {
        var j;
        for (j = 0; j < batch.length; j++) push(batch[j]);
      }
    }
    return out;
  }

  async function loadWinningList() {
    var now = Date.now();
    if (memoryCache.list && now - memoryCache.at < CACHE_MS) return memoryCache.list;
    var res = await fetch(LOTTERY_URL, { cache: "default" });
    if (!res.ok) throw new Error("fetch");
    var data = await res.json();
    var list = flattenApiPayload(data);
    memoryCache = { at: now, list: list };
    return list;
  }

  function matchEightDigits(inv8, row) {
    var p = row.prizes;
    if (!inv8 || inv8.length !== 8) return null;
    if (p.special && inv8 === p.special) return { grade: "特別獎", amount: PRIZE_AMOUNTS.特別獎 };
    if (p.grand && inv8 === p.grand) return { grade: "特獎", amount: PRIZE_AMOUNTS.特獎 };
    var i;
    for (i = 0; i < (p.first || []).length; i++) {
      if (inv8 === p.first[i]) return { grade: "頭獎", amount: PRIZE_AMOUNTS.頭獎 };
    }
    for (i = 0; i < (p.first || []).length; i++) {
      var h = p.first[i];
      if (inv8.slice(1) === h.slice(1)) return { grade: "二獎", amount: PRIZE_AMOUNTS.二獎 };
    }
    for (i = 0; i < (p.first || []).length; i++) {
      h = p.first[i];
      if (inv8.slice(2) === h.slice(2)) return { grade: "三獎", amount: PRIZE_AMOUNTS.三獎 };
    }
    for (i = 0; i < (p.first || []).length; i++) {
      h = p.first[i];
      if (inv8.slice(3) === h.slice(3)) return { grade: "四獎", amount: PRIZE_AMOUNTS.四獎 };
    }
    for (i = 0; i < (p.first || []).length; i++) {
      h = p.first[i];
      if (inv8.slice(4) === h.slice(4)) return { grade: "五獎", amount: PRIZE_AMOUNTS.五獎 };
    }
    for (i = 0; i < (p.first || []).length; i++) {
      h = p.first[i];
      if (inv8.slice(5) === h.slice(5)) return { grade: "六獎", amount: PRIZE_AMOUNTS.六獎 };
    }
    return null;
  }

  function extractInvoicesFromText(text) {
    var s = String(text || "");
    var out = [];
    var re = /\b([A-Za-z]{2})[-\s]?([0-9]{8})\b/g;
    var m;
    while ((m = re.exec(s))) {
      out.push({ letters: m[1].toUpperCase(), digits: m[2], raw: m[1].toUpperCase() + m[2] });
    }
    return out;
  }

  function formatAmount(n) {
    return Number(n).toLocaleString("zh-Hant-TW");
  }

  function formatResult(inv, hit) {
    if (hit)
      return (
        "恭喜中獎：" +
        hit.grade +
        "，獎金新台幣 " +
        formatAmount(hit.amount) +
        " 元（發票 " +
        inv +
        "）。"
      );
    return "未中獎（發票 " + inv + "）。";
  }

  /**
   * @param {{ invoiceRaw?: string, note?: string, bookedDateYmd?: string }} o
   * @returns {Promise<string>} 一行中文說明
   */
  async function checkInvoice(o) {
    var invField = String((o && o.invoiceRaw) || "").trim().toUpperCase().replace(/\s+/g, "");
    var note = String((o && o.note) || "");
    var ymd = (o && o.bookedDateYmd) || "";
    var combined = [invField, note].filter(Boolean).join(" ");
    var codes = extractInvoicesFromText(combined);
    if (codes.length === 0) return "";

    var termKey = ymdToInvTermKey(ymd);
    if (!termKey) return "無法對獎：請確認記帳日期。";

    var list;
    try {
      list = await loadWinningList();
    } catch (e) {
      return "無法取得開獎資料（請連線後再試）。";
    }

    var row = null;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].invTermKey === termKey) {
        row = list[i];
        break;
      }
    }
    if (!row) return "本期（期別 " + termKey + "）尚無開獎資料或未收錄。";

    var lines = [];
    for (i = 0; i < codes.length; i++) {
      var d = codes[i].digits;
      var hit = matchEightDigits(d, row);
      lines.push(formatResult(codes[i].raw, hit));
    }
    return lines.join(" ");
  }

  global.StitchLottery = {
    checkInvoice: checkInvoice,
    ymdToInvTermKey: ymdToInvTermKey,
    extractInvoicesFromText: extractInvoicesFromText,
    LOTTERY_DATA_URL: LOTTERY_URL,
  };
})(typeof window !== "undefined" ? window : globalThis);
