import crypto from 'crypto'
import type { NextApiRequest } from 'next'

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const MAX_BUCKETS = 10_000

interface FailureBucket {
  failures: number
  resetAt: number
}

const failureBuckets = new Map<string, FailureBucket>()

function clientAddress(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const firstForwarded = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]
  return firstForwarded?.trim() || req.socket.remoteAddress || 'unknown'
}

/** The map contains only an irreversible digest, never a raw email or IP. */
export function loginThrottleKey(
  req: NextApiRequest,
  normalizedEmail: string
): string {
  return crypto
    .createHash('sha256')
    .update(`${clientAddress(req)}\0${normalizedEmail}`)
    .digest('hex')
}

function prune(now: number) {
  failureBuckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) failureBuckets.delete(key)
  })

  while (failureBuckets.size >= MAX_BUCKETS) {
    const oldest = failureBuckets.keys().next().value
    if (typeof oldest !== 'string') break
    failureBuckets.delete(oldest)
  }
}

export function checkLoginThrottle(
  key: string,
  now = Date.now()
): { limited: boolean; retryAfterSeconds: number } {
  const bucket = failureBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    if (bucket) failureBuckets.delete(key)
    return { limited: false, retryAfterSeconds: 0 }
  }

  return {
    limited: bucket.failures >= MAX_FAILURES,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

export function recordLoginFailure(key: string, now = Date.now()) {
  prune(now)
  const bucket = failureBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    failureBuckets.set(key, { failures: 1, resetAt: now + WINDOW_MS })
    return
  }
  bucket.failures += 1
}

export function clearLoginFailures(key: string) {
  failureBuckets.delete(key)
}
