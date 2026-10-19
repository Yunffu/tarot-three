import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initScene, flame1, flame2, flame3, crystals, crystalModel } from './scene.js';
import { initLogin, updateLogin, loginActive, triggerBurnTransition, getLoginRefs, getLoginScene, FLIP_TARGET } from './login.js';
import { initDebugPanel } from './debug-panel.js';
import { initDeck, spreadToFan, collapseToFile, getDeckParams, setDeckParam, applyFanLayout, applyPileLayout, setDeckLoadCallback } from './deck.js';
import { initCamera, moveToDivinationView } from './camera.js';
import { initDialogue, startDialogue, updateLoadProgress, showIdleDialogue, hideIdleDialogue } from './dialogue.js';
import { initBreath, startBreath } from './breath.js';
import { initRules, showRules } from './rules.js';
import { initSignificator, startSignificator } from './significator.js';
import { initShuffle, startShuffle, CUT_CAM, DEAL_CAM } from './shuffle.js';

// ===== 初始化规则提示 =====
initRules();
window.__showRules = showRules;
window.__showIdleDialogue = showIdleDialogue;
window.__hideIdleDialogue = hideIdleDialogue;

// ===== 相机 =====
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(0, 3.75, 2.89);
camera.lookAt(0, 1.88, 0);

// ===== 渲染器 =====
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.35; // login.js会立即覆盖为0
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ===== 初始化场景 =====
const scene = initScene(renderer, camera);

// ===== OrbitControls（开发用） =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 1.88, 0);
controls.minDistance = 1.5;
controls.maxDistance = 5;
controls.maxPolarAngle = Math.PI / 2.2;
controls.update();
initCamera(camera, controls);

// ===== 初始化洗牌模块 =====
initShuffle(camera, scene, controls);

// ===== 初始化象征牌模块 =====
initSignificator();

// ===== 初始化呼吸动画 =====
initBreath();
window.__startBreath = startBreath;

// ===== 占卜阶段标记（呼吸结束后设为true）=====
let _divinationActive = false;
export function isDivinationActive() { return _divinationActive; }

// 开发调试：控制台用 window.__cam / window.__controls
window.__cam = camera;
window.__controls = controls;

// ===== 登录完成回调 =====
function onLoginComplete() {
  // 1. 初始化牌组（后台加载贴图），spreadToFan 内部会等待贴图加载完毕再展开
  initDeck(scene);
  setDeckLoadCallback((loaded, total) => {
    updateLoadProgress(loaded, total);
  });

  // 2. 初始化对话框
  initDialogue(() => {
    // 对话框消失后，等1秒让DOM完全清理，再推进相机
    setTimeout(() => {
      moveToDivinationView(2000, () => {
        console.log('IDLE：78张牌已就绪，相机到位');
      });
    }, 1000);
  }, renderer);

  // 3. 相机先推进，到位后显示对话框
  moveToDivinationView(2000, () => {
    startDialogue();
  });

  // 4. 展开后激活水晶球点击检测
  setTimeout(() => {
    spreadToFan(() => {
      _sigActive = true; // 牌展开完成后激活水晶球点击
      // 水晶球上方标注
      _showCrystalBallLabel();
    });
  }, 500);
}

// ===== 初始化登录模块 =====
setTimeout(() => {
  initLogin(scene, camera, renderer, onLoginComplete);
  window.__loginModule = { triggerBurnTransition };

  // 调试面板：等牌和文字标签都就绪
  setTimeout(() => {
    const refs = getLoginRefs();
    initDebugPanel(
      scene, refs.cards, refs.spotLeft, refs.spotRight,
      camera, controls, refs.labelEls, FLIP_TARGET,
      spreadToFan, getDeckParams, setDeckParam, applyFanLayout, collapseToFile, applyPileLayout
    );
  }, 1000);
}, 200);

// ===== 水晶球点击 → 牌堆合拢 =====
const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2(-9999, -9999);

// ===== 象征牌阶段水晶球Raycaster检测 =====
const _sigRaycaster = new THREE.Raycaster();
const _sigMouse = new THREE.Vector2();
let _sigActive = false;

window.addEventListener('mousemove', (e) => {
  _mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  // 用户操作时重置无操作计时器（仅在占卜阶段生效）
  if (_divinationActive) {
    _clearIdleTimer();
    _startIdleTimer();
  }
});

renderer.domElement.addEventListener('click', () => {
  if (loginActive || !crystalModel) return;
  _raycaster.setFromCamera(_mouse, camera);
  const hits = _raycaster.intersectObject(crystalModel, true);
  if (hits.length > 0) {
    collapseToFile(() => {
      console.log('牌堆合拢，准备洗牌');
      // 进入下一阶段
    });
  }
});

// ===== 象征牌阶段水晶球点击检测 =====
renderer.domElement.addEventListener('click', (e) => {
  if (!_sigActive || !crystalModel) return;
  _sigMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  _sigMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  _sigRaycaster.setFromCamera(_sigMouse, camera);
  const hits = _sigRaycaster.intersectObject(crystalModel, true);
  if (hits.length > 0) {
    _sigActive = false; // 防止重复触发
    _divinationActive = false; // 用户已操作，永久停止 idle 计时器
    // 清理计时器和脉动
    _clearIdleTimer();
    _clearCrystalPulse();
    // 隐藏标签和空闲提示（缓出）
    const label = document.getElementById('crystal-ball-label');
    if (label) label.style.opacity = '0';
    if (window.__hideIdleDialogue) window.__hideIdleDialogue();
    // 读取登录时的用户信息
    const profile = JSON.parse(localStorage.getItem('tarot_profile') || '{}');
    const userInfo = {
      gender: profile.gender,
      age: profile.age,
      birthday_year: profile.birthday_year,
    };
    startSignificator(userInfo, (card) => {
      console.log('象征牌选定：', card.cn);
      // 洗牌阶段永久禁用idle计时器，不再弹出对话框
      _clearIdleTimer();
      _divinationActive = false;
      if (window.__hideIdleDialogue) window.__hideIdleDialogue();
      // 接入洗牌流程
      startShuffle((dealtCards, positions) => {
        console.log('发牌完成', dealtCards.length, '张');
        // 接入翻牌和解读流程
      });
    });
  }
});

// ===== 动画循环 =====
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const time = Date.now() * 0.001;

  // 烛光（只在登录完成后才有effect，曝光为0时看不到）
  const breath   = Math.sin(time*1.5)*0.8  + Math.sin(time*2.3)*0.4;
  const flicker1 = Math.sin(time*11)*0.2   + Math.sin(time*17)*0.1;
  const flicker2 = Math.sin(time*13)*0.2   + Math.sin(time*19)*0.1;
  const flicker3 = Math.sin(time*9)*0.2    + Math.sin(time*15)*0.1;

  // 烛光：登录阶段锁为0，登录完成后才恢复
  const candleOn = !loginActive;
  if (flame1) flame1.intensity = candleOn ? 5 + breath + flicker1 : 0;
  if (flame2) flame2.intensity = candleOn ? 2.5 + breath*0.6 + flicker2 : 0;
  if (flame3) flame3.intensity = candleOn ? 2.5 + breath*0.6 + flicker3 : 0;

  if (flame1) {
    flame1.position.x = Math.sin(time*1.5)*0.02 + Math.sin(time*11)*0.005;
    flame1.position.z = -0.6 + Math.cos(time*1.8)*0.02 + Math.cos(time*13)*0.005;
  }

  // 水晶脉动
  if (crystals) {
    crystals.traverse(child => {
      if (!child.isMesh) return;
      const f1 = Math.max(0, Math.sin(time*13)*Math.sin(time*7));
      const f2 = Math.max(0, Math.sin(time*17)*Math.sin(time*11));
      child.material.envMapIntensity = 3.0 + f1*4.0 + f2*3.0;
      child.material.emissive = new THREE.Color(0x330044);
      child.material.emissiveIntensity = 0.1 + f1*0.4;
    });
  }
  if (crystalModel) {
    crystalModel.traverse(child => {
      if (child.isMesh) child.material.envMapIntensity = 2.0 + Math.sin(time*1.5)*0.5;
    });
  }

  // 登录模块每帧更新
  updateLogin();

  if (loginActive) {
    // 登录阶段：两pass渲染
    // pass1：渲染主场景（极低曝光，道具隐约可见）
    renderer.autoClear = true;
    renderer.render(scene, camera);
    // pass2：清空深度缓冲，渲染登录牌（完全独立，不受场景深度影响）
    const loginScene = getLoginScene();
    if (loginScene) {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(loginScene, camera);
      renderer.autoClear = true;
    }
  } else {
    // 正常占卜阶段：单pass渲染
    renderer.autoClear = true;
    renderer.render(scene, camera);
  }
}
animate();

// ===== 窗口缩放 =====
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== 水晶球标注文字 + 开始占卜按钮 =====
let _idleTimer = null;  // 无操作计时器
let _crystalPulseInterval = null;  // 水晶球脉动interval
let _crystalHovered = false;

function _showCrystalBallLabel() {
  // 移除旧标签（防止重复）
  const oldLabel = document.getElementById('crystal-ball-label');
  if (oldLabel) oldLabel.remove();

  const label = document.createElement('div');
  label.id = 'crystal-ball-label';
  label.innerHTML = `
    <div class="cb-glyph">✦</div>
    <div class="cb-title">开始占卜</div>
    <div class="cb-sub">触碰水晶球</div>
  `;

  // 添加样式
  const style = document.createElement('style');
  style.id = 'cbl-style';
  style.textContent = `
    #crystal-ball-label {
      position: fixed;
      z-index: 150;
      opacity: 0;
      filter: blur(6px);
      transition: opacity 0.8s ease, filter 0.8s ease, transform 0.8s ease;
      transform: translateX(-50%) translateY(4px);
      pointer-events: auto;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    #crystal-ball-label.visible {
      opacity: 1;
      filter: blur(0px);
      transform: translateX(-50%) translateY(0px);
    }
    .cb-glyph {
      font-size: 22px;
      color: #c8a97a;
      letter-spacing: 0.2em;
      text-shadow: 0 0 16px rgba(168,145,106,0.8);
      animation: cbGlyphPulse 2s ease-in-out infinite;
    }
    @keyframes cbGlyphPulse {
      0%,100% { opacity: 0.7; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.15); }
    }
    .cb-title {
      font-family: 'Noto Serif SC','ZCOOL XiaoWei',serif;
      font-size: 16px;
      font-weight: 300;
      color: #e8dcc8;
      letter-spacing: 0.35em;
      text-align: center;
      text-shadow: 0 0 20px rgba(168,145,106,0.5);
      animation: cbTextGlow 2.5s ease-in-out infinite;
    }
    @keyframes cbTextGlow {
      0%,100% {
        color: #e8dcc8;
        text-shadow: 0 0 15px rgba(168,145,106,0.4);
      }
      50% {
        color: #f0e6d8;
        text-shadow: 0 0 30px rgba(168,145,106,0.7);
      }
    }
    .cb-sub {
      font-family: 'Cormorant Garamond',serif;
      font-size: 12px;
      font-style: italic;
      color: rgba(200,180,140,0.65);
      letter-spacing: 0.18em;
      text-align: center;
      animation: cbSubFade 3s ease-in-out infinite;
    }
    @keyframes cbSubFade {
      0%,100% { opacity: 0.5; }
      50% { opacity: 0.8; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(label);

  // 点击事件 - 开始占卜
  label.addEventListener('click', () => {
    if (!_sigActive) return;
    _sigActive = false;
    _clearIdleTimer();
    _clearCrystalPulse();
    // 隐藏标签和空闲提示
    const theLabel = document.getElementById('crystal-ball-label');
    if (theLabel) theLabel.style.opacity = '0';
    const idleTip = document.getElementById('idle-tip');
    if (idleTip) idleTip.style.opacity = '0';
    // 读取登录时的用户信息
    const profile = JSON.parse(localStorage.getItem('tarot_profile') || '{}');
    const userInfo = {
      gender: profile.gender,
      age: profile.age,
      birthday_year: profile.birthday_year,
    };
    // 进入象征牌阶段
    startSignificator(userInfo, (card) => {
      console.log('象征牌选定：', card.cn);
      startShuffle((dealtCards, positions) => {
        console.log('发牌完成', dealtCards.length, '张');
      });
    });
  });

  // 每帧更新位置，跟随水晶球 + 悬停检测 + 发光联动
  let _crystalGlowTarget = 0;
  let _crystalGlowCurrent = 0;

  function tick() {
    if (!document.getElementById('crystal-ball-label')) return;
    if (!crystalModel) { requestAnimationFrame(tick); return; }

    // 更新标签位置（跟随水晶球正上方）
    const pos = crystalModel.position.clone();
    pos.y += 0.35;
    const proj = pos.project(camera);
    const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-proj.y * 0.5 + 0.5) * window.innerHeight;
    label.style.left = sx + 'px';
    label.style.top  = sy + 'px';

    // Raycaster悬停检测
    if (_sigActive) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(_mouse, camera);
      const hits = ray.intersectObject(crystalModel, true);
      const isHovered = hits.length > 0;

      if (isHovered !== _crystalHovered) {
        _crystalHovered = isHovered;
        if (isHovered) {
          label.classList.add('visible');
          _crystalGlowTarget = 1.0;
        } else {
          label.classList.remove('visible');
          _crystalGlowTarget = 0;
        }
      }

      // 水晶球发光平滑插值（lerp系数0.08，约1秒内归零）
      _crystalGlowCurrent += (_crystalGlowTarget - _crystalGlowCurrent) * 0.08;
      crystalModel.traverse(child => {
        if (!child.isMesh) return;
        // 基础脉动 + 悬停发光叠加
        const base = 2.0 + Math.sin(Date.now() * 0.0015) * 0.5;
        child.material.envMapIntensity = base + _crystalGlowCurrent * 2.5;
        // 悬停时加紫色emissive
        child.material.emissive = new THREE.Color(0x2a0044);
        child.material.emissiveIntensity = _crystalGlowCurrent * 0.35;
      });
    }

    requestAnimationFrame(tick);
  }
  tick();
}

// ===== 水晶球脉动效果 =====
function _startCrystalPulse() {
  if (_crystalPulseInterval) clearInterval(_crystalPulseInterval);

  let phase = 0;
  _crystalPulseInterval = setInterval(() => {
    if (!crystalModel || !_sigActive) {
      _clearCrystalPulse();
      return;
    }
    phase += 0.03;
    const intensity = 2.5 + Math.sin(phase) * 1.5 + Math.sin(phase * 1.7) * 0.8;
    crystalModel.traverse(child => {
      if (child.isMesh) {
        child.material.envMapIntensity = intensity;
        // 添加微弱的发光效果
        if (child.material.emissive) {
          const glow = 0.05 + Math.sin(phase) * 0.03;
          child.material.emissive.setRGB(glow * 0.3, 0, glow * 0.5);
          child.material.emissiveIntensity = glow;
        }
      }
    });
  }, 50);
}

function _clearCrystalPulse() {
  if (_crystalPulseInterval) {
    clearInterval(_crystalPulseInterval);
    _crystalPulseInterval = null;
  }
}

// ===== 无操作计时器（10秒后弹窗）=====
function _startIdleTimer() {
  _clearIdleTimer();
  if (!_divinationActive) return;  // 仅在占卜阶段计时
  if (window.__shufflePhase) return;  // 洗牌阶段不计时
  _idleTimer = setTimeout(() => {
    if (!_divinationActive) return;
    if (window.__shufflePhase) return;
    if (window.__showIdleDialogue) {
      window.__showIdleDialogue();
    }
  }, 10000);
}

function _clearIdleTimer() {
  if (_idleTimer) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }
}

// ===== 占卜阶段开始后调用：启动 idle 计时器 =====
// 由 dialogue.js 在呼吸结束后调用
export function startIdleTimerAfterBreath() {
  _divinationActive = true;
  _startIdleTimer();
}
window.__startIdleTimerAfterBreath = startIdleTimerAfterBreath;
