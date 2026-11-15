import { describe, expect, it } from 'vitest'
import { PROVIDER_PRESETS } from './providerPresets'

describe('Command Code GOAT preset', () => {
  it('uses its documented Chat Completions endpoint by default', () => {
    const preset = PROVIDER_PRESETS.find(item => item.id === 'commandcode-goat')

    expect(preset).toMatchObject({
      protocol: 'openai',
      baseUrl: 'https://api.commandcode.ai/provider/v1',
      model: 'deepseek/deepseek-v4.1-flash',
    })
  })
})
