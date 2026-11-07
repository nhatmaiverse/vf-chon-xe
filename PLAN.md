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
  3. **0 lần bịa thông số** trong 20 câu hỏi kiểm tra.
  4. Có README case study, kèm video demo 60–90 giây.

## 1. Phạm vi

**Làm (MVP):**
1. Bộ 6 câu hỏi nhu cầu → gợi ý 1–2 mẫu xe kèm lý do.
2. Dàn 6 xe (VF 3, VF 5, VF 6, VF 7, VF 8, VF 9) hiển thị theo tỉ lệ chiều dài thật.
3. Máy tính chi phí điện và xăng theo tháng, cho phép chỉnh giá.
4. Ô hỏi đáp: AI chỉ trả lời dựa trên file dữ liệu.
5. Bộ test tự động và bảng kết quả.

**Không làm (để dành sau):** 3D/Blender, đăng nhập, bản đồ trạm sạc, đặt lịch lái thử, đa ngôn ngữ.

## 2. Nguyên tắc thiết kế quan trọng nhất

**Logic chọn xe do code quyết định, AI chỉ giải thích.**

- Điểm phù hợp của từng xe được tính bằng quy tắc rõ ràng trong `scoring.js`. Kết quả minh bạch và kiểm tra được.
- AI (LLM) chỉ nhận đầu vào là kết quả chấm điểm và dữ liệu xe, rồi viết lời giải thích bằng tiếng Việt dễ hiểu.
- Cách làm này giúp AI không bịa thông số. Đây cũng là điểm nên kể trong case study ("tại sao tôi không để AI tự chọn xe").

## 3. Công nghệ (chọn cái đơn giản nhất)

| Phần | Công cụ | Lý do |
|---|---|---|
| Giao diện | HTML + CSS + JavaScript thuần + GSAP | Bạn đã dùng trong video "Chạm Tương Lai" |
| AI | Gemini API (gói miễn phí) hoặc Claude API | Gọi qua 1 hàm server để giấu API key |
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
├─ tests/spec_questions.json  # 20 câu hỏi thông số
├─ tests/run_eval.js          # chạy test, xuất results.md
└─ README.md           # case study
```

## 5. Dữ liệu: `data/cars.json`

**Tự lấy số liệu từ vinfastauto.com.** Không lấy số do AI nhớ, và ghi lại ngày lấy.

```json
{
  "updated": "2026-11-07",
  "source": "https://vinfastauto.com (truy cập ngày ...)",
  "cars": [
    {
      "id": "vf3",
      "name": "VF 3",
      "segment": "mini SUV",
      "length_m": 3.19,
      "seats": 4,
      "price_vnd_from": null,
      "range_km": null,
      "battery_kwh": null,
      "dc_fast_charge": null,
      "kwh_per_100km": null,
      "best_for": ["đi phố", "đỗ xe chật", "người mới lái"],
      "not_ideal_for": ["đi tỉnh xa thường xuyên", "gia đình 5 người"],
      "image": "assets/cars/vf3.png"
    }
  ]
}
```

- Chiều dài đã có sẵn trong tài liệu video: VF 3 3.19 m, VF 5 3.97 m, VF 6 4.24 m, VF 7 4.55 m, VF 8 4.75 m, VF 9 5.12 m.
- Ô nào chưa tìm được số thì để `null`. App phải hiển thị "chưa có dữ liệu", không được đoán.

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
Viết 3–5 câu: vì sao xe này hợp nhu cầu, 1 điểm cần lưu ý, gợi ý bước tiếp theo (lái thử, kiểm tra giá mới nhất).
<data>{cars.json}</data>
<result>{kết quả scoring}</result>
<user_needs>{câu trả lời 6 câu hỏi}</user_needs>
```

**Chế độ 2: hỏi đáp**
```
Chỉ trả lời dựa trên <data>. Nếu câu hỏi nằm ngoài dữ liệu, nói rõ không có thông tin
và gợi ý kiểm tra tại vinfastauto.com hoặc showroom. Không bịa số liệu, không hứa hẹn khuyến mãi.
```

## 9. Bộ test (bằng chứng "thực chiến")

- **`tests/scenarios.json`:** 30 tình huống như *"Vợ chồng + 2 con nhỏ, đi làm 25 km/ngày, về quê 150 km mỗi tháng, chung cư không sạc được"*. Mỗi tình huống ghi kèm các mẫu xe bạn cho là hợp lý.
  - **Nguồn ý tưởng:** đọc các câu hỏi phổ biến trên group/forum, chỉ đọc chứ không cần liên hệ ai.
- **`tests/spec_questions.json`:** 20 câu hỏi có đáp án nằm trong dữ liệu, kèm 5 câu "bẫy" có đáp án không có trong dữ liệu, để kiểm tra AI có dám nói "không biết".
- **`tests/run_eval.js`:** chạy toàn bộ test và xuất `results.md` gồm: tỉ lệ đúng, các trường hợp sai, số lần bịa số.
- **Ghi lại từng vòng sửa**, ví dụ "Vòng 1: 22/30, bịa 3 lần → sửa prompt + thêm luật → Vòng 2: 28/30, bịa 0". Đây là phần giá trị nhất của case study.

## 10. Giao diện (giữ ngôn ngữ thiết kế của video)

- **Màu:** nền #05070D / #0B1330, xanh #1464F4, đỏ nhấn #EE3D43, xanh lá #2DBE78 cho phần chi phí điện.
- **Font:** Mulish.
- **Bố cục:** các khối cắt vát chữ V, chuyển cảnh GSAP nhẹ, ưu tiên hiển thị tốt trên điện thoại.
- **Thứ tự trang:**
  1. Hero: dàn 6 xe theo tỉ lệ thật + nút "Tìm xe hợp với tôi".
  2. Bộ câu hỏi, mỗi câu một màn.
  3. Kết quả: xe gợi ý, lời giải thích của AI, so sánh 2 xe.
  4. Máy tính chi phí.
  5. Hỏi đáp.
- **Chân trang bắt buộc:** *"Dự án cá nhân, phi thương mại, không phải trang chính thức của VinFast. Thông số lấy từ vinfastauto.com ngày …, vui lòng kiểm tra lại trước khi mua."*
- **Logo:** không dùng logo VinFast làm logo của app. App có tên và biểu tượng riêng.

## 11. Lịch làm việc + câu lệnh mẫu cho AI

*(Lịch đã dời: bắt đầu 6/11. Mỗi ngày có file hướng dẫn copy-paste riêng.)*

| Ngày | Task | Câu mở đầu gợi ý cho Claude Code / Antigravity |
|---|---|---|
| 6/11 | ✅ Tạo repo GitHub + Vercel, khung thư mục, có link web đầu tiên | Xem file HUONG-DAN-NGAY-1.md |
| 7/11 | ☐ Điền `cars.json` (tự tra), viết 30 + 25 câu test | (tự làm, có thể nhờ Claude rà định dạng JSON) |
| 8/11 | ☐ Hero + dàn xe tỉ lệ thật | "Làm mục 10.1: dàn 6 xe theo `length_m` trong cars.json, đúng màu và font mục 10." |
| 9/11 | ☐ Bộ 6 câu hỏi | "Làm bộ câu hỏi mục 6, mỗi câu một màn, lưu đáp án vào một object." |
| 10/11 | ☐ `scoring.js` | "Viết scoring.js đúng quy tắc mục 6, kèm 3 ví dụ chạy thử in ra console." |
| 11/11 | ☐ `api/ask.js` chế độ 1 | "Viết api/ask.js gọi Gemini với prompt mục 8, key đọc từ biến môi trường." |
| 12/11 | ☐ Trang kết quả + so sánh 2 xe | "Hiển thị top 2 từ scoring và lời giải thích từ /api/ask." |
| 13/11 | ☐ Máy tính chi phí + hỏi đáp | "Làm cost.js theo mục 7 và ô hỏi đáp chế độ 2." |
| 14/11 | ☐ `run_eval.js`, chạy vòng 1 | "Viết tests/run_eval.js theo mục 9, xuất results.md." |
| 15/11 | ☐ Sửa lỗi, chạy vòng 2–3, kiểm tra trên điện thoại | Dán phần sai từ results.md, nhờ sửa luật hoặc prompt |
| 16/11 | ☐ README case study | Nhờ Claude viết từ các ghi chép của bạn |
| 17/11 | ☐ Video demo 60–90s + viết lại case study "Chạm Tương Lai" | Bỏ lời chào và link nhóm Zalo, viết theo khung mục 12 |
| 18/11 | ☐ Dự phòng + đoạn mô tả cho form | |
| 19/11 | ☐ **Nộp** trước 23:59 (nên nộp trước 20:00) | |

## 12. Khung README case study (dùng cho cả 2 dự án)

1. **Vấn đề:** ai gặp, gặp lúc nào, tại sao khó.
2. **Giải pháp:** 1 câu mô tả + ảnh chụp màn hình + link demo.
3. **Vì sao dùng AI như vậy:** code chọn xe, AI giải thích, để chống bịa.
4. **Kết quả đo được:** bảng các vòng test.
5. **Quy trình & công cụ:** Claude Code, Antigravity, Gemini API, Vercel, GSAP.
6. **Giới hạn & bước tiếp theo:** dữ liệu tự cập nhật, bản đồ trạm sạc, thử với người dùng thật.

**Mẫu đoạn mô tả cho form (~100 từ):**
> "VF Chọn Xe là web app giúp người mua xe điện lần đầu chọn đúng mẫu VinFast theo nhu cầu thực tế. Tôi tách logic chọn xe bằng quy tắc minh bạch, chỉ dùng LLM để giải thích bằng tiếng Việt và giới hạn AI chỉ trả lời từ dữ liệu thông số chính hãng. Qua 3 vòng kiểm thử với 30 tình huống và 25 câu hỏi, độ hợp lý đạt __/30 và số lần bịa thông số giảm từ __ xuống 0. Tôi tự thiết kế giao diện và phát triển bằng Claude Code/Antigravity. Demo: [link] · Code: [GitHub]"

## 13. Quy tắc tiết kiệm token

- Mỗi phiên chỉ làm 1 task trong mục 11. Xong thì `/clear` hoặc mở phiên mới.
- Bắt đầu phiên bằng câu "Đọc PLAN.md, làm task ngày X". Không giải thích lại từ đầu.
- Dùng Antigravity cho việc chỉnh giao diện lặp lại; dùng Claude cho logic, lỗi khó và phần viết.
- Không dán file lớn hay video vào chat. Lỗi thì chụp màn hình hoặc copy đúng dòng báo lỗi.
- Không dùng Blender MCP trong dự án này.
