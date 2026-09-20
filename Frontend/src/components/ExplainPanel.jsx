import { useEffect, useState } from 'react'
import { fetchExplanation } from '../api'

/**
 * `useEffect` là hook để chạy "side effect" -- việc gì đó không phải
 * thuần render UI, ví dụ gọi API. Cú pháp:
 *
 *   useEffect(() => { ...làm gì đó... }, [danh sách dependency])
 *
 * React sẽ chạy lại hàm này mỗi khi 1 trong các giá trị ở mảng
 * dependency thay đổi (so sánh với lần render trước). Ở đây mình theo
 * dõi `business` (dòng đang chọn) và `weights` (trọng số đang áp dụng,
 * có thể đổi khi kéo WhatIfSliders) -- đổi 1 trong 2 là gọi lại
 * GET /explain.
 *
 * ExplainPanel hiển thị breakdown % đóng góp của CF/Geo/Category cho
 * business đang được chọn trong RankingTable.
 */
function ExplainPanel({ business, searchContext, weights }) {
  const [explanation, setExplanation] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Không có business nào được chọn -> không có gì để fetch. Cố tình
    // KHÔNG gọi setExplanation(null) ở đây: phần render bên dưới
    // (`if (!business) return ...`) đã tự ẩn hẳn kết quả cũ khi
    // business rỗng rồi, nên không cần đồng bộ thêm state chỉ để giấu
    // nó lần nữa (oxlint cảnh báo đúng: setState ngay trong effect như
    // vậy hay là dấu hiệu logic thừa).
    if (!business) return

    // `ignore` để tránh race condition: nếu người dùng click dòng khác
    // hoặc đổi weight trước khi request cũ trả lời xong, response cũ
    // (đến sau) sẽ bị bỏ qua thay vì ghi đè lên dữ liệu mới hơn.
    let ignore = false

    // oxlint cảnh báo "setState trong effect gây render dây chuyền" ở
    // đây -- đúng về mặt kỹ thuật, nhưng đây là pattern tiêu chuẩn khi
    // fetch dữ liệu bằng useEffect thuần (không dùng thư viện như React
    // Query) theo đúng stack đã chọn (fetch thuần). Chấp nhận có 1 lần
    // render phụ để bật cờ loading.
    // oxlint-disable-next-line react/set-state-in-effect
    setIsLoading(true)
    setError(null)

    fetchExplanation({
      businessId: business.business_id,
      latitude: searchContext.latitude,
      longitude: searchContext.longitude,
      userId: searchContext.user_id,
      categories: searchContext.categories,
      weights,
    })
      .then((result) => {
        if (!ignore) setExplanation(result)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    // Hàm return trong useEffect là "cleanup" -- React gọi nó ngay
    // trước khi chạy lại effect (hoặc khi component bị gỡ khỏi trang).
    return () => {
      ignore = true
    }
  }, [business, searchContext, weights])

  if (!business) {
    return (
      <aside className="explain-panel explain-panel-empty">
        <p className="empty-state">
          Chọn 1 địa điểm trong bảng hoặc trên bản đồ để xem điểm số được
          tính thế nào.
        </p>
      </aside>
    )
  }

  return (
    <aside className="explain-panel">
      <h3 className="explain-panel-title">{business.name}</h3>
      {isLoading && <p className="explain-status">Đang tải giải thích...</p>}
      {error && <p className="error-banner">Lỗi: {error}</p>}
      {/* So business_id trong response với business đang chọn: tránh
          hiện nhầm breakdown của business trước đó trong khoảnh khắc
          đang fetch business mới (explanation cũ chưa bị ghi đè). */}
      {explanation && explanation.business_id === business.business_id && (
        <>
          <p className="total-score">
            <span className="total-score-label">Tổng điểm</span>
            <span className="total-score-value">{explanation.total_score.toFixed(4)}</span>
          </p>
          <BreakdownBar
            label="CF (lịch sử đánh giá)"
            score={explanation.cf_score}
            percentage={explanation.cf_contribution_pct}
          />
          <BreakdownBar
            label="Geo (khoảng cách)"
            score={explanation.geo_score}
            percentage={explanation.geo_contribution_pct}
          />
          <BreakdownBar
            label="Category (thể loại)"
            score={explanation.category_score}
            percentage={explanation.category_contribution_pct}
          />
          <p className="distance-note">
            Cách vị trí tìm kiếm {explanation.distance_km.toFixed(2)} km
          </p>
        </>
      )}
    </aside>
  )
}

function BreakdownBar({ label, score, percentage }) {
  return (
    <div className="breakdown-row">
      <div className="breakdown-label">
        <span>{label}</span>
        <span className="breakdown-pct">{percentage.toFixed(1)}%</span>
      </div>
      <div className="breakdown-bar-track">
        <div className="breakdown-bar-fill" style={{ width: `${percentage}%` }} />
      </div>
      <div className="breakdown-raw">raw score {score.toFixed(4)}</div>
    </div>
  )
}

export default ExplainPanel
