import type { LookupAnswer, LookupQuestion, OverlayLookupFacilitator } from '@bsv/sdk'
import { AppCatalog } from './index.js'

class MockLookupFacilitator implements OverlayLookupFacilitator {
  readonly calls: Array<{ host: string, question: LookupQuestion, timeout?: number }> = []

  constructor (
    private readonly responses: Record<string, LookupAnswer | Error>
  ) {}

  async lookup (
    host: string,
    question: LookupQuestion,
    timeout?: number
  ): Promise<LookupAnswer> {
    this.calls.push({ host, question, timeout })
    const response = this.responses[host]
    if (response instanceof Error) throw response
    return response ?? { type: 'output-list', outputs: [] }
  }
}

describe('AppCatalog direct host lookup', () => {
  it('queries every configured host and reports failures without failing the lookup', async () => {
    const facilitator = new MockLookupFacilitator({
      'https://overlay-ap-1.example': {
        type: 'output-list',
        outputs: [{ beef: [], outputIndex: 0 }]
      },
      'https://overlay-eu-1.example': new Error('region unavailable')
    })
    const catalog = new AppCatalog({ networkPreset: 'mainnet' })

    const result = await catalog.findAppsAcrossHosts({}, {
      facilitator,
      hosts: ['https://overlay-ap-1.example', 'https://overlay-eu-1.example'],
      timeout: 1234
    })

    expect(result.apps).toEqual([])
    expect(facilitator.calls).toHaveLength(2)
    expect(facilitator.calls[0].timeout).toBe(1234)
    expect(result.diagnostics.hosts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        host: 'https://overlay-ap-1.example',
        ok: true,
        rawOutputCount: 1,
        parsedAppCount: 0,
        parseFailureCount: 1
      }),
      expect.objectContaining({
        host: 'https://overlay-eu-1.example',
        ok: false,
        error: 'region unavailable'
      })
    ]))
  })

  it('lets findApps use direct hosts when hosts are supplied', async () => {
    const facilitator = new MockLookupFacilitator({
      'https://overlay-us-1.example': { type: 'output-list', outputs: [] }
    })
    const catalog = new AppCatalog({ networkPreset: 'mainnet' })

    const apps = await catalog.findApps({ category: 'Utility' }, {
      facilitator,
      hosts: ['https://overlay-us-1.example/'],
      includeBeef: false
    })

    expect(apps).toEqual([])
    expect(facilitator.calls).toHaveLength(1)
    expect(facilitator.calls[0].host).toBe('https://overlay-us-1.example')
    expect(facilitator.calls[0].question).toEqual({
      service: 'ls_apps',
      query: {
        category: 'Utility',
        includeBeef: false
      }
    })
  })
})
