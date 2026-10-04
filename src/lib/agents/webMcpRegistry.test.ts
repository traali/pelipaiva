import { describe, expect, it } from 'vitest'
import { shouldKeepHostContext } from './webMcpRegistry'

describe('shouldKeepHostContext', () => {
  it('keeps a Chrome or ChatGPT host that only has registerTool', () => {
    expect(shouldKeepHostContext({ registerTool() {} })).toBe(true)
  })

  it('does not treat an empty page as a host', () => {
    expect(shouldKeepHostContext(undefined)).toBe(false)
    expect(shouldKeepHostContext({})).toBe(false)
  })
})
