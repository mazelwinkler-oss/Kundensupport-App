/**
 * Rate limiter with exponential backoff and in-memory caching for Weclapp API
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

interface RateLimitState {
  requestCount: number
  windowStart: number
  backoffUntil: number
}

const RATE_LIMIT = 100 // Max requests per minute
const WINDOW_MS = 60 * 1000 // 1 minute window
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache
const MAX_BACKOFF_MS = 60 * 1000 // Max 60 seconds backoff

class RateLimiter {
  private state: RateLimitState = {
    requestCount: 0,
    windowStart: Date.now(),
    backoffUntil: 0
  }

  private cache: Map<string, CacheEntry<any>> = new Map()

  /**
   * Check if we can make a request, and if not, how long to wait
   */
  canRequest(): { allowed: boolean; waitMs: number } {
    const now = Date.now()

    // Check if in backoff
    if (now < this.state.backoffUntil) {
      return { allowed: false, waitMs: this.state.backoffUntil - now }
    }

    // Reset window if expired
    if (now - this.state.windowStart >= WINDOW_MS) {
      this.state.requestCount = 0
      this.state.windowStart = now
    }

    // Check rate limit
    if (this.state.requestCount >= RATE_LIMIT) {
      const waitMs = WINDOW_MS - (now - this.state.windowStart)
      return { allowed: false, waitMs }
    }

    return { allowed: true, waitMs: 0 }
  }

  /**
   * Record a successful request
   */
  recordRequest(): void {
    this.state.requestCount++
  }

  /**
   * Handle a 429 response with exponential backoff
   */
  handleRateLimitError(retryAfterMs?: number): void {
    const backoffMs = retryAfterMs || Math.min(
      Math.pow(2, this.state.requestCount / 20) * 1000,
      MAX_BACKOFF_MS
    )
    this.state.backoffUntil = Date.now() + backoffMs
  }

  /**
   * Get cached data
   */
  getCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache data
   */
  setCache<T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs
    })
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// Singleton instance for Weclapp
export const weclappRateLimiter = new RateLimiter()

/**
 * Wrapper function for rate-limited API calls with caching
 */
export async function rateLimitedRequest<T>(
  cacheKey: string,
  requestFn: () => Promise<T>,
  options: { skipCache?: boolean; cacheTtlMs?: number } = {}
): Promise<T> {
  // Check cache first
  if (!options.skipCache) {
    const cached = weclappRateLimiter.getCache<T>(cacheKey)
    if (cached !== null) {
      return cached
    }
  }

  // Check rate limit
  const { allowed, waitMs } = weclappRateLimiter.canRequest()
  if (!allowed) {
    await sleep(waitMs)
  }

  try {
    weclappRateLimiter.recordRequest()
    const result = await requestFn()
    weclappRateLimiter.setCache(cacheKey, result, options.cacheTtlMs)
    return result
  } catch (error: any) {
    // Handle 429 Too Many Requests
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '0', 10) * 1000
      weclappRateLimiter.handleRateLimitError(retryAfter)

      // Retry after backoff
      await sleep(retryAfter || 5000)
      return rateLimitedRequest(cacheKey, requestFn, { ...options, skipCache: true })
    }
    throw error
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
