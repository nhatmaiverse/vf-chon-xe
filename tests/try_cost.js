/**
 * VF Chọn Xe — Script kiểm thử tính chi phí hàng tháng (cost.js)
 * Chạy bằng: node tests/try_cost.js
 */

const fs = require('fs');
const path = require('path');
const { estimateMonthlyCost } = require('../cost.js');

const ROOT_DIR = path.resolve(__dirname, '..');
const CARS_PATH = path.join(ROOT_DIR, 'data', 'cars.json');
const PRICES_PATH = path.join(ROOT_DIR, 'data', 'prices.json');

function formatVnd(val) {
  if (typeof val !== 'number') return String(val);
  return val.toLocaleString('vi-VN') + ' đ';
}

function runTests() {
  const carsData = JSON.parse(fs.readFileSync(CARS_PATH, 'utf8'));
  const prices = JSON.parse(fs.readFileSync(PRICES_PATH, 'utf8'));

  const cars = carsData.cars || [];
  const vf6 = cars.find(c => c.version === 'VF 6 Eco' || c.id === 'vf6');

  if (!vf6) {
    console.error('LỖI: Không tìm thấy xe VF 6 Eco trong data/cars.json');
    process.exit(1);
  }

  let passed = 0;
  const total = 4;

  console.log('=== KIỂM THỬ TÍNH CHI PHÍ (cost.js) ===\n');

  // Ca 1: Với VF 6 Eco: daily_km 25, sạc nhà
  console.log('--- Ca 1: VF 6 Eco | daily_km 25 | sạc nhà ---');
  const ca1 = estimateMonthlyCost({
    car: vf6,
    prices,
    daily_km: 25,
    home_charging: true,
    free_charging: false
  });
  console.log('  ev_cost_vnd:           ', ca1.ev_cost_vnd, `(${formatVnd(ca1.ev_cost_vnd)})`);
  console.log('  petrol_cost_vnd:       ', ca1.petrol_cost_vnd, `(${formatVnd(ca1.petrol_cost_vnd)})`);
  console.log('  saving_vnd:            ', ca1.saving_vnd, `(${formatVnd(ca1.saving_vnd)})`);
  console.log('  kwh_per_100km_estimate:', ca1.kwh_per_100km_estimate);

  const ca1_ok =
    ca1.ok === true &&
    ca1.ev_cost_vnd === 293000 &&
    ca1.petrol_cost_vnd === 1190000 &&
    ca1.saving_vnd === 897000 &&
    typeof ca1.kwh_per_100km_estimate === 'number';

  if (ca1_ok) {
    passed++;
    console.log('  => KẾT QUẢ: ĐÚNG\n');
  } else {
    console.log('  => KẾT QUẢ: SAI\n');
  }

  // Ca 2: Cùng xe, sạc công cộng
  console.log('--- Ca 2: VF 6 Eco | daily_km 25 | sạc công cộng ---');
  const ca2 = estimateMonthlyCost({
    car: vf6,
    prices,
    daily_km: 25,
    home_charging: false,
    free_charging: false
  });
  console.log('  ev_cost_vnd:           ', ca2.ev_cost_vnd, `(${formatVnd(ca2.ev_cost_vnd)})`);
  console.log('  petrol_cost_vnd:       ', ca2.petrol_cost_vnd, `(${formatVnd(ca2.petrol_cost_vnd)})`);
  console.log('  saving_vnd:            ', ca2.saving_vnd, `(${formatVnd(ca2.saving_vnd)})`);
  console.log('  kwh_per_100km_estimate:', ca2.kwh_per_100km_estimate);

  const ca2_ok =
    ca2.ok === true &&
    ca2.ev_cost_vnd === 356000 &&
    ca2.petrol_cost_vnd === 1190000 &&
    ca2.saving_vnd === 834000 &&
    typeof ca2.kwh_per_100km_estimate === 'number';

  if (ca2_ok) {
    passed++;
    console.log('  => KẾT QUẢ: ĐÚNG\n');
  } else {
    console.log('  => KẾT QUẢ: SAI\n');
  }

  // Ca 3: Cùng xe, sạc miễn phí
  console.log('--- Ca 3: VF 6 Eco | daily_km 25 | sạc miễn phí ---');
  const ca3 = estimateMonthlyCost({
    car: vf6,
    prices,
    daily_km: 25,
    home_charging: false,
    free_charging: true
  });
  console.log('  ev_cost_vnd:           ', ca3.ev_cost_vnd, `(${formatVnd(ca3.ev_cost_vnd)})`);
  console.log('  petrol_cost_vnd:       ', ca3.petrol_cost_vnd, `(${formatVnd(ca3.petrol_cost_vnd)})`);
  console.log('  saving_vnd:            ', ca3.saving_vnd, `(${formatVnd(ca3.saving_vnd)})`);
  console.log('  kwh_per_100km_estimate:', ca3.kwh_per_100km_estimate);

  const ca3_ok =
    ca3.ok === true &&
    ca3.ev_cost_vnd === 0 &&
    ca3.petrol_cost_vnd === 1190000 &&
    ca3.saving_vnd === 1190000 &&
    typeof ca3.kwh_per_100km_estimate === 'number';

  if (ca3_ok) {
    passed++;
    console.log('  => KẾT QUẢ: ĐÚNG\n');
  } else {
    console.log('  => KẾT QUẢ: SAI\n');
  }

  // Ca 4: Xe có dữ liệu thiếu (nếu có) và daily_km = -5 -> phải ra ok:false
  console.log('--- Ca 4: Dữ liệu thiếu và daily_km = -5 ---');
  const resNegativeKm = estimateMonthlyCost({
    car: vf6,
    prices,
    daily_km: -5,
    home_charging: true,
    free_charging: false
  });
  console.log('  daily_km = -5:         ', resNegativeKm);

  const carMissing =
    cars.find(c => c.battery_kwh == null || c.range_km == null) ||
    { id: 'missing_test', name: 'Xe thiếu pin', battery_kwh: null, range_km: 400 };

  const resMissingCar = estimateMonthlyCost({
    car: carMissing,
    prices,
    daily_km: 25,
    home_charging: true,
    free_charging: false
  });
  console.log('  Xe thiếu dữ liệu:      ', resMissingCar);

  const ca4_ok =
    resNegativeKm.ok === false &&
    resNegativeKm.reason === 'chưa có dữ liệu' &&
    resMissingCar.ok === false &&
    resMissingCar.reason === 'chưa có dữ liệu';

  if (ca4_ok) {
    passed++;
    console.log('  => KẾT QUẢ: ĐÚNG\n');
  } else {
    console.log('  => KẾT QUẢ: SAI\n');
  }

  console.log(`Chi phí: ${passed}/${total} đúng`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
