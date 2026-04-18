/**
 * Shared text-generation helper for page-level chatbots.
 * Supports Gemini and Grok using a normalized request interface.
 */

function normalizeProvider(provider) {
  return String(provider || 'gemini').trim().toLowerCase();
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text || '')
    .join('')
    .trim();
}

function extractGeminiProxyText(data) {
  if (typeof data?.text === 'string') return data.text.trim();
  if (typeof data?.response === 'string') return data.response.trim();
  return '';
}

async function requestGeminiProxy({ endpoint, systemPrompt, userMessage, history = [], fetchOptions = {} }) {
  const response = await fetch(endpoint, {
    ...fetchOptions,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers || {})
    },
    body: JSON.stringify({
      prompt: systemPrompt,
      text: userMessage,
      history
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = data?.detail || data?.message || data?.error || `Gemini proxy request failed with ${response.status}`;
    throw new Error(details);
  }

  const text = extractGeminiProxyText(data);
  if (!text) throw new Error('Gemini proxy returned an empty response');
  return text;
}

function extractGrokText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        return part?.text || '';
      })
      .join('')
      .trim();
  }
  return '';
}

async function requestGemini({ apiKey, model, systemPrompt, userMessage, fetchOptions = {} }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    ...fetchOptions,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers || {})
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\nUser question: ${userMessage}`
        }]
      }]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = data?.error?.message || data?.message || `Gemini request failed with ${response.status}`;
    throw new Error(details);
  }

  const text = extractGeminiText(data);
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

async function requestGrok({ apiKey, model, systemPrompt, userMessage, fetchOptions = {}, apiBase }) {
  const endpoint = `${apiBase || 'https://api.x.ai/v1'}/chat/completions`;
  const response = await fetch(endpoint, {
    ...fetchOptions,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(fetchOptions.headers || {})
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = data?.error?.message || data?.message || `Grok request failed with ${response.status}`;
    throw new Error(details);
  }

  const text = extractGrokText(data);
  if (!text) throw new Error('Grok returned an empty response');
  return text;
}

export async function sendChatCompletion(options) {
  const provider = normalizeProvider(options?.provider);
  const apiKey = options?.apiKey;
  const model = options?.model;

  if (!options?.systemPrompt) throw new Error('Missing system prompt');
  if (!options?.userMessage) throw new Error('Missing user message');

  if (provider === 'gemini') {
    if (options?.endpoint) {
      return requestGeminiProxy(options);
    }
    if (!apiKey) throw new Error(`Missing API key for provider "${provider}"`);
    if (!model) throw new Error(`Missing model for provider "${provider}"`);
    return requestGemini(options);
  }

  if (provider === 'grok') {
    if (!apiKey) throw new Error(`Missing API key for provider "${provider}"`);
    if (!model) throw new Error(`Missing model for provider "${provider}"`);
    return requestGrok(options);
  }

  throw new Error(`Unsupported chat provider "${provider}"`);
}
