// Spike: verify route handlers can be imported and invoked in bun test runtime.
import { describe, expect, test } from 'bun:test'
import { GET as registryGET } from '@/app/api/core/registry/route'

describe('spike', () => {
  test('registry GET handler runs outside Next runtime', async () => {
    const res = await registryGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platform).toBeDefined()
  })
})
