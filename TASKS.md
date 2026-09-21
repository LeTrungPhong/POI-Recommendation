# TASKS — POI-DSS (Philadelphia POI Recommendation)

## Đã chốt, không làm lại
- Dataset, trọng số hybrid mặc định (0.4/0.3/0.3): giữ nguyên.
- **Cập nhật 2026-09-21**: đổi cách kết hợp (fusion) từ weighted sum sang **product rule** (`score = cf^w_cf · geo^w_geo · cat^w_cat`), đúng Eq. 18 của paper GeoSoCa — xem `PAPER_ALIGNMENT.md`. Ablation chạy lại: **Hybrid NDCG@10 = 0.0116, vượt CF-only (0.0105) +10.79%** (trước đó thua CF-only -38% khi còn dùng weighted sum). Không đổi Geo/CF/Category, chỉ đổi công thức kết hợp — không cần làm lại phần này.
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
- [x] ~~Ưu tiên cao / chặn frontend: thêm `CORSMiddleware`~~ — không cần nữa, Phúc đã dùng Vite dev proxy (`Frontend/vite.config.js`, forward `/api/*` -> `127.0.0.1:8000` phía server, không qua trình duyệt nên không bị CORS chặn) thay vì sửa backend
- [ ] Viết phần "Backend Architecture & Evaluation Results" cho báo cáo, gồm bảng ablation + phân tích nguyên nhân Hybrid < CF-only
- [ ] Hỗ trợ Phúc debug response thật khi tích hợp

## Phúc — Frontend (đã xong phần khung, còn polish)

### Tuần 1: Chạy được backend + SearchPanel + RankingTable
- [x] Dựng venv và chạy backend local
- [x] Scaffold Vite + React
- [x] Test `/recommend`, `/whatif`, `/explain` qua Swagger `/docs`
- [x] `SearchPanel`
- [x] `RankingTable`: gọi `POST /recommend`, render danh sách thật (không mock)

### Tuần 2: ExplainPanel + WhatIfSliders
- [x] `ExplainPanel`: gọi `GET /explain` khi click 1 dòng, hiển thị breakdown % (cf/geo/category)
- [x] `WhatIfSliders`: slider trọng số cf/geo/cat, gọi `POST /whatif`, cập nhật kết quả bằng `scenario`
- [x] Debounce slider (`onDebouncedChange` trong `WhatIfSliders`)
- [x] Hiển thị bảng `changes` (rank_delta / score_delta) — giờ dùng switch để đổi qua lại với RankingTable thay vì xếp chồng (2026-09-21)

### Tuần 3: MapView + Polish
- [x] `MapView` (react-leaflet): marker cho từng kết quả, click marker → mở `ExplainPanel`
- [x] Click bản đồ để đặt lại vị trí tìm kiếm → cập nhật `SearchPanel`
- [x] Loading/error state cho các lần gọi API
- [x] Layout tổng (header + map/table) — ExplainPanel dời xuống ngay dưới map (2026-09-21)
- [ ] Polish thêm nếu còn thời gian trước demo (xem "Cả nhóm — Báo cáo & Slide" bên dưới)

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
