// rules.js — 占卜规则页面，仅第一次显示

const STORAGE_KEY = 'tarot_rules_seen';

const RULES = [
  '请带着一个真实的问题前来，牌只回应真诚的心',
  '同一个问题，请只问一次',
  '请用左手洗牌与切牌',
  '切牌时请分成三叠，从左到右放下',
  '逆位并非凶兆，只是能量流动的另一种方向',
  '象征牌将由占卜师依您的气质为您选定',
  '无论牌说了什么，请允许自己接受它',
];

// ===== 对外接口 =====

export function initRules() {
  _buildDOM();
}

// 如果是第一次则显示，否则直接回调
export function showRulesIfFirstTime(onComplete) {
  _onComplete = onComplete;
  const seen = localStorage.getItem(STORAGE_KEY);
  if (seen) {
    // 已看过，直接跳过
    onComplete();
    return;
  }
  _show();
}

// 强制显示（从书本道具入口调用）
export function showRules(onComplete) {
  _onComplete = onComplete || null;
  _show();
}

// ===== 内部状态 =====
let _onComplete = null;
const _el = {};

// ===== 构建DOM =====
function _buildDOM() {
  if (document.getElementById('rules-style')) return;

  const style = document.createElement('style');
  style.id = 'rules-style';
  style.textContent = `
    #rules-view {
      position: fixed; inset: 0; z-index: 205;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(8,6,4,0.96);
      opacity: 0; pointer-events: none;
      transition: opacity 1.2s ease;
      padding: 0 20px;
    }
    #rules-view.on {
      opacity: 1; pointer-events: auto;
    }

    /* 顶部标题 */
    #rules-title-en {
      font-family: 'Cinzel','Georgia',serif;
      font-size: 14px; letter-spacing: 0.4em;
      color: rgba(168,145,106,0.5);
      text-transform: uppercase;
      margin-bottom: 10px;
      text-align: center;
    }
    #rules-title-cn {
      font-family: 'Noto Serif SC','ZCOOL XiaoWei',serif;
      font-size: 26px; font-weight: 300;
      color: #e8dcc8; letter-spacing: 0.4em;
      text-align: center;
      margin-bottom: 48px;
    }

    /* 分隔装饰 */
    #rules-ornament {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 40px; width: 100%; max-width: 420px;
    }
    .rules-ornament-line {
      flex: 1; height: 0.5px;
      background: linear-gradient(90deg,
        transparent, rgba(168,145,106,0.4), transparent);
    }
    .rules-ornament-glyph {
      font-size: 14px; color: rgba(168,145,106,0.5);
      letter-spacing: 0.2em;
    }

    /* 规则列表 */
    #rules-list {
      list-style: none;
      width: 100%; max-width: 420px;
      display: flex; flex-direction: column;
      gap: 0;
      margin-bottom: 48px;
    }
    .rules-item {
      display: flex; align-items: flex-start; gap: 16px;
      padding: 14px 0;
      border-bottom: 0.5px solid rgba(168,145,106,0.08);
      opacity: 0; transform: translateY(8px);
      transition: opacity 0.7s ease, transform 0.7s ease;
    }
    .rules-item:first-child {
      border-top: 0.5px solid rgba(168,145,106,0.08);
    }
    .rules-item.show { opacity: 1; transform: translateY(0); }
    .rules-item-glyph {
      font-size: 12px; color: #a8916a;
      flex-shrink: 0; margin-top: 5px;
      opacity: 0.7;
    }
    .rules-item-text {
      font-family: 'Noto Serif SC','Georgia',serif;
      font-size: 17px; font-weight: 300;
      color: #d4c4a8; letter-spacing: 0.08em;
      line-height: 1.9;
    }

    /* 底部按钮 */
    #rules-confirm {
      display: flex; flex-direction: column;
      align-items: center; gap: 8px;
      cursor: pointer;
      opacity: 0; transition: opacity 0.6s ease;
      pointer-events: none;
    }
    #rules-confirm.show {
      opacity: 1; pointer-events: auto;
    }
    #rules-confirm-circle {
      width: 64px; height: 64px; border-radius: 50%;
      border: 1px solid rgba(168,145,106,0.45);
      display: flex; align-items: center; justify-content: center;
      color: #c8a97a; font-size: 22px;
      transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
      box-shadow: 0 0 16px rgba(168,145,106,0.1);
    }
    #rules-confirm:hover #rules-confirm-circle {
      background: rgba(168,145,106,0.1);
      border-color: #c8a97a;
      box-shadow: 0 0 24px rgba(168,145,106,0.2);
    }
    #rules-confirm-label {
      font-family: 'Cinzel','Georgia',serif;
      font-size: 12px; letter-spacing: 0.28em;
      color: rgba(168,145,106,0.65);
    }
  `;
  document.head.appendChild(style);

  const view = document.createElement('div');
  view.id = 'rules-view';
  view.innerHTML = `
    <div id="rules-title-en">Before We Begin</div>
    <div id="rules-title-cn">在我们开始之前</div>

    <div id="rules-ornament">
      <div class="rules-ornament-line"></div>
      <div class="rules-ornament-glyph">✦</div>
      <div class="rules-ornament-line"></div>
    </div>

    <ul id="rules-list">
      ${RULES.map(r => `
        <li class="rules-item">
          <span class="rules-item-glyph">✦</span>
          <span class="rules-item-text">${r}</span>
        </li>
      `).join('')}
    </ul>

    <div id="rules-confirm">
      <div id="rules-confirm-circle">→</div>
      <div id="rules-confirm-label">我明白了</div>
    </div>
  `;
  document.body.appendChild(view);

  _el.view    = view;
  _el.list    = view.querySelectorAll('.rules-item');
  _el.confirm = document.getElementById('rules-confirm');

  _el.confirm.onclick = _hide;
}

// ===== 显示 =====
function _show() {
  // 重置所有条目状态
  _el.list.forEach(item => item.classList.remove('show'));
  _el.confirm.classList.remove('show');

  // 淡入页面
  _el.view.classList.add('on');

  // 条目逐条淡入，间隔120ms
  _el.list.forEach((item, i) => {
    setTimeout(() => {
      item.classList.add('show');
    }, 600 + i * 120);
  });

  // 所有条目显示完后，按钮淡入
  const totalDelay = 600 + RULES.length * 120 + 400;
  setTimeout(() => {
    _el.confirm.classList.add('show');
  }, totalDelay);
}

// ===== 隐藏 =====
function _hide() {
  // 记录已看过
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}

  _el.view.classList.remove('on');
  setTimeout(() => {
    if (_onComplete) _onComplete();
  }, 1200);
}
