const DEFAULT_LAUNCH_AT = '2026-08-01T00:30:00.000Z' // 2026-08-01 06:00 IST

export function getLaunchAt(): Date {
  const raw = process.env.NEXT_PUBLIC_LAUNCH_AT
  const parsed = raw ? new Date(raw) : null
  return parsed && !isNaN(parsed.getTime()) ? parsed : new Date(DEFAULT_LAUNCH_AT)
}

export function isLive(now: Date = new Date()): boolean {
  return now.getTime() >= getLaunchAt().getTime()
}
