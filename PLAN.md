# PLAN.md — VF Chọn Xe
Trợ lý AI giúp người mua lần đầu chọn đúng mẫu xe điện VinFast

> File này là "bản đồ" cho Claude Code / Antigravity. Mỗi phiên làm việc: mở file này, làm đúng 1 task, xong thì tick ✅ và mở phiên mới.

---

## 0. Bối cảnh & mục tiêu

- **Mục đích:** dự án chủ lực nộp hồ sơ chương trình AI Thực Chiến (VinUni).
- **Hạn nộp Đợt 1:** 23:59 ngày 19/11/2026. Thi dự kiến 28–29/11. Sau ngày 19/11 dành thời gian ôn thi.
- **Thời gian làm:** 3–4 giờ/ngày, từ 6/11 đến 19/11.
- **Vấn đề cần giải:** người mua xe điện lần đầu không biết mẫu nào hợp nhu cầu, lo pin không đủ đi xa và chưa rõ chi phí sạc so với xăng. Thông tin hiện nằm rải rác.
- **Định nghĩa thành công:**
  1. Có link app chạy được trên điện thoại và máy tính.
  2. Gợi ý hợp lý ≥ 27/30 tình huống test.
  3. **0 lần bịa thông số** trong 25 câu hỏi kiểm tra (gồm 7 câu bẫy).
  4. Có README case study, kèm video demo 60–90 giây.

## 1. Phạm vi

**Làm (MVP):**
1. Bộ 6 câu hỏi nhu cầu → gợi ý 1–2 mẫu xe kèm lý do.
2. Dàn 7 xe (VF 2, VF 3, VF 5, VF 6, VF 7, VF 8, VF 9) hiển thị theo tỉ lệ chiều dài thật.
   - **Không ghi cứng số lượng xe trong code.** Mọi phần (dàn xe, chấm điểm, hỏi đáp) đọc danh sách từ `cars.json`; thêm xe = thêm dữ liệu + ảnh, không sửa code.
3. Máy tính chi phí điện và xăng theo tháng, cho phép chỉnh giá.
4. Ô hỏi đáp: AI chỉ trả lời dựa trên file dữ liệu.
5. Bộ test tự động và bảng kết quả.

**Không làm (để dành sau):** 3D/Blender, đăng nhập, bản đồ trạm sạc, đặt lịch lái thử, đa ngôn ngữ.

**Quyết định 8/11 — 7 xe (6 xe ban đầu + VF 2).** Trang VinFast hiện bán 10 mẫu ô tô: VF 2, VF 3, VF 5, VF 6, VF 7, VF MPV 7, VF 8, VF 8 Thế hệ mới, VF 9 và VF Wild (bán tải). MVP làm 7 xe ở trên. VF MPV 7, VF 8 Thế hệ mới và VF Wild ghi vào mục "Giới hạn & bước tiếp theo" của README. Trong app (phần giới thiệu hoặc chân trang) cần nói rõ: *"Bản này so sánh 7 mẫu ô tô điện VinFast."* VF Wild: đang cân nhắc (xem `THONG-SO-XE-2026-11-08.md`).

## 2. Nguyên tắc thiết kế quan trọng nhất

**Logic chọn xe do code quyết định, AI chỉ giải thích.**

- Điểm phù hợp của từng xe được tính bằng quy tắc rõ ràng trong `scoring.js`. Kết quả minh bạch và kiểm tra được.
- AI (LLM) chỉ nhận đầu vào là kết quả chấm điểm và dữ liệu xe, rồi viết lời giải thích bằng tiếng Việt dễ hiểu.
- Cách làm này giúp AI không bịa thông số. Đây cũng là điểm nên kể trong case study ("tại sao tôi không để AI tự chọn xe").

**Khác biệt so với "VinFast AI" trên web chính hãng:** vinfastauto.com đã có chatbot tư vấn. Case study cần chủ động nêu điểm khác: logic chọn xe minh bạch, có bộ test đo số lần bịa, có máy tính chi phí điện so với xăng, và là góc nhìn trung lập. Câu chốt: *"VinFast đã có chatbot; tôi làm một trợ lý mà độ chính xác đo được."*

## 3. Công nghệ (chọn cái đơn giản nhất)

| Phần | Công cụ | Lý do |
|---|---|---|
| Giao diện | HTML + CSS + JavaScript thuần + GSAP | Bạn đã dùng trong video "Chạm Tương Lai" |
| AI trong app | Gemini Flash / Flash-Lite qua API key **miễn phí của Google AI Studio** (gói Google AI Pro không kèm hạn mức API) | Việc nhẹ (viết 3–5 câu), model nhỏ là đủ, gọi qua 1 hàm server để giấu API key |
| Server | 1 file Vercel Function: `api/ask.js` | Không cần dựng backend riêng |
| Deploy | Vercel nối GitHub | Push code lên là có link |
| Dữ liệu | `data/cars.json` | Một nguồn sự thật duy nhất |

⚠️ **Không bao giờ** đặt API key trong file HTML/JS phía trình duyệt. Key chỉ để trong Environment Variables của Vercel.

## 4. Cấu trúc thư mục

```
vf-chon-xe/
├─ PLAN.md
├─ index.html          # 1 trang, cuộn qua các phần
├─ style.css
├─ app.js              # điều khiển giao diện, gọi /api/ask
├─ scoring.js          # quy tắc chấm điểm xe
├─ cost.js             # máy tính chi phí
├─ data/cars.json
├─ assets/cars/        # ảnh xe tách nền (PNG) — tái dùng từ video
├─ api/ask.js          # hàm server gọi LLM
├─ tests/scenarios.json       # 30 tình huống người mua
├─ tests/spec_questions.json  # 25 câu hỏi thông số (7 câu bẫy)
├─ tests/run_eval.js          # chạy test, xuất results.md
└─ README.md           # case study
```

## 5. Dữ liệu: `data/cars.json`

**Lấy số liệu từ vinfastauto.com.** Không lấy số do AI nhớ, và ghi lại ngày lấy. Bảng số đã tra ngày 8/11/2026 nằm trong file `THONG-SO-XE-2026-11-08.md`.

```json
{
  "updated": "2026-11-08",
  "source": "https://vinfastauto.com (truy cập ngày 8/11/2026)",
  "cars": [
    {
      "id": "vf3",
      "name": "VF 3",
      "version": "VF 3 Eco",
      "segment": "mini SUV",
      "length_m": 3.19,
      "seats": 4,
      "price_vnd_from": 285000000,
      "price_includes_battery": null,
      "range_km": 215,
      "range_standard": "NEDC",
      "battery_kwh": 18.64,
      "dc_charge_note": "10–70% trong 36 phút",
      "kwh_per_100km": null,
      "best_for": ["đi phố", "đỗ xe chật", "người mới lái"],
      "not_ideal_for": ["đi tỉnh xa thường xuyên", "gia đình 5 người"],
      "image": "assets/cars/vf3.png"
    }
  ]
}
```

- **Chiều dài chính xác (mm):** VF 2 3.090 · VF 3 3.190 · VF 5 3.967 · VF 6 4.241 · VF 7 4.545 · VF 8 4.750 · VF 9 5.119 (theo brochure VF 9).
- Ô nào chưa tìm được số thì để `null`. App phải hiển thị "chưa có dữ liệu", không được đoán.
- ⚠️ **Chuẩn đo quãng đường khác nhau:** VF 9 đo theo WLTP, các xe còn lại đo theo NEDC. Code và AI **không được so trực tiếp** quãng đường VF 9 với xe khác mà không nêu khác biệt chuẩn đo.

## 6. Bộ câu hỏi & quy tắc chấm điểm

| # | Câu hỏi | Lựa chọn |
|---|---|---|
| 1 | Thường đi mấy người? | 1–2 / 3–4 / 5 / 6–7 |
| 2 | Ngân sách? | các khoảng giá (lấy theo dữ liệu thật) |
| 3 | Mỗi ngày đi khoảng bao xa? | <30 / 30–80 / >80 km |
| 4 | Bao lâu đi tỉnh xa (>200 km) một lần? | hiếm / hàng tháng / hàng tuần |
| 5 | Có chỗ sạc ở nhà không? | có / không |
| 6 | Ưu tiên nhất? | dễ đỗ / rộng rãi / tiết kiệm / cảm giác lái |

**Quy tắc (`scoring.js`):**
- **Loại cứng:** loại xe không đủ chỗ ngồi; loại xe vượt ngân sách quá 10%.
- **Cộng điểm:**
  - quãng đường xe chạy được ≥ 3 × quãng đường đi mỗi ngày;
  - đi tỉnh nhiều thì ưu tiên xe có quãng đường dài;
  - xe khớp với lựa chọn ưu tiên ở câu 6;
  - không có chỗ sạc ở nhà thì ưu tiên xe sạc nhanh DC.
- **Đầu ra:** top 2 xe, kèm danh sách lý do dạng mã, ví dụ `["du_cho", "trong_ngan_sach", "range_du_x3"]`. Danh sách này được gửi cho AI để diễn giải.

## 7. Máy tính chi phí (`cost.js`)

```
Điện/tháng = km_tháng × kWh_100km / 100 × giá_điện_mỗi_kWh
Xăng/tháng = km_tháng × lít_100km / 100 × giá_xăng_mỗi_lít
```

- Giá điện, giá xăng và mức tiêu thụ xe xăng tham chiếu để thành **ô nhập**, có giá trị mặc định kèm ghi chú "kiểm tra lại giá hiện hành".
- Không tự khẳng định chính sách sạc miễn phí. Nếu có, để người dùng tự bật tắt.

## 8. Prompt cho AI (`api/ask.js`)

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

## 9. Bộ test (bằng chứng "thực chiến")

- **`tests/scenarios.json`:** 30 tình huống như *"Vợ chồng + 2 con nhỏ, đi làm 25 km/ngày, về quê 150 km mỗi tháng, chung cư không sạc được"*. Mỗi tình huống ghi kèm các mẫu xe bạn cho là hợp lý.
  - **Nguồn ý tưởng:** đọc các câu hỏi phổ biến trên group/forum, chỉ đọc chứ không cần liên hệ ai.
- **`tests/spec_questions.json`:** 18 câu hỏi có đáp án nằm trong dữ liệu, kèm 7 câu "bẫy" có đáp án không có trong dữ liệu, để kiểm tra AI có dám nói "không biết".
  - Gợi ý câu bẫy: *"VF 8 hay VF 9 đi xa hơn?"* (khác chuẩn đo NEDC/WLTP) và *"VF MPV 7 giá bao nhiêu?"* (mẫu không có trong dữ liệu).
- **`tests/run_eval.js`:** chạy toàn bộ test và xuất `results.md` gồm: tỉ lệ đúng, các trường hợp sai, số lần bịa số.
- **Ghi lại từng vòng sửa**, ví dụ "Vòng 1: 22/30, bịa 3 lần → sửa prompt + thêm luật → Vòng 2: 28/30, bịa 0". Đây là phần giá trị nhất của case study.

## 10. Giao diện (giữ ngôn ngữ thiết kế của video)

- **Màu:** nền #05070D / #0B1330, xanh #1464F4, đỏ nhấn #EE3D43, xanh lá #2DBE78 cho phần chi phí điện.
- **Font:** Mulish.
- **Bố cục:** các khối cắt vát chữ V, chuyển cảnh GSAP nhẹ, ưu tiên hiển thị tốt trên điện thoại.
- **Thứ tự trang:**
  1. Hero: dàn 7 xe theo tỉ lệ thật + nút "Tìm xe hợp với tôi".
  2. Bộ câu hỏi, mỗi câu một màn.
  3. Kết quả: xe gợi ý, lời giải thích của AI, so sánh 2 xe.
  4. Máy tính chi phí.
  5. Hỏi đáp.
- **Chân trang bắt buộc:** *"Dự án cá nhân, phi thương mại, không phải trang chính thức của VinFast. Bản này so sánh 7 mẫu ô tô điện VinFast. Thông số lấy từ vinfastauto.com ngày 8/11/2026, vui lòng kiểm tra lại trước khi mua."*
- **Logo:** không dùng logo VinFast làm logo của app. App có tên và biểu tượng riêng.

## 11. Lịch làm việc + câu lệnh mẫu cho AI

*(Lịch đã dời: bắt đầu 6/11. Mỗi ngày có file hướng dẫn copy-paste riêng.)*

| Ngày | Task | Ai viết | Ai review |
|---|---|---|---|
| 6/11 | ☐ Tạo repo GitHub + Vercel, khung thư mục, có link web đầu tiên | Antigravity | — |
| 7/11 | ☐ Điền `cars.json` (số đã tra 8/11), viết 30 + 25 câu test | **Bạn** + Antigravity (định dạng) | Bạn |
| 8/11 | ☐ Hero + dàn xe tỉ lệ thật | Antigravity | Bạn (mắt designer) |
| 9/11 | ☐ Bộ 6 câu hỏi | Antigravity | Bạn |
| 10/11 | ☐ `scoring.js` | Antigravity (Gemini Pro) | **Claude Code** |
| 11/11 | ☐ `api/ask.js` + API key trên Vercel | Antigravity (Gemini Pro) | **Claude Code** (bảo mật key) |
| 12/11 | ☐ Trang kết quả + so sánh 2 xe | Antigravity | Bạn |
| 13/11 | ☐ Máy tính chi phí + hỏi đáp | Antigravity | Claude Code (chỉ khi kẹt) |
| 14/11 | ☐ `run_eval.js`, chạy vòng 1 | Antigravity | **Claude Code** |
| 15/11 | ☐ Sửa lỗi, chạy vòng 2–3, kiểm tra trên điện thoại | Antigravity + Claude Code | Bạn |
| 16/11 | ☐ README case study | **Claude (Project)** | Bạn |
| 17/11 | ☐ Video demo 60–90s + viết lại case study "Chạm Tương Lai" | **Bạn** + Claude (chữ) | Bạn |
| 18/11 | ☐ Dự phòng + đoạn mô tả cho form | Claude (Project) | Bạn |
| 19/11 | ☐ **Nộp** trước 23:59 (nên nộp trước 20:00) | | |

Prompt chi tiết của từng ngày nằm trong các file `HUONG-DAN-NGAY-x.md`.

## 12. Khung README case study (dùng cho cả 2 dự án)

1. **Vấn đề:** ai gặp, gặp lúc nào, tại sao khó.
2. **Giải pháp:** 1 câu mô tả + ảnh chụp màn hình + link demo.
3. **Vì sao dùng AI như vậy:** code chọn xe, AI giải thích, để chống bịa. Nêu khác biệt so với chatbot "VinFast AI" trên web chính hãng: độ chính xác đo được.
4. **Kết quả đo được:** bảng các vòng test.
5. **Quy trình & công cụ:** Antigravity (Gemini) viết, Claude Code review chéo; Gemini Flash chạy trong app (model nhỏ, chi phí 0); Vercel, GSAP.
6. **Giới hạn & bước tiếp theo:** mới có 7/10 mẫu (chưa có VF MPV 7, VF 8 Thế hệ mới, VF Wild); dữ liệu tự cập nhật; bản đồ trạm sạc; thử với người dùng thật.

**Mẫu đoạn mô tả cho form (~100 từ):**
> "VF Chọn Xe là web app giúp người mua xe điện lần đầu chọn đúng mẫu VinFast theo nhu cầu thực tế. Tôi tách logic chọn xe bằng quy tắc minh bạch, chỉ dùng LLM để giải thích bằng tiếng Việt và giới hạn AI chỉ trả lời từ dữ liệu thông số chính hãng. Qua 3 vòng kiểm thử với 30 tình huống và 25 câu hỏi, độ hợp lý đạt __/30 và số lần bịa thông số giảm từ __ xuống 0. Tôi tự thiết kế giao diện và phát triển bằng Claude Code/Antigravity. Demo: [link] · Code: [GitHub]"

## 13. Công cụ AI & quy tắc tiết kiệm hạn mức

**Gói đang có:** Google AI Pro (Antigravity) + Claude Pro (Claude Code + chat Claude).

| Công cụ | Vai trò | Tỉ lệ việc |
|---|---|---|
| **Antigravity** (Gemini; Flash cho việc nhanh, Pro cho logic) | Người viết chính: giao diện, logic bản đầu | ~70% |
| **Claude Code** (Sonnet mặc định) | Người review: đọc code quan trọng, sửa lỗi khó | ~20% |
| **Claude chat trong Project** | Kế hoạch, hướng dẫn từng ngày, README, mô tả nộp form | ~10% |

**Quy trình "AI viết – AI khác soát" (ngày 10, 11, 14/11):**
1. Antigravity viết code theo prompt trong file hướng dẫn.
2. Claude Code review: `Review file <tên file> theo PLAN.md mục <số>. Chỉ ra lỗi logic và trường hợp bị bỏ sót, chưa sửa vội.`
3. Bạn quyết định sửa theo góp ý nào, rồi nhờ Antigravity (hoặc Claude Code) sửa.
→ Ghi vào case study: "dùng hai model khác hãng kiểm tra chéo".

**Tiết kiệm hạn mức:**
- ⚠️ Chat Claude và Claude Code **dùng chung hạn mức Claude Pro**. Hôm nào cần Claude Code thì chat ngắn.
- Làm phần nặng ở Antigravity trước, để Claude cho cuối buổi.
- Mỗi phiên chỉ làm 1 task, xong thì `/clear` hoặc mở phiên mới.
- Bắt đầu phiên bằng câu "Đọc PLAN.md, làm task ngày X". Không giải thích lại từ đầu.
- Antigravity sửa 2–3 lần vẫn lỗi thì chuyển sang Claude Code, đừng lặp mãi.
- Không dán file lớn hay video vào chat. Lỗi thì chụp màn hình hoặc copy đúng dòng báo lỗi.
- Không dùng Blender MCP trong dự án này.
