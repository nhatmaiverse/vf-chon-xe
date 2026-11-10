/* ===== Dàn xe theo tỉ lệ thật (hero-lineup) =====
   - Đọc data/cars.json, vẽ mọi xe có trong file (không ghi cứng số xe).
   - Chiều rộng mỗi xe = length_m × pxPerMeter (thang đo chung).
   - Máy tính: 1 hàng. Điện thoại (<640px): 2 hàng, dùng chung thang đo.
*/
(function () {
  const GAP_DESKTOP = 28;   // khoảng cách giữa các xe (px)
  const GAP_MOBILE = 12;
  const MOBILE_MAX = 639;

  const fmtLen = (m) => String(m).replace('.', ',') + ' m';

  function buildCar(car) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lineup__car';
    btn.dataset.len = car.length_m;
    btn.setAttribute('aria-label', `${car.name}, dài ${fmtLen(car.length_m)}`);

    const img = new Image();
    img.src = car.image;
    img.alt = car.name;
    img.loading = 'eager';
    img.decoding = 'async';
    img.onerror = () => {
      const fb = document.createElement('div');
      fb.className = 'lineup__fallback';
      fb.textContent = car.name;
      img.replaceWith(fb);
      btn.querySelector('.lineup__reflect')?.remove();
    };

    const reflect = new Image();
    reflect.src = car.image;
    reflect.alt = '';
    reflect.className = 'lineup__reflect';
    reflect.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'lineup__label';
    label.innerHTML = `<span class="lineup__name">${car.name}</span><span class="lineup__len">${fmtLen(car.length_m)}</span>`;

    btn.append(img, reflect, label);
    return { btn, img };
  }

  function layout(root, items) {
    // Dùng matchMedia để khớp với @media trong CSS (không bị lệch khi trang bị phóng/thu)
    const isMobile = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
    const gap = isMobile ? GAP_MOBILE : GAP_DESKTOP;

    // Chia hàng: điện thoại = nửa số xe nhỏ ở trên (làm tròn lên), còn lại ở dưới
    const rows = isMobile
      ? [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))]
      : [items];

    root.innerHTML = '';
    // Căn giữa theo màn hình, kể cả khi khung cha bị CSS cũ đẩy lệch
    root.style.translate = '0px 0px';
    const rect = root.getBoundingClientRect();
    const viewW = document.documentElement.clientWidth;
    const dx = Math.round((viewW - rect.width) / 2 - rect.left);
    if (Math.abs(dx) > 1) root.style.translate = dx + 'px 0px';
    const width = rect.width;

    // Thang đo chung: tính theo hàng "dài nhất" để hàng nào cũng vừa khung
    const ppm = Math.min(...rows.map((r) => {
      const totalLen = r.reduce((s, it) => s + it.car.length_m, 0);
      return (width - gap * (r.length - 1)) / totalLen;
    }));

    rows.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'lineup__row';
      row.style.gap = gap + 'px';
      r.forEach((it) => {
        it.btn.style.width = (it.car.length_m * ppm).toFixed(1) + 'px';
        row.appendChild(it.btn);
      });
      root.appendChild(row);
    });

    // Kiểm tra tỉ lệ: cột px_per_m phải gần như bằng nhau
    console.table(items.map((it) => {
      const w = it.img.getBoundingClientRect().width || it.btn.getBoundingClientRect().width;
      return { id: it.car.id, length_m: it.car.length_m, img_width_px: Math.round(w), px_per_m: (w / it.car.length_m).toFixed(2) };
    }));
  }

  function animateIn(items) {
    const els = items.map((it) => it.btn);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!window.gsap || reduce) return; // hiện ngay, không hiệu ứng
    window.gsap.fromTo(
      els,
      { x: 140, opacity: 0 },
      {
        x: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.12,
        clearProps: 'transform,opacity',   // trả lại cho CSS hover sau khi chạy xong
      }
    );
    // Phương án an toàn: sau 3 giây, xe nào vẫn ẩn thì hiện ra
    setTimeout(() => els.forEach((el) => {
      if (getComputedStyle(el).opacity === '0') { el.style.opacity = '1'; el.style.transform = 'none'; }
    }), 3000);
  }

  async function init() {
    const root = document.getElementById('lineup');
    if (!root) return;
    root.classList.add('lineup');

    const res = await fetch('data/cars.json', { cache: 'no-store' });
    const data = await res.json();
    const cars = (data.cars || []).filter((c) => c && c.length_m);

    const items = cars.map((car) => ({ car, ...buildCar(car) }));
    layout(root, items);

    // Chờ ảnh tải xong rồi mới chạy hiệu ứng (tối đa 2,5 giây)
    await Promise.race([
      Promise.all(items.map((it) => (it.img.decode ? it.img.decode().catch(() => {}) : null))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
    animateIn(items);

    // Cập nhật số xe trong dòng "Bản này so sánh N mẫu..."
    document.querySelectorAll('[data-car-count]').forEach((el) => (el.textContent = cars.length));

    let t;
    let lastW = root.getBoundingClientRect().width;
    const relayout = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const w = root.getBoundingClientRect().width;
        if (Math.abs(w - lastW) < 1) return;   // chỉ vẽ lại khi bề ngang thật sự đổi
        lastW = w;
        layout(root, items);
      }, 120);
    };
    window.addEventListener('resize', relayout);
    document.addEventListener('fullscreenchange', relayout);
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
