# TASKS — POI-DSS (Philadelphia POI Recommendation)

## Đã chốt, không làm lại
- Dataset, thuật toán, trọng số hybrid mặc định (0.4/0.3/0.3): giữ nguyên.
- Ablation study (Hybrid NDCG@10 = 0.0065, thua CF-only 0.0105, -38%): **chấp nhận kết quả**, không tune lại. Báo cáo trung thực kèm phân tích nguyên nhân (Geo/Category profile suy ra từ lịch sử trung bình, nhiễu hơn tín hiệu CF trực tiếp).
- Frontend build lên trên backend + artifact hiện có, không sửa scoring/eval.

## Tấn — Data & Scoring (đã xong, giai đoạn tới chỉ hỗ trợ)
- [x] Data pipeline lọc Philadelphia
- [x] Scoring engine (CF/Geo/Category) + artifacts (parquet, cf_model.pkl)
- [ ] Xuất danh sách ~20 `user_id` mẫu (user có nhiều review trong `users_city.parquet`) cho Phúc làm dropdown demo — không có `user_id` thật thì CF chỉ còn là điểm trung bình business, demo mất phần collaborative filtering
- [ ] Xuất danh sách category phổ biến nhất (top ~30) cho Phúc làm bộ lọc category
- [ ] Viết phần "Data & Scoring Methodology" cho báo cáo (~1 trang): pipeline, công thức CF/Geo/Category, lý do chọn Yelp

## Phong — Backend & Evaluation
- [x] FastAPI `/recommend`, `/whatif`, `/explain`
- [x] Evaluation + ablation study thật (25,775 user) — CHỐT, không chạy lại
- [ ] **Ưu tiên cao / chặn frontend:** thêm `CORSMiddleware` vào `app/main.py` (hiện chưa có) — thiếu cái này Phúc không gọi được API từ dev server
- [ ] Viết phần "Backend Architecture & Evaluation Results" cho báo cáo, gồm bảng ablation + phân tích nguyên nhân Hybrid < CF-only
- [ ] Hỗ trợ Phúc debug response thật khi tích hợp

## Phúc — Frontend (việc chính giai đoạn tới)

### Tuần 1: Chạy được backend + SearchPanel + RankingTable
- [ ] Dựng venv và chạy backend local (`Backend/` chưa có `.venv`; artifact trong `Output/` đã đủ): `py -m venv .venv` → `pip install -r requirements.txt` → `uvicorn app.main:app --reload` → kiểm tra `GET /health`
- [ ] Scaffold Vite + React
- [ ] Test `/recommend`, `/whatif`, `/explain` qua Swagger `/docs` để nắm schema thật
- [ ] `SearchPanel` (làm trước RankingTable): input `latitude`/`longitude` (mặc định center Philadelphia 39.9526, -75.1652), chọn `categories`, `k`, `max_distance_km`, dropdown `user_id` mẫu — đây là thứ sinh request cho mọi endpoint còn lại
- [ ] `RankingTable`: gọi `POST /recommend`, render danh sách thật (không mock)

### Tuần 2: ExplainPanel + WhatIfSliders
- [ ] `ExplainPanel`: gọi `GET /explain` khi click 1 dòng, hiển thị breakdown % (cf/geo/category)
- [ ] `WhatIfSliders`: slider trọng số cf/geo/cat, gọi `POST /whatif`, cập nhật `RankingTable` bằng kết quả `scenario`
- [ ] Debounce slider 300–500ms (hoặc chỉ gọi khi thả chuột): `/whatif` chạy `recommend()` 2 lần, mỗi lần duyệt toàn bộ business trong bán kính (~14.5k ở `max_distance_km=15`) — gọi theo từng bước slider sẽ lag
- [ ] Hiển thị bảng `changes` (rank_delta / score_delta) — đây là phần thể hiện rõ nhất tính "hỗ trợ ra quyết định"

### Tuần 3: MapView + Polish
- [ ] `MapView` (react-leaflet): marker cho từng kết quả (`/recommend` đã trả sẵn `latitude`/`longitude`), click marker → mở `ExplainPanel`
- [ ] Click bản đồ để đặt lại vị trí tìm kiếm → cập nhật `SearchPanel`
- [ ] Loading/error state cho các lần gọi API
- [ ] Layout tổng (header + map/table)

## Ghi chú hợp đồng API (chỗ dễ sai khi code frontend)
- `weights` phải có **đủ cả 3 key** `cf`, `geo`, `cat`; thiếu key hoặc thừa key → 422. Backend tự chuẩn hóa tổng = 1 nên không cần tự chia.
- `/explain` nhận trọng số qua **query param riêng lẻ** `cf_weight`, `geo_weight`, `cat_weight` — không phải object `weights` như `/recommend`.
- `/whatif`: trong `scenario` chỉ gửi đúng field muốn override, **không gửi field với giá trị `null`** (backend dùng `exclude_unset`, gửi `null` tường minh sẽ ghi đè lên baseline và làm request lỗi).
- Không truyền `categories` thì `category_score` luôn = 0 → ExplainPanel sẽ hiện category 0%, hybrid thực tế chỉ còn CF + Geo.
- Không truyền `user_id` (hoặc `user_id` lạ) thì CF fallback về rating trung bình của business.

## Cả nhóm — Báo cáo & Slide
- [ ] Gộp 3 phần methodology (data/scoring, backend/eval, frontend/DSS) thành báo cáo hoàn chỉnh
- [ ] Slide thuyết trình
- [ ] Test tích hợp end-to-end (frontend thật ↔ backend thật) trước demo
- [ ] Tập demo trực tiếp trên máy (tránh lỗi live)

## Cần xác nhận
- [ ] Hạn nộp/báo cáo cụ thể — điền ngày để gán mốc thời gian theo tuần ở trên
