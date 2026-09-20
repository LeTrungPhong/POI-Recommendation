import { useState } from 'react'
import SearchPanel from './components/SearchPanel'
import RankingTable from './components/RankingTable'
import ExplainPanel from './components/ExplainPanel'
import WhatIfSliders from './components/WhatIfSliders'
import ChangesTable from './components/ChangesTable'
import MapView from './components/MapView'
import { fetchRecommendations, fetchWhatIf } from './api'
import './App.css'

// Mặc định: trung tâm Philadelphia (theo TASKS.md).
const DEFAULT_LATITUDE = 39.9526
const DEFAULT_LONGITUDE = -75.1652
const DEFAULT_WEIGHTS = { cf: 0.4, geo: 0.3, cat: 0.3 }

/**
 * App là component gốc, giữ toàn bộ state chung mà các component con
 * cần biết ("lift state up" -- xem giải thích ở SearchPanel.jsx):
 *   - latitude/longitude: vị trí tìm kiếm hiện tại -- SearchPanel hiển
 *     thị nó trong form, MapView hiển thị nó bằng chấm đỏ và có thể ghi
 *     đè khi người dùng bấm lên bản đồ
 *   - results/isLoading/error: kết quả tìm kiếm gốc (baseline)
 *   - lastSearchParams: request gốc đã gửi cho /recommend -- cần lại để
 *     làm `baseline` cho /whatif và làm ngữ cảnh cho /explain
 *   - selectedBusiness: dòng/marker đang chọn
 *   - whatIfResult/effectiveWeights: kết quả và trọng số hiện tại của
 *     kịch bản what-if (null nếu chưa chỉnh slider lần nào)
 */
function App() {
  const [latitude, setLatitude] = useState(DEFAULT_LATITUDE)
  const [longitude, setLongitude] = useState(DEFAULT_LONGITUDE)

  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastSearchParams, setLastSearchParams] = useState(null)

  const [selectedBusiness, setSelectedBusiness] = useState(null)

  const [whatIfResult, setWhatIfResult] = useState(null)
  const [whatIfError, setWhatIfError] = useState(null)
  const [effectiveWeights, setEffectiveWeights] = useState(DEFAULT_WEIGHTS)

  async function handleSearch(params) {
    setIsLoading(true)
    setError(null)
    try {
      const recommendations = await fetchRecommendations(params)
      setResults(recommendations)
      setLastSearchParams(params)
      setSelectedBusiness(null)
      setWhatIfResult(null)
      setEffectiveWeights(DEFAULT_WEIGHTS)
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleWhatIfChange({ cf, geo, cat }) {
    if (!lastSearchParams) return // chưa tìm kiếm lần nào thì chưa có baseline để so sánh

    const weights = { cf, geo, cat }
    setEffectiveWeights(weights)
    setWhatIfError(null)
    try {
      const result = await fetchWhatIf({
        baseline: lastSearchParams,
        // Chỉ gửi field muốn override (weights) -- KHÔNG gửi các field
        // khác dù là null, đúng gotcha ghi trong TASKS.md.
        scenario: { weights },
      })
      setWhatIfResult(result)
    } catch (err) {
      setWhatIfError(err.message)
    }
  }

  // Bấm lên bản đồ chỉ cập nhật lại ô lat/lon trong SearchPanel -- KHÔNG
  // tự động tìm kiếm luôn, người dùng vẫn phải bấm nút "Tìm kiếm" (đúng
  // yêu cầu TASKS.md: "click bản đồ để đặt lại vị trí tìm kiếm -> cập
  // nhật SearchPanel").
  function handleMapClick({ latitude: clickedLat, longitude: clickedLon }) {
    setLatitude(Number(clickedLat.toFixed(6)))
    setLongitude(Number(clickedLon.toFixed(6)))
  }

  // Bảng ranking hiển thị: nếu đã có kết quả what-if thì show scenario,
  // chưa thì show baseline gốc. MapView cũng dùng chung mảng này để vẽ
  // marker, nhờ vậy bản đồ và bảng luôn khớp nhau.
  const displayedResults = whatIfResult ? whatIfResult.scenario : results

  // Map business_id -> name để ChangesTable hiển thị tên thay vì id thô
  // (changes từ /whatif không kèm sẵn tên).
  const nameById = {}
  for (const item of results) nameById[item.business_id] = item.name
  if (whatIfResult) {
    for (const item of whatIfResult.scenario) nameById[item.business_id] = item.name
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>POI-DSS: Gợi ý địa điểm</h1>
        <p>Philadelphia, PA — Hybrid CF + Geo + Category</p>
      </header>

      <main className="app-main">
        <SearchPanel
          latitude={latitude}
          longitude={longitude}
          onLatitudeChange={setLatitude}
          onLongitudeChange={setLongitude}
          onSearch={handleSearch}
          isLoading={isLoading}
        />

        {lastSearchParams && (
          <WhatIfSliders disabled={!lastSearchParams} onDebouncedChange={handleWhatIfChange} />
        )}
        {whatIfError && <p className="error-banner">Lỗi what-if: {whatIfError}</p>}
        {error && <p className="error-banner">Lỗi: {error}</p>}
        {isLoading && <p className="loading-banner">Đang tìm kiếm...</p>}

        <div className="map-and-table">
          <MapView
            results={displayedResults}
            center={{ latitude, longitude }}
            selectedBusinessId={selectedBusiness?.business_id}
            onSelectBusiness={setSelectedBusiness}
            onMapClick={handleMapClick}
          />

          <div className="results-panel">
            <RankingTable
              results={displayedResults}
              onSelect={setSelectedBusiness}
              selectedBusinessId={selectedBusiness?.business_id}
            />
            {whatIfResult && (
              <ChangesTable changes={whatIfResult.changes} nameById={nameById} />
            )}
          </div>
        </div>

        {lastSearchParams && (
          <ExplainPanel
            business={selectedBusiness}
            searchContext={lastSearchParams}
            weights={effectiveWeights}
          />
        )}
      </main>
    </div>
  )
}

export default App
