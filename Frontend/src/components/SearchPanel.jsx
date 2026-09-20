import { useState } from 'react'
import { Checkbox, Select } from 'radix-ui'
import sampleUsers from '../data/sampleUsers.json'
import topCategories from '../data/topCategories.json'

// Radix `Select.Item` không cho phép `value=""` (chuỗi rỗng được Radix
// dùng nội bộ để đại diện cho "chưa chọn gì"). Nhưng trong state/API
// của app, `userId === ""` chính là "không chọn user" (xem
// handleSubmit). Nên dùng 1 giá trị giả (sentinel) riêng cho item "--
// Không chọn --", rồi map ngược sentinel -> "" ngay khi nhận
// onValueChange -- state `userId` thật không bao giờ chứa sentinel này.
const NO_USER_SENTINEL = '__none__'

/**
 * SearchPanel là một "controlled form": mỗi input được gắn với một biến
 * state qua value={...} và onChange={...}. React giữ giá trị input
 * trong state, không để trình duyệt tự quản -- nhờ vậy mình luôn biết
 * chính xác form đang chứa gì để build request gửi backend.
 *
 * `latitude`/`longitude` KHÔNG còn là state riêng của component này nữa
 * (khác với bản Tuần 1) -- App.jsx giữ 2 giá trị đó, truyền xuống qua
 * props (`latitude`, `longitude`, `onLatitudeChange`, `onLongitudeChange`).
 * Lý do: MapView (Tuần 3) cũng cần đọc/ghi đúng 2 giá trị này khi người
 * dùng bấm lên bản đồ để đặt lại vị trí tìm kiếm -- 2 component "anh em"
 * (SearchPanel, MapView) muốn chia sẻ 1 state thì state đó phải nằm ở
 * component cha chung (App), đây vẫn là ý "lift state up" đã nói ở
 * bản đầu tiên, chỉ là lần này áp dụng luôn cho lat/lon.
 *
 * `sampleUsers`/`topCategories` import trực tiếp từ file .json trong
 * src/data/ -- Vite cho phép `import` JSON giống như import module JS
 * bình thường (không cần fetch). 2 file này do
 * scripts/export_frontend_samples.py xuất ra từ artifact thật trong
 * Output/ (thay việc còn thiếu của Tấn trong TASKS.md), không phải
 * mock tự bịa.
 *
 * `Select`/`Checkbox` import từ package `radix-ui` -- đây là các
 * "headless primitive": Radix chỉ lo hành vi + accessibility (đóng khi
 * click ra ngoài, điều hướng bàn phím, đúng role/aria-* cho screen
 * reader...), KHÔNG kèm giao diện mặc định. Mọi màu sắc/kích thước là
 * CSS tự viết trong App.css (class `select-*`/`checkbox-*`).
 */
function SearchPanel({ latitude, longitude, onLatitudeChange, onLongitudeChange, onSearch, isLoading }) {
  const [k, setK] = useState(10)
  const [maxDistanceKm, setMaxDistanceKm] = useState(15)
  const [userId, setUserId] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])

  function toggleCategory(name) {
    setSelectedCategories((current) =>
      current.includes(name) ? current.filter((c) => c !== name) : [...current, name],
    )
  }

  function handleUserIdChange(value) {
    setUserId(value === NO_USER_SENTINEL ? '' : value)
  }

  function handleSubmit(event) {
    // Form HTML mặc định sẽ reload trang khi submit -- preventDefault()
    // chặn hành vi đó lại để React tự xử lý.
    event.preventDefault()

    onSearch({
      latitude: Number(latitude),
      longitude: Number(longitude),
      k: Number(k),
      max_distance_km: Number(maxDistanceKm),
      categories: selectedCategories,
      // user_id rỗng ("") thì không gửi field này -- backend hiểu là
      // "không có user_id", CF sẽ fallback về rating trung bình.
      ...(userId ? { user_id: userId } : {}),
    })
  }

  return (
    <form className="search-panel" onSubmit={handleSubmit}>
      <h2>Tìm địa điểm</h2>

      <div className="field-row">
        <label>
          Latitude
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(event) => onLatitudeChange(event.target.value)}
            required
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(event) => onLongitudeChange(event.target.value)}
            required
          />
        </label>
      </div>
      <p className="field-hint">Mẹo: bấm lên bản đồ bên dưới để đặt lại vị trí này.</p>

      <div className="field-row">
        <label>
          Số kết quả (k)
          <input
            type="number"
            min="1"
            max="100"
            value={k}
            onChange={(event) => setK(event.target.value)}
          />
        </label>
        <label>
          Bán kính tối đa (km)
          <input
            type="number"
            min="0.1"
            step="any"
            value={maxDistanceKm}
            onChange={(event) => setMaxDistanceKm(event.target.value)}
          />
        </label>
      </div>

      <div className="field-block">
        <span id="user-select-label">
          User ID mẫu (tuỳ chọn -- để trống thì CF dùng rating trung bình business)
        </span>
        <Select.Root value={userId || NO_USER_SENTINEL} onValueChange={handleUserIdChange}>
          <Select.Trigger className="select-trigger" aria-labelledby="user-select-label">
            <Select.Value />
            <Select.Icon className="select-icon">▾</Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="select-content" position="popper" sideOffset={4}>
              <Select.Viewport className="select-viewport">
                <Select.Item className="select-item" value={NO_USER_SENTINEL}>
                  <Select.ItemText>-- Không chọn --</Select.ItemText>
                </Select.Item>
                {sampleUsers.map((user) => (
                  <Select.Item className="select-item" key={user.user_id} value={user.user_id}>
                    <Select.ItemText>
                      {user.name} ({user.train_interaction_count} review trong train set)
                    </Select.ItemText>
                    <Select.ItemIndicator className="select-item-indicator">✓</Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      <div className="field-block">
        <span id="category-list-label">Categories (tuỳ chọn, chọn nhiều được)</span>
        <div className="category-checkbox-list" aria-labelledby="category-list-label">
          {topCategories.map((category) => (
            <label key={category.name} className="category-checkbox">
              <Checkbox.Root
                className="checkbox-root"
                checked={selectedCategories.includes(category.name)}
                onCheckedChange={() => toggleCategory(category.name)}
              >
                <Checkbox.Indicator className="checkbox-indicator">✓</Checkbox.Indicator>
              </Checkbox.Root>
              {category.name}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Đang tìm...' : 'Tìm kiếm'}
      </button>
    </form>
  )
}

export default SearchPanel
