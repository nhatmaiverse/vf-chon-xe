/**
 * VF Chọn Xe — Script chạy thử và đánh giá quy tắc chấm điểm (scoring.js)
 * Chạy bằng: node tests/try_scoring.js [tên_vòng]
 * Ví dụ:
 *   node tests/try_scoring.js         -> lưu tests/results_scoring.md
 *   node tests/try_scoring.js vong1   -> lưu tests/results_vong1.md
 */

const fs = require('fs');
const path = require('path');
const { scoreCars } = require('../scoring.js');

const ROOT_DIR = path.resolve(__dirname, '..');
const CARS_PATH = path.join(ROOT_DIR, 'data', 'cars.json');
const SCENARIOS_PATH = path.join(ROOT_DIR, 'tests', 'scenarios.json');

// Xử lý tên file đầu ra dựa vào tham số dòng lệnh
const roundArg = process.argv[2];
let outputFileName = 'results_scoring.md';
if (roundArg) {
  const cleanArg = roundArg.trim().replace(/\.md$/, '');
  outputFileName = cleanArg.startsWith('results_') ? `${cleanArg}.md` : `results_${cleanArg}.md`;
}
const OUTPUT_MD_PATH = path.join(ROOT_DIR, 'tests', outputFileName);

function main() {
  const carsData = JSON.parse(fs.readFileSync(CARS_PATH, 'utf8'));
  const scenariosData = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8'));

  const cars = carsData.cars || [];
  const scenarios = scenariosData.scenarios || [];

  const rows = [];
  const failedTop2Ids = [];
  const failedTop1Ids = [];
  let passedTop2Count = 0;
  let passedTop1Count = 0;

  for (const sc of scenarios) {
    const result = scoreCars(cars, sc.answers);
    const topIds = result.top.map(c => c.id);
    const acceptable = sc.acceptable || [];

    const isNoneAcceptable = acceptable.length === 1 && acceptable[0] === 'none';

    // 1. Cách chấm 1 (Top 2):
    // - acceptable là ["none"] -> đạt khi top rỗng
    // - Còn lại -> đạt khi ÍT NHẤT 1 xe trong top nằm trong acceptable
    let isPassTop2 = false;
    if (isNoneAcceptable) {
      isPassTop2 = topIds.length === 0;
    } else {
      isPassTop2 = topIds.some(id => acceptable.includes(id));
    }

    if (isPassTop2) {
      passedTop2Count++;
    } else {
      failedTop2Ids.push(sc.id);
    }

    // 2. Cách chấm 2 (Xe số 1):
    // - acceptable là ["none"] -> đạt khi top rỗng (giữ nguyên cách cũ)
    // - Còn lại -> chỉ đạt khi xe hạng 1 có trong acceptable
    let isPassTop1 = false;
    if (isNoneAcceptable) {
      isPassTop1 = topIds.length === 0;
    } else {
      isPassTop1 = topIds.length > 0 && acceptable.includes(topIds[0]);
    }

    if (isPassTop1) {
      passedTop1Count++;
    } else {
      failedTop1Ids.push(sc.id);
    }

    const suggestedStr = topIds.length > 0
      ? result.top.map(c => `${c.id} (${c.score}đ)`).join(', ')
      : `none (${result.none_reason || 'rỗng'})`;

    const acceptableStr = acceptable.join(', ');
    const statusTop2Str = isPassTop2 ? 'ĐẠT' : 'KHÔNG';
    const statusTop1Str = isPassTop1 ? 'ĐẠT' : 'KHÔNG';
    const firstReasonsStr = result.top.length > 0
      ? result.top[0].reasons.join(', ')
      : (result.none_reason || '');

    rows.push({
      id: sc.id,
      suggested: suggestedStr,
      acceptable: acceptableStr,
      statusTop2: statusTop2Str,
      statusTop1: statusTop1Str,
      reasons: firstReasonsStr,
      description: sc.description || ''
    });
  }

  // In bảng ra Console
  const pad = (str, len) => String(str).padEnd(len, ' ');
  const header = `${pad('ID', 5)} | ${pad('Gợi ý (top 2)', 24)} | ${pad('Acceptable', 16)} | ${pad('Top 2', 8)} | ${pad('Xe số 1', 9)} | Lý do của xe số 1`;
  const divider = '-'.repeat(header.length + 20);

  console.log(divider);
  console.log(header);
  console.log(divider);

  for (const r of rows) {
    console.log(
      `${pad(r.id, 5)} | ${pad(r.suggested, 24)} | ${pad(r.acceptable, 16)} | ${pad(r.statusTop2, 8)} | ${pad(r.statusTop1, 9)} | ${r.reasons}`
    );
  }

  console.log(divider);
  console.log(`Top 2: ${passedTop2Count}/${scenarios.length} | Xe số 1: ${passedTop1Count}/${scenarios.length}`);
  console.log(`Top 2 chưa đạt (${failedTop2Ids.length}): ${failedTop2Ids.length > 0 ? failedTop2Ids.join(', ') : 'Không có (đạt 100%)'}`);
  console.log(`Xe số 1 chưa đạt (${failedTop1Ids.length}): ${failedTop1Ids.length > 0 ? failedTop1Ids.join(', ') : 'Không có (đạt 100%)'}`);

  // Ghi kết quả ra file markdown
  const now = new Date();
  const timeStr = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const mdLines = [
    `# Kết quả kiểm thử quy tắc chấm điểm (\`scoring.js\`)${roundArg ? ` — ${roundArg}` : ''}`,
    '',
    `- **Ngày giờ chạy:** ${timeStr}`,
    `- **Tổng kết:** **Top 2: ${passedTop2Count}/${scenarios.length}** (${Math.round((passedTop2Count / scenarios.length) * 100)}%) | **Xe số 1: ${passedTop1Count}/${scenarios.length}** (${Math.round((passedTop1Count / scenarios.length) * 100)}%)`,
    `- **Top 2 chưa đạt:** ${failedTop2Ids.length > 0 ? failedTop2Ids.join(', ') : 'Không có'}`,
    `- **Xe số 1 chưa đạt:** ${failedTop1Ids.length > 0 ? failedTop1Ids.join(', ') : 'Không có'}`,
    '',
    '## Bảng chi tiết 30 tình huống',
    '',
    '| ID | Gợi ý (2 xe) | Acceptable | Top 2 | Xe số 1 | Lý do của xe số 1 |',
    '|---|---|---|---|---|---|'
  ];

  for (const r of rows) {
    mdLines.push(`| ${r.id} | ${r.suggested} | ${r.acceptable} | **${r.statusTop2}** | **${r.statusTop1}** | \`${r.reasons}\` |`);
  }

  mdLines.push('');
  fs.writeFileSync(OUTPUT_MD_PATH, mdLines.join('\n'), 'utf8');
  console.log(`Đã lưu báo cáo vào: tests/${outputFileName}`);

  // ========================================================================
  // 4 CA KIỂM TRA NHANH ĐẦU VÀO (INPUT VALIDATION & DATA CHECKS)
  // ========================================================================
  console.log('\n' + divider);
  console.log('KIỂM TRA NHANH 4 CA ĐẦU VÀO / DỮ LIỆU ĐẶC BIỆT');
  console.log(divider);

  const validSampleAnswers = {
    people: '1-2',
    budget_max_vnd: 500000000,
    daily_km: 30,
    long_trip: 'hiem',
    home_charging: true,
    priority: 'tiet_kiem'
  };

  // Ca 1: answers = {}
  const case1 = scoreCars(cars, {});
  console.log('Ca 1: answers = {}');
  console.log('  -> none_reason:', case1.none_reason, '| error:', case1.error);

  // Ca 2: budget_max_vnd là chuỗi "300000000"
  const case2 = scoreCars(cars, {
    ...validSampleAnswers,
    budget_max_vnd: '300000000'
  });
  console.log('Ca 2: budget_max_vnd là chuỗi "300000000"');
  console.log('  -> none_reason:', case2.none_reason, '| error:', case2.error);

  // Ca 3: cars = []
  const case3 = scoreCars([], validSampleAnswers);
  console.log('Ca 3: cars = []');
  console.log('  -> none_reason:', case3.none_reason);

  // Ca 4: home_charging là chuỗi "false"
  const case4 = scoreCars(cars, {
    ...validSampleAnswers,
    home_charging: 'false'
  });
  console.log('Ca 4: home_charging là chuỗi "false"');
  console.log('  -> none_reason:', case4.none_reason, '| error:', case4.error);
  console.log(divider);
}

main();
