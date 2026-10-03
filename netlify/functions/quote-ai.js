// Trade 360 — AI Quote Builder backend
//
// Proxies the quote page's AI calls to the Anthropic Messages API, using
// your own Anthropic API key (never exposed to the browser).
//
// Required setup in the Netlify dashboard (Site configuration → Environment
// variables), see README-DEPLOY.md for the full walkthrough:
//   ANTHROPIC_API_KEY        — required. Your Anthropic API key (starts "sk-ant-").
//   ANTHROPIC_MODEL_QUICK    — optional. Defaults to a Haiku model (fast/cheap).
//   ANTHROPIC_MODEL_DEFAULT  — optional. Defaults to a Sonnet model (quality).
//
// Request body (sent by ai-quote-demo's page JS):
//   { mode: "json" | "text", prompt: string, modelTier: "quick"|"default"|"complex",
//     image?: { data: "<base64>", mediaType: "image/jpeg" } }
//
// Response:
//   mode "json" → { json: <parsed object> }
//   mode "text" → { text: string, truncated: boolean }
//   error       → { code: string, message: string }  (4xx/5xx status)

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const MODEL_QUICK = process.env.ANTHROPIC_MODEL_QUICK || 'claude-haiku-4-5-20251001';
const MODEL_DEFAULT = process.env.ANTHROPIC_MODEL_DEFAULT || 'claude-sonnet-5-5';

const MAX_PROMPT_CHARS = 20000;
const MAX_TOKENS_JSON = 1500;
const MAX_TOKENS_TEXT = 2000;

function jsonResponse(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function errorResponse(statusCode, code, message) {
  return jsonResponse(statusCode, { code: code, message: message });
}

// Strips ```json ... ``` / ``` ... ``` fences some models wrap JSON in,
// then parses it. Throws if the result still isn't valid JSON.
function parseModelJSON(text) {
  var cleaned = text.trim();
  var fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Use POST.');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse(
      500,
      'unavailable',
      'ANTHROPIC_API_KEY is not set in this site\'s environment variables yet.'
    );
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return errorResponse(400, 'invalid_request', 'Malformed request body.');
  }

  var mode = body.mode === 'json' ? 'json' : body.mode === 'text' ? 'text' : null;
  var prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!mode || !prompt) {
    return errorResponse(400, 'invalid_request', 'Missing mode or prompt.');
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return errorResponse(400, 'prompt_too_large', 'That request is too long.');
  }

  var model = body.modelTier === 'quick' ? MODEL_QUICK : MODEL_DEFAULT;

  var content = [];
  if (body.image && body.image.data) {
    var mediaType = body.image.mediaType || 'image/jpeg';
    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.indexOf(mediaType) === -1) {
      return errorResponse(400, 'image_rejected', 'Unsupported image type.');
    }
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: body.image.data },
    });
  }
  content.push({ type: 'text', text: prompt });

  var anthropicBody = {
    model: model,
    max_tokens: mode === 'json' ? MAX_TOKENS_JSON : MAX_TOKENS_TEXT,
    messages: [{ role: 'user', content: content }],
  };

  var apiRes;
  try {
    apiRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(anthropicBody),
    });
  } catch (networkErr) {
    return errorResponse(502, 'upstream_error', 'Could not reach the AI service.');
  }

  var apiData;
  try {
    apiData = await apiRes.json();
  } catch (e) {
    return errorResponse(502, 'upstream_error', 'The AI service returned an unreadable response.');
  }

  if (!apiRes.ok) {
    var errType = apiData && apiData.error && apiData.error.type;
    if (apiRes.status === 429) return errorResponse(429, 'rate_limited', 'Too many requests right now.');
    if (errType === 'authentication_error') {
      return errorResponse(500, 'unavailable', 'ANTHROPIC_API_KEY is missing or invalid.');
    }
    if (errType === 'invalid_request_error' && body.image) {
      return errorResponse(400, 'image_rejected', 'That photo could not be processed.');
    }
    return errorResponse(502, 'upstream_error', (apiData && apiData.error && apiData.error.message) || 'The AI service returned an error.');
  }

  if (apiData.stop_reason === 'refusal') {
    return errorResponse(422, 'refused', 'The AI declined that request.');
  }

  var textBlock = Array.isArray(apiData.content)
    ? apiData.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('')
    : '';

  if (!textBlock.trim()) {
    return errorResponse(502, 'empty_completion', 'No answer came back — try again.');
  }

  var truncated = apiData.stop_reason === 'max_tokens';

  if (mode === 'text') {
    return jsonResponse(200, { text: textBlock, truncated: truncated });
  }

  try {
    var parsed = parseModelJSON(textBlock);
    return jsonResponse(200, { json: parsed });
  } catch (parseErr) {
    return errorResponse(502, 'invalid_json', 'The AI reply came back in an unexpected shape.');
  }
};
