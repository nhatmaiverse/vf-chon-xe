/**
 * VF Chọn Xe — Trợ lý AI chọn xe điện VinFast
 * File: scoring.js — Quy tắc chấm điểm độ phù hợp của từng xe theo nhu cầu người dùng
 * Chạy được cả trên trình duyệt (window.scoreCars) và Node.js (module.exports)
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    const exported = factory();
    module.exports = exported.scoreCars;
    module.exports.scoreCars = exported.scoreCars;
    module.exports.CONFIG = exported.CONFIG;
  } else {
    const exported = factory();
    root.scoreCars = exported.scoreCars;
    root.SCORING_CONFIG = exported.CONFIG;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /**
   * Bảng cấu hình toàn bộ điểm số và ngưỡng chấm điểm
   * Có thể chỉnh sửa dễ dàng tại đây mà không cần sửa logic bên dưới
   */
  const CONFIG = {
    // Quy đổi câu trả lời số người sang số chỗ ngồi tối thiểu cần thiết
    SEATS_MAP: {
      '1-2': 2,
      '3-4': 4,
      '5': 5,
      '6-7': 7
    },

    // Ngưỡng loại cứng ngân sách: cho phép vượt tối đa 10% (nhân 1.1)
    BUDGET_TOLERANCE_RATIO: 1.1,

    // Quãng đường đi mỗi ngày: xe chạy được >= 3 lần quãng đường ngày thì cộng điểm
    DAILY_RANGE_MULTIPLIER: 3,
    SCORE_RANGE_X3: 3,

    // Tần suất đi tỉnh xa (>200 km)
    LONG_TRIP_MONTHLY_MIN_RANGE: 300, // Đi tỉnh hàng tháng: cần quãng đường >= 300 km
    SCORE_LONG_TRIP_MONTHLY: 1,       // Cộng +1 điểm
    LONG_TRIP_WEEKLY_MIN_RANGE: 400,  // Đi tỉnh hàng tuần: cần quãng đường >= 400 km
    SCORE_LONG_TRIP_WEEKLY: 2,        // Cộng +2 điểm

    // Ưu tiên 1: Dễ đỗ xe (de_do)
    EASY_PARK_MAX_LENGTH_M: 4.0,      // Chiều dài xe <= 4.0 m
    SCORE_EASY_PARK: 2,               // Cộng +2 điểm

    // Ưu tiên 2: Rộng rãi (rong_rai)
    SPACIOUS_MIN_SEATS: 5,            // Số chỗ >= 5
    SPACIOUS_HIGH_MIN_LENGTH_M: 4.7,  // Chiều dài >= 4.7 m (mã rong_rai)
    SPACIOUS_MED_MIN_LENGTH_M: 4.2,   // 4.2 m <= Chiều dài < 4.7 m (mã rong_rai_vua)
    SPACIOUS_MIN_LENGTH_M: 4.2,       // Tương thích ngược
    SCORE_SPACIOUS: 2,                // Giữ nguyên điểm cộng hiện tại của rong_rai (+2 điểm)
    SCORE_SPACIOUS_MED: 1,            // Cộng ít hơn mức trên 1 điểm cho rong_rai_vua (+1 điểm)

    // Ưu tiên 3: Tiết kiệm (tiet_kiem) — xét trong nhóm xe không bị loại
    SCORE_CHEAPEST: 2,                // Xe rẻ nhất cộng +2 điểm
    SCORE_SECOND_CHEAPEST: 1,         // Xe rẻ thứ hai cộng +1 điểm

    // Ưu tiên 4: Cảm giác lái (cam_giac_lai)
    DRIVING_HIGH_SEGMENTS: ['C-SUV', 'D-SUV'], // Phân khúc cộng điểm cao
    SCORE_DRIVING_HIGH: 2,                     // Cộng +2 điểm
    DRIVING_MED_SEGMENTS: ['B-SUV'],           // Phân khúc cộng điểm vừa
    SCORE_DRIVING_MED: 1,                      // Cộng +1 điểm

    // Không có chỗ sạc tại nhà (home_charging === false): ưu tiên sạc nhanh DC
    FAST_CHARGE_HIGH_KW: 100,         // Công suất sạc DC >= 100 kW
    FAST_CHARGE_MAX_MINUTES: 30,      // Hoặc sạc 10–70% <= 30 phút
    SCORE_FAST_CHARGE_HIGH: 2,        // Cộng +2 điểm (sac_nhanh)
    FAST_CHARGE_MED_KW: 50,           // Công suất sạc DC >= 50 kW
    SCORE_FAST_CHARGE_MED: 1,         // Cộng +1 điểm (sac_kha)

    // Luật trừ điểm (Penalties)
    // 1. Không sạc ở nhà mà range_km < 2 × daily_km (phai_sac_moi_ngay)
    PENALTY_MUST_CHARGE_DAILY_MULTIPLIER: 2,
    PENALTY_SCORE_MUST_CHARGE_DAILY: 2, // Trừ 2 điểm

    // 2. Hay đi tỉnh xa mà range_km < 300 km (chay_tinh_kho)
    PENALTY_LONG_TRIP_MIN_RANGE: 300,
    PENALTY_SCORE_LONG_TRIP: 2, // Trừ 2 điểm

    // Số lượng xe tối đa trong danh sách gợi ý đầu ra
    TOP_LIMIT: 2
  };

  /**
   * Thêm mã lý do vào mảng nếu chưa tồn tại
   */
  function addReasonUnique(reasons, code) {
    if (reasons.indexOf(code) === -1) {
      reasons.push(code);
    }
  }

  /**
   * Phân tích các lý do loại xe khi không còn xe nào phù hợp:
   * - none_reason: Lý do của (các) xe bị loại bởi ít điều kiện nhất (xe gần đạt nhất)
   * - none_reasons: Danh sách mọi lý do khác nhau đã gặp trên tất cả xe bị loại
   */
  function analyzeExcludedReasons(excluded) {
    if (!excluded || excluded.length === 0) {
      return {
        none_reason: null,
        none_reasons: []
      };
    }

    const allReasons = [];
    let minConditionCount = Infinity;

    for (let i = 0; i < excluded.length; i++) {
      const reasons = excluded[i].reasons || [];
      if (reasons.length > 0 && reasons.length < minConditionCount) {
        minConditionCount = reasons.length;
      }
      for (let j = 0; j < reasons.length; j++) {
        addReasonUnique(allReasons, reasons[j]);
      }
    }

    const closestCounts = {};
    let bestReason = null;
    let maxFreq = 0;

    for (let i = 0; i < excluded.length; i++) {
      const reasons = excluded[i].reasons || [];
      if (reasons.length === minConditionCount) {
        for (let j = 0; j < reasons.length; j++) {
          const r = reasons[j];
          closestCounts[r] = (closestCounts[r] || 0) + 1;
          if (closestCounts[r] > maxFreq) {
            maxFreq = closestCounts[r];
            bestReason = r;
          }
        }
      }
    }

    return {
      none_reason: bestReason,
      none_reasons: allReasons
    };
  }

  /**
   * Chấm điểm và lọc xe phù hợp với câu trả lời của người dùng
   * @param {Array|Object} carsInput - Mảng xe hoặc object { cars: [...] } từ data/cars.json
   * @param {Object} answers - Câu trả lời 6 câu hỏi: { people, budget_max_vnd, daily_km, long_trip, home_charging, priority }
   * @returns {Object} { top, excluded, none_reason, error? }
   */
  function scoreCars(carsInput, answers) {
    // ========================================================================
    // KIỂM TRA DỮ LIỆU ĐẦU VÀO
    // ========================================================================

    // 1. Kiểm tra danh sách xe: rỗng hoặc undefined/null -> "khong_co_du_lieu_xe"
    const cars = Array.isArray(carsInput)
      ? carsInput
      : carsInput && Array.isArray(carsInput.cars)
      ? carsInput.cars
      : null;

    if (!cars || cars.length === 0) {
      return {
        top: [],
        excluded: [],
        none_reason: 'khong_co_du_lieu_xe',
        none_reasons: []
      };
    }

    // 2. Kiểm tra answers: phải là object
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'answers phải là một object chứa câu trả lời'
      };
    }

    const ans = answers;

    // 2.1 budget_max_vnd: phải là số (không tự đổi chuỗi thành số)
    if (ans.budget_max_vnd === undefined || ans.budget_max_vnd === null) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'Thiếu trường budget_max_vnd'
      };
    }
    if (typeof ans.budget_max_vnd !== 'number' || isNaN(ans.budget_max_vnd) || ans.budget_max_vnd <= 0) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'budget_max_vnd phải là số dương (không chấp nhận chuỗi hoặc giá trị không hợp lệ)'
      };
    }

    // 2.2 daily_km: phải là số (không tự đổi chuỗi thành số)
    if (ans.daily_km === undefined || ans.daily_km === null) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'Thiếu trường daily_km'
      };
    }
    if (typeof ans.daily_km !== 'number' || isNaN(ans.daily_km) || ans.daily_km < 0) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'daily_km phải là số không âm (không chấp nhận chuỗi hoặc giá trị không hợp lệ)'
      };
    }

    // 2.3 people: phải là số hoặc mức hợp lệ ('1-2', '3-4', '5', '6-7')
    if (ans.people === undefined || ans.people === null) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'Thiếu trường people'
      };
    }
    const isPeopleNum = typeof ans.people === 'number' && !isNaN(ans.people) && ans.people > 0;
    const isPeopleValidStr = typeof ans.people === 'string' && CONFIG.SEATS_MAP.hasOwnProperty(ans.people);
    if (!isPeopleNum && !isPeopleValidStr) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'people phải là số dương hoặc mức hợp lệ (1-2, 3-4, 5, 6-7)'
      };
    }

    // 2.4 home_charging: phải là boolean (không tự đổi chuỗi thành boolean)
    if (ans.home_charging === undefined || ans.home_charging === null) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'Thiếu trường home_charging'
      };
    }
    if (typeof ans.home_charging !== 'boolean') {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'home_charging phải là boolean (true hoặc false, không chấp nhận chuỗi)'
      };
    }

    // 2.5 long_trip: phải là boolean hoặc tần suất hợp lệ ('hiem', 'hang_thang', 'hang_tuan')
    if (ans.long_trip === undefined || ans.long_trip === null) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'Thiếu trường long_trip'
      };
    }
    const isLongTripBool = typeof ans.long_trip === 'boolean';
    const isLongTripValidStr =
      typeof ans.long_trip === 'string' &&
      (ans.long_trip === 'hiem' || ans.long_trip === 'hang_thang' || ans.long_trip === 'hang_tuan');
    if (!isLongTripBool && !isLongTripValidStr) {
      return {
        top: [],
        excluded: [],
        none_reason: 'dau_vao_khong_hop_le',
        none_reasons: [],
        error: 'long_trip phải là boolean hoặc tần suất hợp lệ (hiem, hang_thang, hang_tuan)'
      };
    }

    // ========================================================================
    // TÍNH TOÁN CÁC THÔNG SỐ CHẤM ĐIỂM
    // ========================================================================
    const neededSeats = typeof ans.people === 'number'
      ? ans.people
      : CONFIG.SEATS_MAP[ans.people] || null;

    const budgetMax = ans.budget_max_vnd;
    const maxAllowedPrice = Math.round(budgetMax * CONFIG.BUDGET_TOLERANCE_RATIO);
    const dailyKm = ans.daily_km;

    const excluded = [];
    const survivors = [];

    // ========================================================================
    // BƯỚC 1: LOẠI CỨNG
    // ========================================================================
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (!car || !car.id) continue;

      const excludeReasons = [];
      const missingReasons = [];
      let checkedSeatsPass = false;
      let checkedBudgetPass = false;

      // 1. Kiểm tra số chỗ ngồi
      if (neededSeats !== null) {
        if (car.seats == null) {
          addReasonUnique(missingReasons, 'thieu_du_lieu_seats');
        } else if (car.seats < neededSeats) {
          addReasonUnique(excludeReasons, 'khong_du_cho');
        } else {
          checkedSeatsPass = true;
        }
      }

      // 2. Kiểm tra ngân sách (cho phép vượt tối đa 10%)
      if (maxAllowedPrice !== null) {
        if (car.price_vnd_from == null) {
          addReasonUnique(missingReasons, 'thieu_du_lieu_price_vnd_from');
        } else if (car.price_vnd_from > maxAllowedPrice) {
          addReasonUnique(excludeReasons, 'vuot_ngan_sach');
        } else {
          checkedBudgetPass = true;
        }
      }

      // 3. Kiểm tra quãng đường đi 1 ngày
      if (dailyKm !== null) {
        if (car.range_km == null) {
          addReasonUnique(missingReasons, 'thieu_du_lieu_range_km');
        } else if (car.range_km < dailyKm) {
          addReasonUnique(excludeReasons, 'khong_du_quang_duong_1_ngay');
        }
      }

      if (excludeReasons.length > 0) {
        excluded.push({
          id: car.id,
          reasons: excludeReasons
        });
      } else {
        // Chỉ gắn lý do du_cho và trong_ngan_sach khi đã thực sự kiểm tra trường tương ứng
        const survivorReasons = [];
        if (checkedSeatsPass) {
          survivorReasons.push('du_cho');
        }
        if (checkedBudgetPass) {
          survivorReasons.push('trong_ngan_sach');
        }
        for (let j = 0; j < missingReasons.length; j++) {
          addReasonUnique(survivorReasons, missingReasons[j]);
        }

        survivors.push({
          car: car,
          score: 0,
          reasons: survivorReasons
        });
      }
    }

    // Nếu tất cả xe đều bị loại
    if (survivors.length === 0) {
      const analysis = analyzeExcludedReasons(excluded);
      return {
        top: [],
        excluded: excluded,
        none_reason: analysis.none_reason,
        none_reasons: analysis.none_reasons
      };
    }

    // ========================================================================
    // BƯỚC 2: CỘNG ĐIỂM CHO CÁC XE CÒN LẠI
    // ========================================================================

    // Chuẩn bị thứ hạng giá nếu ưu tiên là "tiet_kiem"
    let cheapestId = null;
    let secondCheapestId = null;
    if (ans.priority === 'tiet_kiem') {
      const carsWithPrice = survivors
        .filter(function (item) {
          return item.car.price_vnd_from != null;
        })
        .slice()
        .sort(function (a, b) {
          return a.car.price_vnd_from - b.car.price_vnd_from;
        });

      if (carsWithPrice.length >= 1) {
        cheapestId = carsWithPrice[0].car.id;
      }
      if (carsWithPrice.length >= 2) {
        secondCheapestId = carsWithPrice[1].car.id;
      }
    }

    for (let i = 0; i < survivors.length; i++) {
      const item = survivors[i];
      const car = item.car;
      const reasons = item.reasons;

      // 1. Quãng đường >= 3 lần quãng đường đi mỗi ngày
      if (dailyKm !== null) {
        if (car.range_km == null) {
          addReasonUnique(reasons, 'thieu_du_lieu_range_km');
        } else if (car.range_km >= CONFIG.DAILY_RANGE_MULTIPLIER * dailyKm) {
          item.score += CONFIG.SCORE_RANGE_X3;
          addReasonUnique(reasons, 'range_du_x3');
        }
      }

      // 2. Đi tỉnh xa (long_trip)
      if (ans.long_trip === 'hang_thang' || ans.long_trip === true) {
        if (car.range_km == null) {
          addReasonUnique(reasons, 'thieu_du_lieu_range_km');
        } else if (car.range_km >= CONFIG.LONG_TRIP_MONTHLY_MIN_RANGE) {
          item.score += CONFIG.SCORE_LONG_TRIP_MONTHLY;
          addReasonUnique(reasons, 'di_xa_on');
        }
      } else if (ans.long_trip === 'hang_tuan') {
        if (car.range_km == null) {
          addReasonUnique(reasons, 'thieu_du_lieu_range_km');
        } else if (car.range_km >= CONFIG.LONG_TRIP_WEEKLY_MIN_RANGE) {
          item.score += CONFIG.SCORE_LONG_TRIP_WEEKLY;
          addReasonUnique(reasons, 'di_xa_tot');
        }
      }

      // 3. Ưu tiên (priority)
      if (ans.priority === 'de_do') {
        if (car.length_m == null) {
          addReasonUnique(reasons, 'thieu_du_lieu_length_m');
        } else if (car.length_m <= CONFIG.EASY_PARK_MAX_LENGTH_M) {
          item.score += CONFIG.SCORE_EASY_PARK;
          addReasonUnique(reasons, 'de_do');
        }
      } else if (ans.priority === 'rong_rai') {
        if (car.seats == null) {
          addReasonUnique(reasons, 'thieu_du_lieu_seats');
        }
        if (car.length_m == null) {
          addReasonUnique(reasons, 'thieu_du_lieu_length_m');
        }
        if (car.seats != null && car.length_m != null) {
          // seats >= 5 và length_m >= 4.7 -> mã "rong_rai", giữ nguyên điểm (+2)
          if (car.seats >= CONFIG.SPACIOUS_MIN_SEATS && car.length_m >= CONFIG.SPACIOUS_HIGH_MIN_LENGTH_M) {
            item.score += CONFIG.SCORE_SPACIOUS;
            addReasonUnique(reasons, 'rong_rai');
          }
          // seats >= 5 và 4.2 <= length_m < 4.7 -> mã "rong_rai_vua", cộng ít hơn 1 điểm (+1)
          else if (
            car.seats >= CONFIG.SPACIOUS_MIN_SEATS &&
            car.length_m >= CONFIG.SPACIOUS_MED_MIN_LENGTH_M &&
            car.length_m < CONFIG.SPACIOUS_HIGH_MIN_LENGTH_M
          ) {
            item.score += CONFIG.SCORE_SPACIOUS_MED;
            addReasonUnique(reasons, 'rong_rai_vua');
          }
        }
      } else if (ans.priority === 'tiet_kiem') {
        if (car.price_vnd_from == null) {
          addReasonUnique(reasons, 'thieu_du_lieu_price_vnd_from');
        } else if (car.id === cheapestId) {
          item.score += CONFIG.SCORE_CHEAPEST;
          addReasonUnique(reasons, 'tiet_kiem');
        } else if (car.id === secondCheapestId) {
          item.score += CONFIG.SCORE_SECOND_CHEAPEST;
          addReasonUnique(reasons, 'tiet_kiem');
        }
      } else if (ans.priority === 'cam_giac_lai') {
        if (car.segment == null) {
          addReasonUnique(reasons, 'thieu_du_lieu_segment');
        } else if (CONFIG.DRIVING_HIGH_SEGMENTS.indexOf(car.segment) !== -1) {
          item.score += CONFIG.SCORE_DRIVING_HIGH;
          addReasonUnique(reasons, 'cam_giac_lai');
        } else if (CONFIG.DRIVING_MED_SEGMENTS.indexOf(car.segment) !== -1) {
          item.score += CONFIG.SCORE_DRIVING_MED;
          addReasonUnique(reasons, 'cam_giac_lai');
        }
      }

      // 4. Không có chỗ sạc ở nhà (home_charging === false)
      // Đạt nếu dc_max_kw đạt ngưỡng HOẶC dc_10_70_min đạt ngưỡng.
      // Trường nào null thì bỏ qua, chỉ gắn thieu_du_lieu_... khi CẢ HAI trường đều null.
      if (ans.home_charging === false) {
        const hasKw = car.dc_max_kw != null;
        const hasTime = car.dc_10_70_min != null;

        if (!hasKw && !hasTime) {
          addReasonUnique(reasons, 'thieu_du_lieu_dc_max_kw');
          addReasonUnique(reasons, 'thieu_du_lieu_dc_10_70_min');
        }

        const isFastHigh =
          (hasKw && car.dc_max_kw >= CONFIG.FAST_CHARGE_HIGH_KW) ||
          (hasTime && car.dc_10_70_min <= CONFIG.FAST_CHARGE_MAX_MINUTES);
        const isFastMed =
          !isFastHigh && (hasKw && car.dc_max_kw >= CONFIG.FAST_CHARGE_MED_KW);

        if (isFastHigh) {
          item.score += CONFIG.SCORE_FAST_CHARGE_HIGH;
          addReasonUnique(reasons, 'sac_nhanh');
        } else if (isFastMed) {
          item.score += CONFIG.SCORE_FAST_CHARGE_MED;
          addReasonUnique(reasons, 'sac_kha');
        }
      }

      // ======================================================================
      // 5. CÁC LUẬT TRỪ ĐIỂM (PENALTIES)
      // ======================================================================

      // 5.1 home_charging = false và range_km < 2 × daily_km -> trừ 2 điểm, mã "phai_sac_moi_ngay"
      if (ans.home_charging === false && dailyKm !== null && car.range_km != null) {
        if (car.range_km < CONFIG.PENALTY_MUST_CHARGE_DAILY_MULTIPLIER * dailyKm) {
          item.score -= CONFIG.PENALTY_SCORE_MUST_CHARGE_DAILY;
          addReasonUnique(reasons, 'phai_sac_moi_ngay');
        }
      }

      // 5.2 long_trip = true và range_km < 300 -> trừ 2 điểm, mã "chay_tinh_kho"
      const isLongTrip =
        ans.long_trip === true ||
        ans.long_trip === 'hang_thang' ||
        ans.long_trip === 'hang_tuan';

      if (isLongTrip && car.range_km != null) {
        if (car.range_km < CONFIG.PENALTY_LONG_TRIP_MIN_RANGE) {
          item.score -= CONFIG.PENALTY_SCORE_LONG_TRIP;
          addReasonUnique(reasons, 'chay_tinh_kho');
        }
      }

      // Điểm tổng không được xuống dưới 0 khi xếp hạng
      if (item.score < 0) {
        item.score = 0;
      }
    }

    // ========================================================================
    // BƯỚC 3: SẮP XẾP & CHỌN TOP 2
    // Bằng điểm -> xe rẻ hơn xếp trước
    // ========================================================================
    survivors.sort(function (a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const priceA = a.car.price_vnd_from != null ? a.car.price_vnd_from : Infinity;
      const priceB = b.car.price_vnd_from != null ? b.car.price_vnd_from : Infinity;
      return priceA - priceB;
    });

    const top = survivors.slice(0, CONFIG.TOP_LIMIT).map(function (item) {
      return {
        id: item.car.id,
        name: item.car.name,
        score: item.score,
        range_standard: item.car.range_standard || null,
        reasons: item.reasons
      };
    });

    return {
      top: top,
      excluded: excluded,
      none_reason: null,
      none_reasons: []
    };
  }

  return {
    scoreCars: scoreCars,
    CONFIG: CONFIG
  };
});
