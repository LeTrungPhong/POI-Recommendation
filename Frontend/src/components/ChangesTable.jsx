/**
 * ChangesTable hiển thị kết quả `changes` từ POST /whatif: mỗi business
 * đổi hạng/điểm thế nào khi chuyển từ baseline (trọng số mặc định
 * 0.4/0.3/0.3) sang scenario (trọng số người dùng vừa chỉnh bằng
 * WhatIfSliders). Đây là phần thể hiện rõ nhất "hỗ trợ ra quyết định":
 * cho thấy quyết định đổi trọng số ảnh hưởng cụ thể ra sao, chứ không
 * chỉ đổi 1 bảng ranking mới không rõ vì sao.
 */
function ChangesTable({ changes, nameById }) {
  if (changes.length === 0) return null

  return (
    <div className="changes-table-wrapper">
      <h3>Thay đổi so với baseline</h3>
      <div className="table-scroll">
        <table className="changes-table">
          <thead>
            <tr>
              <th>Địa điểm</th>
              <th className="col-num">Hạng cũ</th>
              <th className="col-num">Hạng mới</th>
              <th className="col-num">Δ hạng</th>
              <th className="col-num">Điểm cũ</th>
              <th className="col-num">Điểm mới</th>
              <th className="col-num">Δ điểm</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.business_id}>
                <td>{nameById[change.business_id] ?? change.business_id}</td>
                <td className="col-num">{change.baseline_rank ?? '—'}</td>
                <td className="col-num">{change.scenario_rank ?? '—'}</td>
                <td className={`col-num ${rankDeltaClass(change.rank_delta)}`}>
                  {formatRankDelta(change.rank_delta)}
                </td>
                <td className="col-num">{change.baseline_score?.toFixed(4) ?? '—'}</td>
                <td className="col-num">{change.scenario_score?.toFixed(4) ?? '—'}</td>
                <td className={`col-num ${scoreDeltaClass(change.score_delta)}`}>
                  {formatScoreDelta(change.score_delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatRankDelta(delta) {
  if (delta === null || delta === undefined) return '—'
  if (delta > 0) return `▲ ${delta}`
  if (delta < 0) return `▼ ${Math.abs(delta)}`
  return '– 0'
}

function rankDeltaClass(delta) {
  if (!delta) return ''
  return delta > 0 ? 'delta-positive' : 'delta-negative'
}

function formatScoreDelta(delta) {
  if (delta === null || delta === undefined) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(4)}`
}

function scoreDeltaClass(delta) {
  if (!delta) return ''
  return delta > 0 ? 'delta-positive' : 'delta-negative'
}

export default ChangesTable
