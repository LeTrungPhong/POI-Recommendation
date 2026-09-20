import { Fragment, useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Lỗi kinh điển khi dùng react-leaflet chung với bundler (Vite/webpack):
// Leaflet mặc định tự đoán URL ảnh marker dựa vào vị trí file CSS của
// nó, nhưng bundler đã đóng gói lại ảnh ở chỗ khác nên đoán sai -> marker
// hiện ra là ô vuông vỡ hình. Cách sửa chuẩn: xoá hàm đoán mặc định, khai
// thẳng URL 3 ảnh marker sau khi Vite đã xử lý import ở trên.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const SELECTED_Z_INDEX = 1000

// Leaflet `pathOptions` cần giá trị màu literal (hex/rgb) -- không đọc
// được CSS custom property. 2 hằng số này PHẢI khớp tay với
// --color-map-search-point / --color-map-marker-selected khai báo
// trong App.css (:root) -- đổi 1 bên thì phải đổi bên kia theo.
const MAP_SEARCH_POINT_COLOR = '#2b6777' // = var(--color-map-search-point)
const MAP_MARKER_SELECTED_COLOR = '#b24c3e' // = var(--color-map-marker-selected)

/**
 * MapView vẽ 1 marker cho mỗi business trong `results` (toạ độ có sẵn
 * trong response /recommend, xem TASKS.md), cộng thêm 1 chấm đỏ đánh dấu
 * vị trí đang tìm kiếm (`center`). Bấm marker -> gọi `onSelectBusiness`
 * (giống hệt việc click 1 dòng trong RankingTable). Bấm lên bản đồ chỗ
 * trống -> gọi `onMapClick` để App.jsx cập nhật lại lat/lon cho
 * SearchPanel.
 */
function MapView({ results, center, selectedBusinessId, onSelectBusiness, onMapClick }) {
  return (
    <MapContainer center={[center.latitude, center.longitude]} zoom={14} className="map-view">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <RecenterOnChange latitude={center.latitude} longitude={center.longitude} />
      <MapClickHandler onMapClick={onMapClick} />

      <CircleMarker
        center={[center.latitude, center.longitude]}
        radius={8}
        pathOptions={{
          color: MAP_SEARCH_POINT_COLOR,
          fillColor: MAP_SEARCH_POINT_COLOR,
          fillOpacity: 0.9,
        }}
      >
        <Popup>Vị trí đang tìm kiếm</Popup>
      </CircleMarker>

      {results.map((item) => (
        <Fragment key={item.business_id}>
          {item.business_id === selectedBusinessId && (
            // Vòng tròn accent phía dưới marker được chọn -- dấu hiệu
            // trực quan nối với dòng đang tô sáng trong RankingTable,
            // dùng cùng 1 màu (--color-map-marker-selected) cho cả 2 nơi.
            <CircleMarker
              center={[item.latitude, item.longitude]}
              radius={14}
              pathOptions={{
                color: MAP_MARKER_SELECTED_COLOR,
                fillColor: MAP_MARKER_SELECTED_COLOR,
                fillOpacity: 0.18,
                weight: 2,
              }}
              interactive={false}
            />
          )}
          <Marker
            position={[item.latitude, item.longitude]}
            opacity={item.business_id === selectedBusinessId ? 1 : 0.75}
            zIndexOffset={item.business_id === selectedBusinessId ? SELECTED_Z_INDEX : 0}
            eventHandlers={{ click: () => onSelectBusiness(item) }}
          >
            <Popup>
              <strong>{item.name}</strong>
              <br />
              Score: {item.score.toFixed(4)}
            </Popup>
          </Marker>
        </Fragment>
      ))}
    </MapContainer>
  )
}

/**
 * `useMap()` (hook riêng của react-leaflet) trả về đối tượng bản đồ
 * Leaflet gốc đang chạy bên trong <MapContainer>. Component này không
 * render UI gì (return null) -- nó chỉ tồn tại để, mỗi khi `latitude`/
 * `longitude` đổi (ví dụ sau khi bấm "Tìm kiếm" với toạ độ mới), gọi
 * `map.setView(...)` để bản đồ tự di chuyển tới đó.
 */
function RecenterOnChange({ latitude, longitude }) {
  const map = useMap()
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom())
  }, [latitude, longitude, map])
  return null
}

/**
 * `useMapEvents` đăng ký lắng nghe sự kiện của bản đồ (ở đây là "click").
 * Cũng là 1 component không render gì -- pattern quen thuộc của
 * react-leaflet: tạo 1 component "vô hình" chỉ để gắn logic vào bản đồ.
 */
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
    },
  })
  return null
}

export default MapView
