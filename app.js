/**
 * VF Chọn Xe — Trợ lý AI chọn xe điện VinFast
 * File: app.js
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeroHeaderAnimation();
  initSmoothScroll();
});

// Lắng nghe sự kiện hoàn thành 6 câu hỏi ('quiz:done')
document.addEventListener('quiz:done', async (e) => {
  const answers = (e && e.detail) || window.quizAnswers;
  if (!answers || typeof window.scoreCars !== 'function') return;

  try {
    const res = await fetch('data/cars.json');
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    const data = await res.json();
    const cars = data.cars || [];

    const result = window.scoreCars(cars, answers);
    window.lastScoringResult = result;

    console.log('Scoring result:', result);
    console.table(result.top);
  } catch (err) {
    console.error('Lỗi khi chấm điểm xe:', err);
  }
});

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
  .from('.hero-subtitle', {
    opacity: 0,
    y: 12,
    duration: 0.5,
    ease: 'power3.out'
  }, '-=0.3')
  .from('.fleet-caption', {
    opacity: 0,
    y: 8,
    duration: 0.4
  }, '+=0.2')
  .from('.hero-cta-wrap', {
    opacity: 0,
    y: 15,
    duration: 0.5,
    ease: 'back.out(1.4)'
  }, '-=0.1');
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
