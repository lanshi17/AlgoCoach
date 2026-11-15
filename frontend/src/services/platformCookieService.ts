import axios from 'axios'
export type CookiePlatform = 'ACWING' | 'HDU'

export interface PlatformStatus {
  LEETCODE: boolean
  ACWING: boolean
  HDU: boolean
}

/** 统一登录态入口：一次取回三个平台的配置状态。 */
export const platformCookieService = {
  async summary(): Promise<PlatformStatus> {
    const { data } = await axios.get<PlatformStatus>('/api/platforms')
    return {
      LEETCODE: Boolean(data.LEETCODE),
      ACWING: Boolean(data.ACWING),
      HDU: Boolean(data.HDU),
    }
  },

  async status(platform: CookiePlatform | 'LEETCODE'): Promise<boolean> {
    const { data } = await axios.get<{ configured?: boolean }>(`/api/platforms/${platform}/status`)
    return Boolean(data.configured)
  },

  async save(platform: CookiePlatform, cookie: string): Promise<void> {
    await axios.post(`/api/platforms/${platform}/cookie`, { cookie: cookie.trim() })
  },

  /** LeetCode 走原端点（session + csrf 分开存）。 */
  async saveLeetCode(session: string, csrf: string): Promise<void> {
    await axios.post('/api/auth/cookie', { session: session.trim(), csrf: csrf.trim() })
  },

  /** LeetCode 真实登录校验（会请求上游）。 */
  async validateLeetCode(): Promise<boolean> {
    const { data } = await axios.get<{ authenticated?: boolean }>('/api/auth/validate')
    return Boolean(data.authenticated)
  },
}
