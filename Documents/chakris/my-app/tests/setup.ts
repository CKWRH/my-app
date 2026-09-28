class MockDurableObjectState {
  storage = {
    map: new Map<string, unknown>(),
    async put(key: string, value: unknown) {
      this.map.set(key, value)
    },
    async get(key: string) {
      return this.map.get(key)
    },
  }
}

class MockDurableObject {
  ctx: { storage: typeof MockDurableObjectState.prototype.storage }

  constructor(ctx?: { storage: typeof MockDurableObjectState.prototype.storage }) {
    this.ctx = ctx ?? { storage: new MockDurableObjectState().storage }
  }
}

;(globalThis as typeof globalThis & { DurableObject?: any; DurableObjectState?: any }).DurableObject = MockDurableObject
;(globalThis as typeof globalThis & { DurableObject?: any; DurableObjectState?: any }).DurableObjectState = MockDurableObjectState
