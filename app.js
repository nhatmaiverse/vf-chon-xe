/**
 * VF Chọn Xe — Trợ lý AI chọn xe điện VinFast
 * File: app.js — Điều khiển giao diện, hiển thị kết quả và gọi trợ lý AI
 */

// Bảng chuyển đổi mã lý do sang câu tiếng Việt dễ hiểu
const REASON_LABELS = {
  du_cho: 'đủ chỗ cho số người bạn chọn',
  trong_ngan_sach: 'nằm trong ngân sách của bạn (đã cho phép vượt tối đa 10%)',
  range_du_x3: 'đi được hơn 3 ngày với một lần sạc theo quãng đường bạn đi mỗi ngày',
  di_xa_on: 'hợp chuyến đi tỉnh hàng tháng',
  di_xa_tot: 'quãng đường dài, hợp chuyến đi tỉnh hàng tuần',
  de_do: 'nhỏ gọn, dễ đỗ xe',
  rong_rai: 'rộng rãi cho cả nhà',
  rong_rai_vua: 'khá rộng rãi, nhỏ hơn một chút so với nhóm xe lớn nhất',
  tiet_kiem: 'giá thấp trong các xe phù hợp',
  cam_giac_lai: 'thuộc nhóm SUV cỡ vừa trở lên, hợp với cảm giác lái bạn ưu tiên',
  sac_nhanh: 'sạc nhanh DC, tiện khi không có chỗ sạc ở nhà',
  sac_kha: 'sạc nhanh DC ở mức khá',
  phai_sac_moi_ngay: 'với quãng đường bạn đi và không có chỗ sạc ở nhà, có thể phải sạc gần như mỗi ngày',
  chay_tinh_kho: 'quãng đường dưới 300 km, hơi ngắn nếu bạn hay đi tỉnh',
  thieu_du_lieu_seats: 'chưa có dữ liệu số chỗ ngồi để đánh giá số chỗ và độ rộng rãi',
  thieu_du_lieu_price_vnd_from: 'chưa có dữ liệu giá xe để đánh giá ngân sách và mức tiết kiệm',
  thieu_du_lieu_range_km: 'chưa có dữ liệu quãng đường để đánh giá khả năng di chuyển',
  thieu_du_lieu_length_m: 'chưa có dữ liệu chiều dài xe để đánh giá khả năng đỗ xe và độ rộng rãi',
  thieu_du_lieu_segment: 'chưa có dữ liệu phân khúc xe để đánh giá cảm giác lái',
  thieu_du_lieu_dc_max_kw: 'chưa có dữ liệu công suất sạc DC tối đa để đánh giá sạc nhanh',
  thieu_du_lieu_dc_10_70_min: 'chưa có dữ liệu thời gian sạc nhanh 10–70% để đánh giá sạc nhanh'
};
const DEGRADED_REASON_MAP = REASON_LABELS;

// Các mã lý do cần tách thành mục "Lưu ý" riêng, tô nổi bật nhẹ
const CAUTION_CODES = ['phai_sac_moi_ngay', 'chay_tinh_kho'];

// Bảng chuyển đổi mã khi không có xe phù hợp
const NONE_REASON_LABELS = {
  khong_du_cho: 'Chưa có mẫu xe nào đủ chỗ cho số người bạn chọn',
  vuot_ngan_sach: 'Các mẫu xe đủ chỗ đều vượt ngân sách (đã cho phép vượt tối đa 10%)',
  khong_du_quang_duong_1_ngay: 'Chưa có xe nào chạy đủ quãng đường mỗi ngày mà không phải sạc giữa chừng'
};

// Biến quản lý yêu cầu AI Explain đang diễn ra
let currentExplainAbortController = null;
let explainTimer20s = null;
let explainTimer40s = null;

// Bộ nhớ đệm danh sách xe nạp từ data/cars.json và giá từ data/prices.json
let cachedCarsData = null;
let cachedCarsRawData = null;
let cachedPricesData = null;

// Trạng thái ô tích chung "Tôi được sạc miễn phí" (mặc định TẮT)
let isFreeCharging = false;

document.addEventListener('DOMContentLoaded', () => {
  initHeroHeaderAnimation();
  initSmoothScroll();
  initSummaryActionsListener();
});

/**
 * Nạp dữ liệu danh sách xe từ data/cars.json riêng biệt
 * Không lưu kết quả lỗi hay mảng rỗng vào bộ nhớ đệm
 */
async function loadCarsData() {
  if (Array.isArray(cachedCarsData) && cachedCarsData.length > 0) {
    return cachedCarsData;
  }
  try {
    const resCars = await fetch('data/cars.json');
    if (!resCars.ok) {
      cachedCarsData = null;
      cachedCarsRawData = null;
      return null;
    }
    const dataCars = await resCars.json();
    cachedCarsRawData = dataCars;
    let cars = null;
    if (Array.isArray(dataCars)) {
      cars = dataCars;
    } else if (dataCars && typeof dataCars === 'object' && Array.isArray(dataCars.cars)) {
      cars = dataCars.cars;
    }
    if (!cars || !Array.isArray(cars) || cars.length === 0) {
      cachedCarsData = null;
      cachedCarsRawData = null;
      return null;
    }
    cachedCarsData = cars;
    return cachedCarsData;
  } catch (err) {
    cachedCarsData = null;
    cachedCarsRawData = null;
    return null;
  }
}

/**
 * Nạp dữ liệu giá từ data/prices.json riêng biệt
 * Không lưu kết quả lỗi vào bộ nhớ đệm
 */
async function loadPricesData() {
  if (cachedPricesData && typeof cachedPricesData === 'object' && !Array.isArray(cachedPricesData) && Object.keys(cachedPricesData).length > 0) {
    return cachedPricesData;
  }
  try {
    const resPrices = await fetch('data/prices.json');
    if (!resPrices.ok) {
      cachedPricesData = null;
      return null;
    }
    const dataPrices = await resPrices.json();
    if (!dataPrices || typeof dataPrices !== 'object' || Array.isArray(dataPrices) || Object.keys(dataPrices).length === 0) {
      cachedPricesData = null;
      return null;
    }
    cachedPricesData = dataPrices;
    return cachedPricesData;
  } catch (err) {
    cachedPricesData = null;
    return null;
  }
}

/**
 * Lắng nghe sự kiện hoàn thành 6 câu hỏi ('quiz:done')
 */
document.addEventListener('quiz:done', async (e) => {
  const answers = (e && e.detail) || window.quizAnswers;
  if (!answers || typeof window.scoreCars !== 'function') return;

  // Hủy các tiến trình giải thích AI trước đó nếu có
  cancelOngoingExplain();

  const [cars, prices] = await Promise.all([loadCarsData(), loadPricesData()]);

  // Nếu cars.json lỗi hoặc không phải mảng/đối tượng hợp lệ
  if (!cars || !Array.isArray(cars) || cars.length === 0) {
    const resultSection = document.getElementById('result');
    if (resultSection) {
      resultSection.innerHTML = '<p class="car-cost-empty">Chưa tải được dữ liệu xe, bạn tải lại trang nhé.</p>';
      resultSection.style.display = 'block';
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      resultSection.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'start'
      });
    }
    return;
  }

  // Nếu cars.json tốt: vẫn hiện xe, lý do, bảng so sánh bình thường
  const result = window.scoreCars(cars, answers);
  window.lastScoringResult = result;

  // Hiển thị phần kết quả lên giao diện
  renderResultSection(result, cars, answers);
});

/**
 * Lắng nghe sự kiện reset bộ câu hỏi ('quiz:reset')
 * Ẩn phần kết quả, xoá nội dung, đặt lại ô tích miễn phí sạc và huỷ yêu cầu AI đang chờ
 */
document.addEventListener('quiz:reset', () => {
  cancelOngoingExplain();
  isFreeCharging = false;

  const resultSection = document.getElementById('result');
  if (resultSection) {
    resultSection.innerHTML = '';
    resultSection.style.display = 'none';
  }
});

/**
 * Hủy yêu cầu AI Explain và xoá các bộ đếm thời gian
 */
function cancelOngoingExplain() {
  if (explainTimer20s) {
    clearTimeout(explainTimer20s);
    explainTimer20s = null;
  }
  if (explainTimer40s) {
    clearTimeout(explainTimer40s);
    explainTimer40s = null;
  }
  if (currentExplainAbortController) {
    currentExplainAbortController.abort();
    currentExplainAbortController = null;
  }
}

/**
 * Làm sạch văn bản phản hồi từ AI:
 * Bỏ mọi dấu **, *, #, `, nhưng vẫn giữ nguyên dấu xuống dòng
 */
function cleanText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#/g, '')
    .replace(/`/g, '');
}

/**
 * Định dạng giá tiền VNĐ thân thiện cho giao diện
 */
function formatPriceVnd(price) {
  if (price == null) return 'chưa có dữ liệu';
  if (price < 1000000000) {
    const trieu = Math.round(price / 1000000);
    return `Từ ${trieu} triệu VNĐ`;
  }
  const ty = price / 1000000000;
  const formatted = parseFloat(ty.toFixed(2)).toString().replace('.', ',');
  return `Từ ${formatted} tỷ VNĐ`;
}

/**
 * Ánh xạ mã lý do sang câu tiếng Việt
 * Bắt đầu bằng 'thieu_du_lieu' -> 'chưa có dữ liệu để đánh giá một tiêu chí' (nếu chưa nhận ra)
 * Mã lạ -> trả về null (bỏ qua, không in mã thô)
 */
function mapReasonCode(code) {
  if (typeof code !== 'string') return null;
  if (REASON_LABELS[code]) {
    return REASON_LABELS[code];
  }
  if (code.startsWith('thieu_du_lieu')) {
    return 'chưa có dữ liệu để đánh giá một tiêu chí';
  }
  return null;
}
const mapDegradedReason = mapReasonCode;

/**
 * Định dạng quãng đường hiển thị của xe:
 * Nếu xe thiếu range_standard thì hiện "chuẩn đo chưa rõ", không giả định NEDC.
 */
function formatCarRange(car) {
  if (!car || car.range_km == null) return 'chưa có dữ liệu';
  const standard = (car.range_standard && typeof car.range_standard === 'string' && car.range_standard.trim())
    ? car.range_standard.trim()
    : 'chuẩn đo chưa rõ';
  return `${car.range_km} km (${standard})`;
}

/**
 * Đọc từ data/cars.json thông tin điều kiện/giới hạn sạc miễn phí
 */
function getFreeChargingPolicyText(rawData) {
  if (!rawData || typeof rawData !== 'object') return '';
  if (rawData.charging_policy) {
    if (typeof rawData.charging_policy === 'string') {
      return rawData.charging_policy.trim();
    }
    if (rawData.charging_policy.free_charging && typeof rawData.charging_policy.free_charging === 'string') {
      return rawData.charging_policy.free_charging.trim();
    }
  }
  if (typeof rawData.free_charging === 'string') {
    return rawData.free_charging.trim();
  }
  return '';
}

/**
 * Tạo mã HTML cho khối chi phí vận hành ước tính mỗi tháng của từng xe
 * Dùng hàm estimateMonthlyCost từ cost.js
 */
function buildCarCostHtml(car, prices, answers, freeCharging, isDifferentRangeStandard = false) {
  if (typeof window.estimateMonthlyCost !== 'function' || !car || !prices) {
    return `
      <div class="car-cost-block" id="cost-block-${car && car.id ? car.id : 'unknown'}">
        <p class="car-cost-empty">Chưa có dữ liệu giá để tính chi phí.</p>
      </div>
    `;
  }

  const costRes = window.estimateMonthlyCost({
    car,
    prices,
    daily_km: answers ? Number(answers.daily_km) : null,
    home_charging: answers ? Boolean(answers.home_charging) : false,
    free_charging: Boolean(freeCharging)
  });

  if (!costRes || !costRes.ok) {
    return `
      <div class="car-cost-block" id="cost-block-${car.id}">
        <p class="car-cost-empty">Chưa có dữ liệu giá để tính chi phí.</p>
      </div>
    `;
  }

  const evCostStr = `${costRes.ev_cost_vnd.toLocaleString('vi-VN')} đ`;
  const petrolCostStr = `${costRes.petrol_cost_vnd.toLocaleString('vi-VN')} đ`;
  const savingCostStr = `${costRes.saving_vnd.toLocaleString('vi-VN')} đ`;

  const note1 =
    (costRes.notes && costRes.notes[0]) ||
    'Con số là ước tính, chưa tính hao hụt khi sạc và điều kiện thực tế.';
  const note2 =
    (costRes.notes && costRes.notes[1]) ||
    'Xe xăng so sánh là giả định 7,5 lít/100 km, không phải số liệu của hãng.';

  const diffNoticeHtml = isDifferentRangeStandard
    ? '<p class="cost-note-item">Quãng đường của hai xe đo theo chuẩn khác nhau nên chi phí hai xe không so trực tiếp được.</p>'
    : '';

  const pricesUpdated = prices && prices.updated ? prices.updated : '';
  const priceUpdatedHtml = pricesUpdated
    ? `<p class="cost-note-item">Giá lấy từ dữ liệu cập nhật ngày ${pricesUpdated}; vui lòng kiểm tra lại giá hiện hành.</p>`
    : '';

  return `
    <div class="car-cost-block" id="cost-block-${car.id}">
      <h4 class="car-cost-title">Chi phí vận hành ước tính mỗi tháng</h4>
      <div class="car-cost-lines">
        <div class="car-cost-line">
          <span class="cost-label">Điện:</span>
          <span class="cost-val">${evCostStr}</span>
        </div>
        <div class="car-cost-line">
          <span class="cost-label">Xe xăng tham chiếu:</span>
          <span class="cost-val">${petrolCostStr}</span>
        </div>
        <div class="car-cost-line is-saving">
          <span class="cost-label">Tiết kiệm:</span>
          <span class="cost-val cost-saving-val">${savingCostStr}</span>
        </div>
      </div>
      <div class="car-cost-notes">
        <p class="cost-note-item">${note1}</p>
        <p class="cost-note-item">${note2}</p>
        ${diffNoticeHtml}
        ${priceUpdatedHtml}
      </div>
    </div>
  `;
}

/**
 * Cập nhật tức thời tất cả các khối chi phí khi người dùng chuyển đổi ô tích sạc miễn phí
 */
function updateAllCostBlocks(carsList, prices, answers, freeCharging, isDifferentRangeStandard = false) {
  carsList.forEach((car) => {
    const blockEl = document.getElementById(`cost-block-${car.id}`);
    if (blockEl) {
      const newHtml = buildCarCostHtml(car, prices, answers, freeCharging, isDifferentRangeStandard);
      blockEl.outerHTML = newHtml;
    }
  });
}

/**
 * Vẽ toàn bộ phần Kết quả (#result)
 */
function renderResultSection(result, cars, answers) {
  const resultSection = document.getElementById('result');
  if (!resultSection) return;

  const top = (result && result.top) || [];
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  resultSection.innerHTML = '';
  resultSection.style.display = 'block';

  if (top.length === 0) {
    // Trường hợp KHÔNG có xe phù hợp
    renderNoCarResult(resultSection, result);
  } else {
    // Trường hợp CÓ xe phù hợp (1 hoặc 2 xe)
    renderMatchedCarsResult(resultSection, top, cars, answers);
  }

  // Cuộn mượt tới phần kết quả
  resultSection.scrollIntoView({
    behavior: prefersReduced ? 'auto' : 'smooth',
    block: 'start'
  });

  // Hiệu ứng GSAP nhẹ khi xuất hiện
  if (window.gsap && !prefersReduced) {
    window.gsap.fromTo(
      resultSection,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }
    );
  }
}

/**
 * Vẽ giao diện khi KHÔNG CÓ XE PHÙ HỢP (top rỗng)
 * Trường hợp này KHÔNG gọi /api/ask
 */
function renderNoCarResult(container, result) {
  const noneReasons = (result && result.none_reasons) || [];
  const isDataError = Boolean(
    (result && (result.none_reason === 'khong_co_du_lieu_xe' || result.none_reason === 'dau_vao_khong_hop_le')) ||
    noneReasons.includes('khong_co_du_lieu_xe') ||
    noneReasons.includes('dau_vao_khong_hop_le')
  );

  if (isDataError) {
    container.innerHTML = `
      <div class="no-car-card">
        <div class="no-car-icon-wrap" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
        </div>
        <h2 class="no-car-title">Hiện chưa có xe phù hợp</h2>
        <div class="no-car-reasons-box">
          <p class="no-car-reasons-intro">Chưa đủ dữ liệu để gợi ý lúc này, bạn thử lại nhé.</p>
        </div>
        <div class="no-car-action">
          <button type="button" class="quiz-primary-btn" id="btn-no-car-restart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            <span>Làm lại</span>
          </button>
        </div>
      </div>
    `;

    const restartBtn = container.querySelector('#btn-no-car-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        if (typeof window.resetQuiz === 'function') {
          window.resetQuiz();
        }
      });
    }
    return;
  }

  const reasonLines = [];
  noneReasons.forEach((code) => {
    if (NONE_REASON_LABELS[code]) {
      reasonLines.push(NONE_REASON_LABELS[code]);
    }
  });

  if (reasonLines.length === 0) {
    reasonLines.push('Các tiêu chí hiện tại chưa trùng khớp với thông số của các dòng xe hiện có.');
  }

  const reasonsListHtml = reasonLines
    .map(
      (text) => `
        <li>
          <span class="no-car-bullet" aria-hidden="true">•</span>
          <span>${text}</span>
        </li>
      `
    )
    .join('');

  container.innerHTML = `
    <div class="no-car-card">
      <div class="no-car-icon-wrap" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        </svg>
      </div>
      <h2 class="no-car-title">Hiện chưa có xe phù hợp</h2>
      <div class="no-car-reasons-box">
        <p class="no-car-reasons-intro">Lý do chưa tìm thấy xe tối ưu:</p>
        <ul class="no-car-reasons-list">
          ${reasonsListHtml}
        </ul>
      </div>
      <p class="no-car-suggestion">
        Gợi ý: Bạn có thể thử tăng ngân sách hoặc giảm số chỗ ngồi để tìm được mẫu xe phù hợp hơn.
      </p>
      <div class="no-car-action">
        <button type="button" class="quiz-primary-btn" id="btn-no-car-restart">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          <span>Làm lại</span>
        </button>
      </div>
    </div>
  `;

  const restartBtn = container.querySelector('#btn-no-car-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      if (typeof window.resetQuiz === 'function') {
        window.resetQuiz();
      }
    });
  }
}

/**
 * Vẽ giao diện khi CÓ XE PHÙ HỢP (tối đa 2 xe)
 */
function renderMatchedCarsResult(container, top, cars, answers) {
  // Lọc và chỉ giữ các xe tìm thấy trong cars.json; bỏ các xe không tìm thấy
  const carsList = Array.isArray(cars) ? cars : [];
  const validTopCars = [];

  for (const item of top) {
    if (!item || !item.id) continue;
    const carInfo = carsList.find((c) => c && c.id === item.id);
    if (carInfo && carInfo.id && carInfo.name) {
      validTopCars.push({
        ...carInfo,
        score: item.score,
        reasons: item.reasons || []
      });
    }
    if (validTopCars.length === 2) {
      break;
    }
  }

  // Nếu bỏ hết thì hiện câu "Chưa tải được dữ liệu xe, bạn tải lại trang nhé."
  if (validTopCars.length === 0) {
    container.innerHTML = '<p class="car-cost-empty">Chưa tải được dữ liệu xe, bạn tải lại trang nhé.</p>';
    return;
  }

  const topCarsWithData = validTopCars.map((car, index) => ({
    ...car,
    rank: index + 1
  }));

  // Kiểm tra khác chuẩn đo quãng đường: hai chuẩn khác nhau HOẶC một trong hai thiếu (khi có đủ 2 xe)
  const isDifferentRangeStandard = Boolean(
    topCarsWithData.length === 2 &&
    (!topCarsWithData[0].range_standard ||
      !topCarsWithData[1].range_standard ||
      topCarsWithData[0].range_standard !== topCarsWithData[1].range_standard)
  );

  // 1. Tiêu đề mục kết quả
  const headerHtml = `
    <div class="result-header">
      <div class="result-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Gợi ý theo nhu cầu</span>
      </div>
      <h2 class="result-title">Mẫu xe phù hợp nhất với bạn</h2>
      <p class="result-subtitle">Dựa trên số người, ngân sách, thói quen đi lại và ưu tiên bạn đã chọn</p>
    </div>
  `;

  // 2. Ô tích chung "Tôi được sạc miễn phí" phía trên các thẻ xe (ẩn khi không có dữ liệu giá)
  const hasPrices = Boolean(cachedPricesData && typeof cachedPricesData === 'object' && Object.keys(cachedPricesData).length > 0);
  const toggleWrapStyle = hasPrices ? '' : 'style="display: none;"';

  const freeChargingPolicy = getFreeChargingPolicyText(cachedCarsRawData);
  const freeChargingNoteHtml = `
    <p class="result-cost-toggle-note">
      Giả định toàn bộ điện sạc miễn phí; điều kiện của chương trình thực tế có thể có giới hạn.${freeChargingPolicy ? `<br><span class="result-cost-toggle-policy">${freeChargingPolicy}</span>` : ''}
    </p>
  `;

  const toggleHtml = `
    <div class="result-cost-toggle-wrap" ${toggleWrapStyle}>
      <label class="result-cost-toggle-label" for="free-charging-checkbox">
        <input
          type="checkbox"
          id="free-charging-checkbox"
          class="result-cost-checkbox"
          ${isFreeCharging ? 'checked' : ''}
          ${hasPrices ? '' : 'style="display: none;"'}
        />
        <span class="result-cost-checkbox-box" aria-hidden="true">
          <svg class="result-cost-check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
        <span class="result-cost-toggle-text">Tôi được sạc miễn phí</span>
      </label>
      ${freeChargingNoteHtml}
    </div>
  `;

  // 3. Danh sách tối đa 2 thẻ xe
  const cardsHtml = topCarsWithData
    .map((car) => {
      const pros = [];
      const cautions = [];

      car.reasons.forEach((code) => {
        const text = mapReasonCode(code);
        if (!text) return; // Bỏ qua mã lạ
        if (CAUTION_CODES.includes(code)) {
          cautions.push(text);
        } else {
          pros.push(text);
        }
      });

      const prosListHtml = pros
        .map(
          (text) => `
            <li>
              <span class="reason-check" aria-hidden="true">✓</span>
              <span>${text}</span>
            </li>
          `
        )
        .join('');

      const cautionHtml =
        cautions.length > 0
          ? `
            <div class="car-caution-block">
              <div class="car-caution-header">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>Lưu ý</span>
              </div>
              <ul class="car-caution-list">
                ${cautions.map((c) => `<li>${c}</li>`).join('')}
              </ul>
            </div>
          `
          : '';

      const rankLabel = car.rank === 1 ? 'Lựa chọn số 1' : 'Gợi ý thay thế';
      const rankClass = car.rank === 1 ? 'rank-1' : 'rank-2';
      const rangeText = formatCarRange(car);
      const seatsText = car.seats != null ? `${car.seats} chỗ` : 'chưa có dữ liệu';
      const priceText = formatPriceVnd(car.price_vnd_from);

      // Khối chi phí vận hành ước tính mỗi tháng
      const costHtml = buildCarCostHtml(car, cachedPricesData, answers, isFreeCharging, isDifferentRangeStandard);

      return `
        <article class="car-card">
          <div class="car-card-rank ${rankClass}">${rankLabel}</div>
          <div class="car-card-img-wrap">
            <img
              src="assets/cars/${car.id}.webp"
              alt="VinFast ${car.name}"
              class="car-card-img"
              loading="lazy"
            />
          </div>
          <div class="car-card-title-row">
            <h3 class="car-card-name">${car.name}</h3>
            ${car.version ? `<span class="car-card-version">${car.version}</span>` : ''}
          </div>
          <div class="car-specs-grid">
            <div class="car-spec-item">
              <span class="car-spec-label">Giá từ</span>
              <span class="car-spec-value">${priceText}</span>
            </div>
            <div class="car-spec-item">
              <span class="car-spec-label">Quãng đường</span>
              <span class="car-spec-value">${rangeText}</span>
            </div>
            <div class="car-spec-item">
              <span class="car-spec-label">Số chỗ</span>
              <span class="car-spec-value">${seatsText}</span>
            </div>
          </div>
          ${costHtml}
          <div class="car-reasons-block">
            <h4 class="car-reasons-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Vì sao hợp bạn</span>
            </h4>
            <ul class="car-reasons-list">
              ${prosListHtml || '<li>Phù hợp với các tiêu chí bạn đã cung cấp.</li>'}
            </ul>
          </div>
          ${cautionHtml}
        </article>
      `;
    })
    .join('');

  const gridHtml = `<div class="result-cars-grid">${cardsHtml}</div>`;

  // 4. Bảng so sánh nếu có đúng 2 xe
  let compareHtml = '';
  if (topCarsWithData.length === 2) {
    const c1 = topCarsWithData[0];
    const c2 = topCarsWithData[1];

    let c1Longer = false;
    let c2Longer = false;
    if (!isDifferentRangeStandard && c1.range_km != null && c2.range_km != null) {
      if (c1.range_km > c2.range_km) c1Longer = true;
      else if (c2.range_km > c1.range_km) c2Longer = true;
    }

    const valOrMissing = (val, suffix = '') => {
      if (val === null || val === undefined || val === '') return 'chưa có dữ liệu';
      return suffix ? `${val} ${suffix}` : `${val}`;
    };

    const c1RangeStr = formatCarRange(c1);
    const c2RangeStr = formatCarRange(c2);

    compareHtml = `
      <section class="compare-card" aria-label="So sánh 2 xe">
        <div class="compare-header">
          <h3 class="compare-title">So sánh trực quan giữa 2 xe</h3>
          <p class="compare-subtitle">Đối chiếu các thông số quan trọng giữa ${c1.name} và ${c2.name}</p>
        </div>
        <div class="compare-table-wrap">
          <table class="compare-table">
            <thead>
              <tr>
                <th scope="col" class="col-feature">Tiêu chí</th>
                <th scope="col" class="col-car">${c1.name}</th>
                <th scope="col" class="col-car">${c2.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="cell-label">Giá từ</td>
                <td class="cell-value">${formatPriceVnd(c1.price_vnd_from)}</td>
                <td class="cell-value">${formatPriceVnd(c2.price_vnd_from)}</td>
              </tr>
              <tr>
                <td class="cell-label">Số chỗ</td>
                <td class="cell-value">${valOrMissing(c1.seats, 'chỗ')}</td>
                <td class="cell-value">${valOrMissing(c2.seats, 'chỗ')}</td>
              </tr>
              <tr>
                <td class="cell-label">Quãng đường</td>
                <td class="cell-value ${c1Longer ? 'is-longer' : ''}">${c1RangeStr}</td>
                <td class="cell-value ${c2Longer ? 'is-longer' : ''}">${c2RangeStr}</td>
              </tr>
              <tr>
                <td class="cell-label">Dung lượng pin</td>
                <td class="cell-value">${valOrMissing(c1.battery_kwh, 'kWh')}</td>
                <td class="cell-value">${valOrMissing(c2.battery_kwh, 'kWh')}</td>
              </tr>
              <tr>
                <td class="cell-label">Sạc nhanh DC 10–70%</td>
                <td class="cell-value">${valOrMissing(c1.dc_10_70_min, 'phút')}</td>
                <td class="cell-value">${valOrMissing(c2.dc_10_70_min, 'phút')}</td>
              </tr>
              <tr>
                <td class="cell-label">Chiều dài</td>
                <td class="cell-value">${valOrMissing(c1.length_m, 'm')}</td>
                <td class="cell-value">${valOrMissing(c2.length_m, 'm')}</td>
              </tr>
              <tr>
                <td class="cell-label">Bảo hành</td>
                <td class="cell-value">${valOrMissing(c1.warranty)}</td>
                <td class="cell-value">${valOrMissing(c2.warranty)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${
          isDifferentRangeStandard
            ? `
              <div class="compare-notice-diff">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Hai xe đo quãng đường theo hai chuẩn khác nhau (NEDC/WLTP), không so trực tiếp được.</span>
              </div>
            `
            : ''
        }
      </section>
    `;
  }

  const explainCardHtml = `
    <section class="ai-explain-card" aria-label="Lời giải thích từ trợ lý AI">
      <div class="ai-explain-header">
        <div class="ai-explain-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div>
          <h3 class="ai-explain-title">Lời giải thích từ trợ lý AI</h3>
          <p class="ai-explain-subtitle">Phân tích chuyên sâu từ thông số kỹ thuật xe</p>
        </div>
      </div>
      <div class="ai-explain-body">
        <div class="ai-explain-loading" id="ai-loading-box">
          <div class="ai-loading-spinner" aria-hidden="true"></div>
          <span id="ai-loading-text">Đang nhờ trợ lý AI giải thích…</span>
        </div>
        <div class="ai-explain-content" id="ai-explain-content" style="display: none;"></div>
        <div class="ai-explain-meta" id="ai-explain-meta" style="display: none;"></div>
      </div>
    </section>
  `;

  container.innerHTML = headerHtml + toggleHtml + gridHtml + compareHtml + explainCardHtml;

  // 6. Gắn sự kiện thay đổi cho ô tích sạc miễn phí
  const freeChargingCheckbox = container.querySelector('#free-charging-checkbox');
  if (freeChargingCheckbox) {
    freeChargingCheckbox.addEventListener('change', (e) => {
      isFreeCharging = e.target.checked;
      updateAllCostBlocks(topCarsWithData, cachedPricesData, answers, isFreeCharging, isDifferentRangeStandard);
    });
  }

  // 7. Kích hoạt gọi API /api/ask để lấy lời giải thích AI
  requestAiExplanation(answers);
}

/**
 * Gọi API /api/ask ở chế độ explain
 * Chỉ gửi đúng 6 câu trả lời, không gửi gì khác.
 * Quản lý timeout 20s, 40s bằng AbortController.
 */
async function requestAiExplanation(answers) {
  // Chuẩn bị payload chỉ chứa đúng 6 câu trả lời
  const sixAnswers = {
    people: answers.people,
    budget_max_vnd: Number(answers.budget_max_vnd),
    daily_km: Number(answers.daily_km),
    long_trip: answers.long_trip,
    home_charging: Boolean(answers.home_charging),
    priority: answers.priority
  };

  const payload = {
    mode: 'explain',
    answers: sixAnswers
  };

  const controller = new AbortController();
  currentExplainAbortController = controller;

  // Hẹn giờ 20 giây: đổi thông báo đang chờ
  explainTimer20s = setTimeout(() => {
    const loadingText = document.getElementById('ai-loading-text');
    if (loadingText) {
      loadingText.textContent = 'AI trả lời hơi lâu, bạn xem tạm lý do bên trên nhé';
    }
  }, 20000);

  // Hẹn giờ 40 giây: hủy yêu cầu và dừng chờ
  explainTimer40s = setTimeout(() => {
    if (currentExplainAbortController === controller) {
      controller.abort();
    }
  }, 40000);

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    // Xóa bộ đếm giờ khi đã có phản hồi
    clearTimeout(explainTimer20s);
    clearTimeout(explainTimer40s);
    explainTimer20s = null;
    explainTimer40s = null;

    if (!res.ok) {
      showAiExplanationFallback();
      return;
    }

    let data = null;
    try {
      data = await res.json();
    } catch (parseErr) {
      showAiExplanationFallback();
      return;
    }

    if (!data || !data.ok || !data.text) {
      showAiExplanationFallback();
      return;
    }

    // Hiển thị lời giải thích đã làm sạch
    displayAiExplanationSuccess(data);
  } catch (err) {
    clearTimeout(explainTimer20s);
    clearTimeout(explainTimer40s);
    explainTimer20s = null;
    explainTimer40s = null;

    // Nếu bị hủy do người dùng bấm "Làm lại", không hiển thị gì cả
    const resultSection = document.getElementById('result');
    if (!resultSection || resultSection.style.display === 'none') {
      return;
    }

    // Lỗi mạng hoặc quá 40s abort
    showAiExplanationFallback();
  }
}

/**
 * Hiển thị thành công lời giải thích từ AI hoặc giải thích tự động từ dữ liệu
 */
function displayAiExplanationSuccess(data) {
  const loadingBox = document.getElementById('ai-loading-box');
  const contentEl = document.getElementById('ai-explain-content');
  const metaEl = document.getElementById('ai-explain-meta');

  if (loadingBox) loadingBox.style.display = 'none';

  if (contentEl) {
    contentEl.textContent = cleanText(data.text);
    contentEl.style.display = 'block';
  }

  if (metaEl) {
    metaEl.className = 'ai-explain-meta';
    metaEl.style.display = 'block';

    if (data.source === 'llm') {
      const modelName = data.model_used ? ` (model ${data.model_used})` : '';
      metaEl.textContent = `Lời giải thích do AI viết từ dữ liệu thông số${modelName}`;
    } else if (data.degraded) {
      metaEl.textContent = 'Giải thích tự động từ dữ liệu vì trợ lý AI đang bận.';
    } else {
      metaEl.textContent = 'Giải thích tự động từ dữ liệu thông số.';
    }
  }
}

/**
 * Hiển thị thông báo nhẹ nhàng khi không gọi được AI (offline hoặc lỗi mạng)
 * KHÔNG báo lỗi đỏ, KHÔNG làm sập trang, không in key hay nội dung lỗi gốc.
 */
function showAiExplanationFallback() {
  const loadingBox = document.getElementById('ai-loading-box');
  const contentEl = document.getElementById('ai-explain-content');
  const metaEl = document.getElementById('ai-explain-meta');

  if (loadingBox) loadingBox.style.display = 'none';
  if (contentEl) contentEl.style.display = 'none';

  if (metaEl) {
    metaEl.className = 'ai-explain-meta is-fallback';
    metaEl.textContent = 'Chưa có lời giải thích từ AI (chỉ hoạt động trên bản web đã đưa lên mạng)';
    metaEl.style.display = 'inline-block';
  }
}

/**
 * Lắng nghe nút bấm ở màn summary của quiz để cuộn xuống kết quả mượt mà
 */
function initSummaryActionsListener() {
  document.addEventListener('click', (e) => {
    const seeResultBtn = e.target.closest('#quiz-btn-see-result');
    if (!seeResultBtn) return;

    const resultSection = document.getElementById('result');
    if (resultSection && resultSection.style.display !== 'none') {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      resultSection.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'start'
      });

      const noticeText = document.getElementById('quiz-notice');
      if (noticeText) noticeText.style.display = 'none';
    }
  });
}

/**
 * Hiệu ứng vào của phần tiêu đề, dòng phụ và nút kêu gọi hành động
 */
function initHeroHeaderAnimation() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!window.gsap || prefersReducedMotion) return;

  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

  tl.from('.hero-title', {
    opacity: 0,
    y: 20,
    duration: 0.6,
    ease: 'power3.out'
  })
    .from(
      '.hero-subtitle',
      {
        opacity: 0,
        y: 12,
        duration: 0.5,
        ease: 'power3.out'
      },
      '-=0.3'
    )
    .from(
      '.fleet-caption',
      {
        opacity: 0,
        y: 8,
        duration: 0.4
      },
      '+=0.2'
    )
    .from(
      '.hero-cta-wrap',
      {
        opacity: 0,
        y: 15,
        duration: 0.5,
        ease: 'back.out(1.4)'
      },
      '-=0.1'
    );
}

/**
 * Nút "Tìm xe hợp với tôi" cuộn mượt xuống phần id="quiz"
 */
function initSmoothScroll() {
  const ctaBtn = document.getElementById('cta-find-car');
  if (!ctaBtn) return;

  ctaBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const quizSection = document.getElementById('quiz');
    if (quizSection) {
      quizSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
}
