# Thông số xe VinFast — tra ngày 8/11/2026

Nguồn: trang đặt cọc từng mẫu trên vinfastauto.com (đường dẫn ở cuối file). Mỗi mẫu lấy phiên bản rẻ nhất, tức phiên bản đang được chọn sẵn trên trang. Ô nào trang không ghi thì để trống, không đoán.

## 7 xe trong PLAN.md

| Thông tin | VF 2 | VF 3 | VF 5 | VF 6 | VF 7 | VF 8 | VF 9 |
|---|---|---|---|---|---|---|---|
| Phiên bản lấy số | (trang không ghi tên phiên bản) | VF 3 Eco | (trang không ghi tên phiên bản) | VF 6 Eco | VF 7 Eco | VF 8 Eco | VF 9 Eco |
| Giá niêm yết từ (VNĐ) | 188.000.000 | 285.000.000 | 496.000.000 | 646.000.000 | 740.000.000 | 898.000.000 | 1.348.000.000 |
| Giá đã gồm pin? | Có* | Có* | Có* | Có* | Có* | Có* | Có* |
| Số chỗ ngồi | 4 | 4 | 5 | 5 | 5 | 5 | 7 |
| Quãng đường mỗi lần sạc (km) | 210 | 215 | 326 | 485 | 440 | 635 | 626 |
| Chuẩn đo | NEDC | NEDC | NEDC | NEDC | NEDC | NEDC | **WLTP** |
| Dung lượng pin khả dụng (kWh) | 18,3 | 18,64 (trang không ghi đơn vị) | 37,23 | 59,6 | 59,6 | 87,7 | 123 |
| Sạc nhanh DC 10→70% | 34 phút | 36 phút | 33 phút | 25 phút | | | 35 phút |
| Công suất sạc DC tối đa | ~24 kW | 24 kW | ~50 kW | 100 kW | 100 kW | 149 kW | |
| Chiều dài (mm) | 3.090 | 3.190 | 3.967 | 4.241 | 4.545 | 4.750 | (trang không ghi) |
| Phân khúc / nhãn trên web | Xe đô thị cỡ nhỏ | mini SUV | A-SUV | B-SUV | C-SUV | D-SUV | E-SUV |
| Bảo hành | 5 năm / 130.000 km | 7 năm / 160.000 km | 7 năm / 160.000 km | 7 năm / 160.000 km | 7 năm / 160.000 km | 10 năm / 200.000 km | 10 năm / 200.000 km |
| Ngày tra | 8/11/2026 | 8/11/2026 | 8/11/2026 | 8/11/2026 | 8/11/2026 | 8/11/2026 | 8/11/2026 |

\* VinFast dừng cho thuê pin ô tô điện từ 01/03/2025 (xem ghi chú).

## Đang cân nhắc: VF Wild (bán tải REEV)

Số liệu tra ngày 8/11/2026 trên trang VF Wild:

| Thông tin | VF Wild |
|---|---|
| Loại | Bán tải điện mở rộng phạm vi (REEV: pin + máy xăng phát điện) |
| Giá niêm yết từ (VNĐ) | 860.000.000 |
| Số chỗ ngồi | (trang không ghi) |
| Quãng đường thuần điện (NEDC) | "Trên 250 km/1 lần sạc" (không có số chính xác) |
| Quãng đường kết hợp xăng + điện | "Lên tới 1.000 km" |
| Pin | LFP 46,4 kWh |
| Sạc nhanh DC | (trang không ghi) |
| Chiều dài x rộng x cao (mm) | 5.376 x 2.069 x 1.873 |
| Thùng xe (mm) / tải trọng | 1.574 x 1.512 x 509 / 750 kg |
| Lưu ý của trang | Hình ảnh là của giai đoạn tiền thương mại; thông tin có thể thay đổi |

## Không làm trong MVP: VF MPV 7

| Thông tin | VF MPV 7 |
|---|---|
| Giá niêm yết từ (VNĐ) | 750.000.000 |
| Số chỗ ngồi | 7 |
| Quãng đường (NEDC) | 450 km |
| Pin khả dụng | 60,13 kWh |
| Sạc nhanh 10→70% | 30 phút (DC tối đa 80 kW) |
| Chiều dài (mm) | 4.740 |

## Ghi chú

- **Lưu ý khi so quãng đường:** VF 9 đo theo chuẩn WLTP, các xe còn lại đo theo NEDC. WLTP thường cho số thấp hơn NEDC, nên không so trực tiếp 626 km với 635 km của VF 8. `cars.json` phải có trường `range_standard`, và AI phải nhắc điều này khi so sánh.
- **Còn thiếu:**
  - chiều dài VF 9 (cần xem brochure);
  - thời gian sạc nhanh 10→70% của VF 7 và VF 8;
  - công suất sạc DC của VF 9;
- **Giá đã gồm pin?** Các trang xe không ghi. Trang "Dịch vụ pin ô tô điện" của VinFast cho biết từ ngày 01/03/2025 VinFast đã dừng cho thuê pin ô tô điện, tức xe mới hiện bán kèm pin. Trong `cars.json`, đặt `price_includes_battery: true` cho cả 7 xe, kèm ghi chú nguồn (vinfastauto.com/vn_vi/dich-vu-pin-oto-dien).
- **Giá xăng trên trang xe VinFast** (24.230 đ/lít, cập nhật 10/09/2026) đã cũ. Dùng giá Petrolimex ở mục dưới.

## Chính sách sạc & giá tham chiếu (tra ngày 8/11/2026)

- **Chính sách sạc:** khách cá nhân mua ô tô điện VinFast từ 10/02/2026 được miễn phí sạc tại trạm V-Green đến hết 10/02/2029, **tối đa 10 lần/tháng**. Từ tháng 9/2026, VF 3, VF 7, VF 8, VF 9, MPV 7 vẫn được 10 lần/tháng. Nguồn là báo chí (VnExpress 9/2/2026, Znews 9/2026). Trang vinfastauto.com chỉ ghi "Ưu đãi miễn phí sạc xe VinFast từ ngày 10/02/2026", không ghi chi tiết.
  - Trong app, để thành **công tắc bật/tắt**, mặc định tắt, kèm ghi chú "tối đa 10 lần/tháng, đến 10/02/2029, kiểm tra lại với VinFast".
- **Giá xăng (Petrolimex, hiệu lực từ 15h ngày 05/11/2026, vùng 1):**
  - E10 RON 95-III: **21.150 đ/lít** (vùng 2: 21.570)
  - E10 RON 95-V: 22.650 đ/lít
  - E5 RON 92-II: 20.890 đ/lít
  - Petrolimex hiện không còn bán xăng RON 95 thường, chỉ có E10 RON 95. Nguồn: petrolimex.com.vn, thông cáo số 61/2026/PLX-TCBC.
- **Giá sạc trạm công cộng VinFast/V-Green:** **3.858 đ/kWh**, đã gồm VAT, áp dụng từ 19/03/2024 theo trang vinfastauto.com/vn_vi/dich-vu-pin-oto-dien. Đây là số mới nhất trang còn ghi. Chưa tìm thấy bảng giá mới hơn trên trang V-Green.
- **Giá điện sinh hoạt tại nhà (EVN, từ 01/11/2026, Quyết định 2892/QĐ-BCT, chưa gồm VAT):**
  - Bậc 1: 0–100 kWh, 1.901 đ
  - Bậc 2: 101–200 kWh, 2.289 đ
  - Bậc 3: 201–400 kWh, 2.894 đ
  - Bậc 4: 401–700 kWh, 3.456 đ
  - Bậc 5: từ 701 kWh, 3.844 đ
  - Biểu giá mới chỉ còn 5 bậc, thay cho 6 bậc trước đây. Sạc xe ở nhà cộng thêm vào hoá đơn gia đình, nên thường rơi vào bậc 3. Mặc định cho máy tính chi phí: **2.894 đ/kWh** chưa VAT, khoảng **3.183 đ/kWh** đã gồm VAT 10%.
  - Nguồn: tin EVN ngày 04/11/2026 qua mekongasean.vn / sggp.org.vn. Trang evn.com.vn không mở được bảng giá trực tiếp.

## Đường dẫn nguồn

- vinfastauto.com/vn_vi/dat-coc-xe-vf2
- vinfastauto.com/vn_vi/dat-coc-xe-dien-vf3
- vinfastauto.com/vn_vi/dat-coc-xe-dien-vf5
- vinfastauto.com/vn_vi/dat-coc-xe-dien-vf6
- vinfastauto.com/vn_vi/dat-coc-xe-dien-vf7
- vinfastauto.com/vn_vi/dat-coc-xe-vf-mpv7
- vinfastauto.com/vn_vi/dat-coc-xe-vf8
- vinfastauto.com/vn_vi/dat-coc-xe-vf9
- vinfastauto.com/vn_vi/dat-coc-xe-vf-wild
- Brochure VF 9: storage.googleapis.com/vinfast-data-01/brochure/VF%209_%20Brochure.pdf
