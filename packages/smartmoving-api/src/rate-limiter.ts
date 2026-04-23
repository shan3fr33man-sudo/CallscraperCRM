/**
 * Token-bucket rate limiter shared across the package.
 *
 * SmartMoving Premium API cap is 125,000 calls/month. Two brands share that
 * budget via callscraper.com v3 (live calls, notes, follow-ups) plus our new
 * historical/delta scrapes. We set a conservative per-minute ceiling so the
 * one-time 14K-job historical pull can't starve the live path.
 *
 * Internal: refill at `tokensPerInterval` tokens every `intervalMs`. Acquire
 * returns a promise that resolves when a token is available.
 */
export class RateLimiter {
  private available: number;
  private queue: Array<() => void> = [];
  private readonly max: number;
  private readonly refillPerMs: number;
  private lastRefill: number;

  constructor(opts: { tokensPerInterval: number; intervalMs: number }) {
    this.max = opts.tokensPerInterval;
    this.available = opts.tokensPerInterval;
    this.refillPerMs = opts.tokensPerInterval / opts.intervalMs;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.available = Math.min(this.max, this.available + elapsed * this.refillPerMs);
    this.lastRefill = now;
    while (this.available >= 1 && this.queue.length > 0) {
      this.available -= 1;
      const resolve = this.queue.shift()!;
      resolve();
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.available >= 1) {
      this.available -= 1;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      const tokensNeeded = 1;
      const waitMs = Math.ceil(tokensNeeded / this.refillPerMs);
      setTimeout(() => this.refill(), waitMs);
    });
  }
}

/** Shared limiter used by the default client. 60 req/min. */
export const defaultLimiter = new RateLimiter({
  tokensPerInterval: 60,
  intervalMs: 60_000,
});
