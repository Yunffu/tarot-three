// dialogue.js — 占卜师开场对话模块

import { callModel, probeModel, getAiMode, MODEL_LABEL } from './ai-client.js';
import { offlineDiviner } from './offline-diviner.js';

// 占卜师的系统提示词（本人设计的"镜子而非方向盘"人格约束）
const DIVINER_SYSTEM = `你是一位温暖、神秘、富有洞察力的塔罗占卜师，名字叫"织牌者"。

性格：ENFJ，温柔而坚定，善于倾听，不轻易评判。说话简短有力，常留白，给人思考的空间。语感古典温柔。

你正在进行占卜前的开场对话，目的是让来访者放松，引导他们触碰内心真实的问题，约3轮后自然引导开始占卜。

规则：每次回复不超过50字。用换行分段。不说套话。不主动解读塔罗。语言是中文，保持古典温柔语感。`;

// ===== 对外接口 =====
export function initDialogue(onReadyToStart) {
  _onReadyToStart = onReadyToStart;
  _buildDOM();
  _bindEvents();
  // 探测模型可用性：没有密钥时自动进入离线降级，并在面板上如实标注
  probeModel().then(mode => _renderAiMode(mode));
}

export function startDialogue() {
  hideIdleDialogue();
  requestAnimationFrame(() => {
    _el.mask.style.opacity    = '1';
    _el.panel.style.transform = 'translateX(0)';
    _el.panel.style.opacity   = '1';
  });
  setTimeout(() => _showOpener(), 1400);
}

// ===== 空闲提示对话框（10秒无操作后弹出）=====
export function hideIdleDialogue() {
  const tip = document.getElementById('idle-tip');
  if (tip) {
    tip.style.transition = 'opacity 0.8s ease';
    tip.style.opacity = '0';
    setTimeout(() => tip.remove(), 800);
  }
}

export function showIdleDialogue() {
  // 移除旧提示（防止重复）
  const oldTip = document.getElementById('idle-tip');
  if (oldTip) oldTip.remove();

  // 创建悬浮提示
  const tip = document.createElement('div');
  tip.id = 'idle-tip';
  tip.innerHTML = `
    <div class="idle-tip-content">
      <div class="idle-tip-icon">✦</div>
      <div class="idle-tip-text">
        <div class="idle-tip-title">织牌者</div>
        <div class="idle-tip-msg">我感觉到你还在。准备好时，点击水晶球开始吧。</div>
      </div>
    </div>
  `;

  // 添加样式
  const style = document.createElement('style');
  style.id = 'idle-tip-style';
  style.textContent = `
    #idle-tip {
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      z-index: 160;
      opacity: 0;
      animation: idleTipAppear 0.6s ease forwards;
      pointer-events: none;
    }
    @keyframes idleTipAppear {
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .idle-tip-content {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 24px;
      background: rgba(13,10,7,0.92);
      border: 1px solid rgba(168,145,106,0.3);
      border-radius: 12px;
      backdrop-filter: blur(12px);
      box-shadow: 0 0 40px rgba(168,145,106,0.1);
    }
    .idle-tip-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(168,145,106,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: #a8916a;
      flex-shrink: 0;
      animation: idleIconPulse 2s ease-in-out infinite;
    }
    @keyframes idleIconPulse {
      0%,100% { box-shadow: 0 0 8px rgba(168,145,106,0.2); }
      50% { box-shadow: 0 0 20px rgba(168,145,106,0.4); }
    }
    .idle-tip-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .idle-tip-title {
      font-family: 'Cinzel','Georgia',serif;
      font-size: 11px;
      letter-spacing: 0.25em;
      color: #c8a97a;
    }
    .idle-tip-msg {
      font-family: 'Noto Serif SC','ZCOOL XiaoWei','Georgia',serif;
      font-size: 14px;
      color: rgba(232,220,200,0.8);
      letter-spacing: 0.04em;
      line-height: 1.6;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(tip);
}

export function updateLoadProgress(loaded, total) {
  _loadedCount = loaded;
  _totalCount  = total;
  _renderDeckStatus();
}

// ===== 内部状态 =====
let _onReadyToStart = null;
let _turnCount      = 0;
let _deckReady      = false;
let _userWantsStart = false;
let _loadedCount    = 0;
let _totalCount     = 234;
let _history        = [];
let _typing         = false;
const _el           = {};

const QUICK_TRIGGERS = [
  '直接开始','开始','跳过','直接占卜','不聊了','直接','skip','start','准备好了',
];

// ===== 构建DOM =====
function _buildDOM() {
  if (document.getElementById('dlg-style')) return;

  const style = document.createElement('style');
  style.id = 'dlg-style';
  style.textContent = `
    #dlg-mask {
      position: fixed; inset: 0; z-index: 180;
      background: rgba(8,6,4,0.78);
      opacity: 0;
      transition: opacity 1.0s ease;
      pointer-events: none;
    }
    #dlg-panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(38vw, 480px);
      min-width: 360px;
      z-index: 190;
      background: #0d0a07;
      border-left: 1px solid rgba(168,145,106,0.25);
      display: flex; flex-direction: column;
      transform: translateX(100%);
      opacity: 0;
      transition: transform 0.9s cubic-bezier(0.16,1,0.3,1),
                  opacity 0.9s ease;
      pointer-events: auto;
    }
    #dlg-panel::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg,
        transparent 0%, rgba(168,145,106,0.8) 50%, transparent 100%);
      animation: dlgScan 3s ease-in-out infinite;
    }
    @keyframes dlgScan {
      0%,100% { opacity: 0.4; } 50% { opacity: 1; }
    }
    #dlg-header {
      padding: 32px 28px 20px;
      border-bottom: 1px solid rgba(168,145,106,0.12);
      flex-shrink: 0;
      position: relative;
    }
    #dlg-diviner-row {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 6px;
    }
    #dlg-sigil {
      width: 36px; height: 36px; border-radius: 50%;
      border: 1px solid rgba(168,145,106,0.6);
      display: flex; align-items: center; justify-content: center;
      color: #a8916a; font-size: 14px;
      background: rgba(168,145,106,0.06);
      flex-shrink: 0;
    }
    #dlg-name {
      font-family: 'Cinzel','Georgia',serif;
      font-size: 13px; letter-spacing: 0.3em;
      color: #c8a97a; font-weight: 400;
    }
    #dlg-ai-mode {
      position: absolute;
      right: 28px;
      top: 26px;
      font-family: 'Cinzel','Georgia',serif;
      font-size: 10px;
      letter-spacing: 0.18em;
      color: rgba(168,145,106,0.45);
      border: 1px solid rgba(168,145,106,0.22);
      border-radius: 10px;
      padding: 3px 10px;
      transition: color 0.4s ease, border-color 0.4s ease;
      white-space: nowrap;
    }
    #dlg-ai-mode.model {
      color: rgba(168,145,106,0.85);
      border-color: rgba(168,145,106,0.45);
    }
    #dlg-ai-mode.offline {
      color: rgba(200,150,110,0.85);
      border-color: rgba(200,150,110,0.4);
    }
    #dlg-sub {
      font-family: 'Cormorant Garamond','Georgia',serif;
      font-size: 12px; letter-spacing: 0.15em;
      color: rgba(200,180,140,0.45); font-style: italic;
      padding-left: 48px;
    }
    #dlg-messages {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      padding: 28px 28px 12px;
      display: flex; flex-direction: column;
      gap: 22px;
      scrollbar-width: thin;
      scrollbar-color: rgba(168,145,106,0.2) transparent;
    }
    #dlg-messages::-webkit-scrollbar { width: 3px; }
    #dlg-messages::-webkit-scrollbar-thumb {
      background: rgba(168,145,106,0.2); border-radius: 2px;
    }
    .dlg-msg-diviner {
      display: flex; gap: 12px; align-items: flex-start;
      opacity: 0; transform: translateY(8px);
      transition: opacity 0.9s ease, transform 0.9s ease;
    }
    .dlg-msg-diviner.show { opacity: 1; transform: translateY(0); }
    .dlg-dot {
      width: 4px; height: 4px; border-radius: 50%;
      background: #a8916a;
      flex-shrink: 0; margin-top: 11px;
    }
    .dlg-diviner-text {
      font-family: 'Noto Serif SC','ZCOOL XiaoWei','Georgia',serif;
      font-size: 15px; line-height: 2.2;
      color: #e8dcc8;
      letter-spacing: 0.06em;
      font-weight: 300;
    }
    .dlg-diviner-text em {
      font-style: italic;
      color: #c8a97a;
      font-family: 'Cormorant Garamond','Georgia',serif;
    }
    .dlg-divider {
      display: flex; align-items: center; gap: 10px;
      opacity: 0; transition: opacity 0.6s ease;
      flex-shrink: 0;
    }
    .dlg-divider.show { opacity: 0.25; }
    .dlg-divider-line {
      flex: 1; height: 0.5px;
      background: rgba(168,145,106,0.6);
    }
    .dlg-divider-glyph {
      font-size: 8px; color: #a8916a;
      letter-spacing: 0.2em;
    }
    .dlg-msg-user {
      align-self: flex-end; max-width: 85%;
      padding: 10px 16px;
      border: 1px solid rgba(168,145,106,0.2);
      border-radius: 12px 2px 12px 12px;
      font-family: 'Noto Serif SC','Georgia',serif;
      font-size: 14px; line-height: 1.9;
      color: #b8a888;
      letter-spacing: 0.04em;
      font-weight: 300;
      opacity: 0; transform: translateY(4px);
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .dlg-msg-user.show { opacity: 1; transform: translateY(0); }
    #dlg-typing {
      display: flex; gap: 12px; align-items: center;
      opacity: 0; transition: opacity 0.3s ease;
      flex-shrink: 0;
    }
    #dlg-typing.show { opacity: 1; }
    .dlg-typing-dots { display: flex; gap: 5px; align-items: center; }
    .dlg-typing-dot {
      width: 4px; height: 4px; border-radius: 50%;
      background: #a8916a;
      animation: dlgPulse 1.4s ease-in-out infinite;
    }
    .dlg-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .dlg-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dlgPulse {
      0%,100% { opacity: 0.25; transform: scale(0.85); }
      50%      { opacity: 1;    transform: scale(1.1); }
    }
    #dlg-footer {
      padding: 16px 28px 36px;
      border-top: 1px solid rgba(168,145,106,0.1);
      flex-shrink: 0;
    }
    #dlg-deck-status {
      font-family: 'Cinzel','Georgia',serif;
      font-size: 13px; letter-spacing: 0.22em;
      color: #c8a97a;
      text-align: right; margin-bottom: 20px;
      transition: color 0.6s ease;
    }
    #dlg-deck-status.ready {
      color: #c8a97a;
      text-shadow: 0 0 12px rgba(168,145,106,0.4);
    }
    #dlg-input-wrap {
      position: relative; padding-bottom: 3px;
      margin-bottom: 28px;
    }
    #dlg-input-underline {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 1px; background: rgba(168,145,106,0.45);
    }
    #dlg-input-cursor {
      position: absolute; bottom: 0; left: 0;
      height: 1px; width: 0%;
      background: #c8a97a;
      transition: width 0.5s ease;
      box-shadow: 0 0 6px rgba(168,145,106,0.6);
    }
    #dlg-input {
      width: 100%; background: transparent;
      border: none; outline: none; resize: none;
      font-family: 'Noto Serif SC','Georgia',serif;
      font-size: 16px;
      color: #e8dcc8;
      letter-spacing: 0.06em; line-height: 1.9;
      padding: 8px 44px 12px 0;
      min-height: 38px; max-height: 140px;
      font-weight: 300;
    }
    #dlg-input::placeholder {
      color: rgba(168,145,106,0.5);
      font-style: italic;
    }
    #dlg-send {
      position: absolute; right: 0; bottom: 10px;
      width: 32px; height: 32px; border-radius: 50%;
      border: 1px solid rgba(168,145,106,0.55);
      background: rgba(168,145,106,0.06);
      color: #c8a97a;
      font-size: 14px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: border-color 0.2s, background 0.2s;
    }
    #dlg-send:hover {
      border-color: #c8a97a;
      background: rgba(168,145,106,0.15);
    }
    #dlg-start-btn {
      display: flex; align-items: center; gap: 16px;
      background: transparent; border: none; cursor: default;
      padding: 8px 0; opacity: 0.2;
      transition: opacity 0.6s ease;
      pointer-events: none;
      width: 100%;
    }
    #dlg-start-btn.ready {
      opacity: 1; pointer-events: auto; cursor: pointer;
    }
    #dlg-start-circle {
      width: 52px; height: 52px; border-radius: 50%;
      border: 1px solid rgba(168,145,106,0.6);
      display: flex; align-items: center; justify-content: center;
      color: #c8a97a; font-size: 18px;
      flex-shrink: 0;
      transition: border-color 0.3s, background 0.3s, box-shadow 0.3s;
    }
    #dlg-start-btn.ready #dlg-start-circle {
      box-shadow: 0 0 16px rgba(168,145,106,0.15);
    }
    #dlg-start-btn.ready:hover #dlg-start-circle {
      background: rgba(168,145,106,0.12);
      border-color: #c8a97a;
      box-shadow: 0 0 24px rgba(168,145,106,0.25);
    }
    #dlg-start-label {
      font-family: 'Cinzel','Georgia',serif;
      font-size: 13px; letter-spacing: 0.28em;
      color: #c8a97a;
      display: block; margin-bottom: 5px;
    }
    #dlg-start-hint {
      font-family: 'Noto Serif SC','Georgia',serif;
      font-size: 12px; letter-spacing: 0.06em;
      color: rgba(168,145,106,0.55);
      font-weight: 300;
      display: block;
    }
  `;
  document.head.appendChild(style);

  const mask = document.createElement('div');
  mask.id = 'dlg-mask';
  document.body.appendChild(mask);

  const panel = document.createElement('div');
  panel.id = 'dlg-panel';
  panel.innerHTML = `
    <div id="dlg-header">
      <div id="dlg-diviner-row">
        <div id="dlg-sigil">✦</div>
        <div id="dlg-name">织 牌 者</div>
      </div>
      <div id="dlg-sub">The Weaver of Cards</div>
      <div id="dlg-ai-mode" title="模型不可用时自动降级为本地规则桩">检测中…</div>
    </div>
    <div id="dlg-messages">
      <div id="dlg-typing">
        <div class="dlg-dot"></div>
        <div class="dlg-typing-dots">
          <div class="dlg-typing-dot"></div>
          <div class="dlg-typing-dot"></div>
          <div class="dlg-typing-dot"></div>
        </div>
      </div>
    </div>
    <div id="dlg-footer">
      <div id="dlg-deck-status">正在整理牌组 · 0 / 78</div>
      <div id="dlg-input-wrap">
        <textarea id="dlg-input" placeholder="说说你想聊的，或直接说「开始」…" rows="1"></textarea>
        <div id="dlg-input-underline"></div>
        <div id="dlg-input-cursor"></div>
        <button id="dlg-send">↑</button>
      </div>
      <button id="dlg-start-btn">
        <div id="dlg-start-circle">→</div>
        <div>
          <div id="dlg-start-label">准备好了，开始</div>
          <div id="dlg-start-hint">牌组就绪后可点击</div>
        </div>
      </button>
    </div>
  `;
  document.body.appendChild(panel);

  _el.mask       = mask;
  _el.panel      = panel;
  _el.messages   = document.getElementById('dlg-messages');
  _el.typing     = document.getElementById('dlg-typing');
  _el.input      = document.getElementById('dlg-input');
  _el.send       = document.getElementById('dlg-send');
  _el.cursor     = document.getElementById('dlg-input-cursor');
  _el.deckStatus = document.getElementById('dlg-deck-status');
  _el.startBtn   = document.getElementById('dlg-start-btn');
  _el.startHint  = document.getElementById('dlg-start-hint');
}

// ===== 事件绑定 =====
function _bindEvents() {
  _el.send.onclick = _handleSend;
  _el.input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _handleSend(); }
  });
  _el.input.addEventListener('input', () => {
    _el.input.style.height = 'auto';
    _el.input.style.height = Math.min(_el.input.scrollHeight, 100) + 'px';
  });
  _el.input.addEventListener('focus', () => { _el.cursor.style.width = '40%'; });
  _el.input.addEventListener('blur',  () => { _el.cursor.style.width = '0%'; });
  _el.startBtn.onclick = _handleStartRequest;
}

// ===== 牌组状态 =====
function _renderDeckStatus() {
  const n = Math.min(Math.floor(_loadedCount / 3), 78);
  if (_loadedCount >= _totalCount) {
    _deckReady = true;
    _el.deckStatus.textContent = '✦ 牌组就绪';
    _el.deckStatus.classList.add('ready');
    _el.startBtn.classList.add('ready');
    _el.startHint.textContent = '点击开始占卜';
    if (_userWantsStart) _triggerStart();
  } else {
    _el.deckStatus.textContent = `正在整理牌组 · ${n} / 78`;
  }
}

// ===== 添加消息 =====
function _addBubble(role, text) {
  const typing = _el.typing;

  if (role === 'diviner') {
    if (_el.messages.children.length > 1) {
      const div = document.createElement('div');
      div.className = 'dlg-divider';
      div.innerHTML = `
        <div class="dlg-divider-line"></div>
        <div class="dlg-divider-glyph">✦</div>
        <div class="dlg-divider-line"></div>`;
      _el.messages.insertBefore(div, typing);
      requestAnimationFrame(() => div.classList.add('show'));
    }
    const el = document.createElement('div');
    el.className = 'dlg-msg-diviner';
    el.innerHTML = `<div class="dlg-dot"></div><div class="dlg-diviner-text">${
      text.split('\n\n').join('<br><br>')
    }</div>`;
    _el.messages.insertBefore(el, typing);
    requestAnimationFrame(() => el.classList.add('show'));
  } else {
    const el = document.createElement('div');
    el.className = 'dlg-msg-user';
    el.textContent = text;
    _el.messages.insertBefore(el, typing);
    requestAnimationFrame(() => el.classList.add('show'));
  }

  setTimeout(() => { _el.messages.scrollTop = _el.messages.scrollHeight; }, 50);
}

// ===== 开场白 =====
const OPENERS = [
  '你来了。\n\n我一直在等。\n\n今天想聊聊什么？还是说，你只是想……感受一下？',
  '坐下来吧。\n\n不用急，这里的时间是你的。\n\n有什么在心里放了很久的事吗？',
  '我感觉到你带着什么来的。\n\n不用说清楚，也可以先什么都不说。\n\n你今天来，是想问什么？',
];

function _showOpener() {
  _el.typing.classList.add('show');
  setTimeout(() => {
    _el.typing.classList.remove('show');
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
    _addBubble('diviner', opener);
    _history.push({ role: 'assistant', content: opener.replace(/\n\n/g, ' ') });
  }, 1800);
}

// ===== 处理发送 =====
async function _handleSend() {
  if (_typing) return;
  const text = _el.input.value.trim();
  if (!text) return;
  _el.input.value = '';
  _el.input.style.height = 'auto';

  _addBubble('user', text);
  _history.push({ role: 'user', content: text });
  _turnCount++;

  const wantsStart = QUICK_TRIGGERS.some(t => text.toLowerCase().includes(t));
  if (wantsStart) {
    setTimeout(() => {
      _addBubble('diviner', '好，那我们直接开始。');
      setTimeout(_handleStartRequest, 1000);
    }, 500);
    return;
  }

  _typing = true;
  _el.input.disabled = true;
  _el.send.disabled  = true;
  _el.typing.classList.add('show');
  _el.messages.scrollTop = _el.messages.scrollHeight;

  const reply = await _callClaude(text);

  _el.typing.classList.remove('show');
  _el.input.disabled = false;
  _el.send.disabled  = false;
  _typing = false;
  _el.input.focus();

  _addBubble('diviner', reply);
  _history.push({ role: 'assistant', content: reply });

  if (_turnCount >= 3) setTimeout(_showStartPrompt, 800);
}

// ===== 大模型调用（含离线降级）=====
async function _callClaude(userText) {
  const { text, mode } = await callModel({
    system: DIVINER_SYSTEM,
    messages: _history.slice(),
    maxTokens: 200,
    // 模型不可用时降级到本地规则桩：同样遵守"镜子而非方向盘"的约束
    offline: () => offlineDiviner(userText, _turnCount)
  });
  _renderAiMode(mode);
  return text;
}

// ===== 模式标识 =====
// 让演示时能一眼看出当前是真实模型还是离线降级，避免"以为在跑模型"
function _renderAiMode(mode) {
  const el = document.getElementById('dlg-ai-mode');
  if (!el) return;
  const m = mode || getAiMode();
  if (m === 'model') {
    el.textContent = `模型 · ${MODEL_LABEL}`;
    el.className = 'model';
  } else {
    el.textContent = '离线模式 · 本地规则桩';
    el.className = 'offline';
  }
}

// ===== 引导开始 =====
function _showStartPrompt() {
  if (_el.messages.querySelector('.dlg-shown')) return;
  _el.typing.classList.add('show');
  setTimeout(() => {
    _el.typing.classList.remove('show');
    _addBubble('diviner', '好了。\n\n我想我们可以开始了。\n\n你准备好了吗？');
    const mark = document.createElement('div');
    mark.className = 'dlg-shown';
    mark.style.display = 'none';
    _el.messages.appendChild(mark);
    if (_deckReady) _el.startBtn.classList.add('ready');
  }, 1500);
}

// ===== 开始请求 =====
function _handleStartRequest() {
  if (!_deckReady) {
    _userWantsStart = true;
    _addBubble('diviner', '稍等片刻。\n\n牌还在整理中。');
    return;
  }
  _triggerStart();
}

// ===== 触发开始 =====
function _triggerStart() {
  hideIdleDialogue();
  _el.panel.style.transform = 'translateX(100%)';
  _el.panel.style.opacity   = '0';
  _el.mask.style.opacity    = '0';

  if (window._formClickHandler) {
    document.querySelector('canvas')?.removeEventListener('click', window._formClickHandler);
    window._formClickHandler = null;
  }

  setTimeout(() => {
    _el.panel.remove();
    _el.mask.remove();

    // 流程：规则页（仅第一次）→ 呼吸 → 占卜
    const doBreath = () => {
      if (window.__startBreath) {
        window.__startBreath(() => {
          // 呼吸结束，占卜正式开始，启动 idle 计时器
          if (window.__startIdleTimerAfterBreath) {
            window.__startIdleTimerAfterBreath();
          }
          setTimeout(() => { if (_onReadyToStart) _onReadyToStart(); }, 500);
        });
      } else {
        if (window.__startIdleTimerAfterBreath) {
          window.__startIdleTimerAfterBreath();
        }
        setTimeout(() => { if (_onReadyToStart) _onReadyToStart(); }, 500);
      }
    };

    if (window.__showRules) {
      window.__showRules(doBreath);
    } else {
      doBreath();
    }
  }, 1000);
}
