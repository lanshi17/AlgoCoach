import type { ModelProviderConfig, ProviderProtocol } from '@/types'

export interface ProviderPreset extends Omit<ModelProviderConfig, 'apiKey'> {
  hint: string
}

// OMP-style presets: endpoint and model remain editable because availability
// depends on the user's account, region, and compatible gateway.
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5', hint: 'Claude API' },
  { id: 'openai', name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hint: 'OpenAI-compatible' },
  { id: 'openai-response', name: 'OpenAI Responses', protocol: 'openai-response', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hint: 'OpenAI Responses API' },
  { id: 'opencode-go', name: 'OpenCode Go', protocol: 'openai', baseUrl: 'https://opencode.ai/inference/go/openai/v1', model: 'deepseek-v4.1-flash', hint: 'OpenCode Go 订阅（OpenAI-compatible）' },
  { id: 'commandcode-goat', name: 'Command Code GOAT', protocol: 'openai', baseUrl: 'https://api.commandcode.ai/provider/v1', model: 'deepseek/deepseek-v4.1-flash', hint: 'Command Code GOAT（OpenAI-compatible；支持可选 Responses）' },
  { id: 'deepseek', name: 'DeepSeek', protocol: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', hint: 'DeepSeek API' },
  { id: 'qwen', name: 'Qwen / DashScope', protocol: 'dashscope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', hint: '通义千问兼容接口' },
  { id: 'moonshot', name: 'Moonshot / Kimi', protocol: 'moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', hint: 'Moonshot API' },
  { id: 'minimax', name: 'MiniMax', protocol: 'minimax', baseUrl: 'https://api.minimax.io/anthropic', model: 'MiniMax-M2.1', hint: 'Anthropic-compatible' },
  { id: 'gemini', name: 'Google Gemini', protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', hint: 'Gemini OpenAI-compatible' },
  { id: 'openrouter', name: 'OpenRouter', protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', hint: '多模型 OpenAI-compatible' },
  { id: 'ollama', name: 'Ollama', protocol: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen3:8b', hint: '本地 OpenAI-compatible' },
  { id: 'volcengine', name: 'Volcengine / 豆包', protocol: 'volcengine', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'ep-xxxxxxxx', hint: '火山方舟' },
  { id: 'xai', name: 'xAI', protocol: 'xai', baseUrl: 'https://api.x.ai', model: 'grok-3-mini', hint: 'xAI API' },
]

export const CUSTOM_PROVIDER_PRESET: ProviderPreset = {
  id: 'custom', name: '自定义 Provider', protocol: 'openai', baseUrl: '', model: '', hint: 'OpenAI / Anthropic-compatible',
}

export const PROTOCOL_OPTIONS: Array<{ value: ProviderProtocol; label: string }> = [
  { value: 'openai', label: 'OpenAI-compatible' },
  { value: 'openai-response', label: 'OpenAI Responses API' },
  { value: 'anthropic', label: 'Anthropic-compatible' },
]

export function providerFromPreset(preset: ProviderPreset, apiKey = ''): ModelProviderConfig {
  return { ...preset, apiKey }
}
