/**
 * tarot-ai-worker — DeepSeek 网关（Cloudflare Worker）
 *
 * GitHub Pages 是纯静态托管，没法注入 API 密钥。这个 Worker 站在前端和
 * DeepSeek 之间：密钥存在 Worker 的 secret 里（DEEPSEEK_API_KEY），前端
 * 只知道 Worker 地址，永远接触不到密钥。
 *
 * 安全约束：
 * 1. 只接受白名单来源（ALLOWED_ORIGINS）的请求，避免变成人人可用的免费代理。
 * 2. 强制覆盖 max_tokens 上限，防止被拿去当批量生成接口刷额度。
 * 3. 密钥只存在服务端环境变量，不出现在任何响应里。
 */

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';

const ALLOWED_ORIGINS = [
  'https://yunffu.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const MAX_TOKENS = 1024;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: { message: 'origin not allowed' } }, 403, origin);
    }

    if (url.pathname === '/health') {
      const hasKey = Boolean(env.DEEPSEEK_API_KEY);
      return json({ ok: hasKey, mode: hasKey ? 'model' : 'offline' }, hasKey ? 200 : 503, origin);
    }

    if (url.pathname !== '/chat/completions' || request.method !== 'POST') {
      return json({ error: { message: 'not found' } }, 404, origin);
    }

    if (!env.DEEPSEEK_API_KEY) {
      return json({ error: { message: 'missing DEEPSEEK_API_KEY' } }, 500, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: { message: 'invalid json body' } }, 400, origin);
    }

    const body = {
      model: payload.model || 'deepseek-chat',
      messages: Array.isArray(payload.messages) ? payload.messages : [],
      max_tokens: Math.min(Number(payload.max_tokens) || 400, MAX_TOKENS),
      stream: false,
    };

    const upstream = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
    });
  },
};
