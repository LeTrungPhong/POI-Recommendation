/**
 * RankingTable KHÔNG có state riêng (không dùng useState) -- nó chỉ nhận
 * dữ liệu qua props (`results`) và render ra bảng. Loại component này
 * thường được gọi là "presentational" / "dumb" component: cho gì render
 * nấy, dễ test và dễ đọc vì không có logic ẩn bên trong.
 *
 * `results` là mảng Recommendation trả về từ POST /recommend, đã được
 * backend sort theo score giảm dần sẵn.
 */
function RankingTable({ results, onSelect, selectedBusinessId }) {
  if (results.length === 0) {
    return (
      <p className="empty-state">
        Chưa có kết quả -- điền vị trí và bấm "Tìm kiếm" để xem xếp hạng.
      </p>
    )
  }

  return (
    <div className="table-scroll">
      <table className="ranking-table">
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th>Địa điểm</th>
            <th className="col-num">Sao</th>
            <th className="col-num">Km</th>
            <th className="col-num">Score</th>
            <th className="col-num">CF</th>
            <th className="col-num">Geo</th>
            <th className="col-num">Category</th>
          </tr>
        </thead>
        <tbody>
          {results.map((item, index) => (
            <tr
              key={item.business_id}
              className={item.business_id === selectedBusinessId ? 'selected-row' : ''}
              onClick={() => onSelect?.(item)}
            >
              <td className="col-rank">{index + 1}</td>
              <td>
                <div className="business-name">{item.name}</div>
                <div className="business-categories">{item.categories}</div>
              </td>
              <td className="col-num">{item.stars.toFixed(1)}</td>
              <td className="col-num">{item.distance_km.toFixed(2)}</td>
              <td className="col-num col-score">{item.score.toFixed(4)}</td>
              <td className="col-num">{item.cf_score.toFixed(4)}</td>
              <td className="col-num">{item.geo_score.toFixed(4)}</td>
              <td className="col-num">{item.category_score.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RankingTable
