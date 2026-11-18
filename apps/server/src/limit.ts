/**
 * A per-client cap on questions, so one script cannot spend the gateway budget. It lives in memory, which is enough for a single instance.
 */
export class RateLimit {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Records a request from `client` at `now`, and says whether it is allowed. */
  allow(client: string, now: number): boolean {
    const recent = (this.hits.get(client) ?? []).filter((at) => now - at < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(client, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(client, recent);
    if (this.hits.size > 10_000) {
      this.sweep(now);
    }
    return true;
  }

  private sweep(now: number): void {
    for (const [client, times] of this.hits) {
      if (times.every((at) => now - at >= this.windowMs)) {
        this.hits.delete(client);
      }
    }
  }
}
