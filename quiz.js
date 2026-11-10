/**
 * VF Chọn Xe — Trợ lý AI chọn xe điện VinFast
 * File: quiz.js — Toàn bộ logic hiển thị và xử lý 6 câu hỏi nhu cầu
 */

(function () {
  'use strict';

  // Cấu hình 6 câu hỏi
  const QUESTIONS = [
    {
      id: 'people',
      field: 'people',
      type: 'buttons',
      title: 'Bạn thường đi mấy người?',
      subtitle: 'Chọn số chỗ ngồi thường xuyên nhất trên xe',
      options: [
        { label: '1–2 người', value: '1-2' },
        { label: '3–4 người', value: '3-4' },
        { label: '5 người', value: '5' },
        { label: '6–7 người', value: '6-7' }
      ]
    },
    {
      id: 'budget',
      field: 'budget_max_vnd',
      type: 'slider',
      title: 'Ngân sách tối đa của bạn?',
      subtitle: 'Kéo để chọn mức giá cao nhất bạn sẵn sàng chi trả',
      min: 150000000,
      max: 2000000000,
      step: 10000000,
      default: 600000000,
      format: formatBudget,
      minLabel: '150 triệu',
      maxLabel: '2 tỷ'
    },
    {
      id: 'daily_km',
      field: 'daily_km',
      type: 'slider',
      title: 'Mỗi ngày bạn đi khoảng bao xa?',
      subtitle: 'Tính cả quãng đường đi làm, đưa đón con và sinh hoạt hàng ngày',
      min: 5,
      max: 400,
      step: 5,
      default: 30,
      format: (val) => `${val} km/ngày`,
      minLabel: '5 km',
      maxLabel: '400 km'
    },
    {
      id: 'long_trip',
      field: 'long_trip',
      type: 'buttons',
      title: 'Bao lâu bạn đi tỉnh xa (trên 200 km) một lần?',
      subtitle: 'Bao gồm về quê, công tác hoặc đi du lịch ngoại tỉnh',
      options: [
        { label: 'Hiếm khi', value: 'hiem' },
        { label: 'Hàng tháng', value: 'hang_thang' },
        { label: 'Hàng tuần', value: 'hang_tuan' }
      ]
    },
    {
      id: 'home_charging',
      field: 'home_charging',
      type: 'buttons',
      title: 'Bạn có chỗ sạc xe ở nhà không?',
      subtitle: 'Có gara, sân riêng cắm sạc được, hay đỗ xe ngoài bãi / chung cư',
      options: [
        { label: 'Có', value: true },
        { label: 'Không (ví dụ ở chung cư)', value: false }
      ]
    },
    {
      id: 'priority',
      field: 'priority',
      type: 'buttons',
      title: 'Bạn ưu tiên điều gì nhất?',
      subtitle: 'Tiêu chí quan trọng nhất khi bạn quyết định mua xe',
      options: [
        { label: 'Dễ đỗ xe', value: 'de_do' },
        { label: 'Rộng rãi', value: 'rong_rai' },
        { label: 'Tiết kiệm', value: 'tiet_kiem' },
        { label: 'Cảm giác lái', value: 'cam_giac_lai' }
      ]
    }
  ];

  // Trạng thái bộ câu hỏi
  let currentStep = 0;
  const answers = {
    people: null,
    budget_max_vnd: QUESTIONS[1].default,
    daily_km: QUESTIONS[2].default,
    long_trip: null,
    home_charging: null,
    priority: null
  };

  let isTransitioning = false;

  /**
   * Định dạng số tiền ngân sách hiển thị dạng chữ
   * Dưới 1 tỷ: "Tối đa X triệu"
   * Từ 1 tỷ trở lên: "Tối đa 1 tỷ" hoặc "Tối đa 1,35 tỷ"
   */
  function formatBudget(val) {
    if (val < 1000000000) {
      const trieu = Math.round(val / 1000000);
      return `Tối đa ${trieu} triệu`;
    }
    const ty = val / 1000000000;
    // Bỏ số 0 thừa phía sau (ví dụ 1.0 -> 1, 1.50 -> 1.5, 1.35 -> 1.35)
    const formatted = parseFloat(ty.toFixed(2)).toString().replace('.', ',');
    return `Tối đa ${formatted} tỷ`;
  }

  /**
   * Khởi tạo giao diện bộ câu hỏi khi trang đã sẵn sàng
   */
  function initQuiz() {
    const container = document.getElementById('quiz');
    if (!container) return;

    renderStep(currentStep, 0);

    // Bắt sự kiện bấm nút "Tìm xe hợp với tôi" ở Hero:
    // Cuộn xuống và bắt đầu từ câu 1
    const ctaBtn = document.getElementById('cta-find-car');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        if (currentStep !== 0) {
          currentStep = 0;
          renderStep(0, 0);
        }
      });
    }
  }

  /**
   * Vẽ màn câu hỏi hoặc màn tóm tắt
   * @param {number} stepIndex - Chỉ số câu (0-5) hoặc 6 là tóm tắt
   * @param {number} direction - Hướng chuyển (1: tiến, -1: lùi, 0: giữ nguyên)
   */
  function renderStep(stepIndex, direction) {
    const container = document.getElementById('quiz');
    if (!container) return;

    if (stepIndex >= QUESTIONS.length) {
      renderSummary(container, direction);
      return;
    }

    const q = QUESTIONS[stepIndex];
    const totalSteps = QUESTIONS.length;
    const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

    const card = document.createElement('div');
    card.className = 'quiz-card';

    // 1. Thanh tiến trình và nút điều hướng đầu thẻ
    const headerHtml = `
      <div class="quiz-topbar">
        <div class="quiz-nav-left">
          ${
            stepIndex > 0
              ? `<button type="button" class="quiz-back-btn" id="quiz-btn-back" aria-label="Quay lại câu trước">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                  <span>Quay lại</span>
                </button>`
              : '<span class="quiz-nav-placeholder"></span>'
          }
        </div>
        <div class="quiz-step-count" aria-live="polite">Câu ${stepIndex + 1}/${totalSteps}</div>
      </div>
      <div class="quiz-progress-track" role="progressbar" aria-valuenow="${stepIndex + 1}" aria-valuemin="1" aria-valuemax="${totalSteps}" aria-label="Tiến trình làm khảo sát">
        <div class="quiz-progress-bar" style="width: ${progressPercent}%;"></div>
      </div>
    `;

    // 2. Tiêu đề câu hỏi
    const questionHtml = `
      <div class="quiz-question-header">
        <h2 class="quiz-title">${q.title}</h2>
        ${q.subtitle ? `<p class="quiz-subtitle">${q.subtitle}</p>` : ''}
      </div>
    `;

    // 3. Phần thân: Nút bấm hoặc Thanh kéo
    let bodyHtml = '';
    if (q.type === 'buttons') {
      const optionsHtml = q.options
        .map((opt) => {
          const isSelected = answers[q.field] === opt.value;
          return `
            <button
              type="button"
              class="quiz-opt-btn ${isSelected ? 'is-selected' : ''}"
              data-value="${opt.value}"
              tabindex="0"
            >
              <span class="quiz-opt-label">${opt.label}</span>
              <span class="quiz-opt-check" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
            </button>
          `;
        })
        .join('');

      bodyHtml = `
        <div class="quiz-options-grid quiz-options-${q.options.length}" role="group" aria-label="${q.title}">
          ${optionsHtml}
        </div>
      `;
    } else if (q.type === 'slider') {
      const currentValue = answers[q.field] !== null ? answers[q.field] : q.default;
      const formattedValue = q.format(currentValue);

      bodyHtml = `
        <div class="quiz-slider-wrap">
          <div class="quiz-slider-display" id="quiz-slider-value" aria-live="polite">${formattedValue}</div>
          <div class="quiz-slider-control">
            <input
              type="range"
              class="quiz-range-input"
              id="quiz-range"
              min="${q.min}"
              max="${q.max}"
              step="${q.step}"
              value="${currentValue}"
              aria-label="${q.title}"
            />
          </div>
          <div class="quiz-slider-labels">
            <span class="quiz-slider-min">${q.minLabel}</span>
            <span class="quiz-slider-max">${q.maxLabel}</span>
          </div>
          <div class="quiz-slider-action">
            <button type="button" class="quiz-primary-btn" id="quiz-btn-next">
              <span>Tiếp tục</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>
      `;
    }

    card.innerHTML = headerHtml + questionHtml + bodyHtml;

    // Thay thế nội dung cũ kèm hiệu ứng
    animateTransition(container, card, direction, () => {
      bindStepEvents(card, q);
    });
  }

  /**
   * Gắn sự kiện tương tác cho từng câu
   */
  function bindStepEvents(card, q) {
    // Sự kiện nút Quay lại
    const backBtn = card.querySelector('#quiz-btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (isTransitioning || currentStep <= 0) return;
        currentStep--;
        renderStep(currentStep, -1);
      });
    }

    // Sự kiện câu dạng NÚT BẤM
    if (q.type === 'buttons') {
      const buttons = card.querySelectorAll('.quiz-opt-btn');
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (isTransitioning) return;

          // Chuyển đổi kiểu giá trị nếu cần (boolean cho true/false)
          let rawVal = btn.getAttribute('data-value');
          let val = rawVal;
          if (rawVal === 'true') val = true;
          if (rawVal === 'false') val = false;

          answers[q.field] = val;

          // Đổi trạng thái hiển thị của nút
          buttons.forEach((b) => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');

          isTransitioning = true;
          // Tự động chuyển câu sau 0.3s
          setTimeout(() => {
            isTransitioning = false;
            currentStep++;
            renderStep(currentStep, 1);
          }, 300);
        });
      });
    }

    // Sự kiện câu dạng THANH KÉO
    if (q.type === 'slider') {
      const rangeInput = card.querySelector('#quiz-range');
      const display = card.querySelector('#quiz-slider-value');
      const nextBtn = card.querySelector('#quiz-btn-next');

      if (rangeInput && display) {
        // Cập nhật giá trị hiển thị khi kéo
        rangeInput.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          answers[q.field] = val;
          display.textContent = q.format(val);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (isTransitioning) return;
          if (rangeInput) {
            answers[q.field] = Number(rangeInput.value);
          }
          currentStep++;
          renderStep(currentStep, 1);
        });
      }
    }
  }

  /**
   * Tạo chuỗi tóm tắt bằng lời dễ hiểu
   */
  function generateSummaryText(ans) {
    const parts = [];

    // 1. Số người
    if (ans.people) {
      const mapPeople = {
        '1-2': '1–2 người',
        '3-4': '3–4 người',
        '5': '5 người',
        '6-7': '6–7 người'
      };
      parts.push(mapPeople[ans.people] || `${ans.people} người`);
    }

    // 2. Ngân sách
    if (ans.budget_max_vnd) {
      const budText = formatBudget(ans.budget_max_vnd).toLowerCase();
      parts.push(budText);
    }

    // 3. Quãng đường ngày
    if (ans.daily_km) {
      parts.push(`${ans.daily_km} km/ngày`);
    }

    // 4. Đi xa
    if (ans.long_trip) {
      const mapTrip = {
        hiem: 'ít đi tỉnh xa',
        hang_thang: 'về quê/đi xa hàng tháng',
        hang_tuan: 'đi tỉnh xa hàng tuần'
      };
      parts.push(mapTrip[ans.long_trip] || ans.long_trip);
    }

    // 5. Chỗ sạc
    if (ans.home_charging !== null) {
      parts.push(ans.home_charging ? 'có chỗ sạc tại nhà' : 'không có chỗ sạc tại nhà');
    }

    // 6. Ưu tiên
    if (ans.priority) {
      const mapPriority = {
        de_do: 'ưu tiên dễ đỗ xe',
        rong_rai: 'ưu tiên rộng rãi',
        tiet_kiem: 'ưu tiên tiết kiệm',
        cam_giac_lai: 'ưu tiên cảm giác lái'
      };
      parts.push(mapPriority[ans.priority] || ans.priority);
    }

    return parts.join(' · ');
  }

  /**
   * Vẽ màn hình tóm tắt sau khi hoàn thành 6 câu
   */
  function renderSummary(container, direction) {
    // 1. Lưu vào biến toàn cục window.quizAnswers với đúng tên trường và kiểu dữ liệu
    window.quizAnswers = {
      people: answers.people,
      budget_max_vnd: Number(answers.budget_max_vnd),
      daily_km: Number(answers.daily_km),
      long_trip: answers.long_trip,
      home_charging: Boolean(answers.home_charging),
      priority: answers.priority
    };

    // 2. In ra console để kiểm tra
    console.log('Quiz answers:', window.quizAnswers);

    // 3. Bắn CustomEvent 'quiz:done'
    document.dispatchEvent(
      new CustomEvent('quiz:done', {
        detail: window.quizAnswers
      })
    );

    const summaryText = generateSummaryText(answers);

    const card = document.createElement('div');
    card.className = 'quiz-card quiz-card-summary';

    card.innerHTML = `
      <div class="quiz-summary-badge">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>Đã ghi nhận đủ 6 câu trả lời</span>
      </div>

      <div class="quiz-question-header">
        <h2 class="quiz-title">Tóm tắt nhu cầu của bạn</h2>
        <p class="quiz-subtitle">Chúng tôi sẽ dựa vào thông tin này để tính toán mẫu xe VinFast tối ưu nhất</p>
      </div>

      <div class="quiz-summary-box">
        <p class="quiz-summary-content">${summaryText}</p>
      </div>

      <div class="quiz-summary-actions">
        <button type="button" class="quiz-secondary-btn" id="quiz-btn-restart">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          <span>Làm lại</span>
        </button>

        <button type="button" class="quiz-primary-btn" id="quiz-btn-see-result">
          <span>Xem gợi ý</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>

      <div class="quiz-notice-text" id="quiz-notice" style="display: none;" role="status">
        Đang hoàn thiện – sẽ có ở bước tiếp theo
      </div>
    `;

    animateTransition(container, card, direction, () => {
      // Sự kiện nút Làm lại
      const restartBtn = card.querySelector('#quiz-btn-restart');
      if (restartBtn) {
        restartBtn.addEventListener('click', () => {
          resetQuiz();
        });
      }

      // Sự kiện nút Xem gợi ý (tạm thời hiện thông báo)
      const seeResultBtn = card.querySelector('#quiz-btn-see-result');
      const noticeText = card.querySelector('#quiz-notice');
      if (seeResultBtn && noticeText) {
        seeResultBtn.addEventListener('click', () => {
          noticeText.style.display = 'block';
          if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            window.gsap.fromTo(noticeText, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
          }
        });
      }
    });
  }

  /**
   * Reset toàn bộ khảo sát khi bấm nút "Làm lại":
   * 1. Xoá sạch đáp án: window.quizAnswers = {} (object rỗng).
   * 2. Bỏ trạng thái "đã chọn" (tô sáng) của MỌI nút lựa chọn ở cả 6 câu.
   * 3. Đưa 2 thanh kéo về giá trị mặc định: ngân sách 600 triệu, quãng đường 30 km/ngày, cập nhật số hiển thị.
   * 4. Ẩn thẻ tóm tắt, quay về câu 1, thanh tiến trình về "Câu 1/6".
   * 5. Cuộn mượt lên đầu khung #quiz.
   * 6. Phát sự kiện: document.dispatchEvent(new CustomEvent('quiz:reset')).
   * 7. In ra Console: console.log('Quiz reset', window.quizAnswers).
   */
  function resetQuiz() {
    // 1. Xoá sạch đáp án: window.quizAnswers = {} (object rỗng)
    window.quizAnswers = {};

    // Xoá sạch đáp án nội bộ của bộ câu hỏi
    answers.people = null;
    answers.budget_max_vnd = QUESTIONS[1].default; // 600 triệu (600000000)
    answers.daily_km = QUESTIONS[2].default;       // 30 km/ngày (30)
    answers.long_trip = null;
    answers.home_charging = null;
    answers.priority = null;

    // 2. Bỏ trạng thái "đã chọn" (tô sáng) của MỌI nút lựa chọn ở cả 6 câu
    const container = document.getElementById('quiz');
    if (container) {
      container.querySelectorAll('.quiz-opt-btn.is-selected').forEach((btn) => {
        btn.classList.remove('is-selected');
      });
    }

    // 3 & 4. Ẩn thẻ tóm tắt, quay về câu 1, thanh tiến trình về "Câu 1/6"
    currentStep = 0;
    renderStep(0, -1);

    // 5. Cuộn mượt lên đầu khung #quiz
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 6. Phát sự kiện: document.dispatchEvent(new CustomEvent('quiz:reset'))
    document.dispatchEvent(new CustomEvent('quiz:reset'));

    // 7. In ra Console: console.log('Quiz reset', window.quizAnswers)
    console.log('Quiz reset', window.quizAnswers);
  }

  // Cho phép gọi reset từ bên ngoài nếu cần
  window.resetQuiz = resetQuiz;

  /**
   * Hiệu ứng chuyển động mượt giữa các câu hỏi bằng GSAP
   */
  function animateTransition(container, newCard, direction, onComplete) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const oldCard = container.firstElementChild;

    if (!window.gsap || prefersReducedMotion || !oldCard || direction === 0) {
      container.innerHTML = '';
      container.appendChild(newCard);
      if (onComplete) onComplete();
      return;
    }

    const offsetX = direction > 0 ? 32 : -32;

    // Đặt container thành vị trí tương đối
    container.style.position = 'relative';

    // Tạo hiệu ứng mờ dần + trượt nhẹ
    window.gsap.to(oldCard, {
      opacity: 0,
      x: -offsetX,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => {
        container.innerHTML = '';
        container.appendChild(newCard);
        if (onComplete) onComplete();

        window.gsap.fromTo(
          newCard,
          { opacity: 0, x: offsetX },
          {
            opacity: 1,
            x: 0,
            duration: 0.35,
            ease: 'expo.out'
          }
        );
      }
    });
  }

  // Khởi động khi DOM nạp xong
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuiz);
  } else {
    initQuiz();
  }
})();
