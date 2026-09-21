# POI-DSS — Hệ thống Hỗ trợ Ra quyết định Chọn địa điểm

Đồ án môn Hệ thống Hỗ trợ Ra quyết định (DSS): xây dựng hệ thống gợi ý
địa điểm (Point-of-Interest Recommendation) trên dữ liệu Yelp thật, có
đầy đủ **ranking, scoring có giải thích được (explainability), và
what-if analysis** — không chỉ trả về 1 danh sách gợi ý cố định như
recommendation system thông thường.

Vận dụng nguyên lý fusion của paper **GeoSoCa** (Zhang & Chow, SIGIR
2015) — xem đối chiếu chi tiết với paper gốc trong
[`PAPER_ALIGNMENT.md`](PAPER_ALIGNMENT.md).

## Hệ thống làm được gì

- **Ranking**: xếp hạng Top-K địa điểm (POI) gần 1 vị trí, theo category
  người dùng quan tâm và lịch sử đánh giá (nếu có `user_id`)
- **Scoring có breakdown**: mỗi điểm số tách rõ 3 thành phần — CF
  (collaborative filtering), Geo (khoảng cách), Category (sở thích) —
  không phải một con số "hộp đen"
- **What-if analysis**: chỉnh trọng số 3 tiêu chí trên, xem ranking đổi
  ngay theo thời gian thực, kèm bảng so sánh rank/score thay đổi ra sao
  so với baseline — đây là phần thể hiện rõ nhất tính chất DSS
- **Explainability**: click 1 địa điểm để xem % đóng góp của từng tiêu
  chí vào điểm số cuối cùng
- **Bản đồ tương tác**: xem kết quả trên bản đồ thật (react-leaflet),
  bấm bản đồ để đặt lại vị trí tìm kiếm

## Dữ liệu & thuật toán (tóm tắt)

- **Dataset**: [Yelp Open Dataset](https://www.yelp.com/dataset), lọc
  theo Philadelphia, PA — 14,567 business, 967,517 review, 279,847 user
- **Công thức Hybrid Score** (product rule, đúng Eq. 18 của GeoSoCa):

  ```
  score = cf_score ^ w_cf · geo_score ^ w_geo · category_score ^ w_cat
  ```

  - `cf_score`: SVD (50 factors) trên ma trận rating user–POI
  - `geo_score`: `exp(-decay_rate × distance_km)`
  - `category_score`: Jaccard similarity giữa category quan tâm và
    category của POI
  - `w_cf + w_geo + w_cat = 1`, mặc định `0.4 / 0.3 / 0.3`, điều chỉnh
    được qua what-if

- **Kết quả ablation study** (K=10, 25,775 user, train/test split theo
  thời gian 80/20):

  | Model | Precision@10 | Recall@10 | NDCG@10 | vs CF-only |
  |---|---|---|---|---|
  | **Hybrid** | **0.0058** | **0.0165** | **0.0116** | **+10.79%** |
  | CF-only | 0.0053 | 0.0146 | 0.0105 | 0.00% |
  | Geo-only | 0.0009 | 0.0036 | 0.0023 | -78.58% |
  | Category-only | 0.0015 | 0.0046 | 0.0033 | -68.23% |

  Chi tiết phương pháp, so sánh với paper gốc, và câu trả lời vấn đáp
  mẫu: xem [`PAPER_ALIGNMENT.md`](PAPER_ALIGNMENT.md).

## Kiến trúc

```
Yelp dataset --> Data pipeline & Scoring engine (Backend/app/) --> FastAPI (/recommend, /whatif, /explain)
                                                                          |
                                                                          v
                                                     React + Vite frontend (Frontend/) -- map, ranking, what-if UI
```

## Chạy dự án

Cần **Python 3.10+** và **Node.js 18+**, chạy **2 terminal song song**
(backend + frontend) — thiếu 1 trong 2 sẽ gặp lỗi `502 Bad Gateway`
khi tìm kiếm trên frontend.

### Terminal 1 — Backend (FastAPI)

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Kiểm tra đã chạy đúng: mở `http://127.0.0.1:8000/health` phải trả về
`{"status":"ok","artifacts_loaded":6}`. Swagger docs (thử API trực
tiếp trên trình duyệt): `http://127.0.0.1:8000/docs`.

> **Nếu cài `pyarrow` lỗi** (thường do dùng Python quá mới, chưa có
> prebuilt wheel — gặp với Python 3.14): cài `fastparquet` thay thế
> (`pip install fastparquet`), pandas tự dùng được, không cần sửa code.

Chi tiết đầy đủ về API (schema request/response từng endpoint,
ablation study, evaluation): [`Backend/README.md`](Backend/README.md).

### Terminal 2 — Frontend (React + Vite)

```powershell
cd Frontend
npm install
npm run dev
```

Mở `http://localhost:5173`. Frontend gọi backend qua Vite dev proxy
(`/api/* -> http://127.0.0.1:8000/*`, xem `Frontend/vite.config.js`) —
không cần bật CORS ở backend vì proxy chạy phía server, không qua
trình duyệt.

Chi tiết cấu trúc component, design token: [`Frontend/README.md`](Frontend/README.md).

## Cấu trúc thư mục

```
Backend/    FastAPI backend — scoring engine, API, evaluation/ablation
Frontend/   React + Vite frontend — map, ranking, what-if, explain UI
Output/     Artifact đã xử lý (parquet, cf_model.pkl, kết quả ablation) — dùng chung cho cả Backend
scripts/    Script phụ trợ (xuất sample user/category cho frontend demo)
docs/       Tài liệu trình bày (paper, slide)
```

## Đội thực hiện

- **Tấn** — Data pipeline & Scoring engine
- **Phong** — Backend API & Evaluation
- **Phúc** — Frontend & tổng hợp

Xem [`TASKS.md`](TASKS.md) để biết phân việc và tiến độ chi tiết.
