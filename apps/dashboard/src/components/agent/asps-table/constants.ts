// Tailwindのスペーシングスケールに準拠（1単位 = 4px = 0.25rem）
export const w = (units: number) => units * 4

// カラムの最小幅（Tailwind準拠）
export const MIN_COLUMN_WIDTH = w(40) // 160px
export const CHECKBOX_WIDTH = w(10)   // 40px
export const NAME_MIN_WIDTH = w(80)   // 320px

// カラム幅の初期値
export const STATUS_WIDTH = w(20)     // 80px

export const DEFAULT_COLUMN_SIZES: Record<string, number> = {
  select: CHECKBOX_WIDTH,
  status: STATUS_WIDTH,       // 80px
  name: w(80),                // 320px
  media: w(40),               // 160px
  loginUrl: w(40),            // 160px
  username: w(40),            // 160px
  password: w(40),            // 160px
  recaptcha: w(30),           // 120px
  lastScrape: w(40),          // 160px
}

// localStorage keys
export const STORAGE_KEY_COLUMN_ORDER = "asps-table-column-order"
export const STORAGE_KEY_COLUMN_VISIBILITY = "asps-table-column-visibility"
export const STORAGE_KEY_COLUMN_SIZES = "asps-table-column-sizes-v2" // v2: fixed 160px columns

// reCAPTCHA突破状況
export type RecaptchaStatus = 'not_applicable' | 'bypassed' | 'unstable' | 'blocked' | 'unknown'

// 最後のスクレイピング結果
export type ScrapeStatus = 'success' | 'failed' | 'partial'

// ASP型定義
export interface AspWithCredentials {
  id: string
  name: string
  login_url: string | null
  created_at: string
  updated_at: string | null
  credentials: AspCredential[]
  // 稼働状況
  is_active: boolean | null
  // reCAPTCHA関連
  has_recaptcha: boolean | null
  recaptcha_status: string | null
  last_scrape_at: string | null
  last_scrape_status: string | null
  scrape_notes: string | null
}

export interface AspCredential {
  id: string
  asp_id: string
  media_id: string
  username_secret_key: string | null
  password_secret_key: string | null
  media: {
    id: string
    name: string
  }
}
