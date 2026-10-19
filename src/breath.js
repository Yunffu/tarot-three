// breath.js — 正念呼吸模块

// ===== 对外接口 =====
export function initBreath() {
  _buildDOM();
}

export function startBreath(onComplete) {
  // === 立即重置所有状态 ===
  _onComplete  = onComplete;
  _round       = 0;
  _phaseIndex  = 0;
  _ended       = false;
  _canSkip     = false;

  // 清除所有残留计时器
  clearTimeout(_startTimer);
  clearTimeout(_timer);
  clearTimeout(_textTimer);

  // 使用 addEventListener 替代 onclick，确保事件正确绑定
  _el.skip.removeEventListener('click', _handleSkip);
  _el.skip.addEventListener('click', _handleSkip);

  // 重置视图可见
  _el.view.classList.add('active');
  _el.view.style.pointerEvents = 'auto';

  // 隐藏跳过按钮（初始状态）
  _el.skip.style.display = 'none';
  _el.skip.classList.remove('on');

  // 重置文字和计数器
  _el.counter.textContent = '';
  _el.prompt.innerHTML = `默念你的问题<span>心灵纯净，方能见牌</span>`;
  _el.text.textContent = '';
  _el.sub.textContent = '';
  _el.text.classList.remove('on');
  _el.sub.classList.remove('on');

  // 停止之前的音频，开始新的
  _stopAudio();
  _startAudio();

  // 开始呼吸阶段
  _startTimer = setTimeout(_runPhase, 600);
}

// ===== 内部状态 =====
let _onComplete  = null;
let _round       = 0;
let _phaseIndex  = 0;
let _ended       = false;
let _canSkip     = false;
let _timer       = null;
let _startTimer = null;
let _textTimer   = null;
let _audioCtx    = null;
let _audioNodes  = [];
const _el        = {};

// 呼吸阶段配置
const PHASES = [
  { text: '吸　气', sub: 'inhale', dur: 4000 },
  { text: '屏　息', sub: 'hold',   dur: 2000 },
  { text: '呼　气', sub: 'exhale', dur: 5000 },
  { text: '屏　息', sub: 'hold',   dur: 2000 },
];
const TOTAL_ROUNDS = 3;

// ===== 构建DOM =====
function _buildDOM() {
  if (document.getElementById('breath-style')) return;

  const style = document.createElement('style');
  style.id = 'breath-style';
  style.textContent = `
    #breath-view {
      position: fixed; inset: 0; z-index: 200;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(8,6,4,0.94);
      opacity: 0; pointer-events: none;
      transition: opacity 1.2s ease;
    }
    #breath-view.active {
      opacity: 1; pointer-events: auto;
    }
    #breath-counter {
      position: absolute; top: 8%;
      font-family: 'Cormorant Garamond','Georgia',serif;
      font-size: 16px; font-weight: 300;
      color: #a8916a; opacity: 0.4;
      letter-spacing: 0.3em;
    }
    #breath-prompt {
      text-align: center; margin-bottom: 40px;
      font-family: 'Noto Serif SC','ZCOOL XiaoWei',serif;
      font-size: 20px; font-weight: 300;
      color: #c8a97a; letter-spacing: 0.35em;
      line-height: 2; opacity: 0.85;
    }
    #breath-prompt span {
      display: block;
      font-family: 'Cormorant Garamond','Georgia',serif;
      font-size: 16px; color: #e8dcc8;
      opacity: 0.4; letter-spacing: 0.2em;
      margin-top: 4px;
    }
    #breath-orb-wrap {
      position: relative;
      width: 160px; height: 160px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 52px;
    }
    #breath-ring {
      position: absolute; inset: -12px; border-radius: 50%;
      border: 1px solid rgba(168,145,106,0.2);
    }
    #breath-orb {
      width: 80px; height: 80px; border-radius: 50%;
      background: radial-gradient(circle,
        rgba(200,169,122,0.7) 0%,
        rgba(168,145,106,0.3) 55%,
        transparent 100%);
      box-shadow: 0 0 30px rgba(168,145,106,0.2);
    }
    @keyframes breatheIn {
      0%   { transform: scale(1);   opacity: 0.5; }
      100% { transform: scale(1.7); opacity: 1; }
    }
    @keyframes breatheOut {
      0%   { transform: scale(1.7); opacity: 1; }
      100% { transform: scale(1);   opacity: 0.5; }
    }
    @keyframes ringIn {
      0%   { transform: scale(1);   opacity: 0.2; }
      100% { transform: scale(2.0); opacity: 0.04; }
    }
    @keyframes ringOut {
      0%   { transform: scale(2.0); opacity: 0.04; }
      100% { transform: scale(1);   opacity: 0.2; }
    }
    #breath-text {
      font-family: 'Noto Serif SC',serif;
      font-size: 26px; font-weight: 300;
      color: #e8dcc8; letter-spacing: 0.45em;
      opacity: 0; transition: opacity 0.7s ease;
      text-align: center; margin-bottom: 8px;
    }
    #breath-text.on { opacity: 0.9; }
    #breath-sub {
      font-family: 'Cormorant Garamond','Georgia',serif;
      font-size: 16px; font-weight: 300; font-style: italic;
      color: #a8916a; letter-spacing: 0.2em;
      opacity: 0; transition: opacity 0.7s ease;
      text-align: center;
    }
    #breath-sub.on { opacity: 0.55; }
    #breath-skip {
      position: absolute; bottom: 8%;
      font-family: 'Noto Serif SC',serif;
      font-size: 17px; font-weight: 300;
      color: #c8a97a; letter-spacing: 0.3em;
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease, background-color 0.2s ease, transform 0.2s ease;
      padding: 14px 40px;
      border: 1px solid rgba(168,145,106,0.3);
      border-radius: 28px;
      background: rgba(168,145,106,0.05);
      cursor: pointer;
      z-index: 220;
      transform: scale(1);
    }
    #breath-skip.on {
      opacity: 0.75; pointer-events: auto;
    }
    #breath-skip.on:hover {
      background: rgba(168,145,106,0.2) !important;
      transform: scale(1.05) !important;
      border-color: rgba(168,145,106,0.6) !important;
    }
    #breath-skip:active {
      transform: scale(0.98) !important;
    }
  `;
  document.head.appendChild(style);

  const view = document.createElement('div');
  view.id = 'breath-view';
  view.innerHTML = `
    <div id="breath-counter"></div>
    <div id="breath-prompt"></div>
    <div id="breath-orb-wrap">
      <div id="breath-ring"></div>
      <div id="breath-orb"></div>
    </div>
    <div id="breath-text"></div>
    <div id="breath-sub"></div>
    <div id="breath-skip">跳过冥想</div>
  `;
  document.body.appendChild(view);

  _el.view    = view;
  _el.counter = document.getElementById('breath-counter');
  _el.prompt  = document.getElementById('breath-prompt');
  _el.orb     = document.getElementById('breath-orb');
  _el.ring    = document.getElementById('breath-ring');
  _el.text    = document.getElementById('breath-text');
  _el.sub     = document.getElementById('breath-sub');
  _el.skip    = document.getElementById('breath-skip');
}

// ===== 跳过按钮处理 =====
function _handleSkip(e) {
  console.log('[Breath] 跳过按钮点击, _canSkip=', _canSkip, ', _ended=', _ended);
  if (!_canSkip) {
    console.log('[Breath] _canSkip 为 false，拒绝跳过');
    return;
  }
  if (_ended) {
    console.log('[Breath] _ended 为 true，返回');
    return;
  }
  console.log('[Breath] 调用 _doEnd');
  _doEnd();
}

// ===== 运行呼吸阶段 =====
function _runPhase() {
  if (_ended) {
    console.log('[Breath] _runPhase: _ended=true，直接返回');
    return;
  }

  const phase = PHASES[_phaseIndex];
  console.log('[Breath] _runPhase: round=', _round, ', phase=', _phaseIndex, ', text=', phase.text);

  // 清除文字
  _el.text.classList.remove('on');
  _el.sub.classList.remove('on');

  // 延迟显示新文字
  clearTimeout(_textTimer);
  _textTimer = setTimeout(() => {
    if (_ended) return;
    _el.text.textContent = phase.text;
    _el.sub.textContent  = phase.sub;
    _el.text.classList.add('on');
    _el.sub.classList.add('on');
  }, 200);

  // 球体动画
  if (phase.sub === 'inhale') {
    _el.orb.style.animation  = 'none';
    _el.ring.style.animation = 'none';
    void _el.orb.offsetWidth;
    _el.orb.style.animation  = `breatheIn ${phase.dur}ms ease-in-out forwards`;
    _el.ring.style.animation = `ringIn ${phase.dur}ms ease-in-out forwards`;
    _el.orb.style.animationPlayState  = 'running';
    _el.ring.style.animationPlayState = 'running';
  } else if (phase.sub === 'exhale') {
    _el.orb.style.animation  = 'none';
    _el.ring.style.animation = 'none';
    void _el.orb.offsetWidth;
    _el.orb.style.animation  = `breatheOut ${phase.dur}ms ease-in-out forwards`;
    _el.ring.style.animation = `ringOut ${phase.dur}ms ease-in-out forwards`;
    _el.orb.style.animationPlayState  = 'running';
    _el.ring.style.animationPlayState = 'running';
  } else {
    _el.orb.style.animationPlayState  = 'paused';
    _el.ring.style.animationPlayState = 'paused';
  }

  // 阶段结束后的处理
  clearTimeout(_timer);
  _timer = setTimeout(() => {
    if (_ended) {
      console.log('[Breath] _timer callback: _ended=true，返回');
      return;
    }

    _phaseIndex++;
    if (_phaseIndex >= PHASES.length) {
      _phaseIndex = 0;
      _round++;
      _el.counter.textContent = `${_round} / ${TOTAL_ROUNDS}`;
      console.log('[Breath] 第', _round, '轮结束');

      // 第一轮结束后显示跳过按钮
      if (_round === 1 && !_canSkip) {
        _canSkip = true;
        _el.skip.style.display = 'flex';
        _el.skip.classList.add('on');
        console.log('[Breath] 第一轮结束，跳过按钮已显示');
      }

      // 三轮结束
      if (_round >= TOTAL_ROUNDS) {
        console.log('[Breath] 三轮结束，调用 _doEnd');
        _doEnd();
        return;
      }
    }
    _runPhase();
  }, phase.dur);
}

// ===== 结束呼吸 =====
function _doEnd() {
  if (_ended) {
    console.log('[Breath] _doEnd: 已调用过，返回');
    return;
  }

  console.log('[Breath] _doEnd: 开始执行');
  _ended = true;

  // 清除所有计时器
  clearTimeout(_startTimer);
  clearTimeout(_timer);
  clearTimeout(_textTimer);

  // 停止音频
  _stopAudio();

  // 隐藏跳过按钮
  _el.skip.style.display = 'none';
  _el.skip.classList.remove('on');

  // 停止动画
  _el.orb.style.animation  = 'none';
  _el.ring.style.animation = 'none';
  _el.orb.style.animationPlayState  = 'running';
  _el.ring.style.animationPlayState = 'running';
  _el.text.classList.remove('on');
  _el.sub.classList.remove('on');

  // 隐藏视图
  _el.view.classList.remove('active');
  _el.view.style.pointerEvents = 'none';

  console.log('[Breath] _doEnd: 调用 _onComplete');
  setTimeout(() => {
    if (_onComplete) {
      console.log('[Breath] _doEnd: 执行 _onComplete');
      _onComplete();
    }
  }, 500);
}

// ===== 背景环境音（432Hz）=====
function _startAudio() {
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const freqs = [432, 528, 396];
    freqs.forEach(freq => {
      const osc    = _audioCtx.createOscillator();
      const gain   = _audioCtx.createGain();
      const filter = _audioCtx.createBiquadFilter();

      osc.type      = 'sine';
      osc.frequency.setValueAtTime(freq, _audioCtx.currentTime);
      filter.type            = 'lowpass';
      filter.frequency.value = 800;
      gain.gain.setValueAtTime(0, _audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, _audioCtx.currentTime + 3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.start();
      _audioNodes.push({ osc, gain });
    });
  } catch (e) {
    console.warn('呼吸音频初始化失败', e);
  }
}

function _stopAudio() {
  try {
    _audioNodes.forEach(({ osc, gain }) => {
      gain.gain.linearRampToValueAtTime(0, _audioCtx.currentTime + 1.5);
      setTimeout(() => osc.stop(), 1600);
    });
    _audioNodes = [];
  } catch (e) {}
}
