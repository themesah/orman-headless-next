import { api, type ApiOptions } from '../csrf'
import type { StreamInfo } from '../types'

export interface StreamOptions {
  /** `addons.notifications.inbox` + `/stream`. Default `/!/notifications/inbox/stream`. */
  url?: string
  api?: ApiOptions
  /** Called for every pushed update (parsed JSON; `{}` when the data is not JSON). */
  onEvent: (event: Record<string, unknown>) => void
  /** Called on every poll tick while the hub is unreachable (or the site has none). */
  onPoll: () => void
  /** A 401 while asking for the token: the person is signed out. */
  onSignedOut?: () => void
  /** Test seam. */
  fetchImpl?: typeof fetch
}

/**
 * Follows the person's own Mercure topic. The token comes from Orman (`/!/…/stream`, 15 minutes, subscribe to this topic only) and
 * goes in an Authorization header (fetch-based SSE), never in a URL. The browser talks to the hub directly, not through the proxy.
 * Before the token runs out it asks for a new one and reconnects; when the hub cannot be reached, or the site has none, it polls
 * instead (`onPoll` every `poll_seconds`). Returns a stop function.
 */
export function followStream(options: StreamOptions): () => void {
  const doFetch = options.fetchImpl ?? fetch
  let stopped = false
  let abort: AbortController | null = null
  let timers: ReturnType<typeof setTimeout>[] = []
  let poller: ReturnType<typeof setInterval> | null = null
  let failures = 0

  const later = (ms: number, run: () => void) => {
    const t = setTimeout(run, ms)
    timers.push(t)
  }
  const startPolling = (seconds: number) => {
    if (poller || stopped) return
    options.onPoll()
    poller = setInterval(options.onPoll, seconds * 1000)
  }
  const stopPolling = () => {
    if (poller) clearInterval(poller)
    poller = null
  }

  async function connect(): Promise<void> {
    if (stopped) return
    const res = await api<{ stream: StreamInfo | null; poll_seconds?: number }>('GET', options.url ?? '/!/notifications/inbox/stream', undefined, options.api)
    if (stopped) return
    if (!res.ok) {
      if (res.status === 401) return options.onSignedOut?.()
      startPolling(30)
      return later(Math.min(60_000, 2000 * 2 ** failures++), connect)
    }
    const poll = res.body.poll_seconds ?? 30
    const info = res.body.stream
    if (!info) {
      startPolling(poll)
      return later(5 * 60_000, connect)
    }

    abort = new AbortController()
    const renewIn = Math.max(10_000, new Date(info.expires_at).getTime() - Date.now() - 60_000)
    later(renewIn, () => {
      abort?.abort()
      void connect()
    })
    try {
      const url = new URL(info.hub)
      url.searchParams.append('topic', info.topic)
      const response = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${info.token}`, Accept: 'text/event-stream' }, signal: abort.signal, cache: 'no-store' })
      if (!response.ok || !response.body) throw new Error(`hub ${response.status}`)
      failures = 0
      stopPolling()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let at: number
        while ((at = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, at)
          buffer = buffer.slice(at + 2)
          const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n')
          if (!data) continue
          let parsed: Record<string, unknown> = {}
          try {
            parsed = JSON.parse(data)
          } catch {
            // not JSON: still a signal that something changed
          }
          options.onEvent(parsed)
        }
      }
    } catch {
      if (stopped || abort?.signal.aborted) return
    }
    if (stopped || abort?.signal.aborted) return
    startPolling(poll)
    later(Math.min(60_000, 2000 * 2 ** failures++), connect)
  }

  void connect()
  return () => {
    stopped = true
    abort?.abort()
    timers.forEach(clearTimeout)
    timers = []
    stopPolling()
  }
}
