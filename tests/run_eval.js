/**
 * VF Chọn Xe — Trợ lý AI chọn xe điện VinFast
 * File: tests/run_eval.js — Đo 25 câu hỏi trong tests/spec_questions.json bằng chế độ "qa" của api/ask.js
 * Cách chạy:
 *   node tests/run_eval.js                        -> Chạy khô: chỉ liệt kê id + câu hỏi, KHÔNG gọi mạng
 *   node tests/run_eval.js --run --from 1 --to 16 -> Gọi Gemini thật từ câu 1 đến 16, nghỉ 14s giữa 2 lần gọi
 *   node tests/run_eval.js --run --only Q01,Q02   -> Chạy lại đúng các câu chỉ định, nghỉ 14s giữa 2 lần gọi
 */

'use strict';

// Thu thập toàn bộ output ra stdout/stderr để kiểm tra an toàn key cuối lần chạy
let capturedOutput = '';
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

process.stdout.write = function (chunk, encoding, callback) {
  if (chunk !== null && chunk !== undefined) {
    capturedOutput += typeof chunk === 'string' ? chunk : chunk.toString();
  }
  return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = function (chunk, encoding, callback) {
  if (chunk !== null && chunk !== undefined) {
    capturedOutput += typeof chunk === 'string' ? chunk : chunk.toString();
  }
  return originalStderrWrite(chunk, encoding, callback);
};

const fs = require('fs');
const path = require('path');

const carsData = require('../data/cars.json');
const pricesData = require('../data/prices.json');
const specQuestionsData = require('./spec_questions.json');
const handler = require('../api/ask.js');

const RESULTS_FILE_PATH = path.join(__dirname, 'results_eval.md');
const CALL_DELAY_MS = 14000;
const API_ERROR_LABEL = 'LỖI GỌI API (không tính điểm)';

/**
 * Tự đọc file .env.local ở thư mục gốc bằng fs và nạp vào process.env (tuyệt đối không in key)
 */
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('export ')) {
      line = line.slice(7).trim();
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIdx = value.indexOf(' #');
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Gọi handler(req, res) của api/ask.js với req/res giả
 */
async function invokeAskHandler(bodyPayload, clientIp) {
  const req = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp || '127.0.0.1'
    },
    body: bodyPayload
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    statusCode: 200,
    setHeader: function () {},
    status: function (code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      responseData = data;
      return this;
    },
    end: function (raw) {
      if (responseData === null && typeof raw === 'string') {
        try {
          responseData = JSON.parse(raw);
        } catch (_e) {
          responseData = { raw: raw };
        }
      }
      return this;
    }
  };

  await handler(req, res);
  return {
    statusCode: statusCode,
    data: responseData
  };
}

/**
 * Tạm dừng (ms)
 */
function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Trích xuất mọi token số từ một chuỗi văn bản
 */
function extractNumberTokens(text) {
  if (typeof text !== 'string' || !text) {
    return [];
  }
  const matches = text.match(/\d+(?:[.,]\d+)*/g);
  return matches ? matches : [];
}

/**
 * Sinh các dạng biểu diễn chuẩn hoá (chuỗi & giá trị số) cho một token số tiếng Việt / JSON
 */
function getTokenVariants(rawToken) {
  const variants = new Set();
  const token = String(rawToken).trim();
  if (!token) {
    return variants;
  }

  variants.add(token);
  variants.add(token.replace(/,/g, '.'));

  // Trường hợp dùng dấu chấm phân tách hàng nghìn (ví dụ: 200.000, 188.000.000, 1.348)
  if (/^\d{1,3}(?:\.\d{3})+$/.test(token)) {
    const noDots = token.replace(/\./g, '');
    variants.add(noDots);
    const numNoDots = Number(noDots);
    if (Number.isFinite(numNoDots)) {
      variants.add(String(numNoDots));
    }
  }

  // Trường hợp dùng dấu phẩy phân tách hàng nghìn (ví dụ: 200,000, 188,000,000)
  if (/^\d{1,3}(?:,\d{3})+$/.test(token)) {
    const noCommas = token.replace(/,/g, '');
    variants.add(noCommas);
    const numNoCommas = Number(noCommas);
    if (Number.isFinite(numNoCommas)) {
      variants.add(String(numNoCommas));
    }
  }

  // Trường hợp số thập phân dùng dấu phẩy hoặc dấu chấm (ví dụ: 5,119 -> 5.119; 4,75 -> 4.75)
  const dotNormalized = token.replace(/,/g, '.');
  const asFloat = Number(dotNormalized);
  if (Number.isFinite(asFloat)) {
    variants.add(String(asFloat));
  }

  return variants;
}

/**
 * Xây dựng tập hợp các con số đã biết từ data/cars.json và data/prices.json
 */
function buildBaseKnownNumbers() {
  const known = new Set();

  function addNumberValue(num) {
    if (typeof num !== 'number' || !Number.isFinite(num)) {
      return;
    }
    known.add(String(num));
    if (num >= 1000000 && num % 100000 === 0) {
      known.add(String(num / 1000000));
      known.add(String(num / 1000000000));
    }
    if (num >= 1000 && num % 1000 === 0) {
      known.add(String(num / 1000));
    }
  }

  function addFromText(str) {
    const tokens = extractNumberTokens(str);
    for (let i = 0; i < tokens.length; i++) {
      const variants = getTokenVariants(tokens[i]);
      variants.forEach(function (v) {
        known.add(v);
        const n = Number(v);
        if (Number.isFinite(n)) {
          addNumberValue(n);
        }
      });
    }
  }

  function walkObject(obj) {
    if (obj === null || obj === undefined) {
      return;
    }
    if (typeof obj === 'number') {
      addNumberValue(obj);
      return;
    }
    if (typeof obj === 'string') {
      addFromText(obj);
      return;
    }
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        walkObject(obj[i]);
      }
      return;
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        walkObject(keys[i]);
        walkObject(obj[keys[i]]);
      }
    }
  }

  walkObject(carsData);
  walkObject(pricesData);

  return known;
}

const BASE_KNOWN_NUMBERS = buildBaseKnownNumbers();

/**
 * Tìm các con số trong câu trả lời không xuất hiện trong data/cars.json, data/prices.json hoặc chính câu hỏi
 */
function findStrangeNumbers(answerText, questionText) {
  const known = new Set(BASE_KNOWN_NUMBERS);

  const qTokens = extractNumberTokens(questionText);
  for (let i = 0; i < qTokens.length; i++) {
    const variants = getTokenVariants(qTokens[i]);
    variants.forEach(function (v) {
      known.add(v);
    });
  }

  const aTokens = extractNumberTokens(answerText);
  const strange = [];

  for (let i = 0; i < aTokens.length; i++) {
    const rawTok = aTokens[i];
    const variants = getTokenVariants(rawTok);
    let found = false;
    variants.forEach(function (v) {
      if (known.has(v)) {
        found = true;
      }
    });
    if (!found && strange.indexOf(rawTok) === -1) {
      strange.push(rawTok);
    }
  }

  return strange;
}

/**
 * Kiểm tra câu trả lời theo 4 tiêu chí trong đề bài
 */
function evaluateAnswer(questionItem, answerText) {
  const text = typeof answerText === 'string' ? answerText : '';
  const lower = text.toLowerCase();
  const notes = [];

  // 1. must_mention: mọi từ trong must_mention (nếu có) phải xuất hiện trong câu trả lời (không phân biệt hoa thường)
  const mustMention = Array.isArray(questionItem.must_mention) ? questionItem.must_mention : [];
  const missingMentions = [];
  for (let i = 0; i < mustMention.length; i++) {
    const term = String(mustMention[i]);
    if (!lower.includes(term.toLowerCase())) {
      missingMentions.push(term);
    }
  }
  if (missingMentions.length > 0) {
    notes.push('thiếu must_mention: ' + missingMentions.join(', '));
  }

  // 2. Số lạ: lấy mọi con số trong câu trả lời; số nào không xuất hiện trong data/cars.json, data/prices.json hoặc chính câu hỏi
  const strangeNumbers = findStrangeNumbers(text, questionItem.question || '');
  if (strangeNumbers.length > 0) {
    notes.push('số lạ: ' + strangeNumbers.join(', '));
  }

  // 3. Câu bẫy (trap = true): phải chứa cụm kiểu "chưa có dữ liệu" / "không có thông tin", hoặc gợi ý trang chính hãng/showroom
  let trapFailed = false;
  if (questionItem.trap === true) {
    const trapPhrases = [
      'chưa có dữ liệu',
      'không có dữ liệu',
      'chưa có thông tin',
      'không có thông tin',
      'ngoài dữ liệu',
      'không nằm trong dữ liệu',
      'dữ liệu hiện tại chưa',
      'dữ liệu chỉ có',
      'vinfastauto.com',
      'trang chính hãng',
      'website chính thức',
      'trang chủ',
      'showroom',
      'đại lý'
    ];
    const hasTrapPhrase = trapPhrases.some(function (phrase) {
      return lower.includes(phrase);
    });
    if (!hasTrapPhrase) {
      trapFailed = true;
      notes.push('câu bẫy thiếu từ chối/gợi ý');
    }
  }

  // 4. NEDC/WLTP: nếu nhắc cả NEDC lẫn WLTP và có từ so sánh (hơn, xa hơn, dài hơn, kém) thì gắn "NGHI SO KHÁC CHUẨN"
  let suspectedCrossStandard = false;
  if (lower.includes('nedc') && lower.includes('wltp')) {
    const compareRegex = /(?:^|[^\p{L}\p{N}])(xa hơn|dài hơn|hơn|kém)(?=$|[^\p{L}\p{N}])/iu;
    if (compareRegex.test(text)) {
      suspectedCrossStandard = true;
      notes.push('NGHI SO KHÁC CHUẨN');
    }
  }

  const passedAll4 =
    missingMentions.length === 0 &&
    strangeNumbers.length === 0 &&
    !trapFailed &&
    !suspectedCrossStandard;

  return {
    label: passedAll4 ? 'ĐẠT' : 'CẦN XEM',
    notes: notes,
    strangeNumbers: strangeNumbers,
    suspectedCrossStandard: suspectedCrossStandard
  };
}

/**
 * Làm sạch chuỗi để đưa vào ô bảng Markdown và cắt tối đa maxLen ký tự
 */
function formatMarkdownCell(str, maxLen) {
  let clean = String(str == null ? '' : str)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (typeof maxLen === 'number' && maxLen > 0 && clean.length > maxLen) {
    clean = clean.slice(0, maxLen) + '...';
  }

  return clean.replace(/\|/g, '\\|');
}

/**
 * Định dạng ngày giờ hiện tại (YYYY-MM-DD HH:mm:ss)
 */
function formatNow() {
  const d = new Date();
  const pad = function (n) {
    return n < 10 ? '0' + n : String(n);
  };
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes()) +
    ':' +
    pad(d.getSeconds())
  );
}

/**
 * Đọc toàn bộ file tests/results_eval.md và tính tổng theo lần chạy gần nhất của mỗi câu
 */
function computeCumulativeLatestSummary() {
  const latestByQuestion = new Map();

  if (fs.existsSync(RESULTS_FILE_PATH)) {
    const content = fs.readFileSync(RESULTS_FILE_PATH, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!/^\|(?:\s*Q\d+\s*)\|/.test(line)) {
        continue;
      }

      // Tách các cột theo ký tự '|' không bị escape '\|'
      const rawCells = line.split(/(?<!\\)\|/);
      if (rawCells.length < 7) {
        continue;
      }

      const qId = rawCells[1].trim();
      const answerCell = rawCells[3].trim();
      const modelCell = rawCells[4].trim();
      const labelCell = rawCells[5].trim();
      const noteCell = rawCells[6].trim();

      const isApiErr =
        labelCell === API_ERROR_LABEL ||
        /^lỗi gọi API/i.test(noteCell) ||
        /^\(LỖI HTTP/i.test(answerCell);

      latestByQuestion.set(qId, {
        id: qId,
        model: modelCell,
        label: isApiErr ? API_ERROR_LABEL : labelCell,
        notes: noteCell,
        isApiError: isApiErr,
        hasStrangeNumbers: !isApiErr && /số lạ:/i.test(noteCell),
        hasCrossStandard: !isApiErr && /NGHI SO KHÁC CHUẨN/i.test(noteCell)
      });
    }
  }

  let datCount = 0;
  let canXemCount = 0;
  let soLaCount = 0;
  let nghiSoKhacChuanCount = 0;
  let apiErrorCount = 0;

  latestByQuestion.forEach(function (item) {
    if (item.isApiError) {
      apiErrorCount++;
      return;
    }
    if (item.label === 'ĐẠT') {
      datCount++;
    } else if (item.label === 'CẦN XEM') {
      canXemCount++;
    }
    if (item.hasStrangeNumbers) {
      soLaCount++;
    }
    if (item.hasCrossStandard) {
      nghiSoKhacChuanCount++;
    }
  });

  return {
    totalUniqueQuestions: latestByQuestion.size,
    datCount: datCount,
    canXemCount: canXemCount,
    soLaCount: soLaCount,
    nghiSoKhacChuanCount: nghiSoKhacChuanCount,
    apiErrorCount: apiErrorCount
  };
}

/**
 * Phân tích tham số dòng lệnh
 */
function parseCliArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { mode: 'dry' };
  }

  let hasRun = false;
  let fromVal = null;
  let toVal = null;
  let onlyVal = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--run') {
      hasRun = true;
    } else if (arg === '--from') {
      fromVal = args[i + 1];
      i++;
    } else if (arg.startsWith('--from=')) {
      fromVal = arg.slice('--from='.length);
    } else if (arg === '--to') {
      toVal = args[i + 1];
      i++;
    } else if (arg.startsWith('--to=')) {
      toVal = arg.slice('--to='.length);
    } else if (arg === '--only') {
      onlyVal = args[i + 1];
      i++;
    } else if (arg.startsWith('--only=')) {
      onlyVal = arg.slice('--only='.length);
    } else {
      return {
        mode: 'invalid',
        reason: 'Tham số không hợp lệ: ' + arg
      };
    }
  }

  if (!hasRun) {
    return {
      mode: 'invalid',
      reason: 'Thiếu cờ --run. Để chạy khô không tham số: node tests/run_eval.js'
    };
  }

  if (onlyVal !== null && onlyVal !== undefined) {
    if (fromVal !== null || toVal !== null) {
      return {
        mode: 'invalid',
        reason: 'Không dùng đồng thời --only với --from/--to.'
      };
    }

    const rawIds = String(onlyVal)
      .split(',')
      .map(function (s) {
        return s.trim().toUpperCase();
      })
      .filter(Boolean);

    if (rawIds.length === 0) {
      return {
        mode: 'invalid',
        reason: 'Danh sách --only trống. Ví dụ: node tests/run_eval.js --run --only Q01,Q02'
      };
    }

    const uniqueIds = [];
    for (let i = 0; i < rawIds.length; i++) {
      if (uniqueIds.indexOf(rawIds[i]) === -1) {
        uniqueIds.push(rawIds[i]);
      }
    }

    return {
      mode: 'run',
      onlyIds: uniqueIds
    };
  }

  if (fromVal === null || fromVal === undefined || toVal === null || toVal === undefined) {
    return {
      mode: 'invalid',
      reason:
        'Thiếu --from/--to hoặc --only. Cách dùng: node tests/run_eval.js --run --from <số> --to <số> hoặc node tests/run_eval.js --run --only Q01,Q02'
    };
  }

  const fromNum = Number(fromVal);
  const toNum = Number(toVal);
  if (!Number.isInteger(fromNum) || !Number.isInteger(toNum)) {
    return {
      mode: 'invalid',
      reason: '--from và --to phải là số nguyên.'
    };
  }

  return {
    mode: 'run',
    from: fromNum,
    to: toNum
  };
}

/**
 * Kiểm tra toàn bộ output không chứa API key hay tiền tố khoá nhạy cảm
 */
function verifyKeySafety(extraText) {
  const sensitiveList = [
    ['KEY', 'GIA'].join('_'),
    ['A', 'Q.'].join(''),
    ['AI', 'za'].join('')
  ];
  const envKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
  if (envKey) {
    sensitiveList.push(envKey);
  }

  const combined = capturedOutput + '\n' + (extraText || '');
  let hasLeak = false;
  for (let i = 0; i < sensitiveList.length; i++) {
    const token = sensitiveList[i];
    if (token && combined.indexOf(token) !== -1) {
      hasLeak = true;
      break;
    }
  }

  if (hasLeak) {
    console.log('An toàn key: KHÔNG ĐẠT');
    process.exit(1);
  } else {
    console.log('An toàn key: ĐẠT');
  }
}

/**
 * Chạy khô: chỉ liệt kê id + câu hỏi, KHÔNG gọi mạng
 */
function runDryMode(questions) {
  console.log('Chế độ chạy khô (không gọi mạng) — Danh sách ' + questions.length + ' câu hỏi:');
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(i + 1 + '. [' + q.id + '] ' + q.question);
  }
}

/**
 * Chạy thật với Gemini qua api/ask.js ở chế độ "qa"
 */
async function runRealMode(questions, runOptions) {
  const targets = [];
  let rangeDescription = '';

  if (Array.isArray(runOptions.onlyIds)) {
    for (let i = 0; i < runOptions.onlyIds.length; i++) {
      const targetId = runOptions.onlyIds[i];
      const foundIdx = questions.findIndex(function (q) {
        return String(q.id).toUpperCase() === targetId;
      });
      if (foundIdx === -1) {
        console.error('Từ chối chạy: Không tìm thấy câu hỏi có id "' + targetId + '" trong tests/spec_questions.json.');
        verifyKeySafety('');
        process.exit(1);
      }
      targets.push({
        item: questions[foundIdx],
        number: foundIdx + 1
      });
    }
    rangeDescription = '--only ' + runOptions.onlyIds.join(',');
  } else {
    const fromIdx1 = runOptions.from;
    const toIdx1 = runOptions.to;
    if (fromIdx1 < 1 || toIdx1 > questions.length || fromIdx1 > toIdx1) {
      console.error(
        'Khoảng câu không hợp lệ (--from ' +
          fromIdx1 +
          ' --to ' +
          toIdx1 +
          '). Phải nằm trong khoảng 1..' +
          questions.length +
          ' và from <= to.'
      );
      verifyKeySafety('');
      process.exit(1);
    }
    for (let idx = fromIdx1 - 1; idx <= toIdx1 - 1; idx++) {
      targets.push({
        item: questions[idx],
        number: idx + 1
      });
    }
    const startQ = questions[fromIdx1 - 1];
    const endQ = questions[toIdx1 - 1];
    rangeDescription = fromIdx1 + '–' + toIdx1 + ' (' + startQ.id + '–' + endQ.id + ')';
  }

  // Nạp biến môi trường từ .env.local và tắt model dự phòng (GEMINI_FALLBACK_MODEL = '')
  loadEnvLocal();
  process.env.GEMINI_FALLBACK_MODEL = '';

  const configuredModel = process.env.GEMINI_MODEL
    ? process.env.GEMINI_MODEL.trim()
    : '(chưa đặt GEMINI_MODEL)';

  const runTimestamp = formatNow();

  let appendedMarkdown = '';
  function appendToResults(content) {
    appendedMarkdown += content;
    fs.appendFileSync(RESULTS_FILE_PATH, content, 'utf8');
  }

  const headerLines = [
    '',
    '## Lần chạy: ' +
      runTimestamp +
      ' | Model cấu hình: `' +
      configuredModel +
      '` (đã tắt model dự phòng) | Khoảng câu: ' +
      rangeDescription,
    '',
    '| id | câu hỏi | trả lời | model | nhãn | ghi chú |',
    '| --- | --- | --- | --- | --- | --- |',
    ''
  ].join('\n');

  appendToResults(headerLines);

  let countDat = 0;
  let countCanXem = 0;
  let countSoLa = 0;
  let countNghiSoKhacChuan = 0;
  let countApiError = 0;
  const modelsAnswered = new Set();
  let stoppedEarlyNote = '';

  try {
    for (let step = 0; step < targets.length; step++) {
      const q = targets[step].item;
      const currentNumber = targets[step].number;

      if (step > 0) {
        console.log('... Đang nghỉ 14 giây trước câu tiếp theo ...');
        await sleep(CALL_DELAY_MS);
      }

      const logStartLen = capturedOutput.length;
      const result = await invokeAskHandler(
        {
          mode: 'qa',
          question: q.question
        },
        '127.0.2.' + currentNumber
      );
      const callLogSlice = capturedOutput.slice(logStartLen);
      const body = result.data || {};

      const isQuotaExhausted =
        result.statusCode === 429 ||
        /429|RESOURCE_EXHAUSTED|hết lượt/i.test(String(body.error || '')) ||
        /HTTP=429|RESOURCE_EXHAUSTED/i.test(callLogSlice);

      const isApiError =
        isQuotaExhausted ||
        result.statusCode !== 200 ||
        body.ok === false ||
        typeof body.text !== 'string' ||
        !body.text.trim();

      const modelUsed = body.model_used || configuredModel;
      if (body.model_used) {
        modelsAnswered.add(body.model_used);
      }

      // Khi câu bị lỗi API (HTTP 429, 5xx, quá thời gian, ok:false):
      // gắn nhãn "LỖI GỌI API (không tính điểm)", KHÔNG tính vào ĐẠT, CẦN XEM, số lạ hay NGHI SO KHÁC CHUẨN.
      if (isApiError) {
        countApiError++;
        const errAnswerText =
          '(LỖI HTTP ' + result.statusCode + ': ' + (body.error || 'không có phản hồi') + ')';
        const errNote = 'lỗi gọi API (HTTP ' + result.statusCode + ')';

        const errRowMarkdown =
          '| ' +
          formatMarkdownCell(q.id) +
          ' | ' +
          formatMarkdownCell(q.question) +
          ' | ' +
          formatMarkdownCell(errAnswerText, 300) +
          ' | ' +
          formatMarkdownCell(modelUsed) +
          ' | ' +
          formatMarkdownCell(API_ERROR_LABEL) +
          ' | ' +
          formatMarkdownCell(errNote) +
          ' |\n';

        appendToResults(errRowMarkdown);

        console.log('[' + q.id + '] (' + modelUsed + ') -> ' + API_ERROR_LABEL + ' [' + errNote + ']');

        // Chỉ DỪNG cả lượt khi gặp 429 / RESOURCE_EXHAUSTED; gặp 5xx (503/502) thì chạy tiếp câu kế
        if (isQuotaExhausted) {
          const stopMsg = 'dừng ở câu ' + q.id + ', chạy tiếp bằng --from ' + currentNumber;
          console.log(stopMsg);
          stoppedEarlyNote = stopMsg;
          break;
        }
        continue;
      }

      const answerText = body.text;
      const evalResult = evaluateAnswer(q, answerText);

      if (evalResult.label === 'ĐẠT') {
        countDat++;
      } else {
        countCanXem++;
      }

      if (evalResult.strangeNumbers.length > 0) {
        countSoLa++;
      }

      if (evalResult.suspectedCrossStandard) {
        countNghiSoKhacChuan++;
      }

      const noteStr = evalResult.notes.length > 0 ? evalResult.notes.join('; ') : '-';
      const rowMarkdown =
        '| ' +
        formatMarkdownCell(q.id) +
        ' | ' +
        formatMarkdownCell(q.question) +
        ' | ' +
        formatMarkdownCell(answerText, 300) +
        ' | ' +
        formatMarkdownCell(modelUsed) +
        ' | ' +
        formatMarkdownCell(evalResult.label) +
        ' | ' +
        formatMarkdownCell(noteStr) +
        ' |\n';

      // Lưu ngay sau MỖI câu
      appendToResults(rowMarkdown);

      console.log(
        '[' +
          q.id +
          '] (' +
          modelUsed +
          ') -> ' +
          evalResult.label +
          (evalResult.notes.length > 0 ? ' [' + noteStr + ']' : '')
      );
    }
  } finally {
    const actualModelsStr =
      modelsAnswered.size > 0 ? Array.from(modelsAnswered).join(', ') : configuredModel;

    const cumulative = computeCumulativeLatestSummary();

    const summaryLines = [
      '',
      '**Tổng kết lần chạy (' + runTimestamp + '):**',
      '- Model thực sự đã trả lời: `' + actualModelsStr + '`',
      '- Số ĐẠT: ' + countDat,
      '- Số CẦN XEM: ' + countCanXem,
      '- Số số-lạ: ' + countSoLa,
      '- Số NGHI SO KHÁC CHUẨN: ' + countNghiSoKhacChuan,
      '- Số câu lỗi API: ' + countApiError
    ];

    if (stoppedEarlyNote) {
      summaryLines.push('- Trạng thái: ' + stoppedEarlyNote);
    }

    summaryLines.push(
      '',
      '**Bảng tổng (chỉ tính lần chạy gần nhất của mỗi câu — đã có ' +
        cumulative.totalUniqueQuestions +
        '/' +
        questions.length +
        ' câu):**',
      '- Số ĐẠT: ' + cumulative.datCount,
      '- Số CẦN XEM: ' + cumulative.canXemCount,
      '- Số số-lạ: ' + cumulative.soLaCount,
      '- Số NGHI SO KHÁC CHUẨN: ' + cumulative.nghiSoKhacChuanCount,
      '- Số câu lỗi API: ' + cumulative.apiErrorCount,
      ''
    );

    appendToResults(summaryLines.join('\n') + '\n');
  }

  verifyKeySafety(appendedMarkdown);
}

async function main() {
  const questions =
    specQuestionsData && Array.isArray(specQuestionsData.questions)
      ? specQuestionsData.questions
      : [];

  const parsedArgs = parseCliArgs(process.argv);

  if (parsedArgs.mode === 'invalid') {
    console.error('Từ chối chạy: ' + parsedArgs.reason);
    verifyKeySafety('');
    process.exit(1);
  }

  if (parsedArgs.mode === 'dry') {
    runDryMode(questions);
    verifyKeySafety('');
    return;
  }

  await runRealMode(questions, parsedArgs);
}

main().catch(function (err) {
  console.error('Lỗi khi chạy run_eval.js:', err && err.message ? err.message : err);
  verifyKeySafety('');
  process.exit(1);
});
