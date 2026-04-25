import type { Bindings } from '../types/bindings.js'

type RedisCommandValue = string | number

type UpstashResponse<T> = {
  result?: T
  error?: string
}

const DEFAULT_RESOURCE_VERSION = 1

export type CacheClient = {
  enabled: boolean
  getJson<T>(key: string): Promise<T | null>
  setJson(key: string, value: unknown, ttlSeconds: number): Promise<void>
  getResourceVersion(resource: string): Promise<number>
  getResourceVersions(resources: readonly string[]): Promise<Record<string, number>>
  bumpResourceVersion(resource: string): Promise<void>
}

export function createCache(env: Partial<Bindings> | undefined): CacheClient {
  const nodeEnv = typeof process !== 'undefined' ? process.env : undefined
  const url = env?.UPSTASH_REDIS_REST_URL ?? nodeEnv?.UPSTASH_REDIS_REST_URL
  const token = env?.UPSTASH_REDIS_REST_TOKEN ?? nodeEnv?.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return createNoopCache()
  }

  const normalizedUrl = url.replace(/\/+$/, '')

  async function runCommand<T>(...command: RedisCommandValue[]) {
    const response = await fetch(`${normalizedUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command)
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as UpstashResponse<T>
    if (payload.error) {
      return null
    }

    return payload.result ?? null
  }

  async function getResourceVersion(resource: string) {
    const raw = await runCommand<string>('GET', resourceVersionKey(resource))
    const parsed = Number(raw)

    if (!Number.isInteger(parsed) || parsed < DEFAULT_RESOURCE_VERSION) {
      return DEFAULT_RESOURCE_VERSION
    }

    return parsed
  }

  return {
    enabled: true,
    async getJson<T>(key: string) {
      const value = await runCommand<string>('GET', key)
      if (!value) {
        return null
      }

      try {
        return JSON.parse(value) as T
      } catch {
        return null
      }
    },
    async setJson(key: string, value: unknown, ttlSeconds: number) {
      await runCommand('SET', key, JSON.stringify(value), 'EX', ttlSeconds)
    },
    getResourceVersion,
    async getResourceVersions(resources: readonly string[]) {
      const versions: Record<string, number> = {}
      await Promise.all(
        resources.map(async (resource) => {
          versions[resource] = await getResourceVersion(resource)
        })
      )

      return versions
    },
    async bumpResourceVersion(resource: string) {
      const key = resourceVersionKey(resource)
      await runCommand('SET', key, DEFAULT_RESOURCE_VERSION, 'NX')
      await runCommand('INCR', key)
    }
  }
}

function resourceVersionKey(resource: string) {
  return `cache:resource:${resource}:version`
}

function createNoopCache(): CacheClient {
  return {
    enabled: false,
    async getJson() {
      return null
    },
    async setJson() {},
    async getResourceVersion() {
      return DEFAULT_RESOURCE_VERSION
    },
    async getResourceVersions(resources) {
      return Object.fromEntries(resources.map((resource) => [resource, DEFAULT_RESOURCE_VERSION]))
    },
    async bumpResourceVersion() {}
  }
}
