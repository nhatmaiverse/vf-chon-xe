/**
 * VF Chọn Xe — Script debug chi tiết 1 tình huống người mua (scenario)
 * Chạy bằng: node tests/debug_scenario.js [ID_tình_huống]
 * Ví dụ: node tests/debug_scenario.js S14
 */

const fs = require('fs');
const path = require('path');
const { scoreCars, CONFIG } = require('../scoring.js');

const ROOT_DIR = path.resolve(__dirname, '..');
const CARS_PATH = path.join(ROOT_DIR, 'data', 'cars.json');
const SCENARIOS_PATH = path.join(ROOT_DIR, 'tests', 'scenarios.json');

const targetId = (process.argv[2] || 'S14').trim().toUpperCase();

function formatVnd(val) {
  if (val == null) return 'chưa có';
  if (val >= 1e9) {
    return (val / 1e9).toFixed(2).replace(/\.00$/, '') + ' tỷ đ';
  }
  if (val >= 1e6) {
    return Math.round(val / 1e6) + ' triệu đ';
  }
  return val.toLocaleString('vi-VN') + ' đ';
}

function formatLength(val) {
  if (val == null) return 'chưa có';
  return Number(val).toFixed(3) + ' m';
}

function formatReason(code, car, allSurvivors) {
  switch (code) {
    case 'range_du_x3':
      return `range_du_x3 +${CONFIG.SCORE_RANGE_X3}`;
    case 'di_xa_tot':
      return `di_xa_tot +${CONFIG.SCORE_LONG_TRIP_WEEKLY}`;
    case 'di_xa_on':
      return `di_xa_on +${CONFIG.SCORE_LONG_TRIP_MONTHLY}`;
    case 'de_do':
      return `de_do +${CONFIG.SCORE_EASY_PARK}`;
    case 'rong_rai':
      return `rong_rai +${CONFIG.SCORE_SPACIOUS}`;
    case 'rong_rai_vua':
      return `rong_rai_vua +${CONFIG.SCORE_SPACIOUS_MED}`;
    case 'sac_nhanh':
      return `sac_nhanh +${CONFIG.SCORE_FAST_CHARGE_HIGH}`;
    case 'sac_kha':
      return `sac_kha +${CONFIG.SCORE_FAST_CHARGE_MED}`;
    case 'phai_sac_moi_ngay':
      return `phai_sac_moi_ngay -${CONFIG.PENALTY_SCORE_MUST_CHARGE_DAILY}`;
    case 'chay_tinh_kho':
      return `chay_tinh_kho -${CONFIG.PENALTY_SCORE_LONG_TRIP}`;
    case 'tiet_kiem': {
      const sortedWithPrice = allSurvivors
        .map(s => s.car)
        .filter(c => c.price_vnd_from != null)
        .slice()
        .sort((a, b) => a.price_vnd_from - b.price_vnd_from);

      if (sortedWithPrice[0] && sortedWithPrice[0].id === car.id) {
        return `tiet_kiem +${CONFIG.SCORE_CHEAPEST}`;
      }
      if (sortedWithPrice[1] && sortedWithPrice[1].id === car.id) {
        return `tiet_kiem +${CONFIG.SCORE_SECOND_CHEAPEST}`;
      }
      return 'tiet_kiem +0';
    }
    case 'cam_giac_lai': {
      if (CONFIG.DRIVING_HIGH_SEGMENTS.includes(car.segment)) {
        return `cam_giac_lai +${CONFIG.SCORE_DRIVING_HIGH}`;
      }
      if (CONFIG.DRIVING_MED_SEGMENTS.includes(car.segment)) {
        return `cam_giac_lai +${CONFIG.SCORE_DRIVING_MED}`;
      }
      return 'cam_giac_lai +0';
    }
    case 'du_cho':
      return 'du_cho (+0)';
    case 'trong_ngan_sach':
      return 'trong_ngan_sach (+0)';
    default:
      return code;
  }
}

function main() {
  const carsData = JSON.parse(fs.readFileSync(CARS_PATH, 'utf8'));
  const scenariosData = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8'));

  const cars = carsData.cars || [];
  const scenarios = scenariosData.scenarios || [];

  const scenario = scenarios.find(s => s.id.toUpperCase() === targetId);

  if (!scenario) {
    console.error(`Không tìm thấy tình huống "${targetId}" trong ${SCENARIOS_PATH}`);
    console.error(`Các tình huống có sẵn: ${scenarios.map(s => s.id).join(', ')}`);
    process.exit(1);
  }

  const carMap = new Map(cars.map(c => [c.id, c]));

  // Lấy toàn bộ xe còn lại bằng cách tăng tạm thời TOP_LIMIT
  const originalTopLimit = CONFIG.TOP_LIMIT;
  CONFIG.TOP_LIMIT = 999;
  const result = scoreCars(cars, scenario.answers);
  CONFIG.TOP_LIMIT = originalTopLimit;

  const allSurvivors = result.top.map(item => ({
    ...item,
    car: carMap.get(item.id) || {}
  }));

  const divider = '='.repeat(100);
  const subDivider = '-'.repeat(100);

  // 1. CÂU MÔ TẢ TÌNH HUỐNG VÀ ANSWERS
  console.log(divider);
  console.log(`TÌNH HUỐNG: ${scenario.id}`);
  console.log(divider);
  console.log(`Mô tả       : ${scenario.description}`);
  console.log(`Acceptable  : [ ${(scenario.acceptable || []).join(', ')} ]`);
  if (scenario.note) {
    console.log(`Ghi chú     : ${scenario.note}`);
  }
  console.log('\nAnswers (câu trả lời):');
  const ans = scenario.answers || {};
  console.log(`  - people        : ${ans.people}`);
  console.log(`  - budget_max_vnd: ${formatVnd(ans.budget_max_vnd)} (ngưỡng +10%: ${formatVnd(Math.round(ans.budget_max_vnd * 1.1))})`);
  console.log(`  - daily_km      : ${ans.daily_km} km/ngày`);
  console.log(`  - long_trip     : ${ans.long_trip}`);
  console.log(`  - home_charging : ${ans.home_charging}`);
  console.log(`  - priority      : ${ans.priority || 'không có'}`);

  // 2. BẢNG TẤT CẢ XE CÒN LẠI
  console.log('\n' + divider);
  console.log(`BẢNG TẤT CẢ XE CÒN LẠI (SURVIVORS: ${allSurvivors.length} xe)`);
  console.log(divider);

  if (allSurvivors.length === 0) {
    console.log(`Không còn xe nào phù hợp:`);
    console.log(`- Lý do chính (xe gần đạt nhất)    : ${result.none_reason}`);
    if (result.none_reasons && result.none_reasons.length > 0) {
      console.log(`- Tất cả lý do gặp phải (none_reasons): ${result.none_reasons.join(', ')}`);
    }
  } else {
    const pad = (str, len) => String(str).padEnd(len, ' ');

    console.log(
      `${pad('#', 3)} | ${pad('ID', 5)} | ${pad('Chỗ', 5)} | ${pad('Dài (m)', 8)} | ${pad('Giá', 14)} | ${pad('Quãng đường', 12)} | ${pad('Điểm', 6)} | Từng lý do kèm điểm số`
    );
    console.log(subDivider);

    allSurvivors.forEach((item, index) => {
      const c = item.car;
      const reasonsWithScores = item.reasons
        .map(code => formatReason(code, c, allSurvivors))
        .join(', ');

      const seatsStr = c.seats != null ? `${c.seats} chỗ` : 'n/a';
      const lengthStr = formatLength(c.length_m);
      const priceStr = formatVnd(c.price_vnd_from);
      const rangeStr = c.range_km != null ? `${c.range_km} km` : 'n/a';
      const scoreStr = `${item.score}đ`;

      console.log(
        `${pad(index + 1, 3)} | ${pad(c.id, 5)} | ${pad(seatsStr, 5)} | ${pad(lengthStr, 8)} | ${pad(priceStr, 14)} | ${pad(rangeStr, 12)} | ${pad(scoreStr, 6)} | ${reasonsWithScores}`
      );
    });
  }

  // 3. DANH SÁCH XE BỊ LOẠI
  console.log('\n' + divider);
  console.log(`DANH SÁCH XE BỊ LOẠI (EXCLUDED: ${result.excluded.length} xe)`);
  console.log(divider);

  if (result.excluded.length === 0) {
    console.log('Không có xe nào bị loại.');
  } else {
    result.excluded.forEach(item => {
      const c = carMap.get(item.id) || {};
      const carName = c.name ? `${c.name} (${item.id})` : item.id;
      const reasonsStr = (item.reasons || []).join(', ');
      console.log(`- ${carName}:`);
      console.log(`  -> Lý do loại: ${reasonsStr}`);
      if (item.reasons.includes('vuot_ngan_sach')) {
        console.log(`     (Giá: ${formatVnd(c.price_vnd_from)} > ngân sách tối đa cho phép ${formatVnd(Math.round(ans.budget_max_vnd * 1.1))})`);
      }
      if (item.reasons.includes('khong_du_cho')) {
        console.log(`     (Số chỗ: ${c.seats} < cần: ${ans.people})`);
      }
      if (item.reasons.includes('khong_du_quang_duong_1_ngay')) {
        console.log(`     (Quãng đường: ${c.range_km} km < đi 1 ngày: ${ans.daily_km} km)`);
      }
    });
  }

  console.log(divider + '\n');
}

main();
