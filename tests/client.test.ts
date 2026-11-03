import { describe, expect, it, vi } from 'vitest'
import { createOrmanClient, tagsForPath } from '../src/client'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function client(fetchImpl: typeof fetch, extra = {}) {
  return createOrmanClient({ origin: 'https://origin.test', token: 'tok', fetch: fetchImpl, retryDelayMs: 0, ...extra })
}

describe('tagsForPath', () => {
  it('tags a page with its path', () => {
    expect(tagsForPath('/page?uri=/blog/hello&site=default')).toEqual(['orman:all', 'path:/blog/hello'])
  })
  it('tags paths, site, listings, trees, navs and globals', () => {
    expect(tagsForPath('/paths?site=default&page=1')).toEqual(['orman:all', 'paths'])
    expect(tagsForPath('/site')).toEqual(['orman:all', 'site'])
    expect(tagsForPath('/collections/blog/entries?sort=-date')).toEqual(['orman:all', 'collection:blog'])
    expect(tagsForPath('/trees/collections/themes?fields=a')).toEqual(['orman:all', 'collection:themes'])
    expect(tagsForPath('/navs/main?site=default')).toEqual(['orman:all', 'nav:main'])
    expect(tagsForPath('/globals/site')).toEqual(['orman:all', 'global:site'])
  })
  it('always includes orman:all', () => {
    expect(tagsForPath('/globals')).toEqual(['orman:all'])
  })
})

describe('createOrmanClient', () => {
  it('sends the bearer token to origin + prefix and tags the cache entry', async () => {
    const f = vi.fn<typeof fetch>(async () => json(200, { type: 'entry', tags: [] }))
    await client(f).page('/about', { site: 'fa' })
    const [url, init] = f.mock.calls[0] as [string, RequestInit & { next?: unknown }]
    expect(url).toBe('https://origin.test/api/headless/v1/page?uri=%2Fabout&site=fa')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(init.next).toEqual({ tags: ['orman:all', 'path:/about'], revalidate: false })
  })

  it('honours a custom prefix', async () => {
    const f = vi.fn<typeof fetch>(async () => json(200, { tags: [] }))
    await client(f, { apiPrefix: '/api/h/v2' }).site()
    expect(f.mock.calls[0][0]).toBe('https://origin.test/api/h/v2/site')
  })

  it('reads /site with addons', async () => {
    const body = { contract_version: 1, site: 'fa', addons: { seo: {} }, tags: ['site', 'orman:all'] }
    expect(await client(async () => json(200, body)).site()).toEqual(body)
  })

  it('reads a form schema, tagged form:<handle>', async () => {
    const f = vi.fn<typeof fetch>(async () => json(200, { data: { handle: 'contact', fields: [], captcha: null }, tags: ['form:contact', 'orman:all'] }))
    const res = await client(f).form('contact')
    const [url, init] = f.mock.calls[0] as [string, RequestInit & { next?: unknown }]
    expect(url).toBe('https://origin.test/api/headless/v1/forms/contact')
    expect(init.next).toEqual({ tags: ['orman:all', 'form:contact'], revalidate: false })
    expect(res.data.handle).toBe('contact')
  })

  it('returns an unknown form as data', async () => {
    expect(await client(async () => json(404, { type: 'not_found', tags: [] })).form('nope')).toEqual({ type: 'not_found', tags: [] })
  })

  it('builds the other endpoints', async () => {
    const f = vi.fn<typeof fetch>(async () => json(200, { tags: [] }))
    const c = client(f)
    await c.paths({ page: 2 })
    await c.globals()
    await c.globals('site')
    await c.navs('main')
    await c.trees('themes', { fields: ['a', 'b'] })
    await c.entries('blog', { sort: '-date' })
    expect(f.mock.calls.map(call => String(call[0]).replace('https://origin.test/api/headless/v1', ''))).toEqual([
      '/paths?page=2',
      '/globals',
      '/globals/site',
      '/navs/main',
      '/trees/collections/themes?fields=a%2Cb',
      '/collections/blog/entries?sort=-date',
    ])
  })

  it('returns a 404 as data', async () => {
    expect(await client(async () => json(404, { type: 'not_found', tags: [] })).page('/x')).toEqual({ type: 'not_found', tags: [] })
  })

  it('throws on other statuses without leaking the token', async () => {
    const error: Error = await client(async () => json(500, {})).page('/x').then(() => new Error('no throw'), e => e as Error)
    expect(error.message).toBe('Orman 500 for /page?uri=%2Fx')
    expect(error.message).not.toContain('tok')
  })

  it('a preview token goes in X-Orman-Token and is never cached', async () => {
    const f = vi.fn<typeof fetch>(async () => json(200, { tags: [] }))
    await client(f).page('/x', {}, { previewToken: 'pv' })
    const init = f.mock.calls[0][1] as RequestInit & { next?: unknown }
    expect((init.headers as Record<string, string>)['X-Orman-Token']).toBe('pv')
    expect(init.cache).toBe('no-store')
    expect(init.next).toBeUndefined()
  })

  it('retries network failures, not statuses', async () => {
    const f = vi.fn<typeof fetch>()
    f.mockRejectedValueOnce(new TypeError('connect timeout')).mockResolvedValueOnce(json(200, { tags: [] }))
    await client(f).site()
    expect(f).toHaveBeenCalledTimes(2)

    const down = vi.fn<typeof fetch>(async () => {
      throw new TypeError('down')
    })
    await expect(client(down).site()).rejects.toThrow('down')
    expect(down).toHaveBeenCalledTimes(3)

    const bad = vi.fn<typeof fetch>(async () => json(500, {}))
    await client(bad).site().catch(() => {})
    expect(bad).toHaveBeenCalledTimes(1)
  })
})
