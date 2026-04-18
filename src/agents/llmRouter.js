const Anthropic = require('@anthropic-ai/sdk').default;
const config = require('../../config');

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = config.anthropic.apiKey;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  _client = new Anthropic({ apiKey });
  return _client;
}

async function chat({ model, system, messages, maxTokens = 160 }) {
  const client = getClient();
  const t0 = Date.now();
  const response = await client.messages.create({
    model: model || 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system,
    messages,
  });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim();
  return {
    text,
    usage: {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
    },
    model: model || 'claude-haiku-4-5',
    latency_ms: Date.now() - t0,
  };
}

module.exports = { chat };
