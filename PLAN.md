# PLAN.md — VF Chọn Xe
Trợ lý AI giúp người mua xe điện lần đầu chọn đúng mẫu VinFast theo nhu cầu.

> Bản thiết kế cho AI lập trình. Mỗi phiên: đọc file này, chỉ làm đúng task được giao, không tự làm task khác. Không chạy lệnh git.

## 1. Mục tiêu & phạm vi

**Thành công khi:** app chạy trên điện thoại và máy tính; gợi ý hợp lý ≥ 27/30 tình huống test; 0 lần bịa thông số trong 25 câu hỏi kiểm tra.

**Làm (MVP):**
1. Bộ 6 câu hỏi nhu cầu → gợi ý 1–2 mẫu xe kèm lý do.
2. Dàn 7 xe (VF 2, VF 3, VF 5, VF 6, VF 7, VF 8, VF 9) theo tỉ lệ chiều dài thật.
3. Máy tính chi phí điện so với xăng theo tháng.
4. Ô hỏi đáp: AI chỉ trả lời từ dữ liệu.
5. Bộ test tự động + bảng kết quả.

**Không làm:** 3D, đăng nhập, bản đồ trạm sạc, đặt lịch lái thử, đa ngôn ngữ, các mẫu VF MPV 7 / VF 8 Thế hệ mới / VF Wild.

**Không ghi cứng số lượng hay tên xe trong code.** Mọi phần đọc danh sách từ `data/cars.json`.

## 2. Nguyên tắc quan trọng nhất

**Code quyết định chọn xe, AI chỉ giải thích.**
- Điểm phù hợp tính bằng quy tắc rõ ràng trong `scoring.js`, minh bạch, kiểm tra được.
- LLM chỉ nhận kết quả chấm điểm + dữ liệu xe, rồi viết lời giải thích tiếng Việt.
- Không bao giờ để LLM tự đưa ra con số không có trong dữ liệu.

## 3. Công nghệ

| Phần | Công cụ |
|---|---|
| Giao diện | HTML + CSS + JavaScript thuần + GSAP 3 (CDN) |
| AI trong app | Gemini Flash qua API key Google AI Studio, gọi qua `api/ask.js` |
| Server | 1 Vercel Function: `api/ask.js` |
| Deploy | Vercel nối GitHub |
| Dữ liệu | `data/cars.json`, `data/prices.json` |

⚠️ API key chỉ nằm trong Environment Variables của Vercel, **không bao giờ** đặt trong code phía trình duyệt.

## 4. Cấu trúc thư mục

```
vf-chon-xe/
├─ PLAN.md
├─ index.html
├─ style.css           # biến thiết kế trong :root
├─ hero-lineup.js      # dàn xe — KHÔNG SỬA nếu không được yêu cầu rõ
├─ hero-lineup.css     # dàn xe — KHÔNG SỬA nếu không được yêu cầu rõ
├─ app.js              # điều khiển giao diện, gọi /api/ask
├─ scoring.js          # quy tắc chấm điểm
├─ cost.js             # máy tính chi phí
├─ data/cars.json
├─ data/prices.json
├─ assets/cars/        # <id>.webp, nền trong suốt, cắt sát mũi–đuôi xe
├─ api/ask.js          # hàm server gọi LLM
├─ nguon/              # bằng chứng nguồn dữ liệu
├─ tests/scenarios.json       # 30 tình huống người mua
├─ tests/spec_questions.json  # 25 câu hỏi (7 bẫy)
├─ tests/run_eval.js          # chạy test, xuất results.md
└─ README.md
```

Dàn xe (`#lineup`) chỉ do `hero-lineup.js/.css` điều khiển. Không code nào khác được tác động lên `#lineup`.

## 5. Dữ liệu

**`data/cars.json`:** thông số tra trên vinfastauto.com ngày 8/11/2026. Mỗi xe có: id, name, version, segment, price_vnd_from, price_includes_battery, seats, range_km, range_standard, battery_kwh, dc_10_70_min, dc_max_kw, length_m, warranty, best_for [], not_ideal_for [], image.
- Ô thiếu số là `null` → app hiển thị "chưa có dữ liệu", không đoán.
- ⚠️ VF 9 đo quãng đường theo **WLTP**, các xe khác theo **NEDC**. Không so trực tiếp quãng đường hai xe khác chuẩn đo mà không nêu khác biệt.

**`data/prices.json`:** giá xăng E10 RON 95-III (mặc định), giá sạc trạm V-Green, giá điện nhà EVN (mặc định bậc 3 đã VAT), chính sách miễn phí sạc (mặc định tắt). Mỗi giá có ngày hiệu lực và nguồn.

## 6. Bộ câu hỏi & quy tắc chấm điểm

| # | Câu hỏi | Lựa chọn → trường dữ liệu |
|---|---|---|
| 1 | Thường đi mấy người? | 1–2 / 3–4 / 5 / 6–7 → `people` |
| 2 | Ngân sách tối đa? | các mức giá theo dữ liệu thật → `budget_max_vnd` (số) |
| 3 | Mỗi ngày đi khoảng bao xa? | **thanh kéo 5–400 km** → `daily_km` (số) |
| 4 | Bao lâu đi tỉnh xa (>200 km) một lần? | hiếm / hàng tháng / hàng tuần → `long_trip` ("hiem","hang_thang","hang_tuan") |
| 5 | Có chỗ sạc ở nhà không? | có / không → `home_charging` (true/false) |
| 6 | Ưu tiên nhất? | dễ đỗ / rộng rãi / tiết kiệm / cảm giác lái → `priority` ("de_do","rong_rai","tiet_kiem","cam_giac_lai") |

**`scoring.js`:**
- **Loại cứng:**
  - xe không đủ chỗ ngồi;
  - xe đắt hơn ngân sách quá 10%;
  - xe có `range_km` < `daily_km` (không chạy hết một ngày nếu không sạc giữa chừng).
- **Loại hết xe** → trả về danh sách rỗng kèm lý do; app nói thẳng "không có xe phù hợp" và gợi ý điều chỉnh (tăng ngân sách, giảm số chỗ…).
- **Cộng điểm:**
  - `range_km` ≥ 3 × `daily_km`;
  - đi tỉnh nhiều → ưu tiên xe có quãng đường dài;
  - khớp ưu tiên ở câu 6;
  - không có chỗ sạc ở nhà → ưu tiên xe sạc nhanh DC.
- **Đầu ra:** top 2 xe + danh sách lý do dạng mã, ví dụ `["du_cho","trong_ngan_sach","range_du_x3"]`, gửi cho LLM diễn giải.

## 7. Máy tính chi phí (`cost.js`)

```
Điện/tháng = km_tháng × kWh_100km / 100 × giá_điện_mỗi_kWh
Xăng/tháng = km_tháng × lít_100km / 100 × giá_xăng_mỗi_lít
```
- Giá điện, giá xăng, mức tiêu thụ xe xăng tham chiếu là **ô nhập**, mặc định lấy từ `prices.json`, kèm ghi chú "kiểm tra lại giá hiện hành".
- Miễn phí sạc: công tắc bật/tắt, mặc định tắt, kèm ghi chú nguồn.

## 8. Prompt cho LLM (`api/ask.js`)

**Chế độ 1: giải thích gợi ý**
```
Bạn là tư vấn viên xe điện trung lập, nói tiếng Việt thân thiện, ngắn gọn.
Chỉ dùng dữ liệu trong <data> và kết quả chấm điểm trong <result>.
Tuyệt đối không đưa ra con số không có trong <data>. Nếu thiếu, nói "chưa có dữ liệu".
Khi nêu quãng đường, luôn ghi kèm chuẩn đo (NEDC/WLTP); không so trực tiếp hai xe khác chuẩn đo.
Viết 3–5 câu: vì sao xe này hợp nhu cầu, 1 điểm cần lưu ý, gợi ý bước tiếp theo (lái thử, kiểm tra giá mới nhất).
<data>{cars.json}</data>
<result>{kết quả scoring}</result>
<user_needs>{câu trả lời 6 câu hỏi}</user_needs>
```

**Chế độ 2: hỏi đáp**
```
Chỉ trả lời dựa trên <data>. Nếu câu hỏi nằm ngoài dữ liệu, nói rõ không có thông tin
và gợi ý kiểm tra tại vinfastauto.com hoặc showroom. Không bịa số liệu, không hứa hẹn khuyến mãi.
Câu hỏi về mẫu xe không có trong <data> (VF MPV 7, VF Wild...): nói app chưa có dữ liệu mẫu này.
```

## 9. Bộ test

- **`tests/scenarios.json`:** 30 tình huống, mỗi tình huống có `answers` (đúng các trường ở mục 6, `daily_km` là số) và `acceptable` (danh sách id xe hợp lý, hoặc `["none"]`). App đạt khi gợi ý trúng ít nhất 1 xe trong `acceptable`; với `["none"]` thì app phải trả về "không có xe phù hợp".
- **`tests/spec_questions.json`:** 25 câu (18 thường + 7 bẫy). Câu có `must_mention` thì câu trả lời phải chứa đủ các từ đó.
- **`tests/run_eval.js`:** chạy toàn bộ test, xuất `results.md`: tỉ lệ đúng, danh sách sai kèm lý do, số lần bịa số. Có khoảng nghỉ giữa các lần gọi API để không vượt giới hạn gói miễn phí.

## 10. Giao diện

- **Biến thiết kế** (trong `:root` của `style.css`): nền `--bg-0` #05070D / `--bg-1` #0B1330, `--blue` #1464F4, `--red` #EE3D43 (chỉ chi tiết nhỏ), `--green` #2DBE78 (phần chi phí điện), `--text` #FFF, `--text-dim` #9AA3B5. CSS mới phải dùng biến, không viết mã màu trực tiếp.
- **Font:** Mulish. **Phong cách:** khối cắt vát chữ V, chuyển cảnh GSAP nhẹ (`expo.out`), tôn trọng `prefers-reduced-motion`, ưu tiên điện thoại.
- **Thứ tự trang:** Hero (dàn xe + nút "Tìm xe hợp với tôi") → Bộ câu hỏi (mỗi câu một màn) → Kết quả (xe gợi ý, lời giải thích AI, so sánh 2 xe) → Máy tính chi phí → Hỏi đáp.
- **Chân trang bắt buộc:** *"Dự án cá nhân, phi thương mại, không phải trang chính thức của VinFast. Bản này so sánh 7 mẫu ô tô điện VinFast. Thông số lấy từ vinfastauto.com ngày 8/11/2026, vui lòng kiểm tra lại trước khi mua."*
- **Không dùng logo VinFast** làm logo app.
