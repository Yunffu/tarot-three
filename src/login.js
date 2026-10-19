import * as THREE from 'three';
import { loadContractAssets, _redrawCanvas as _drawContractCanvas, detectClickArea } from './contractCanvas.js';
// import { submitForm } from '../formService.js'; // 后端接好后取消注释

// ===== 对外暴露 =====
export let loginActive = true;

// 独立的登录场景（与主场景完全隔离）
let _loginScene = null;
export function getLoginScene() { return _loginScene; }

// 调试用：暴露内部引用
export function getLoginRefs() {
  return {
    cards: _loginCards,
    spotLeft: _spotLeft,
    spotRight: _spotRight,
    labelEls: _labelEls,
  };
}

// ===== 内部状态 =====
let _scene, _camera, _renderer;
let _loginCards = [];
let _spotLeft, _spotRight;
let _raycaster, _mouse;
let _hoveredCard = null;
let _selectedCard = null;
let _onComplete = null;
let _labelEls = [];
let _quoteEl = null;
let _overlayEl = null;

// ===== 牌尺寸（登录UI级别，比桌上牌大5倍） =====
const W = 0.55, H = 0.88, D = 0.006, R = 0.025;

// ===== 牌配置：手持扇形造型 =====
// 初始：三张叠在一起（同一位置）
// 展开后：左倾/直立/右倾，高低错落
const CARD_CONFIGS = [
  {
    label_cn: '回来了',    label_en: 'Return',
    color:   new THREE.Color(0xffffff),
    emissive:new THREE.Color(0x0a1a40),
    fan_offset_x: -0.200,
    fan_offset_y: -0.014,
    fan_rotation_z: 0.19,
    fan_z: -0.01,
    type: 'login',
  },
  {
    label_cn: '初次到来',  label_en: 'Begin',
    color:   new THREE.Color(0xc8a060),
    emissive:new THREE.Color(0x5a3000),
    fan_offset_x: 0,
    fan_offset_y: 0,
    fan_rotation_z: 0,
    fan_z: 0,
    type: 'register',
  },
  {
    label_cn: '今夜一问',  label_en: 'One Night',
    color:   new THREE.Color(0x9aabb8),
    emissive:new THREE.Color(0x0a1520),
    fan_offset_x: 0.200,
    fan_offset_y: -0.014,
    fan_rotation_z: -0.19,
    fan_z: 0.01,
    type: 'guest',
  },
];

// 三张牌世界坐标中心
const CENTER = new THREE.Vector3(0, 2.679, 1.290);

// 翻转后牌的目标位置/缩放（调试面板可实时覆盖）
export const FLIP_TARGET = {
  x: 0,
  y: 2.64,
  z: 1.29,
  scale: 1.62,
  rotX: -0.47,
};

// ===== 语录 =====
const QUOTES = [
  { text: '你已经带着所有的答案来到这里了。', author: '' },
  { text: '伤口是光进来的地方。', author: '— 鲁米' },
  { text: '你所寻找的，也在寻找你。', author: '— 鲁米' },
  { text: '在隆冬，我终于知道，\n我身体里有一个不可战胜的夏天。', author: '— 加缪' },
  { text: '要耐心地对待你心中\n一切未解决的问题。', author: '— 里尔克' },
  { text: '当你为错过太阳而哭泣，\n你也将错过群星。', author: '— 泰戈尔' },
  { text: '知人者智，自知者明。', author: '— 老子' },
];

// ===== 初始化 =====
export function initLogin(scene, camera, renderer, onComplete) {
  _scene    = scene;
  _camera   = camera;
  _renderer = renderer;
  _onComplete = onComplete;

  _raycaster = new THREE.Raycaster();
  _mouse     = new THREE.Vector2(-9999, -9999);

  // 一开始：renderer曝光为0，场景全黑
  _renderer.toneMappingExposure = 0;

  // 创建独立登录场景，与主场景完全隔离
  _loginScene = new THREE.Scene();
  // background设为null，透明，主场景从后面透出
  _loginScene.background = null;

  _buildBlackOverlay();
  _buildQuoteEl();
  _buildCards();
  _buildSpotLights();
  _buildLabelEls();
  _bindEvents();
  _runSequence();

  // 预加载契约页面素材
  _loadContractAssets().then(() => {
    console.log('契约素材加载完成');
  });
}

// ===== 纯黑HTML遮罩（承载语录文字） =====
function _buildBlackOverlay() {
  _overlayEl = document.createElement('div');
  Object.assign(_overlayEl.style, {
    position: 'fixed', inset: '0', zIndex: '10',
    background: '#080604',
    transition: 'opacity 2s ease',
    pointerEvents: 'none',
  });
  document.body.appendChild(_overlayEl);
}

// ===== 语录元素 =====
function _buildQuoteEl() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  _quoteEl = document.createElement('div');
  Object.assign(_quoteEl.style, {
    position: 'fixed', inset: '0', zIndex: '20',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '16px',
    opacity: '0', transition: 'opacity 2s ease',
    pointerEvents: 'none',
  });

  const text = document.createElement('p');
  text.innerText = q.text;
  Object.assign(text.style, {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontWeight: '300',
    fontSize: 'clamp(18px, 2.2vw, 24px)',
    color: '#e8dcc8', letterSpacing: '0.06em',
    textAlign: 'center', lineHeight: '1.9',
    whiteSpace: 'pre-line', maxWidth: '580px', padding: '0 48px',
  });
  _quoteEl.appendChild(text);

  if (q.author) {
    const auth = document.createElement('p');
    auth.innerText = q.author;
    Object.assign(auth.style, {
      fontFamily: "'Cinzel', serif",
      fontSize: '10px', letterSpacing: '0.35em',
      color: '#a8916a', opacity: '0.65',
      textTransform: 'uppercase',
    });
    _quoteEl.appendChild(auth);
  }
  document.body.appendChild(_quoteEl);
}

// ===== 三张牌 =====
function _buildCards() {
  const geo = _createCardGeo(W, H, D, R, 8);
  const loader = new THREE.TextureLoader();
  const backTex = loader.load('/tarot_assets/cards/card_back.jpg');
  backTex.colorSpace = THREE.SRGBColorSpace;
  const normTex = loader.load('/tarot_assets/cards/card_back_normal.png');
  const specTex = loader.load('/tarot_assets/cards/card_back_specular.png');

  CARD_CONFIGS.forEach((cfg, i) => {
    const mkMat = () => new THREE.MeshStandardMaterial({
      map: backTex, normalMap: normTex,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: specTex,
      roughness: 0.55, metalness: 0.06,
      color: cfg.color.clone(),
      emissive: cfg.emissive.clone(),
      emissiveIntensity: 0,
      envMapIntensity: 0.2,
      depthTest: false,   // 关闭深度测试，完全靠renderOrder决定层级
      depthWrite: false,  // 不写入深度缓冲，不影响场景物体
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0xd4c9b0, roughness: 0.9, metalness: 0,
    });

    const mesh = new THREE.Mesh(geo, [mkMat(), mkMat(), sideMat]);

    // renderOrder：左=10，中=11，右=12
    // 比场景物体(renderOrder=0)高，保证牌在最上层渲染
    // 右牌(i=2)最大=最前渲染
    mesh.renderOrder = 10 + i;

    // 初始：三张全部叠在CENTER同一位置，从下方浮现
    mesh.position.set(CENTER.x, CENTER.y - 0.5, CENTER.z + cfg.fan_z);
    mesh.rotation.x = -0.420;
    mesh.rotation.z = 0;
    mesh.visible = false;

    mesh.userData = {
      index: i,
      type: cfg.type,
      fanX: CENTER.x + cfg.fan_offset_x,
      fanY: CENTER.y + cfg.fan_offset_y,
      fanZ: CENTER.z + cfg.fan_z,
      fanRZ: cfg.fan_rotation_z,
      baseX: CENTER.x + cfg.fan_offset_x,
      baseY: CENTER.y + cfg.fan_offset_y,
      baseZ: CENTER.z + cfg.fan_z,
      isSelected: false,
      isFanned: false,
    };

    _loginScene.add(mesh);
    _loginCards.push(mesh);
  });
}

// ===== 补光灯（初始散开，动画时聚焦） =====
function _buildSpotLights() {
  // 初始：灯X大幅散开，强度0，光锥角度大（散光）
  _spotLeft = new THREE.SpotLight(0xfff8e8, 0, 10, 1.2, 0.8, 1.0);
  _spotLeft.position.set(-0.20, 3.10, 3.00);  // 从左侧散开开始
  _spotLeft.target.position.copy(CENTER);
  _loginScene.add(_spotLeft); _loginScene.add(_spotLeft.target);

  _spotRight = new THREE.SpotLight(0xe8f0ff, 0, 10, 1.2, 0.8, 1.0);
  _spotRight.position.set(0.20, 3.10, 3.00);   // 从右侧散开开始
  _spotRight.target.position.copy(CENTER);
  _loginScene.add(_spotRight); _loginScene.add(_spotRight.target);
}

// ===== 文字标签 =====
function _buildLabelEls() {
  CARD_CONFIGS.forEach((cfg) => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', zIndex: '35',
      textAlign: 'center', opacity: '0',
      pointerEvents: 'none',
      transition: 'opacity 0.45s ease, transform 0.45s ease',
      transform: 'translateX(-50%) translateY(6px)',
    });
    const cn = document.createElement('span');
    cn.innerText = cfg.label_cn;
    Object.assign(cn.style, {
      display: 'block',
      fontFamily: "'ZCOOL XiaoWei', serif",
      fontSize: '22px', color: '#d4b876',
      letterSpacing: '0.22em', marginBottom: '4px',
      textShadow: '0 0 12px rgba(212,184,118,0.4)',
    });
    const en = document.createElement('span');
    en.innerText = cfg.label_en;
    Object.assign(en.style, {
      display: 'block',
      fontFamily: "'Cinzel', serif",
      fontSize: '10px', letterSpacing: '0.32em',
      color: '#e8dcc8', opacity: '0.4',
      textTransform: 'uppercase',
    });
    el.appendChild(cn); el.appendChild(en);
    document.body.appendChild(el);
    _labelEls.push(el);
  });
}

// ===== 事件 =====
function _bindEvents() {
  window.addEventListener('mousemove', _onMove);
  _renderer.domElement.addEventListener('click', _onClick);
}
function _onMove(e) {
  if (!loginActive) return;
  _mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  // 检测印章悬停，卡片翻转后才生效
  if (!_selectedCard) return;
  const type = _selectedCard.userData.type;
  if (!type) return;

  const ray = new THREE.Raycaster();
  ray.setFromCamera(_mouse, _camera);
  const hits = ray.intersectObject(_selectedCard, false);

  // 鼠标不在卡牌上时重置cursor
  if (hits.length === 0) {
    if (document.body.style.cursor === 'pointer') {
      document.body.style.cursor = '';
    }
    return;
  }

  if (hits[0].uv) {
    // 和 detectClickArea 一样做水平翻转
    const uvx = 1 - hits[0].uv.x;
    const uvy = 1 - hits[0].uv.y;
    // 印章在Canvas中的区域映射到UV
    const stampX = 353 / CANVAS_W, stampY = 515 / CANVAS_H;
    const stampW = 148 / CANVAS_W, stampH = 133 / CANVAS_H;
    const isOverStamp = uvx >= stampX && uvx <= stampX + stampW && uvy >= stampY && uvy <= stampY + stampH;
    if (_cardInputState[type]?._overStamp !== isOverStamp) {
      _cardInputState[type]._overStamp = isOverStamp;
      _refreshCanvas(type);
      document.body.style.cursor = isOverStamp ? 'pointer' : '';
    }
  }
}
function _onClick(e) {
  if (!loginActive) return;
  // 只有悬停在牌上才拦截，否则OrbitControls正常工作
  if (!_hoveredCard || _selectedCard) return;
  e.stopPropagation();
  _selectedCard = _hoveredCard;
  _selectedCard.userData.isSelected = true;
  _loginCards.forEach((c, i) => {
    if (c !== _selectedCard) _labelEls[i].style.opacity = '0';
  });
  _flyToCenter(_selectedCard);
}

// ===== 入场时序 =====
function _runSequence() {
  // T+300ms  语录淡入
  setTimeout(() => { _quoteEl.style.opacity = '1'; }, 300);

  // T+3800ms 语录淡出
  setTimeout(() => { _quoteEl.style.opacity = '0'; }, 3800);

  // T+5400ms 黑层淡出，三张叠牌从下方浮现
  setTimeout(() => {
    _quoteEl.remove();
    _overlayEl.style.opacity = '0';
    _lerpExposure(0, 0.04, 1200);
    _loginCards.forEach(c => { c.visible = true; });
    _floatInStack();
  }, 5400);

  // T+6800ms 聚光灯聚焦 + 牌展开，完全同步
  setTimeout(() => {
    const DUR = 900; // 统一时长，同一条曲线
    _focusSpotLights(DUR);
    _fanOut(DUR);
  }, 6800);

  // T+6800+900+300ms 展开完成后文字聚合浮现
  setTimeout(() => {
    _showFanLabels();
  }, 8000);
}

// ===== 叠牌整体从下方浮现 =====
function _floatInStack() {
  const startY = CENTER.y - 0.5;
  const targetY = CENTER.y - 0.05;
  const t0 = Date.now(), dur = 900;
  function step() {
    if (!loginActive) return;
    const t = Math.min((Date.now() - t0) / dur, 1);
    const e = 1 - Math.pow(1 - t, 3);
    _loginCards.forEach(c => { c.position.y = startY + (targetY - startY) * e; });
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}

// ===== 聚光灯从散开聚焦（与fanOut同步） =====
function _focusSpotLights(dur) {
  // 目标参数（调试面板确认的值）
  const targetLeftX  = -0.20, targetRightX = 0.20;
  const targetIntL   = 30.0,  targetIntR   = 21.0;
  const targetAngle  = 0.54,  targetPenumbra = 0.28;

  const startLeftX   = _spotLeft.position.x;   // -3.0
  const startRightX  = _spotRight.position.x;  //  3.0
  const startAngle   = _spotLeft.angle;         // 1.2
  const startPenumbra= _spotLeft.penumbra;      // 0.8

  const t0 = Date.now();
  function step() {
    if (!loginActive) return;
    const t = Math.min((Date.now() - t0) / dur, 1);
    // easeOutExpo：与fanOut一致
    const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

    // X聚拢
    _spotLeft.position.x  = startLeftX  + (targetLeftX  - startLeftX)  * e;
    _spotRight.position.x = startRightX + (targetRightX - startRightX) * e;

    // 强度从0升起
    _spotLeft.intensity  = targetIntL * e;
    _spotRight.intensity = targetIntR * e;

    // 光锥从散到聚
    _spotLeft.angle   = startAngle   + (targetAngle   - startAngle)   * e;
    _spotRight.angle  = startAngle   + (targetAngle   - startAngle)   * e;
    _spotLeft.penumbra  = startPenumbra + (targetPenumbra - startPenumbra) * e;
    _spotRight.penumbra = startPenumbra + (targetPenumbra - startPenumbra) * e;

    if (t < 1) requestAnimationFrame(step);
    else {
      // 锁定到精确目标值
      _spotLeft.position.x  = targetLeftX;
      _spotRight.position.x = targetRightX;
      _spotLeft.intensity   = targetIntL;
      _spotRight.intensity  = targetIntR;
      _spotLeft.angle = _spotRight.angle = targetAngle;
      _spotLeft.penumbra = _spotRight.penumbra = targetPenumbra;
    }
  }
  step();
}

// ===== 扇形展开动画 =====
function _fanOut(dur) {
  const t0 = Date.now();
  const stackY = CENTER.y - 0.05;
  let doneCount = 0; // 三张全完成才开hover

  _loginCards.forEach((card, i) => {
    const ud = card.userData;
    const startX  = CENTER.x;
    const startY  = stackY;
    const startZ  = CENTER.z + (i - 1) * 0.002;
    const startRZ = 0;

    function step() {
      if (!loginActive) return;
      const t = Math.min((Date.now() - t0) / dur, 1);
      // easeOutExpo：开头极快，结尾骤停
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

      card.position.x = startX  + (ud.fanX  - startX)  * e;
      card.position.y = startY  + (ud.fanY  - startY)  * e;
      card.position.z = startZ  + (ud.fanZ  - startZ)  * e;
      card.rotation.z = startRZ + (ud.fanRZ - startRZ) * e;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        card.position.x = ud.fanX;
        card.position.y = ud.fanY;
        card.position.z = ud.fanZ;
        card.rotation.z = ud.fanRZ;
        // 三张全部完成才统一开hover，防止穿模
        doneCount++;
        if (doneCount === _loginCards.length) {
          _loginCards.forEach(c => { c.userData.isFanned = true; });
        }
      }
    }
    step();
  });
}

// ===== 文字聚合浮现后流散 =====
// 调试确认的文字偏移参数
const LABEL_OFFSETS = [
  { dx: -37, dy: -17, rz: -11 }, // 回来了（登录）
  { dx:   0, dy: -22, rz:   0 }, // 初次到来（注册）
  { dx:  35, dy: -17, rz:  11 }, // 今夜一问（游客）
];

function _showFanLabels() {
  _labelEls.forEach((el, i) => {
    const card = _loginCards[i];
    const topPos3d = card.position.clone();
    topPos3d.y += H * 0.5 + 0.06;
    const sTop = _toScreen(topPos3d);
    const off = LABEL_OFFSETS[i];

    el.style.left      = sTop.x + 'px';
    el.style.top       = sTop.y + 'px';
    el.style.marginLeft = off.dx + 'px';
    el.style.marginTop  = off.dy + 'px';
    // 写入dataset供updateLogin每帧读取
    el.dataset.rotateZ = off.rz;

    // 初始：模糊散开像沙粒
    Object.assign(el.style, {
      transition: 'none',
      opacity: '0',
      filter: 'blur(10px)',
      letterSpacing: '0.7em',
      transform: `translateX(-50%) translateY(8px) rotateZ(${off.rz}deg)`,
    });

    el.offsetHeight;

    // 聚合动画
    Object.assign(el.style, {
      transition: 'opacity 1.2s ease, filter 1.2s ease, letter-spacing 1.2s ease, transform 1.2s ease',
      opacity: '1',
      filter: 'blur(0px)',
      letterSpacing: '0.22em',
      transform: `translateX(-50%) translateY(0px) rotateZ(${off.rz}deg)`,
    });
  });

  // 停留2秒后流散
  setTimeout(() => {
    _labelEls.forEach((el, i) => {
      const rz = LABEL_OFFSETS[i].rz;
      Object.assign(el.style, {
        transition: 'opacity 1s ease, filter 1s ease, letter-spacing 1s ease, transform 1s ease',
        opacity: '0',
        filter: 'blur(8px)',
        letterSpacing: '0.9em',
        transform: `translateX(-50%) translateY(-10px) rotateZ(${rz}deg)`,
      });
    });
  }, 2000);
}

// ===== 点击后：先淡出其他两张，再飞，再翻转 =====
// ===== 点击后完整动画流程 =====
function _flyToCenter(card) {
  const type = card.userData.type;

  // 1. 立刻提升renderOrder，防止穿模
  card.renderOrder = 20;

  // 2. 预烘焙Canvas纹理到正面，翻转前已渲染好
  _prebakeContractTexture(card, type);

  // 3. 隐藏所有标签
  _labelEls.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });

  // 4. 其他两张立刻从loginScene移除，彻底消除穿模
  const otherCards = _loginCards.filter(c => c !== card);
  otherCards.forEach((c, i) => {
    if (c.parent) _loginScene.remove(c);
    // 禁用hover逻辑，防止标签穿透翻转的牌
    c.userData.isFanned = false;
    c.userData.isHidden = true;
    // 强制隐藏对应标签
    const globalIdx = _loginCards.indexOf(c);
    if (_labelEls[globalIdx]) {
      _labelEls[globalIdx].style.opacity = '0';
      _labelEls[globalIdx].style.pointerEvents = 'none';
    }
  });

  // 80ms后触发甩牌+翻转
  setTimeout(() => _doThrowAndFlip(card), 80);
}

// ===== 预烘焙Canvas纹理 =====
function _prebakeContractTexture(card, type) {
  const canvas = _getOrCreateCanvas(type);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  _cardTextures[type] = texture;

  if (!card.userData._origMat1) {
    card.userData._origMat1 = card.material[1];
  }
  card.material[1] = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.7, metalness: 0.0,
    envMapIntensity: 0.3,
    depthTest: false,
  });
  card.material[1].renderOrder = card.renderOrder;
  _refreshCanvas(type);
}

// ===== 甩牌+翻转同步动画 =====
function _doThrowAndFlip(card) {
  const sp = card.position.clone();
  const ss = card.scale.clone();
  const startRY = card.rotation.y;
  const startRX = card.rotation.x;
  const targetRY = Math.PI;
  const DUR = 750;
  const t0 = Date.now();

  function step() {
    const t = Math.min((Date.now() - t0) / DUR, 1);

    // 位置/缩放：easeOutBack，快速冲出轻微过冲，模拟甩牌弹性
    const c1 = 1.70158, c3 = c1 + 1;
    const ePos = t === 1 ? 1 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);

    // 翻转：easeInOutQuart，前慢中快后慢，有厚重感
    const eRot = t < 0.5
      ? 8 * t * t * t * t
      : 1 - Math.pow(-2 * t + 2, 4) / 2;

    const tp = new THREE.Vector3(FLIP_TARGET.x, FLIP_TARGET.y, FLIP_TARGET.z);
    const ts = new THREE.Vector3(FLIP_TARGET.scale, FLIP_TARGET.scale, FLIP_TARGET.scale);

    card.position.lerpVectors(sp, tp, Math.min(ePos, 1.08));
    card.scale.lerpVectors(ss, ts, ePos);
    card.rotation.y = startRY + (targetRY - startRY) * eRot;
    card.rotation.x = startRX + (FLIP_TARGET.rotX - startRX) * eRot;

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      card.position.copy(tp);
      card.scale.copy(ts);
      card.rotation.y = targetRY;
      card.rotation.x = FLIP_TARGET.rotX;
      _bindFormInteraction(card);
    }
  }
  step();
}

// ===== Canvas契约页面（接入contractCanvas.js） =====
const CANVAS_W = 512, CANVAS_H = 820;
const _cardCanvases = {};
const _cardTextures = {};
const _cardInputState = {}; // { type: { name, password, ... } }
let _activeField = null;
let _cursorTimer = null;

// 预加载素材（在initLogin里调用）
async function _loadContractAssets() {
  await loadContractAssets('/ziyuan');
  await document.fonts.ready; // 等所有字体（本地woff2）加载完成
}

function _getOrCreateCanvas(type) {
  if (_cardCanvases[type]) return _cardCanvases[type];
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W; canvas.height = CANVAS_H;
  _cardCanvases[type] = canvas;
  _cardInputState[type] = { cursorVisible: true };
  return canvas;
}

function _refreshCanvas(type) {
  const canvas = _cardCanvases[type];
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  _drawContractCanvas(type, ctx, _cardInputState[type] || {}, _activeField);
  if (_cardTextures[type]) _cardTextures[type].needsUpdate = true;
}

// ===== 绑定表单交互（动画结束后调用） =====
function _bindFormInteraction(card) {
  const type = card.userData.type;
  const overlay = document.getElementById('login-form-overlay');
  if (overlay) overlay.style.display = 'none';

  // 光标闪烁
  if (_cursorTimer) clearInterval(_cursorTimer);
  _cursorTimer = setInterval(() => {
    if (_cardInputState[type]) {
      _cardInputState[type].cursorVisible = !_cardInputState[type].cursorVisible;
      _refreshCanvas(type);
    }
  }, 500);

  _bindKeyboard(type);
  _bindFormClick(card, type);

  // 眼睛按钮：按住显示密码
  function _eyeDownHandler(e) {
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, _camera);
    const hits = ray.intersectObject(card, false);
    if (!hits.length || hits[0].face.materialIndex !== 1) return;
    const uv = hits[0].uv;
    const cx = (1 - uv.x) * CANVAS_W;
    const cy = (1 - uv.y) * CANVAS_H;
    const area = detectClickArea(type, cx, cy);
    if (area === 'eye_password') {
      _cardInputState[type]._eyeOpen = true;
      _refreshCanvas(type);
    }
  }
  function _eyeUpHandler() {
    if (_cardInputState[type] && _cardInputState[type]._eyeOpen) {
      _cardInputState[type]._eyeOpen = false;
      _refreshCanvas(type);
    }
  }
  _renderer.domElement.addEventListener('mousedown', _eyeDownHandler);
  _renderer.domElement.addEventListener('mouseup',   _eyeUpHandler);
  _renderer.domElement.addEventListener('mouseleave', _eyeUpHandler);

  // 记录引用以便后续清理
  window._eyeDownHandler = _eyeDownHandler;
  window._eyeUpHandler   = _eyeUpHandler;
}

// ===== 显示表单（兼容保留） =====
function _showForm(card) {
  _bindFormInteraction(card);
}

// ===== 键盘输入 =====
const BIRTHDAY_MAXLEN = { birthday_year: 4, birthday_month: 2, birthday_day: 2 };
const BIRTHDAY_NEXT   = { birthday_year: 'birthday_month', birthday_month: 'birthday_day', birthday_day: null };

function _bindKeyboard(type) {
  if (window._formKeyHandler) window.removeEventListener('keydown', window._formKeyHandler);
  window._formKeyHandler = (e) => {
    if (!_activeField) return;
    const state = _cardInputState[type];
    if (!state) return;
    const maxLen = BIRTHDAY_MAXLEN[_activeField];

    if (e.key === 'Backspace') {
      state[_activeField] = (state[_activeField] || '').slice(0, -1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
    } else if (e.key === 'Enter') {
      _submitForm(type); return;
    } else if (/^[0-9]$/.test(e.key)) {
      const cur = state[_activeField] || '';
      if (!maxLen || cur.length < maxLen) {
        state[_activeField] = cur + e.key;
        if (maxLen && state[_activeField].length === maxLen) {
          _activeField = BIRTHDAY_NEXT[_activeField] || _activeField;
        }
      }
    } else if (!maxLen && e.key.length === 1) {
      state[_activeField] = (state[_activeField] || '') + e.key;
    }
    _refreshCanvas(type);
  };
  window.addEventListener('keydown', window._formKeyHandler);
}

// ===== 点击检测 =====
function _bindFormClick(card, type) {
  if (window._formClickHandler) {
    _renderer.domElement.removeEventListener('click', window._formClickHandler);
  }
  window._formClickHandler = (e) => {
    if (!_selectedCard) return;
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, _camera);
    const hits = ray.intersectObject(card, false);

    // 点击牌以外→回到三张牌
    if (!hits.length) { _resetSelection(); return; }
    if (hits[0].face.materialIndex !== 1) { _resetSelection(); return; }

    const uv = hits[0].uv;
    // contractCanvas内部做了水平翻转，UV需对应处理
    const cx = (1 - uv.x) * CANVAS_W;
    const cy = (1 - uv.y) * CANVAS_H;

    const area = detectClickArea(type, cx, cy);
    const state = _cardInputState[type];

    if (area === 'stamp') {
      _submitForm(type);
    } else if (area === 'gender_female') {
      state.gender = 'female'; _refreshCanvas(type);
    } else if (area === 'gender_male') {
      state.gender = 'male'; _refreshCanvas(type);
    } else if (area === 'gender_nonbinary') {
      state.gender = 'nonbinary'; _refreshCanvas(type);
    } else if (area) {
      _activeField = area; _refreshCanvas(type);
    } else {
      _activeField = null; _refreshCanvas(type);
    }
  };
  _renderer.domElement.addEventListener('click', window._formClickHandler);
}

// ===== 提交表单 =====
function _submitForm(type) {
  const state = _cardInputState[type];
  console.log(`提交 ${type}:`, state);

  // 清理输入监听
  if (window._formKeyHandler) { window.removeEventListener('keydown', window._formKeyHandler); window._formKeyHandler = null; }
  if (window._formClickHandler) { _renderer.domElement.removeEventListener('click', window._formClickHandler); window._formClickHandler = null; }
  if (_cursorTimer) { clearInterval(_cursorTimer); _cursorTimer = null; }

  // 触发HTML层燃烧Canvas，完成后再做Three.js转场
  if (window.startBurn) {
    window.startBurn(window.innerWidth / 2, window.innerHeight / 2, () => {
      triggerBurnTransition();
    });
  } else {
    triggerBurnTransition();
  }
}
function _resetSelection() {
  if (!_selectedCard) return;
  const ud = _selectedCard.userData;
  const card = _selectedCard;
  const otherCards = _loginCards.filter(c => c !== card);

  // ── Step 1：另外两张先向外让位 ──
  otherCards.forEach(c => {
    if (!c.parent) _loginScene.add(c);
    c.userData.isFanned = true;
    c.userData.isHidden = false;
    c.visible = true;

    // 只做位置动画
    const offsetX = c.userData.fanX < ud.fanX ? -0.22 : 0.22;
    const spreadX = c.userData.fanX + offsetX;
    const t0s = Date.now(), durs = 350;
    function spreadOut() {
      const t = Math.min((Date.now() - t0s) / durs, 1);
      const e = 1 - Math.pow(1 - t, 2);
      c.position.x += (spreadX - c.position.x) * 0.12;
      c.position.y += (c.userData.fanY - c.position.y) * 0.12;
      if (t < 1) requestAnimationFrame(spreadOut);
    }
    spreadOut();
  });

  // ── Step 2：选中牌翻回背面（300ms 后开始）──
  setTimeout(() => {
    const startRY = card.rotation.y;
    const t0flip = Date.now(), durFlip = 400;
    function flipBack() {
      const t = Math.min((Date.now() - t0flip) / durFlip, 1);
      const e = 1 - Math.pow(1 - t, 3);
      card.rotation.y = startRY + (0 - startRY) * e;
      if (t < 1) {
        requestAnimationFrame(flipBack);
      } else {
        // 翻完再换回材质
        if (card.userData._origMat1) {
          card.material[1] = card.userData._origMat1;
          delete card.userData._origMat1;
        }
      }
    }
    flipBack();

    // ── Step 3：同时飞回原位 ──
    const sp = card.position.clone();
    const ss = card.scale.clone();
    const tp = new THREE.Vector3(ud.baseX, ud.baseY, ud.baseZ);
    const ts = new THREE.Vector3(1, 1, 1);
    const t0 = Date.now(), dur = 550;
    card.renderOrder = 20;

    function flyBack() {
      const t = Math.min((Date.now() - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      card.position.lerpVectors(sp, tp, e);
      card.scale.lerpVectors(ss, ts, e);
      if (t < 1) {
        requestAnimationFrame(flyBack);
      } else {
        card.renderOrder = _loginCards.indexOf(card) + 10;

        // ── Step 4：选中牌到位后，其他牌归位 ──
        otherCards.forEach(c => {
          const t0r = Date.now(), durr = 400;
          function returnToFan() {
            const t = Math.min((Date.now() - t0r) / durr, 1);
            const e = 1 - Math.pow(1 - t, 3);
            c.position.x += (c.userData.fanX - c.position.x) * (e * 0.2);
            c.position.y += (c.userData.fanY - c.position.y) * (e * 0.2);
            if (t < 1) {
              requestAnimationFrame(returnToFan);
            }
          }
          returnToFan();
        });
      }
    }
    flyBack();
  }, 300);

  // ── 重置状态 ──
  _loginCards.forEach(c => { c.userData.isSelected = false; });
  _selectedCard = null;
  _hoveredCard = null;
  _activeField = null;

  if (window._formKeyHandler) {
    window.removeEventListener('keydown', window._formKeyHandler);
    window._formKeyHandler = null;
  }
  if (window._formClickHandler) {
    _renderer.domElement.removeEventListener('click', window._formClickHandler);
    window._formClickHandler = null;
  }
  if (_cursorTimer) { clearInterval(_cursorTimer); _cursorTimer = null; }
  if (window._eyeDownHandler) {
    _renderer.domElement.removeEventListener('mousedown', window._eyeDownHandler);
    _renderer.domElement.removeEventListener('mouseup',   window._eyeUpHandler);
    _renderer.domElement.removeEventListener('mouseleave', window._eyeUpHandler);
    window._eyeDownHandler = null;
    window._eyeUpHandler   = null;
  }
}

// ===== 燃烧转场完成后调用 =====
export function triggerBurnTransition() {
  loginActive = false;
  _fadeSpot(_spotLeft,  0, 900);
  _fadeSpot(_spotRight, 0, 900);
  setTimeout(() => { _lerpExposure(_renderer.toneMappingExposure, 0.35, 2000); }, 600);
  setTimeout(() => { _cleanup(); }, 2200);
  setTimeout(() => { if (_onComplete) _onComplete(); }, 2400);
}

// ===== 清理 =====
function _cleanup() {
  _loginCards.forEach(c => _loginScene.remove(c));
  _loginCards = [];
  _loginScene.remove(_spotLeft);  _loginScene.remove(_spotLeft.target);
  _loginScene.remove(_spotRight); _loginScene.remove(_spotRight.target);
  _loginScene = null;
  _labelEls.forEach(el => el.remove()); _labelEls = [];
  if (_overlayEl) _overlayEl.remove();
  window.removeEventListener('mousemove', _onMove);

  if (window._formKeyHandler) {
    window.removeEventListener('keydown', window._formKeyHandler);
    window._formKeyHandler = null;
  }
  if (window._formClickHandler) {
    _renderer.domElement.removeEventListener('click', window._formClickHandler);
    window._formClickHandler = null;
  }
  if (_cursorTimer) { clearInterval(_cursorTimer); _cursorTimer = null; }
  if (window._eyeDownHandler) {
    _renderer.domElement.removeEventListener('mousedown', window._eyeDownHandler);
    _renderer.domElement.removeEventListener('mouseup',   window._eyeUpHandler);
    _renderer.domElement.removeEventListener('mouseleave', window._eyeUpHandler);
    window._eyeDownHandler = null;
    window._eyeUpHandler   = null;
  }
}

// ===== 清理所有登录事件监听（供 dialogue.js 在转场时调用）=====
export function cleanupLoginHandlers(renderer) {
  if (window._formClickHandler && renderer) {
    renderer.domElement.removeEventListener('click', window._formClickHandler);
    window._formClickHandler = null;
  }
  if (window._eyeDownHandler && renderer) {
    renderer.domElement.removeEventListener('mousedown', window._eyeDownHandler);
    renderer.domElement.removeEventListener('mouseup', window._eyeUpHandler);
    renderer.domElement.removeEventListener('mouseleave', window._eyeUpHandler);
    window._eyeDownHandler = null;
    window._eyeUpHandler = null;
  }
}

// ===== 每帧更新 =====
export function updateLogin() {
  if (!loginActive || _loginCards.length === 0) return;
  const time = Date.now() * 0.001;

  _raycaster.setFromCamera(_mouse, _camera);
  const hits = _raycaster.intersectObjects(_loginCards, false);
  _hoveredCard = hits.length > 0 ? hits[0].object : null;

  _loginCards.forEach((card, i) => {
    const ud = card.userData;
    if (ud.isSelected || !card.visible || !ud.isFanned || ud.isHidden) return;

    const isHov = card === _hoveredCard;

    // 只做Y轴上移
    const targetY = isHov ? ud.baseY + 0.07 : ud.baseY;
    card.position.y += (targetY - card.position.y) * 0.09;

    // 呼吸浮动（只影响Y）
    card.position.y += Math.sin(time * 1.0 + i * 1.4) * 0.0005;

    // Z轴强制锁定，永远不动
    card.position.z = ud.fanZ;

    // emissive发光
    const targetGlow = isHov ? 0.38 : 0.0;
    card.material[0].emissiveIntensity += (targetGlow - card.material[0].emissiveIntensity) * 0.09;
    card.material[1].emissiveIntensity  = card.material[0].emissiveIntensity;

    if (_labelEls[i]) {
      const topPos3d = card.position.clone();
      topPos3d.y += H * 0.5 + 0.06;
      const sTop = _toScreen(topPos3d);
      const off = LABEL_OFFSETS[i];
      _labelEls[i].style.left       = sTop.x + 'px';
      _labelEls[i].style.top        = sTop.y + 'px';
      _labelEls[i].style.marginLeft = off.dx + 'px';
      _labelEls[i].style.marginTop  = off.dy + 'px';

      const rz = parseFloat(_labelEls[i].dataset.rotateZ || off.rz || '0');
      const rzStr = `rotateZ(${rz}deg)`;

      if (isHov) {
        _labelEls[i].style.transition = 'opacity 0.6s ease, filter 0.6s ease, letter-spacing 0.6s ease';
        _labelEls[i].style.opacity = '1';
        _labelEls[i].style.filter = 'blur(0px)';
        _labelEls[i].style.letterSpacing = '0.22em';
        if (!_labelEls[i].dataset.forceShow) {
          _labelEls[i].style.transform = `translateX(-50%) translateY(0px) ${rzStr}`;
        }
      } else {
        _labelEls[i].style.transition = 'opacity 0.4s ease, filter 0.4s ease, letter-spacing 0.4s ease';
        _labelEls[i].style.opacity = _labelEls[i].dataset.forceShow ? '1' : '0';
        _labelEls[i].style.filter = _labelEls[i].dataset.forceShow ? 'blur(0px)' : 'blur(5px)';
        _labelEls[i].style.letterSpacing = '0.5em';
        if (!_labelEls[i].dataset.forceShow) {
          _labelEls[i].style.transform = `translateX(-50%) translateY(-4px) ${rzStr}`;
        }
      }
    }
  });
}

// ===== 工具函数 =====
function _toScreen(pos3d) {
  const v = pos3d.clone().project(_camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
  };
}
function _fadeSpot(light, target, duration) {
  const start = light.intensity, t0 = Date.now();
  function step() {
    const t = Math.min((Date.now() - t0) / duration, 1);
    light.intensity = start + (target - start) * (1 - Math.pow(1-t, 2));
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}
function _lerpExposure(from, to, duration) {
  const t0 = Date.now();
  function step() {
    const t = Math.min((Date.now() - t0) / duration, 1);
    _renderer.toneMappingExposure = from + (to - from) * (1 - Math.pow(1-t, 2));
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}

// ===== 圆角矩形几何体 =====
function _createCardGeo(width, height, depth, radius, segments) {
  const geo = new THREE.BufferGeometry();
  const pos=[], nor=[], uv=[], idx=[], grp=[];
  let vc=0;
  function pts(w,h,r,seg){
    const p=[];
    for(const [cx,cy,sa] of [[w-r,h-r,0],[-w+r,h-r,Math.PI*.5],[-w+r,-h+r,Math.PI],[w-r,-h+r,Math.PI*1.5]]){
      for(let i=0;i<=seg;i++){const a=sa+Math.PI*.5*i/seg;p.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}
    }
    return p;
  }
  const w=width/2,h=height/2,d=depth/2;
  const ol=pts(w,h,radius,segments), N=ol.length;

  // 正面
  const fs=vc; pos.push(0,0,d);nor.push(0,0,1);uv.push(.5,.5);vc++;
  for(let i=0;i<N;i++){const[x,y]=ol[i];pos.push(x,y,d);nor.push(0,0,1);uv.push((x/w+1)/2,(y/h+1)/2);vc++;}
  const fi=idx.length;
  for(let i=0;i<N;i++)idx.push(fs,fs+1+i,fs+1+(i+1)%N);
  grp.push({start:fi,count:N*3,materialIndex:0});

  // 背面
  const bs=vc; pos.push(0,0,-d);nor.push(0,0,-1);uv.push(.5,.5);vc++;
  for(let i=0;i<N;i++){const[x,y]=ol[i];pos.push(x,y,-d);nor.push(0,0,-1);uv.push((x+w)/width,(y+h)/height);vc++;}
  const bi=idx.length;
  for(let i=0;i<N;i++)idx.push(bs,bs+1+(i+1)%N,bs+1+i);
  grp.push({start:bi,count:N*3,materialIndex:1});

  // 侧边
  const si=idx.length;
  for(let i=0;i<N;i++){
    const[x0,y0]=ol[i],[x1,y1]=ol[(i+1)%N];
    const nx=(x0+x1)/2,ny=(y0+y1)/2,len=Math.sqrt(nx*nx+ny*ny);
    pos.push(x0,y0,d,x1,y1,d,x0,y0,-d,x1,y1,-d);
    nor.push(nx/len,ny/len,0,nx/len,ny/len,0,nx/len,ny/len,0,nx/len,ny/len,0);
    uv.push(0,1,1,1,0,0,1,0);
    const v=vc+i*4; idx.push(v,v+1,v+2,v+1,v+3,v+2); vc+=4;
  }
  grp.push({start:si,count:idx.length-si,materialIndex:2});

  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('normal',  new THREE.Float32BufferAttribute(nor,3));
  geo.setAttribute('uv',      new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx);
  for(const g of grp) geo.addGroup(g.start,g.count,g.materialIndex);
  return geo;
}
