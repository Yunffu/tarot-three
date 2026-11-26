// ai-client.js — 大模型接入层（带无密钥降级）
//
// 设计目标：
// 1. 密钥永远不出现在前端。请求走同源路径 /api/deepseek，由 vite 代理在服务端注入
//    Authorization 头；前端代码里没有密钥，也不需要密钥。
// 2. 模型不可用时（未配置密钥 / 网络失败 / 返回为空）必须优雅降级到本地规则桩，
//    而不是弹错或卡住。调用方只需要传一个 offline 降级函数。
// 3. 降级状态对用户可见（面板上有模式标识），避免"演示时以为在跑模型"。
//
// 注意：DeepSeek 的 deepseek-chat 是纯文本模型，不接受图片输入。
// 因此带图的调用（如自拍测象征牌）一律走 offline 降级，不做"假装看见"的调用。

// AI 网关地址：
//   - 本地开发：默认 '/api/deepseek'，由 vite 代理转发到 api.deepseek.com（密钥在服务端注入）
//   - 线上部署：构建时用 VITE_AI_BASE 指定（静态托管下需要外部 serverless 代理注入密钥）
const AI_BASE = import.meta.env.VITE_AI_BASE || '/api/deepseek';

export const API_PATH = AI_BASE + '/chat/completions';
export const MODEL = 'deepseek-chat';
export const MODEL_LABEL = 'DeepSeek';

let _mode = 'offline'; // 'model' | 'offline'
let _modeKnown = false;

export function getAiMode() { return _mode; }
export function isModelMode() { return _mode === 'model'; }

/**
 * 调用大模型；失败时返回降级结果。
 * @param {object} opts
 * @param {string} [opts.system]  system prompt
 * @param {Array}  opts.messages  消息数组
 * @param {number} [opts.maxTokens]
 * @param {Array}  [opts.images]  多模态图片（DeepSeek 不支持，会直接降级）
 * @param {Function} [opts.offline] 降级处理 () => string
 * @returns {Promise<{text: string, mode: 'model'|'offline'}>}
 */
export async function callModel(opts) {
  const { system, messages, maxTokens = 400, images = null, offline = null } = opts;

  // DeepSeek 不支持图片输入：与其让模型凭空猜一张它看不见的照片，
  // 不如直接走调用方的本地降级逻辑。
  if (images && images.length) {
    _mode = 'offline';
    _modeKnown = true;
    const fallbackText = offline ? offline(new Error('model has no vision support')) : '';
    return { text: fallbackText, mode: 'offline', error: 'vision_unsupported' };
  }

  const msgs = messages.map(m => ({ ...m }));
  if (system) {
    msgs.unshift({ role: 'system', content: system });
  }

  const body = { model: MODEL, max_tokens: maxTokens, messages: msgs, stream: false };

  try {
    const res = await fetch(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') throw new Error('empty content');

    _mode = 'model';
    _modeKnown = true;
    return { text, mode: 'model' };
  } catch (err) {
    _mode = 'offline';
    _modeKnown = true;
    const fallbackText = offline ? offline(err) : '';
    return { text: fallbackText, mode: 'offline', error: String(err && err.message || err) };
  }
}

/** 启动时探测一次模型是否可用，用于面板上的模式标识 */
export async function probeModel() {
  try {
    const res = await fetch(AI_BASE + '/health', { method: 'GET' });
    _mode = res.ok ? 'model' : 'offline';
  } catch {
    _mode = 'offline';
  }
  _modeKnown = true;
  return _mode;
}
