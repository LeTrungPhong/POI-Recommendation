// Tất cả các hàm gọi Backend (FastAPI) đi qua đây.
// Dùng "/api/..." (không phải "http://127.0.0.1:8000/...") vì Vite dev
// server sẽ proxy nó sang backend thật -- xem vite.config.js.

const BASE_URL = '/api'

/**
 * Gọi POST /recommend.
 * @param {{
 *   latitude: number,
 *   longitude: number,
 *   k?: number,
 *   categories?: string[],
 *   max_distance_km?: number,
 *   user_id?: string,
 *   weights?: { cf: number, geo: number, cat: number },
 * }} params
 * @returns {Promise<Array<object>>} danh sách Recommendation (đã sort theo score giảm dần)
 */
export async function fetchRecommendations(params) {
  const response = await fetch(`${BASE_URL}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const detail = await safeReadErrorDetail(response)
    throw new Error(`/recommend thất bại (${response.status}): ${detail}`)
  }

  return response.json()
}

/**
 * Gọi GET /explain cho một business cụ thể.
 * Lưu ý: /explain nhận trọng số qua 3 query param riêng lẻ
 * (cf_weight, geo_weight, cat_weight), KHÔNG phải object weights.
 */
export async function fetchExplanation({
  businessId,
  latitude,
  longitude,
  userId,
  categories = [],
  decayRate = 0.15,
  weights = { cf: 0.4, geo: 0.3, cat: 0.3 },
}) {
  const query = new URLSearchParams({
    business_id: businessId,
    latitude: String(latitude),
    longitude: String(longitude),
    decay_rate: String(decayRate),
    cf_weight: String(weights.cf),
    geo_weight: String(weights.geo),
    cat_weight: String(weights.cat),
  })
  if (userId) query.set('user_id', userId)
  for (const category of categories) query.append('categories', category)

  const response = await fetch(`${BASE_URL}/explain?${query.toString()}`)

  if (!response.ok) {
    const detail = await safeReadErrorDetail(response)
    throw new Error(`/explain thất bại (${response.status}): ${detail}`)
  }

  return response.json()
}

/**
 * Gọi POST /whatif.
 * Lưu ý: trong `scenario` chỉ đưa field muốn override -- KHÔNG đưa field
 * với giá trị null/undefined tường minh, vì backend dùng exclude_unset và
 * sẽ coi null là "override thành null" chứ không phải "bỏ qua field này".
 */
export async function fetchWhatIf({ baseline, scenario }) {
  const response = await fetch(`${BASE_URL}/whatif`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseline, scenario }),
  })

  if (!response.ok) {
    const detail = await safeReadErrorDetail(response)
    throw new Error(`/whatif thất bại (${response.status}): ${detail}`)
  }

  return response.json()
}

async function safeReadErrorDetail(response) {
  try {
    const body = await response.json()
    return typeof body?.detail === 'string' ? body.detail : JSON.stringify(body?.detail ?? body)
  } catch {
    return response.statusText
  }
}
