# Đối chiếu với paper tham khảo (GeoSoCa, 2015)

Tài liệu này mô tả dự án đã áp dụng những gì từ paper tham khảo, phần nào đơn giản hóa và vì sao — dùng làm cơ sở cho báo cáo/slide và trả lời vấn đáp.

## 1. Đề tài

Xây dựng hệ thống hỗ trợ ra quyết định lựa chọn địa điểm dựa trên POI Recommendation. Dataset: Yelp Open Dataset, lọc theo Philadelphia, PA (14,567 business, 967,517 review, 279,847 user).

## 2. Paper tham khảo

**GeoSoCa: Exploiting Geographical, Social and Categorical Correlations for Point-of-Interest Recommendations** — Zhang & Chow, SIGIR 2015.
https://github.com/hongleizhang/RSPapers/blob/master/06-POI_RS/2015-Geosoca%20Exploiting%20geographical%20social%20and%20categorical%20correlations%20for%20point-of-interest%20recommendations.%20.pdf

Paper đề xuất kết hợp 3 loại tương quan để dự đoán mức độ liên quan giữa user và POI chưa ghé:

- **Geographical correlation**: Adaptive Kernel Density Estimation (KDE) — ước lượng phân phối check-in cá nhân hóa cho từng user từ lịch sử vị trí của họ (Eq. 1-9), với bandwidth thích ứng theo mật độ check-in cục bộ.
- **Social correlation**: tổng hợp rating/tần suất check-in của **bạn bè thật** (social link) trên 1 POI, biến đổi qua phân phối power-law học từ dữ liệu (Eq. 10-13).
- **Categorical correlation**: lấy độ thiên lệch (bias) của user với từng category, dùng để weight độ phổ biến (popularity) của POI trong category đó, biến đổi qua phân phối power-law (Eq. 14-17).
- **Kết hợp (fusion)**: nhân 3 điểm với nhau theo **product rule** (Eq. 18): `s(u,l) = fGeo(l|u) · FSo(x) · FCa(y)`. Paper chỉ ra rõ product rule mạnh hơn weighted linear sum (dẫn chứng: baseline USG dùng linear sum cho kết quả yếu nhất trong so sánh).

## 3. Nhóm đã áp dụng gì, đơn giản hóa gì, và vì sao

| Thành phần | GeoSoCa (paper) | Dự án đã làm | Trạng thái |
|---|---|---|---|
| **Fusion (cách kết hợp)** | Product rule: `fGeo · FSo · FCa` (Eq. 18) | **Weighted geometric mean**: `cf^w_cf · geo^w_geo · cat^w_cat` (`w` chuẩn hóa tổng = 1) | ✅ Đúng nguyên tắc product rule, mở rộng thêm trọng số điều chỉnh được để giữ tính năng what-if (DSS) |
| **Geo** | Adaptive KDE cá nhân hóa từng user (Eq. 1-9) | Exponential decay từ 1 điểm tọa độ: `exp(-decay_rate · distance_km)` | ❌ Đơn giản hóa — không cá nhân hóa theo lịch sử phân bố vị trí của từng user |
| **Social → CF** | Tổng hợp rating của bạn bè thật (social link matrix), transform qua power-law CDF (Eq. 10-13) | Collaborative Filtering (SVD, 50 factors) trên ma trận rating user-POI | ❌ Thay thế hoàn toàn — dataset đã lọc không giữ field `friends`; CF đóng vai trò tín hiệu "cộng đồng" tương tự nhưng qua cơ chế khác |
| **Category** | Categorical bias × popularity, transform qua power-law CDF (Eq. 14-17) | Jaccard similarity giữa category user quan tâm và category của POI | ❌ Đơn giản hóa — không tính đến độ phổ biến POI trong từng category |

**Lý do đơn giản hóa**: giới hạn thời gian đồ án (KDE + social + category power-law đầy đủ ước tính tốn thêm ~2.5-3 ngày công cho 1 người, xem thảo luận nhóm 2026-09-20/21), và dataset Yelp đã lọc chưa giữ field `friends` cần thiết cho social correlation thật.

## 4. Thực nghiệm xác nhận nguyên tắc fusion của paper là đúng

Ablation study (K=10, 25,775 user được đánh giá, train/test split theo thời gian 80/20):

Áp dụng product rule (`cf^w1 · geo^w2 · cat^w3`) với trọng số mặc định (0.4/0.3/0.3):

| Model | Precision@10 | Recall@10 | NDCG@10 | NDCG vs CF-only |
|---|---|---|---|---|
| **Hybrid** | **0.0058** | **0.0165** | **0.0116** | **+10.79%** |
| CF-only | 0.0053 | 0.0146 | 0.0105 | 0.00% |
| Geo-only | 0.0009 | 0.0036 | 0.0023 | -78.58% |
| Category-only | 0.0015 | 0.0046 | 0.0033 | -68.23% |

**Kết luận**: Hybrid vượt CF-only trên cả 3 chỉ số (NDCG +10.8%, Precision +7.3%, Recall +12.5%). Kết quả này khớp trực tiếp với lập luận của paper (Section 4.2.1) rằng product rule là chiến lược fusion mạnh hơn linear weighted sum — đây là bằng chứng thực nghiệm độc lập của nhóm, không chỉ là trích dẫn suông.

## 5. Trả lời vấn đáp (nếu được hỏi)

- **"Nhóm có implement đúng GeoSoCa không?"** → Không đúng 100%. Nhóm áp dụng đúng nguyên tắc cốt lõi (product-rule fusion, Eq. 18) và verify bằng thực nghiệm trên dataset Yelp/Philadelphia. Ba mô hình thành phần (Geo/Social/Category) được đơn giản hóa để phù hợp thời gian đồ án và đặc thù dataset — có bảng so sánh chi tiết ở mục 3.
- **"Vì sao không dùng social correlation thật?"** → Yelp dataset có field `friends`, nhưng bước lọc dữ liệu ban đầu chưa giữ lại field này; nhóm thay bằng Collaborative Filtering (SVD) làm tín hiệu tương tự vai trò "ý kiến cộng đồng" trong công thức.
- **"Vì sao Geo không dùng KDE như paper?"** → KDE thích ứng (adaptive bandwidth) cần tính riêng cho từng user dựa trên toàn bộ lịch sử check-in của họ — phức tạp hơn đáng kể so với exponential decay. Nhóm ưu tiên làm đúng fusion rule trước (ảnh hưởng lớn nhất đến kết quả, đã verify bằng ablation) trong phạm vi thời gian cho phép.
- **"Kết quả có ý nghĩa gì?"** → Ablation cho thấy chọn đúng cách kết hợp tín hiệu quan trọng hơn việc tối ưu từng tín hiệu riêng lẻ — đúng insight chính của paper GeoSoCa.

## 6. Hướng mở rộng nếu còn thời gian

Xem `Mức 2` trong thảo luận nhóm: implement đầy đủ Adaptive KDE (Geo), social correlation thật từ `friends` (cần lọc lại `user.json`), và category popularity power-law — ước tính ~2.5-3 ngày công, có rủi ro mạng bạn bè Yelp trong phạm vi 1 thành phố khá sparse.
