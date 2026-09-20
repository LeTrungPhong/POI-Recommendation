# POI-DSS Frontend

Giao diện web cho hệ thống hỗ trợ ra quyết định chọn địa điểm kinh doanh
(POI-DSS), dựa trên backend FastAPI trong `../Backend` và artifact
trong `../Output`. Xem `../TASKS.md` để biết bối cảnh và kế hoạch tổng
thể của đồ án.

Stack: Vite + React 19 (JavaScript thuần) + react-leaflet + Radix UI
primitives (chỉ dùng cho hành vi/accessibility, không dùng theme mặc
định — mọi style là CSS tự viết trong `src/App.css`).

## Chạy local

Cần chạy **cả backend lẫn frontend** cùng lúc (2 terminal):

```
# Terminal 1 -- backend (xem thêm ../Backend/README.md)
cd ../Backend
.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload

# Terminal 2 -- frontend
npm install
npm run dev
```

Mở `http://localhost:5173`. Backend chưa bật `CORSMiddleware`, nên
`vite.config.js` có cấu hình dev proxy: mọi request `/api/...` từ
frontend được Vite forward sang `http://127.0.0.1:8000/...` ở phía
server (không bị trình duyệt chặn CORS). Xem `src/api.js` để biết toàn
bộ hợp đồng API đang dùng.

## Cấu trúc

- `src/components/SearchPanel.jsx` -- form tìm kiếm (lat/lon, k, bán
  kính, user mẫu, category).
- `src/components/RankingTable.jsx` -- bảng xếp hạng kết quả.
- `src/components/ExplainPanel.jsx` -- breakdown % CF/Geo/Category khi
  chọn 1 địa điểm.
- `src/components/WhatIfSliders.jsx` -- 3 slider trọng số, debounce
  400ms trước khi gọi `/whatif`.
- `src/components/ChangesTable.jsx` -- bảng so sánh baseline vs kịch
  bản what-if.
- `src/components/MapView.jsx` -- bản đồ react-leaflet.
- `src/data/sampleUsers.json`, `src/data/topCategories.json` -- xuất
  từ artifact thật bằng `../scripts/export_frontend_samples.py` (không
  phải mock tự bịa).

## Lint

```
npm run lint
```
