// shuffle.js — 洗牌、切牌、发牌流程
import * as THREE from 'three';
import { deckMeshes, deckOrder, collapseToFile } from './deck.js';

// ===== 对外接口 =====
export function initShuffle(camera, scene, controls) {
  _camera   = camera;
  _scene    = scene;
  _controls = controls;
  _buildUI();
}

export function startShuffle(onDealt) {
  _onDealt    = onDealt;
  _dealtCards = [];
  collapseToFile(() => {
    // 强制重置所有牌的rotation为正确初始状态（背面朝上，平放）
    deckMeshes.forEach((m, i) => {
      m.rotation.set(0, Math.PI, 0);
      m.position.set(PILE_X, PILE_Y + i * CARD_THICKNESS, PILE_Z);
      m.visible = true;
    });
    setTimeout(() => _doOverhand(), 600);
  });
}

export const CUT_CAM = {
  x: 0, y: 4.2, z: 1.2,
  tx: 0, ty: 2.0, tz: 0,
};
export const DEAL_CAM = {
  x: 0, y: 3.2, z: 0.9,
  tx: 0, ty: 2.0, tz: 0.2,
};

// ===== 随机工具 =====
let _entropyPool  = [];
let _entropyTimer = null;

function _startEntropy() {
  _entropyPool  = [];
  _entropyTimer = setInterval(() => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    _entropyPool.push({ r: buf[0] / (0xFFFFFFFF + 1), t: performance.now() });
    if (_entropyPool.length > 600) _entropyPool.shift();
  }, 100);
}
function _stopEntropy() { clearInterval(_entropyTimer); _entropyTimer = null; }

function _poolRand() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  if (!_entropyPool.length) return buf[0] / (0xFFFFFFFF + 1);
  const idx = buf[0] % _entropyPool.length;
  const e   = _entropyPool[idx];
  return ((e.r + (e.t % 1)) % 1 + 1) % 1;
}

// 正态分布 Box-Muller，clamp到[lo,hi]
function _normalRand(mean, std, lo, hi) {
  let u, v, s;
  do {
    u = _poolRand() * 2 - 1;
    v = _poolRand() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  const n = u * Math.sqrt(-2 * Math.log(s) / s);
  return Math.round(Math.max(lo, Math.min(hi, mean + n * std)));
}

// ===== 内部状态 =====
let _camera      = null;
let _scene       = null;
let _controls    = null;
let _onDealt     = null;
let _dealtCards  = [];
let _loopTimer   = null;
let _loopRunning = false;
const _el = {};

const PILE_X = 0.07, PILE_Y = 1.99, PILE_Z = 0.18;
const CARD_THICKNESS = 0.0013; // 真实塔罗牌比例：0.8mm/70mm × CARD_W(0.11)
const CARD_W = 0.11, CARD_H = 0.188;

const DEAL_POSITIONS = [
  { x: -0.22, y: PILE_Y, z: 0.35, label: '你现在真实的处境' },
  { x:  0,    y: PILE_Y, z: 0.35, label: '你内心回避的部分' },
  { x:  0.22, y: PILE_Y, z: 0.35, label: '可以走向的方向'   },
];

// ===== 阶段一：切洗（Overhand Shuffle）=====
function _doOverhand() {
  _startEntropy();
  _loopRunning = true;
  _showPrompt(
    '占卜师正在整理牌',
    '心中默念你的问题',
    () => {
      _loopRunning = false;
      clearTimeout(_loopTimer);
      _hidePrompt();
      // 整理到标准牌堆
      deckMeshes.forEach((m, i) => {
        _animateMesh(m, { x: PILE_X, y: PILE_Y + i * CARD_THICKNESS, z: PILE_Z }, 400, 'easeOutCubic');
        m.rotation.z = 0;
      });
      setTimeout(() => _doRiffle(), 700);
    }
  );
  _overhandStep();
}

function _overhandStep() {
  if (!_loopRunning) return;

  const total = deckMeshes.length;
  // 取牌位置：正态，均值在中间，避开两端
  const pos = _normalRand(Math.floor(total / 2), 10, 5, total - 22);
  // 取牌数：正态，均值17（一手能舒适抓住的量），范围5~30
  const sz  = _normalRand(17, 5, 5, Math.min(30, total - pos - 1));

  const chunk  = deckMeshes.slice(pos, pos + sz);
  const remain = [...deckMeshes.slice(0, pos), ...deckMeshes.slice(pos + sz)];

  // chunk抬起
  chunk.forEach(m => {
    _animateMesh(m, {
      x: PILE_X + 0.05,
      y: m.position.y + 0.10,
      z: PILE_Z,
    }, 280, 'easeOutCubic');
  });

  setTimeout(() => {
    // chunk放到顶部 → 数组末尾 = 视觉最顶层
    const merged = [...remain, ...chunk];

    merged.forEach((m, i) => {
      setTimeout(() => {
        if (!_loopRunning) return;
        _animateMesh(m, {
          x: PILE_X,
          y: PILE_Y + i * CARD_THICKNESS,
          z: PILE_Z,
        }, 200, 'easeOutBack');
        m.rotation.z = (_poolRand() - 0.5) * 0.01;
      }, i * 8);
    });

    // 同步逻辑牌序（chunk到顶部）
    deckMeshes.splice(0, deckMeshes.length, ...merged);
    deckOrder.splice(0, deckOrder.length, ...merged.map(m => m.userData.cardIndex));

    const wait = merged.length * 8 + 320;
    _loopTimer = setTimeout(() => {
      if (_loopRunning) _overhandStep();
    }, wait);
  }, 300);
}

// ===== 阶段二：Riffle扑克洗 =====
// 物理过程：
// 1. 从中间分成左右两叠
// 2. 两叠各自以底端为轴向中间倾斜（形成倒V）
// 3. 两拇指交替松开，牌从顶端交错落下
// 4. 合并后整叠逆时针转回正位
// 5. 左叠经历了完整翻转 → 逆位取反，右叠不变

function _doRiffle() {
  _loopRunning = true;
  _showPrompt(
    '感受牌的流动',
    '两叠交错，意志融入',
    () => {
      _loopRunning = false;
      clearTimeout(_loopTimer);
      _hidePrompt();
      // 归整所有牌到标准位置，平放背面朝上
      deckMeshes.forEach((m, i) => {
        m.rotation.set(0, Math.PI, 0);
        _animateMesh(m, {
          x: PILE_X, y: PILE_Y + i * CARD_THICKNESS, z: PILE_Z,
        }, 400, 'easeOutCubic');
      });
      setTimeout(() => _doCircleWash(), 700);
    }
  );
  _riffleStep();
}

function _riffleStep() {
  if (!_loopRunning) return;

  const total = deckMeshes.length;
  const split = _normalRand(Math.floor(total / 2), 8, 10, total - 10);

  const leftMeshes  = deckMeshes.slice(0, split);
  const rightMeshes = deckMeshes.slice(split);

  const SPREAD_DUR = 450;
  const ARCH_DUR   = 300;
  const MERGE_DUR  = 180;

  // ===== 第一步：左右分开 =====
  leftMeshes.forEach((m, i) => {
    _animateMesh(m, {
      x: PILE_X - 0.13,
      y: PILE_Y + i * CARD_THICKNESS,
      z: PILE_Z,
    }, SPREAD_DUR, 'easeOutCubic');
  });
  rightMeshes.forEach((m, i) => {
    _animateMesh(m, {
      x: PILE_X + 0.13,
      y: PILE_Y + i * CARD_THICKNESS,
      z: PILE_Z,
    }, SPREAD_DUR, 'easeOutCubic');
  });

  // ===== 第二步：弯成弓形，内侧角靠拢 =====
  // 左叠：越靠内侧（index越大）rotation.z越大，顶端向右弯
  // 右叠：越靠内侧（index越小）rotation.z越小（负值），顶端向左弯
  setTimeout(() => {
    if (!_loopRunning) return;

    leftMeshes.forEach((m, i) => {
      // i从0（外侧）到split-1（内侧），内侧弯曲更大
      const ratio = i / (leftMeshes.length - 1 || 1);
      const archAngle = ratio * 0.35; // 最内侧最弯
      _animateRotation([m], 'z', archAngle, ARCH_DUR);
      // 内侧向右靠拢
      _animateMesh(m, {
        x: PILE_X - 0.13 + ratio * 0.06,
        y: PILE_Y + i * CARD_THICKNESS,
        z: PILE_Z,
      }, ARCH_DUR, 'easeOutCubic');
    });

    rightMeshes.forEach((m, i) => {
      // i从0（内侧）到rightMeshes.length-1（外侧），内侧弯曲更大
      const ratio = 1 - (i / (rightMeshes.length - 1 || 1));
      const archAngle = -ratio * 0.35;
      _animateRotation([m], 'z', archAngle, ARCH_DUR);
      // 内侧向左靠拢
      _animateMesh(m, {
        x: PILE_X + 0.13 - ratio * 0.06,
        y: PILE_Y + i * CARD_THICKNESS,
        z: PILE_Z,
      }, ARCH_DUR, 'easeOutCubic');
    });
  }, SPREAD_DUR);

  // ===== 第三步：拇指交替松开，内侧底部弹出交错落下 =====
  setTimeout(() => {
    if (!_loopRunning) return;

    // 算法：正态分布批次交错
    const merged = [];
    let li = 0, ri = 0;
    while (li < leftMeshes.length || ri < rightMeshes.length) {
      const takeLe = li < leftMeshes.length
        ? _normalRand(2, 1, 1, Math.min(4, leftMeshes.length - li)) : 0;
      for (let k = 0; k < takeLe && li < leftMeshes.length; k++) {
        merged.push(leftMeshes[li++]);
      }
      const takeRi = ri < rightMeshes.length
        ? _normalRand(2, 1, 1, Math.min(4, rightMeshes.length - ri)) : 0;
      for (let k = 0; k < takeRi && ri < rightMeshes.length; k++) {
        merged.push(rightMeshes[ri++]);
      }
    }

    // 每张牌飞向中央，弓形消除归平
    merged.forEach((mesh, i) => {
      setTimeout(() => {
        if (!_loopRunning) return;
        _animateMesh(mesh, {
          x: PILE_X,
          y: PILE_Y + i * CARD_THICKNESS,
          z: PILE_Z,
        }, MERGE_DUR, 'easeOutCubic');
        _animateRotation([mesh], 'z', 0, MERGE_DUR);
      }, i * 12);
    });

    // 同步牌序（桌面riffle不产生逆位）
    deckMeshes.splice(0, deckMeshes.length, ...merged);
    deckOrder.splice(0, deckOrder.length, ...merged.map(m => m.userData.cardIndex));

    // 等落完归整再循环
    const waitMs = merged.length * 12 + MERGE_DUR + 350;
    _loopTimer = setTimeout(() => {
      if (_loopRunning) {
        deckMeshes.forEach((m, i) => {
          m.rotation.set(0, Math.PI, 0);
          m.position.set(PILE_X, PILE_Y + i * CARD_THICKNESS, PILE_Z);
        });
        _riffleStep();
      }
    }, waitMs);
  }, SPREAD_DUR + ARCH_DUR + 150);
}


// 批量旋转动画（针对一组mesh的某个rotation轴）
function _animateRotation(meshes, axis, targetAngle, dur) {
  const startAngles = meshes.map(m => m.rotation[axis]);
  const t0 = Date.now();
  function step() {
    const t = Math.min((Date.now() - t0) / dur, 1);
    const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
    meshes.forEach((m, i) => {
      m.rotation[axis] = startAngles[i] + (targetAngle - startAngles[i]) * e;
    });
    if (t < 1) requestAnimationFrame(step);
    else meshes.forEach(m => { m.rotation[axis] = targetAngle; });
  }
  step();
}

// ===== 阶段三：圆形推洗 =====
let _washRunning  = false;
let _washFrame    = null;
let _washCards    = [];
let _washTime     = 0;

// 扩大范围：确保78张牌铺开后重叠少
const WASH_CX = PILE_X;
const WASH_CZ = PILE_Z;
const WASH_RX = 0.42; // 一人坐桌前的推洗范围
const WASH_RZ = 0.30;

// 空间网格：把桌面分格，加速碰撞检测
const GRID_SIZE = 0.15;

function _buildGrid(cards) {
  const grid = new Map();
  cards.forEach((c, idx) => {
    const gx = Math.floor(c.x / GRID_SIZE);
    const gz = Math.floor(c.z / GRID_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${gx+dx},${gz+dz}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(idx);
      }
    }
  });
  return grid;
}

function _doCircleWash() {
  _loopRunning = true;
  _showPrompt(
    '把你的问题默念三遍',
    '感觉对了就点击',
    _stopCircleWash
  );

  // 散开：随机角度+平方根半径，分布均匀
  // 给每张牌初始切向速度，产生顺时针旋转趋势
  _washCards = deckMeshes.map((m) => {
    const angle = _poolRand() * Math.PI * 2;
    const r     = Math.sqrt(_poolRand());
    const tx = WASH_CX + Math.cos(angle) * WASH_RX * r + (_poolRand()-0.5)*0.04;
    const tz = WASH_CZ + Math.sin(angle) * WASH_RZ * r + (_poolRand()-0.5)*0.03;
    const tr = _poolRand() * 360;
    // 初始切向速度：让牌散开时就有顺时针旋转趋势
    const vx = -Math.sin(angle) * 0.03;
    const vz =  Math.cos(angle) * 0.03;
    return { mesh: m, x: tx, z: tz, rot: tr, vx, vz, vr: 0 };
  });

  // 随机延迟散开，0~500ms
  _washCards.forEach((c, i) => {
    const delay = Math.floor(_poolRand() * 500);
    setTimeout(() => {
      // 位置动画
      _animateMesh(c.mesh, { x: c.x, y: PILE_Y, z: c.z }, 700, 'easeOutCubic');
      // 旋转动画同步
      const startRot = c.mesh.rotation.z;
      const endRot   = c.rot * Math.PI / 180;
      const t0 = Date.now();
      function rotStep() {
        const t = Math.min((Date.now()-t0)/700, 1);
        const e = 1 - Math.pow(1-t, 3);
        c.mesh.rotation.z = startRot + (endRot - startRot) * e;
        if (t < 1) requestAnimationFrame(rotStep);
        else c.mesh.rotation.z = endRot;
      }
      rotStep();
    }, delay);
  });

  setTimeout(() => {
    _washRunning  = true;
    _washTime     = 0;
    let _lastSwapTime = 0;
    const last = { t: performance.now() };

    function tick(ts) {
      if (!_washRunning) return;
      const dt = Math.min(ts - last.t, 50);
      last.t = ts;
      _washTime += dt;

      // 两手沿同一圆圈顺时针运动，速度略有差异产生自然流动感
      // 参考full_flow_v4：0.0009和0.0013，相位差2.8弧度
      const h1a = _washTime * 0.0009;
      const h1x = WASH_CX + Math.cos(h1a) * WASH_RX * 0.55;
      const h1z = WASH_CZ + Math.sin(h1a) * WASH_RZ * 0.55;
      const h2a = _washTime * 0.0013 + 2.8;
      const h2x = WASH_CX + Math.cos(h2a) * WASH_RX * 0.42;
      const h2z = WASH_CZ + Math.sin(h2a) * WASH_RZ * 0.42;

      // 构建空间网格加速碰撞检测
      const grid = _buildGrid(_washCards);

      _washCards.forEach((c, i) => {
        // 手推力
        _applyWashForce(c, h1x, h1z, 0.20, 0.09);
        _applyWashForce(c, h2x, h2z, 0.16, 0.07);

        // 向心力：防止牌跑出椭圆
        const dx = c.x - WASH_CX, dz = c.z - WASH_CZ;
        const normDist = Math.sqrt(
          (dx/WASH_RX)*(dx/WASH_RX) + (dz/WASH_RZ)*(dz/WASH_RZ)
        );
        if (normDist > 0.88) {
          const f = (normDist - 0.88) * 0.0005;
          c.vx -= (dx / normDist) * f;
          c.vz -= (dz / normDist) * f;
        }

        // 牌间排斥力（法向接触力）：用网格加速
        const gx = Math.floor(c.x / GRID_SIZE);
        const gz = Math.floor(c.z / GRID_SIZE);
        const key = `${gx},${gz}`;
        const neighbors = grid.get(key) || [];
        neighbors.forEach(j => {
          if (j <= i) return;
          const other = _washCards[j];
          const ddx = c.x - other.x;
          const ddz = c.z - other.z;
          const dist = Math.sqrt(ddx*ddx + ddz*ddz);
          // 最小间距：约半张牌宽，两张牌中心至少相距这么远
          const MIN_DIST = CARD_W * 0.7;
          if (dist < MIN_DIST && dist > 0.001) {
            const overlap = (MIN_DIST - dist) / MIN_DIST;
            // 线性关系更平滑（平方太跳跃）
            const repulsion = overlap * 0.06;
            c.vx     += (ddx / dist) * repulsion;
            c.vz     += (ddz / dist) * repulsion;
            other.vx -= (ddx / dist) * repulsion;
            other.vz -= (ddz / dist) * repulsion;
            // 轻微拨动旋转
            c.vr     += (_poolRand() - 0.5) * repulsion * 8;
            other.vr += (_poolRand() - 0.5) * repulsion * 8;
          }
        });

        // 桌面摩擦（阻尼）
        // 小噪声：让流动不完全机械（参考full_flow_v4）
        c.vx += (_poolRand() - 0.5) * 0.0012;
        c.vz += (_poolRand() - 0.5) * 0.0010;
        c.vr += (_poolRand() - 0.5) * 0.04;
        c.vx *= 0.935; c.vz *= 0.935; c.vr *= 0.91; // 和full_flow_v4一致
        c.x  += c.vx * dt * 0.06;
        c.z  += c.vz * dt * 0.06;
        c.rot += c.vr * dt * 0.02;

        c.mesh.position.x = c.x;
        c.mesh.position.z = c.z;
        c.mesh.rotation.z = c.rot * Math.PI / 180;
      });

      // 每200ms做一次逻辑牌序交换
      if (_washTime - _lastSwapTime > 200) {
        _lastSwapTime = _washTime;
        _washProximitySwap();
      }

      _washFrame = requestAnimationFrame(tick);
    }
    _washFrame = requestAnimationFrame(tick);
  }, 800); // 等牌散开动画基本完成
}

function _applyWashForce(c, hx, hz, radius, strength) {
  const dx = c.x - hx, dz = c.z - hz;
  const d  = Math.sqrt(dx*dx + dz*dz);
  if (d < radius && d > 0.001) {
    const f = (1 - d / radius) * strength;
    // 切向力（-dz, dx）主导顺时针流动，参考full_flow_v4的0.3比例
    c.vx += (-dz / d) * f;
    c.vz += ( dx / d) * f;
    // 径向力小一些，只是轻微向外推
    c.vx += ( dx / d) * f * 0.3;
    c.vz += ( dz / d) * f * 0.3;
    // 旋转力
    c.vr += (_poolRand() - 0.5) * f * 8;
  }
}

function _washProximitySwap() {
  const n = _washCards.length;
  const sampleSize = Math.floor(n * 0.25);
  for (let s = 0; s < sampleSize; s++) {
    const i = Math.floor(_poolRand() * n);
    const j = Math.floor(_poolRand() * n);
    if (i === j) continue;
    const dx = _washCards[i].x - _washCards[j].x;
    const dz = _washCards[i].z - _washCards[j].z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 0.09) {
      const prob = (1 - dist / 0.09) * 0.75;
      if (_poolRand() < prob) {
        const idxI = deckMeshes.indexOf(_washCards[i].mesh);
        const idxJ = deckMeshes.indexOf(_washCards[j].mesh);
        if (idxI >= 0 && idxJ >= 0) {
          [deckMeshes[idxI], deckMeshes[idxJ]] = [deckMeshes[idxJ], deckMeshes[idxI]];
          [deckOrder[idxI],  deckOrder[idxJ]]  = [deckOrder[idxJ],  deckOrder[idxI]];
          if (_poolRand() < 0.15) {
            _washCards[i].mesh.userData.reversed = !_washCards[i].mesh.userData.reversed;
          }
        }
      }
    }
  }
}

function _stopCircleWash() {
  _washRunning = false;
  cancelAnimationFrame(_washFrame);
  _stopEntropy();
  _hidePrompt();

  deckMeshes.forEach((m, i) => {
    setTimeout(() => {
      _animateMesh(m, {
        x: PILE_X, y: PILE_Y + i * CARD_THICKNESS, z: PILE_Z,
      }, 600, 'easeInOutCubic');
      m.rotation.z = 0;
    }, Math.random() * 400);
  });

  setTimeout(() => _doCut(), 1400);
}

// ===== 阶段四：切牌 =====
let _cutDone = 0;
let _cut1Idx = 0;
let _cut2Idx = 0;

function _doCut() {
  _cutDone = 0;
  _showCutHint();
  _moveCam(
    { x: CUT_CAM.x, y: CUT_CAM.y, z: CUT_CAM.z },
    { x: CUT_CAM.tx, y: CUT_CAM.ty, z: CUT_CAM.tz },
    1500
  );
  _showPrompt('请用左手切牌', '点击牌堆切第一刀', null, false);
  document.addEventListener('click', _onCutClick);
}

function _onCutClick(e) {
  if (_cutDone >= 2) return;
  const mouse = new THREE.Vector2(
    ( e.clientX / window.innerWidth)  * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, _camera);
  const hits = ray.intersectObjects(deckMeshes, false);
  if (!hits.length) return;

  const hitY   = hits[0].point.y;
  const pileH  = deckMeshes.length * CARD_THICKNESS;
  const relY   = Math.max(0, Math.min(1, (hitY - PILE_Y) / pileH));
  const cutIdx = Math.max(5, Math.min(deckMeshes.length - 5,
    Math.floor(relY * deckMeshes.length)));

  if (_cutDone === 0) {
    _cut1Idx = cutIdx;
    deckMeshes.slice(_cut1Idx).forEach((m, i) => {
      _animateMesh(m, {
        x: PILE_X - 0.18, y: PILE_Y + i * CARD_THICKNESS, z: PILE_Z,
      }, 600, 'easeOutCubic');
    });
    _cutDone = 1;
    _updatePrompt('再切一刀', '点击剩余牌堆切第二刀');
  } else {
    _cut2Idx = Math.max(5, Math.min(deckMeshes.length - _cut1Idx - 5, cutIdx));
    deckMeshes.slice(_cut2Idx, _cut1Idx).forEach((m, i) => {
      _animateMesh(m, {
        x: PILE_X + 0.18, y: PILE_Y + i * CARD_THICKNESS, z: PILE_Z,
      }, 600, 'easeOutCubic');
    });
    _cutDone = 2;
    document.removeEventListener('click', _onCutClick);
    _hideCutHint();
    _hidePrompt();
    setTimeout(() => _doMerge(), 800);
  }
}

function _doMerge() {
  const p1 = deckMeshes.slice(0, _cut2Idx);
  const p3 = deckMeshes.slice(_cut2Idx, _cut1Idx);
  const p2 = deckMeshes.slice(_cut1Idx);
  const merged = [...p1, ...p2, ...p3];

  setTimeout(() => {
    p2.forEach((m, i) => {
      _animateMesh(m, {
        x: PILE_X - 0.18,
        y: PILE_Y + p3.length * CARD_THICKNESS + i * CARD_THICKNESS,
        z: PILE_Z,
      }, 600, 'easeInOutCubic');
    });
  }, 300);

  setTimeout(() => {
    merged.forEach((m, i) => {
      _animateMesh(m, {
        x: PILE_X, y: PILE_Y + i * CARD_THICKNESS, z: PILE_Z,
      }, 700, 'easeInOutCubic');
    });
    deckMeshes.splice(0, deckMeshes.length, ...merged);
    deckOrder.splice(0, deckOrder.length, ...merged.map(m => m.userData.cardIndex));
  }, 1200);

  setTimeout(() => _doDeal(), 2600);
}

// ===== 阶段五：发牌 =====
function _doDeal() {
  _moveCam(
    { x: DEAL_CAM.x, y: DEAL_CAM.y, z: DEAL_CAM.z },
    { x: DEAL_CAM.tx, y: DEAL_CAM.ty, z: DEAL_CAM.tz },
    2000
  );
  _dealtCards = [];
  DEAL_POSITIONS.forEach((pos, i) => {
    setTimeout(() => {
      const mesh = deckMeshes[deckMeshes.length - 1 - i];
      if (!mesh) return;
      _dealCard(mesh, pos, i, () => {
        _dealtCards.push(mesh);
        if (_dealtCards.length === DEAL_POSITIONS.length) {
          setTimeout(() => { if (_onDealt) _onDealt(_dealtCards, DEAL_POSITIONS); }, 500);
        }
      });
    }, i * 500);
  });
}

function _dealCard(mesh, pos, index, onDone) {
  const sp = mesh.position.clone();
  const DUR = 800, t0 = Date.now();
  function step() {
    const t = Math.min((Date.now() - t0) / DUR, 1);
    const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
    mesh.position.x = sp.x + (pos.x - sp.x) * e;
    mesh.position.z = sp.z + (pos.z - sp.z) * e;
    mesh.position.y = sp.y + (pos.y - sp.y) * e + Math.sin(t * Math.PI) * 0.08;
    if (t < 1) requestAnimationFrame(step);
    else {
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData.dealPosition = pos;
      mesh.userData.dealIndex    = index;
      if (onDone) onDone();
    }
  }
  step();
}

// ===== UI =====
function _showPrompt(title, sub, onConfirm, showBtn = true) {
  _el.promptTitle.textContent = title;
  _el.promptSub.textContent   = sub;
  _el.promptWrap.style.opacity       = '1';
  _el.promptWrap.style.pointerEvents = 'auto';
  if (showBtn && onConfirm) {
    _el.promptBtn.style.display = 'flex';
    _el.promptBtn.onclick = () => { _hidePrompt(); onConfirm(); };
  } else {
    _el.promptBtn.style.display = 'none';
  }
}
function _updatePrompt(title, sub) {
  _el.promptTitle.textContent = title;
  _el.promptSub.textContent   = sub;
}
function _hidePrompt() {
  _el.promptWrap.style.opacity       = '0';
  _el.promptWrap.style.pointerEvents = 'none';
}
function _showCutHint() { _el.cutHint.style.opacity = '1'; }
function _hideCutHint() { _el.cutHint.style.opacity = '0'; }

function _buildUI() {
  if (document.getElementById('shuffle-style')) return;
  const style = document.createElement('style');
  style.id = 'shuffle-style';
  style.textContent = `
    #shuffle-prompt-wrap {
      position: fixed; bottom: 12%; left: 50%;
      transform: translateX(-50%);
      z-index: 160;
      display: flex; flex-direction: column;
      align-items: center; gap: 16px;
      opacity: 0; pointer-events: none;
      transition: opacity 0.8s ease;
    }
    #shuffle-prompt-title {
      font-family: 'Noto Serif SC',serif;
      font-size: 18px; font-weight: 300;
      color: #e8dcc8; letter-spacing: 0.3em;
      text-align: center;
      text-shadow: 0 0 20px rgba(168,145,106,0.3);
    }
    #shuffle-prompt-sub {
      font-family: 'Cormorant Garamond',serif;
      font-size: 14px; font-style: italic;
      color: rgba(200,180,140,0.65); letter-spacing: 0.15em;
      text-align: center;
    }
    #shuffle-prompt-btn {
      display: flex; align-items: center; gap: 12px;
      background: transparent; border: none; cursor: pointer;
      padding: 8px 0; margin-top: 4px;
    }
    #shuffle-prompt-btn-circle {
      width: 48px; height: 48px; border-radius: 50%;
      border: 1px solid rgba(200,169,122,0.8);
      display: flex; align-items: center; justify-content: center;
      color: #e8d4a0; font-size: 18px;
      transition: background 0.3s, box-shadow 0.3s;
      box-shadow: 0 0 16px rgba(168,145,106,0.25);
    }
    #shuffle-prompt-btn:hover #shuffle-prompt-btn-circle {
      background: rgba(168,145,106,0.18);
      box-shadow: 0 0 28px rgba(168,145,106,0.4);
    }
    #shuffle-prompt-btn-label {
      font-family: 'Cinzel',serif;
      font-size: 13px; letter-spacing: 0.28em;
      color: #d4b87a;
      text-shadow: 0 0 12px rgba(168,145,106,0.5);
    }
    #shuffle-cut-hint {
      position: fixed; top: 12%; left: 50%;
      transform: translateX(-50%);
      z-index: 160;
      font-family: 'Cinzel',serif;
      font-size: 10px; letter-spacing: 0.3em;
      color: rgba(168,145,106,0.5);
      opacity: 0; pointer-events: none;
      transition: opacity 0.6s ease;
    }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.id = 'shuffle-prompt-wrap';
  wrap.innerHTML = `
    <div id="shuffle-prompt-title"></div>
    <div id="shuffle-prompt-sub"></div>
    <button id="shuffle-prompt-btn">
      <div id="shuffle-prompt-btn-circle">→</div>
      <div id="shuffle-prompt-btn-label">感觉对了，点击这里</div>
    </button>
  `;
  document.body.appendChild(wrap);

  const cutHint = document.createElement('div');
  cutHint.id = 'shuffle-cut-hint';
  cutHint.textContent = '点击牌堆切牌 · 左手';
  document.body.appendChild(cutHint);

  _el.promptWrap  = wrap;
  _el.promptTitle = document.getElementById('shuffle-prompt-title');
  _el.promptSub   = document.getElementById('shuffle-prompt-sub');
  _el.promptBtn   = document.getElementById('shuffle-prompt-btn');
  _el.cutHint     = cutHint;
}

// ===== 相机动画 =====
function _moveCam(toPos, toTarget, dur) {
  const sp = _camera.position.clone();
  const st = _controls ? _controls.target.clone() : new THREE.Vector3(0, 1.88, 0);
  const ep = new THREE.Vector3(toPos.x, toPos.y, toPos.z);
  const et = new THREE.Vector3(toTarget.x, toTarget.y, toTarget.z);
  const t0 = Date.now();
  const prevDamp = _controls ? _controls.dampingFactor : 0;
  if (_controls) _controls.dampingFactor = 0;
  function step() {
    const t = Math.min((Date.now() - t0) / dur, 1);
    const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
    _camera.position.lerpVectors(sp, ep, e);
    _camera.lookAt(new THREE.Vector3().lerpVectors(st, et, e));
    if (t < 1) requestAnimationFrame(step);
    else {
      _camera.position.copy(ep);
      _camera.lookAt(et);
      if (_controls) {
        _controls.dampingFactor = prevDamp;
        _controls.target.copy(et);
        _controls.update();
      }
    }
  }
  step();
}

// ===== Mesh动画 =====
function _animateMesh(mesh, to, dur, easing = 'easeOutCubic') {
  const sp = mesh.position.clone();
  const t0 = Date.now();
  function easeFn(t) {
    switch (easing) {
      case 'easeOutCubic':   return 1 - Math.pow(1 - t, 3);
      case 'easeInOutCubic': return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
      case 'easeOutBack': {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(t-1, 3) + c1 * Math.pow(t-1, 2);
      }
      default: return t;
    }
  }
  function step() {
    const t = Math.min((Date.now() - t0) / dur, 1);
    const e = easeFn(t);
    if (to.x !== undefined) mesh.position.x = sp.x + (to.x - sp.x) * e;
    if (to.y !== undefined) mesh.position.y = sp.y + (to.y - sp.y) * e;
    if (to.z !== undefined) mesh.position.z = sp.z + (to.z - sp.z) * e;
    if (t < 1) requestAnimationFrame(step);
    else {
      if (to.x !== undefined) mesh.position.x = to.x;
      if (to.y !== undefined) mesh.position.y = to.y;
      if (to.z !== undefined) mesh.position.z = to.z;
    }
  }
  step();
}
