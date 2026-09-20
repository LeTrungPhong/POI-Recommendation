import { useEffect, useState } from 'react'
import { Slider } from 'radix-ui'

const DEFAULT_WEIGHTS = { cf: 40, geo: 30, cat: 30 }
const DEBOUNCE_MS = 400

/**
 * "Debounce" nghĩa là: chờ người dùng ngừng thao tác một khoảng thời
 * gian rồi mới thực sự làm việc gì đó, thay vì làm ngay mỗi lần có thay
 * đổi. Bắt buộc phải debounce ở đây vì mỗi lần gọi POST /whatif, backend
 * chạy recommend() 2 lần, mỗi lần duyệt toàn bộ business trong bán kính
 * (~14.5k ở max_distance_km=15) -- kéo slider mà gọi API theo từng pixel
 * sẽ làm UI đơ.
 *
 * Cách làm bằng useEffect + setTimeout:
 *   - Mỗi khi cf/geo/cat đổi, effect chạy lại: đặt 1 timer 400ms.
 *   - Nếu user đổi tiếp trước khi timer bắn, hàm cleanup (return trong
 *     effect) sẽ clearTimeout timer cũ trước khi effect chạy lại và đặt
 *     timer mới -- coi như "reset đồng hồ đếm ngược".
 *   - Chỉ khi user NGỪNG kéo slider đủ 400ms, timer mới thực sự chạy
 *     xong và gọi onDebouncedChange(...).
 */
function WhatIfSliders({ disabled, onDebouncedChange }) {
  const [cf, setCf] = useState(DEFAULT_WEIGHTS.cf)
  const [geo, setGeo] = useState(DEFAULT_WEIGHTS.geo)
  const [cat, setCat] = useState(DEFAULT_WEIGHTS.cat)

  useEffect(() => {
    const timer = setTimeout(() => {
      onDebouncedChange({ cf, geo, cat })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // Cố ý không đưa onDebouncedChange vào dependency: nó là hàm App.jsx
    // tạo lại mỗi lần render, nếu thêm vào đây effect sẽ chạy lại (và
    // reset debounce timer) ngay cả khi cf/geo/cat không đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf, geo, cat])

  const total = cf + geo + cat || 1 // tránh chia 0
  const normalizedPct = (value) => ((value / total) * 100).toFixed(0)

  return (
    <div className="whatif-sliders">
      <h2>What-if: thử trọng số khác</h2>
      <p className="whatif-note">
        Kéo thanh trượt để xem thứ hạng thay đổi thế nào nếu đổi trọng số
        CF/Geo/Category. Backend tự chuẩn hoá về tổng 1 nên chỉ cần quan
        tâm tỉ lệ tương đối giữa 3 thanh.
      </p>

      <SliderRow
        label="CF"
        value={cf}
        percentage={normalizedPct(cf)}
        onChange={setCf}
        disabled={disabled}
      />
      <SliderRow
        label="Geo"
        value={geo}
        percentage={normalizedPct(geo)}
        onChange={setGeo}
        disabled={disabled}
      />
      <SliderRow
        label="Category"
        value={cat}
        percentage={normalizedPct(cat)}
        onChange={setCat}
        disabled={disabled}
      />

      {disabled && <p className="whatif-hint">Tìm kiếm trước để dùng What-if.</p>}
    </div>
  )
}

/**
 * Radix `Slider.Root` nhận `value` dạng MẢNG (để hỗ trợ nhiều thumb
 * cùng lúc, dù ở đây chỉ dùng 1) và callback `onValueChange` trả về
 * mảng tương ứng -- khác chữ ký `onChange={(e) => ...}` của input
 * native. Destructure `([v]) => onChange(v)` để vẫn gọi `onChange`
 * (chính là `setCf`/`setGeo`/`setCat` của component cha) với đúng 1 số
 * như trước, không đổi state hay logic debounce ở component cha.
 */
function SliderRow({ label, value, percentage, onChange, disabled }) {
  return (
    <div className="slider-row">
      <span className="slider-label">
        {label}: {percentage}%
      </span>
      <Slider.Root
        className="slider-root"
        min={0}
        max={100}
        step={1}
        value={[value]}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      >
        <Slider.Track className="slider-track">
          <Slider.Range className="slider-range" />
        </Slider.Track>
        <Slider.Thumb className="slider-thumb" aria-label={label} />
      </Slider.Root>
    </div>
  )
}

export default WhatIfSliders
