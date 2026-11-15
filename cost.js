/**
 * VF Chọn Xe — Trợ lý AI chọn xe điện VinFast
 * File: cost.js — Máy tính so sánh chi phí sạc điện hàng tháng so với chi phí xăng
 * Hàm thuần, không đụng DOM, không gọi mạng.
 * Chạy được cả trên trình duyệt (window.estimateMonthlyCost) và Node.js (module.exports).
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    const exported = factory();
    module.exports = exported.estimateMonthlyCost;
    module.exports.estimateMonthlyCost = exported.estimateMonthlyCost;
  } else {
    const exported = factory();
    root.estimateMonthlyCost = exported.estimateMonthlyCost;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /**
   * Ước tính chi phí sạc điện hàng tháng và so sánh với xe xăng tham chiếu.
   *
   * @param {Object} params
   * @param {Object} params.car Dữ liệu xe từ cars.json (chứa battery_kwh, range_km)
   * @param {Object} params.prices Dữ liệu giá từ prices.json
   * @param {number} params.daily_km Quãng đường đi mỗi ngày (km)
   * @param {boolean} [params.home_charging=false] true: sạc tại nhà; false: sạc công cộng
   * @param {boolean} [params.free_charging=false] true: miễn phí sạc (tiền điện = 0)
   * @returns {Object} { ok, ev_cost_vnd, petrol_cost_vnd, saving_vnd, kwh_per_100km_estimate, notes }
   *                   hoặc { ok: false, reason: "chưa có dữ liệu" }
   */
  function estimateMonthlyCost(params) {
    if (!params || typeof params !== 'object') {
      return { ok: false, reason: 'chưa có dữ liệu' };
    }

    const { car, prices, daily_km, home_charging, free_charging } = params;

    // 1. Kiểm tra dữ liệu xe (pin kWh và quãng đường km)
    if (!car || typeof car !== 'object') {
      return { ok: false, reason: 'chưa có dữ liệu' };
    }

    const batteryKwh = car.battery_kwh;
    const rangeKm = car.range_km;

    if (
      batteryKwh == null ||
      typeof batteryKwh !== 'number' ||
      isNaN(batteryKwh) ||
      batteryKwh <= 0
    ) {
      return { ok: false, reason: 'chưa có dữ liệu' };
    }

    if (
      rangeKm == null ||
      typeof rangeKm !== 'number' ||
      isNaN(rangeKm) ||
      rangeKm <= 0
    ) {
      return { ok: false, reason: 'chưa có dữ liệu' };
    }

    // 2. Kiểm tra daily_km
    if (
      daily_km == null ||
      typeof daily_km !== 'number' ||
      isNaN(daily_km) ||
      daily_km <= 0
    ) {
      return { ok: false, reason: 'chưa có dữ liệu' };
    }

    // 3. Kiểm tra bảng giá prices
    if (!prices || typeof prices !== 'object') {
      return { ok: false, reason: 'chưa có dữ liệu' };
    }

    const iceRef = prices.ice_reference;
    if (
      !iceRef ||
      typeof iceRef.l_per_100km !== 'number' ||
      isNaN(iceRef.l_per_100km) ||
      iceRef.l_per_100km <= 0
    ) {
      return { ok: false, reason: 'chưa có dữ liệu' };
    }

    const petrolPriceObj = prices.petrol_e10_ron95_iii;
    if (
      !petrolPriceObj ||
      typeof petrolPriceObj.value !== 'number' ||
      isNaN(petrolPriceObj.value) ||
      petrolPriceObj.value <= 0
    ) {
      return { ok: false, reason: 'chưa có dữ liệu' };
    }

    const isFreeCharging = Boolean(free_charging);
    const isHomeCharging = Boolean(home_charging);

    let electricityPrice = 0;
    if (!isFreeCharging) {
      if (isHomeCharging) {
        const homeElec = prices.home_electricity;
        if (
          !homeElec ||
          typeof homeElec.default_price_incl_vat !== 'number' ||
          isNaN(homeElec.default_price_incl_vat) ||
          homeElec.default_price_incl_vat <= 0
        ) {
          return { ok: false, reason: 'chưa có dữ liệu' };
        }
        electricityPrice = homeElec.default_price_incl_vat;
      } else {
        const publicCharging = prices.public_charging_vgreen;
        if (
          !publicCharging ||
          typeof publicCharging.value !== 'number' ||
          isNaN(publicCharging.value) ||
          publicCharging.value <= 0
        ) {
          return { ok: false, reason: 'chưa có dữ liệu' };
        }
        electricityPrice = publicCharging.value;
      }
    }

    // 4. Tính toán
    // kWh/100km ước tính = pin_kwh / quang_duong_km * 100
    const kwh_per_100km_estimate = (batteryKwh / rangeKm) * 100;

    // Một tháng = 30 ngày; km_thang = daily_km * 30
    const km_thang = daily_km * 30;

    // Chi phí điện xe điện (làm tròn về hàng nghìn đồng)
    let ev_cost_vnd = 0;
    if (!isFreeCharging) {
      const rawEvCost = (km_thang / 100) * kwh_per_100km_estimate * electricityPrice;
      ev_cost_vnd = Math.round(rawEvCost / 1000) * 1000;
    }

    // Chi phí xe xăng tham chiếu (làm tròn về hàng nghìn đồng)
    const rawPetrolCost =
      (km_thang / 100) * iceRef.l_per_100km * petrolPriceObj.value;
    const petrol_cost_vnd = Math.round(rawPetrolCost / 1000) * 1000;

    // Tiết kiệm được mỗi tháng (hàng nghìn đồng)
    const saving_vnd = petrol_cost_vnd - ev_cost_vnd;

    const notes = [
      'Con số là ước tính, chưa tính hao hụt khi sạc và điều kiện thực tế.',
      'Xe xăng so sánh là giả định 7,5 lít/100 km, không phải số liệu của hãng.'
    ];

    return {
      ok: true,
      ev_cost_vnd,
      petrol_cost_vnd,
      saving_vnd,
      kwh_per_100km_estimate,
      notes
    };
  }

  return { estimateMonthlyCost };
});
