// significator.js — 象征牌选定模块
// 流程：读取用户信息 → 尝试摄像头拍照 → 模型分析 → 展示结果

import { TAROT_DB } from './tarot-db.js';
import { callModel } from './ai-client.js';

// ===== 对外接口 =====
export function initSignificator() {
  _buildDOM();
}

export function startSignificator(userInfo, onComplete) {
  _userInfo   = userInfo;   // { gender, age, type } 来自登录表单
  _onComplete = onComplete; // (significatorCard) => void

  const profile = _loadProfile();

  // 回访用户已有象征牌 → 直接展示
  if (profile?.significatorId !== undefined) {
    const card = TAROT_DB.find(c => c.id === profile.significatorId);
    if (card) {
      _showReveal(card, profile.sigDesc || '', false);
      return;
    }
  }

  // 新用户 → 尝试摄像头
  _startSelfie();
}

// ===== 内部状态 =====
let _userInfo   = null;
let _onComplete = null;
let _stream     = null;
let _gender     = '';
let _age        = '';
const _el       = {};

const PROFILE_KEY = 'tarot_profile';

// ===== 宫廷牌映射 =====
const COURT_MAP = {
  male:   { young: 'King',   senior: 'Knight' },
  female: { young: 'Queen',  senior: 'Page'   },
  other:  { young: 'King',   senior: 'Knight' },
};

// ===== 从登录信息推断性别和年龄段 =====
function _inferFromUserInfo() {
  if (!_userInfo) return { gender: 'other', age: 'young' };

  // 性别
  const gender = _userInfo.gender === 'female' ? 'female'
    : _userInfo.gender === 'male' ? 'male' : 'other';

  // 年龄段：从出生年份或年龄字段推断
  let age = 'young';
  const birthYear = parseInt(_userInfo.birthday_year || _userInfo.birthYear);
  const ageNum    = parseInt(_userInfo.age);

  if (!isNaN(birthYear)) {
    const years = new Date().getFullYear() - birthYear;
    age = years >= 35 ? 'senior' : 'young';
  } else if (!isNaN(ageNum)) {
    age = ageNum >= 35 ? 'senior' : 'young';
  }

  return { gender, age };
}

// ===== 构建DOM =====
function _buildDOM() {
  if (document.getElementById('sig-style')) return;

  const style = document.createElement('style');
  style.id = 'sig-style';
  style.textContent = `
    /* 自拍页 */
    #sig-selfie-view {
      position: fixed; inset: 0; z-index: 210;
      background: rgba(8,6,4,0.96);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: opacity 1s ease;
      gap: 24px;
    }
    #sig-selfie-view.on { opacity: 1; pointer-events: auto; }

    #sig-selfie-title {
      font-family: 'Noto Serif SC','Georgia',serif;
      font-size: 16px; font-weight: 300;
      color: #e8dcc8; letter-spacing: 0.3em;
      text-align: center;
    }
    #sig-selfie-sub {
      font-family: 'Cormorant Garamond','Georgia',serif;
      font-size: 13px; font-style: italic;
      color: rgba(168,145,106,0.6); letter-spacing: 0.1em;
      text-align: center; margin-top: -16px;
    }

    /* 摄像头预览 */
    #sig-video-wrap {
      position: relative;
      width: 220px; height: 220px;
      border: 1px solid rgba(168,145,106,0.3);
      border-radius: 50%;
      overflow: hidden;
      background: #0a0805;
    }
    #sig-video {
      width: 100%; height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }
    #sig-canvas { display: none; }
    #sig-analyzing {
      position: absolute; inset: 0;
      background: rgba(8,6,4,0.85);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.4s;
      border-radius: 50%;
    }
    #sig-analyzing.on { opacity: 1; }
    #sig-analyzing-text {
      font-family: 'Cinzel','Georgia',serif;
      font-size: 10px; letter-spacing: 0.3em;
      color: #a8916a;
      animation: sigPulse 1.5s ease-in-out infinite;
    }
    @keyframes sigPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

    /* 拍照按钮 */
    #sig-shutter {
      width: 56px; height: 56px; border-radius: 50%;
      border: 1px solid rgba(168,145,106,0.5);
      background: rgba(168,145,106,0.08);
      color: #c8a97a; font-size: 20px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.3s, border-color 0.3s, opacity 0.3s;
    }
    #sig-shutter:hover { background: rgba(168,145,106,0.15); border-color: #c8a97a; }
    #sig-shutter.dim { opacity: 0.3; cursor: default; }

    #sig-privacy {
      font-family: 'Cormorant Garamond','Georgia',serif;
      font-size: 11px; font-style: italic;
      color: rgba(168,145,106,0.3); letter-spacing: 0.1em;
      text-align: center;
    }

    /* 跳过按钮 */
    #sig-skip {
      font-family: 'Noto Serif SC',serif;
      font-size: 11px; letter-spacing: 0.2em;
      color: rgba(168,145,106,0.4);
      cursor: pointer; border: none; background: none;
      transition: color 0.2s;
    }
    #sig-skip:hover { color: rgba(168,145,106,0.7); }

    /* 象征牌展示页 */
    #sig-reveal-view {
      position: fixed; inset: 0; z-index: 210;
      background: rgba(8,6,4,0.96);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: opacity 1s ease;
      gap: 20px;
    }
    #sig-reveal-view.on { opacity: 1; pointer-events: auto; }

    #sig-reveal-intro {
      font-family: 'Noto Serif SC',serif;
      font-size: 15px; font-weight: 300;
      color: #c8a97a; letter-spacing: 0.3em;
      text-align: center; line-height: 2;
      white-space: pre-line;
    }

    /* 牌面展示 */
    #sig-card-wrap {
      width: 120px;
      opacity: 0; transform: translateY(16px) scale(0.95);
      transition: opacity 0.9s ease, transform 0.9s ease;
    }
    #sig-card-wrap.on { opacity: 1; transform: translateY(0) scale(1); }
    #sig-card-img {
      width: 100%; border-radius: 4px;
      box-shadow: 0 0 40px rgba(168,145,106,0.15);
    }

    #sig-card-name-en {
      font-family: 'Cinzel','Georgia',serif;
      font-size: 11px; letter-spacing: 0.25em;
      color: rgba(168,145,106,0.7);
      text-align: center; margin-top: 12px;
    }
    #sig-card-name-cn {
      font-family: 'Noto Serif SC',serif;
      font-size: 18px; font-weight: 300;
      color: #e8dcc8; letter-spacing: 0.3em;
      text-align: center; margin-top: 4px;
    }
    #sig-card-desc {
      font-family: 'Cormorant Garamond','Georgia',serif;
      font-size: 14px; font-style: italic;
      color: rgba(200,180,140,0.7); letter-spacing: 0.08em;
      text-align: center; max-width: 280px;
      line-height: 1.8; margin-top: 4px;
    }

    /* 确认/重试按钮 */
    #sig-confirm-btn {
      display: flex; align-items: center; gap: 12px;
      background: transparent; border: none; cursor: pointer;
      padding: 8px 0; margin-top: 8px;
      transition: opacity 0.3s;
    }
    #sig-confirm-btn:hover { opacity: 0.8; }
    #sig-confirm-circle {
      width: 44px; height: 44px; border-radius: 50%;
      border: 1px solid rgba(168,145,106,0.5);
      display: flex; align-items: center; justify-content: center;
      color: #c8a97a; font-size: 16px;
      transition: background 0.3s;
    }
    #sig-confirm-btn:hover #sig-confirm-circle {
      background: rgba(168,145,106,0.1);
    }
    #sig-confirm-label {
      font-family: 'Cinzel','Georgia',serif;
      font-size: 11px; letter-spacing: 0.25em;
      color: #c8a97a;
    }
    #sig-retry-btn {
      font-family: 'Noto Serif SC',serif;
      font-size: 11px; letter-spacing: 0.2em;
      color: rgba(168,145,106,0.4);
      cursor: pointer; border: none; background: none;
      transition: color 0.2s;
    }
    #sig-retry-btn:hover { color: rgba(168,145,106,0.7); }
  `;
  document.head.appendChild(style);

  // 自拍页
  const selfieView = document.createElement('div');
  selfieView.id = 'sig-selfie-view';
  selfieView.innerHTML = `
    <div id="sig-selfie-title">让我看看你</div>
    <div id="sig-selfie-sub">占卜师需要感知你的气质，为你选定象征牌</div>
    <div id="sig-video-wrap">
      <video id="sig-video" autoplay playsinline muted></video>
      <canvas id="sig-canvas"></canvas>
      <div id="sig-analyzing">
        <div id="sig-analyzing-text">感知中</div>
      </div>
    </div>
    <button id="sig-shutter" class="dim">◎</button>
    <div id="sig-privacy">· 照片仅用于分析，不会被保存 ·</div>
    <button id="sig-skip">跳过，直接推断</button>
  `;
  document.body.appendChild(selfieView);

  // 象征牌展示页
  const revealView = document.createElement('div');
  revealView.id = 'sig-reveal-view';
  revealView.innerHTML = `
    <div id="sig-reveal-intro"></div>
    <div id="sig-card-wrap">
      <img id="sig-card-img" src="" alt="">
      <div id="sig-card-name-en"></div>
      <div id="sig-card-name-cn"></div>
    </div>
    <div id="sig-card-desc"></div>
    <button id="sig-confirm-btn">
      <div id="sig-confirm-circle">→</div>
      <div id="sig-confirm-label">就是这张，开始</div>
    </button>
    <button id="sig-retry-btn">重新拍摄</button>
  `;
  document.body.appendChild(revealView);

  // 缓存引用
  _el.selfieView  = selfieView;
  _el.revealView  = revealView;
  _el.video       = document.getElementById('sig-video');
  _el.canvas      = document.getElementById('sig-canvas');
  _el.analyzing   = document.getElementById('sig-analyzing');
  _el.shutter     = document.getElementById('sig-shutter');
  _el.skip        = document.getElementById('sig-skip');
  _el.revealIntro = document.getElementById('sig-reveal-intro');
  _el.cardWrap    = document.getElementById('sig-card-wrap');
  _el.cardImg     = document.getElementById('sig-card-img');
  _el.cardNameEn  = document.getElementById('sig-card-name-en');
  _el.cardNameCn  = document.getElementById('sig-card-name-cn');
  _el.cardDesc    = document.getElementById('sig-card-desc');
  _el.confirmBtn  = document.getElementById('sig-confirm-btn');
  _el.retryBtn    = document.getElementById('sig-retry-btn');
}

// ===== 启动自拍流程 =====
function _startSelfie() {
  _el.selfieView.classList.add('on');

  // 启动摄像头
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    .then(stream => {
      _stream = stream;
      _el.video.srcObject = stream;
      _el.shutter.classList.remove('dim');
    })
    .catch(() => {
      // 无摄像头权限，直接用登录信息推断
      _el.selfieView.classList.remove('on');
      _fallbackToInfer();
    });

  _el.shutter.onclick = () => {
    if (_el.shutter.classList.contains('dim')) return;
    _takeSelfie();
  };

  _el.skip.onclick = () => {
    _stopCamera();
    _el.selfieView.classList.remove('on');
    _fallbackToInfer();
  };
}

// ===== 拍照 =====
function _takeSelfie() {
  const video  = _el.video;
  const canvas = _el.canvas;

  canvas.width  = video.videoWidth  || 320;
  canvas.height = video.videoHeight || 320;
  canvas.getContext('2d').drawImage(video, 0, 0);

  const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

  _stopCamera();
  _el.analyzing.classList.add('on');

  _analyzeWithModel(base64);
}

function _stopCamera() {
  if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
}

// ===== 大模型分析 =====
// 注意：当前模型（DeepSeek Chat）是纯文本模型，不接受图片输入，
// 所以这条路径实际会降级到本地颜色特征分析（见 _analyzeLocally）。
async function _analyzeWithModel(base64) {
  const { gender, age } = _inferFromUserInfo();
  const courtType = COURT_MAP[gender]?.[age] || 'King';

  const prompt = `你是一位精通韦特塔罗的占卜师。请仔细观察这张照片中人物的外貌气质，根据以下Waite原著规则为其选定象征牌（Significator）：

宫廷牌类型（已知）：${courtType}（基于性别和年龄）

花色选择规则（根据外貌和气质）：
- 权杖（Wands）：发色偏浅/金发/红发、肤色白皙、蓝眼，或气质活跃、充满行动力
- 圣杯（Cups）：浅棕发、灰蓝眼、中等肤色，或气质细腻、情感丰富
- 宝剑（Swords）：深棕发、榛色或灰色眼睛、中深肤色，或气质敏锐、思维活跃
- 星币（Pentacles）：黑发、深色眼睛、深肤色，或气质稳重、脚踏实地

重要：Waite原著特别说明，气质可以凌驾于外貌之上。请综合判断。

请以JSON格式回复，不要有任何其他文字：
{
  "suit": "Wands/Cups/Swords/Pentacles中选一",
  "reason": "用一句话解释选择原因（中文，20字以内，温暖诗意）",
  "desc": "用一句话描述这张牌代表的气质（中文，25字以内，第二人称，如'你如水般流动，感知细腻'）"
}`;

  const { text, mode } = await callModel({
    messages: [{ role: 'user', content: prompt }],
    images: [{ media_type: 'image/jpeg', data: base64 }],
    maxTokens: 200,
    // 模型不可用时降级：改用本地图像特征分析（不是模型）
    offline: () => ''
  });

  _el.analyzing.classList.remove('on');
  _el.selfieView.classList.remove('on');

  if (mode === 'model') {
    try {
      const clean = String(text).replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);
      const card = TAROT_DB.find(c => c.en === `${courtType} of ${result.suit}`);
      if (card) {
        _saveProfile(card.id, result.desc, gender, age);
        _showReveal(card, result.desc, true);
        return;
      }
    } catch (e) {
      console.warn('象征牌解析失败，改用本地图像特征分析', e);
    }
  }

  _analyzeLocally();
}

// ===== 降级一：本地图像特征分析（有照片、无模型）=====
// 说明：这不是 AI，是确定性的颜色特征统计（中心区域平均色相/亮度/饱和度），
// 目的是让"自拍 → 象征牌"这条链路在无密钥时依然完整可用。
function _analyzeLocally() {
  const { gender, age } = _inferFromUserInfo();
  const courtType = COURT_MAP[gender]?.[age] || 'King';
  const feat = _extractColorFeatures(_el.canvas);

  let suit;
  if (!feat) {
    suit = 'Cups';
  } else if (feat.hue < 45 || feat.hue >= 330) {
    suit = 'Wands';
  } else if (feat.hue < 100) {
    suit = 'Pentacles';
  } else if (feat.hue < 260) {
    suit = 'Cups';
  } else {
    suit = 'Swords';
  }

  const desc = {
    Wands:    '你身上有未熄的火，光比你想的更亮。',
    Pentacles:'你脚下很稳，是那种能慢慢走远的人。',
    Cups:     '你如水般流动，感知细腻，情绪先于言语。',
    Swords:   '你的目光很利，一句话里已经想了三层。'
  }[suit];

  const reason = {
    Wands:    '暖色为主，像有火在烧',
    Pentacles:'色调沉稳，落地',
    Cups:     '光偏柔冷，像水',
    Swords:   '光影分明，轮廓清冷'
  }[suit];

  const card = TAROT_DB.find(c => c.en === `${courtType} of ${suit}`) || TAROT_DB[22];
  _saveProfile(card.id, desc, gender, age);
  _showReveal(card, desc, true);
}

// ===== 提取画面中心区域的颜色特征 =====
function _extractColorFeatures(canvas) {
  try {
    if (!canvas || !canvas.width || !canvas.height) return null;
    const N = 16;
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const ctx = c.getContext('2d');
    // 取中心 60% 区域，避开背景干扰
    ctx.drawImage(canvas,
      canvas.width * 0.2, canvas.height * 0.2, canvas.width * 0.6, canvas.height * 0.6,
      0, 0, N, N);
    const d = ctx.getImageData(0, 0, N, N).data;
    let r = 0, g = 0, b = 0;
    const px = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    r /= px; g /= px; b /= px;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 255;
    const s = max === min ? 0 : (max - min) / (max + min > 1 ? 255 - l : l);
    let h = 0;
    if (max !== min) {
      const dd = max - min;
      if (max === r) h = ((g - b) / dd + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / dd + 2;
      else h = (r - g) / dd + 4;
      h *= 60;
    }
    return { r, g, b, hue: h, sat: s, light: l };
  } catch (e) {
    return null;
  }
}

// ===== 降级二：无照片时用登录信息推断 =====
function _fallbackToInfer() {
  const { gender, age } = _inferFromUserInfo();
  const courtType = COURT_MAP[gender]?.[age] || 'King';

  // 默认花色映射（无照片时按性别气质给一个合理默认）
  const defaultSuit = {
    male:   { young: 'Wands',    senior: 'Pentacles' },
    female: { young: 'Cups',     senior: 'Cups'      },
    other:  { young: 'Swords',   senior: 'Pentacles' },
  };
  const suit = defaultSuit[gender]?.[age] || 'Cups';
  const cardName = `${courtType} of ${suit}`;
  const card = TAROT_DB.find(c => c.en === cardName) || TAROT_DB[22];

  const desc = '感性而深邃，善于感知内心的声音。';
  _saveProfile(card.id, desc, gender, age);
  _showReveal(card, desc, true);
}

// ===== 展示象征牌 =====
function _showReveal(card, desc, isNew) {
  _el.revealIntro.textContent = isNew
    ? '我看见你了。\n\n你的象征牌是——'
    : '欢迎回来。\n\n你上次的象征牌是——';

  _el.cardImg.src   = `${import.meta.env.BASE_URL}tarot_assets/cards/${card.id}.jpg`;
  _el.cardNameEn.textContent = card.en || '';
  _el.cardNameCn.textContent = card.cn || '';
  _el.cardDesc.textContent   = desc || '';

  _el.revealView.classList.add('on');

  setTimeout(() => {
    _el.cardWrap.classList.add('on');
  }, 400);

  // 确认按钮
  _el.confirmBtn.onclick = () => {
    _el.revealView.classList.remove('on');
    _el.cardWrap.classList.remove('on');
    setTimeout(() => {
      if (_onComplete) _onComplete(card);
    }, 800);
  };

  // 重试按钮（仅新用户显示）
  _el.retryBtn.style.display = isNew ? 'block' : 'none';
  _el.retryBtn.onclick = () => {
    // 清除保存的象征牌记录
    const profile = _loadProfile() || {};
    delete profile.significatorId;
    delete profile.sigDesc;
    _saveProfileRaw(profile);

    _el.revealView.classList.remove('on');
    _el.cardWrap.classList.remove('on');
    setTimeout(() => _startSelfie(), 800);
  };
}

// ===== localStorage =====
function _loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch { return null; }
}
function _saveProfile(sigId, sigDesc, gender, age) {
  const profile = _loadProfile() || {};
  profile.significatorId = sigId;
  profile.sigDesc        = sigDesc;
  profile.gender         = gender;
  profile.age            = age;
  _saveProfileRaw(profile);
}
function _saveProfileRaw(profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
}
