import { HttpRangeFetcher } from '@gmod/http-range-fetcher'
import { Buffer } from 'buffer'
import { RemoteFile, PolyfilledResponse } from 'generic-filehandle'

type BinaryRangeFetch = (
  url: string,
  start: number,
  end: number,
  options?: { headers?: HeadersInit; signal?: AbortSignal },
) => Promise<BinaryRangeResponse>

export interface BinaryRangeResponse {
  headers: Record<string, string>
  requestDate: Date
  responseDate: Date
  buffer: Buffer
}

const fetchers: Record<string, BinaryRangeFetch> = {}

function binaryRangeFetch(
  url: string,
  start: number,
  end: number,
  options: { headers?: HeadersInit; signal?: AbortSignal } = {},
): Promise<BinaryRangeResponse> {
  const fetcher = fetchers[url]
  if (!fetcher) {
    throw new Error(`fetch not registered for ${url}`)
  }
  return fetcher(url, start, end, options)
}

const globalRangeCache = new HttpRangeFetcher({
  fetch: binaryRangeFetch,
  size: 500 * 1024 ** 2, // 500MiB
  chunkSize: 128 * 1024, // 128KiB
  maxFetchSize: 100 * 1024 ** 2, // 100MiB
  minimumTTL: 24 * 60 * 60 * 1000, // 1 day
})

export function clearCache() {
  globalRangeCache.reset()
}

export class RemoteFileWithRangeCache extends RemoteFile {
  public async fetch(
    url: RequestInfo,
    init?: RequestInit,
  ): Promise<PolyfilledResponse> {
    const str = String(url)
    if (!fetchers[str]) {
      fetchers[str] = this.fetchBinaryRange.bind(this)
    }
    // if it is a range request, route it through the range cache
    const range = new Headers(init?.headers)?.get('range')
    if (range) {
      const rangeParse = /bytes=(\d+)-(\d+)/.exec(range)
      if (rangeParse) {
        const [, start, end] = rangeParse
        const s = Number.parseInt(start, 10)
        const e = Number.parseInt(end, 10)
        const len = e - s
        const { buffer, headers } = (await globalRangeCache.getRange(
          url,
          s,
          len + 1,
          { signal: init?.signal },
        )) as BinaryRangeResponse
        return new Response(buffer, { status: 206, headers })
      }
    }
    return super.fetch(url, init)
  }

  public async fetchBinaryRange(
    url: string,
    start: number,
    end: number,
    options: { headers?: HeadersInit; signal?: AbortSignal } = {},
  ): Promise<BinaryRangeResponse> {
    const requestDate = new Date()
    const res = await super.fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        range: `bytes=${start}-${end}`,
      },
    })
    const responseDate = new Date()
    if (!res.ok) {
      const errorMessage = `HTTP ${res.status} fetching ${url} bytes ${start}-${end}`
      const hint = ' (should be 206 for range requests)'
      throw new Error(`${errorMessage}${res.status === 200 ? hint : ''}`)
    }

    // translate the Headers object into a regular key -> value object.
    // will miss duplicate headers of course
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers: Record<string, any> = {}
    for (const [k, v] of res.headers.entries()) {
      headers[k] = v
    }

    // return the response headers, and the data buffer
    const arrayBuffer = await res.arrayBuffer()
    return {
      headers,
      requestDate,
      responseDate,
      buffer: Buffer.from(arrayBuffer),
    }
  }
}
