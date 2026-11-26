import * as THREE from 'three';

// ===== 对外暴露 =====
export let deckMeshes = [];      // 78个mesh，index对应牌序
export let deckOrder = [];       // 当前牌序（0-77的数组，可洗牌）
export let deckState = 'idle';   // 'idle' | 'collapsing' | 'pile'

// ===== 牌的几何参数（与scene.js一致）=====
const CARD_W = 0.11, CARD_H = 0.188, CARD_D = 0.0015, CARD_R = 0.005, CARD_SEG = 8;

// ===== 桌面布局参数 =====
// 扇形圆心在桌面后方偏下（桌面活动区的"后方"）
let FAN_CENTER_X = 0;
let FAN_CENTER_Z = -0.12;   // 扇形圆心z坐标（偏后）
let FAN_RADIUS   = 0.72;   // 扇形半径
let FAN_Y        = 2.02;  // 牌放在桌面上的高度
let FAN_ANGLE_START = -1.20; // 扇形起始角（弧度）
let FAN_ANGLE_END   =  1.20; // 扇形结束角
let FAN_ROTATION    = 1.49; // 扇形整体旋转偏移（弧度）

// 牌堆位置（收起时）
let PILE_X = 0.07, PILE_Y = 1.99, PILE_Z = 0.18;

// 内部状态
let _scene = null;
let _cardGeometry = null;
let _cardBackMat = null;      // 牌背材质（共享）
let _frontMats = [];          // 正面材质数组[78]，懒加载

// ===== 初始化 =====
export function initDeck(scene) {
  _scene = scene;
  deckOrder = _genRandomOrder();
  _buildGeometry();
  _buildBackMaterial();
  _buildAllMeshes();
  // 初始：所有牌在牌堆位置，不可见
  deckMeshes.forEach(m => { m.visible = false; });
}

// ===== 生成随机牌序 =====
function _genRandomOrder() {
  const arr = Array.from({ length: 78 }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== 圆角矩形几何体（复用scene.js的逻辑）=====
function _buildGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = [], normals = [], uvs = [], indices = [], groups = [];
  let vc = 0;

  function getRoundedRectPoints(w, h, r, seg) {
    const pts = [];
    const corners = [
      [w-r, h-r, 0], [-w+r, h-r, Math.PI*0.5],
      [-w+r,-h+r, Math.PI], [w-r,-h+r, Math.PI*1.5],
    ];
    for (const [cx, cy, sa] of corners) {
      for (let i = 0; i <= seg; i++) {
        const a = sa + Math.PI * 0.5 * i / seg;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    }
    return pts;
  }

  const w = CARD_W / 2, h = CARD_H / 2, d = CARD_D / 2;
  const ol = getRoundedRectPoints(w, h, CARD_R, CARD_SEG);
  const N = ol.length;

  // 正面（materialIndex 0）
  const fs = vc;
  positions.push(0, 0, d); normals.push(0, 0, 1); uvs.push(0.5, 0.5); vc++;
  for (let i = 0; i < N; i++) {
    const [x, y] = ol[i];
    positions.push(x, y, d); normals.push(0, 0, 1);
    uvs.push((x / w + 1) / 2, (y / h + 1) / 2); vc++;
  }
  const fi = indices.length;
  for (let i = 0; i < N; i++) indices.push(fs, fs+1+i, fs+1+(i+1)%N);
  groups.push({ start: fi, count: N * 3, materialIndex: 0 });

  // 背面（materialIndex 1）
  const bs = vc;
  positions.push(0, 0, -d); normals.push(0, 0, -1); uvs.push(0.5, 0.5); vc++;
  for (let i = 0; i < N; i++) {
    const [x, y] = ol[i];
    positions.push(x, y, -d); normals.push(0, 0, -1);
    uvs.push((x + w) / CARD_W, (y + h) / CARD_H); vc++;
  }
  const bi = indices.length;
  for (let i = 0; i < N; i++) indices.push(bs, bs+1+(i+1)%N, bs+1+i);
  groups.push({ start: bi, count: N * 3, materialIndex: 1 });

  // 侧边（materialIndex 2）
  const si = indices.length;
  for (let i = 0; i < N; i++) {
    const [x0, y0] = ol[i], [x1, y1] = ol[(i+1)%N];
    const nx = (x0+x1)/2, ny = (y0+y1)/2, len = Math.sqrt(nx*nx+ny*ny);
    positions.push(x0,y0,d, x1,y1,d, x0,y0,-d, x1,y1,-d);
    normals.push(nx/len,ny/len,0, nx/len,ny/len,0, nx/len,ny/len,0, nx/len,ny/len,0);
    uvs.push(0,1, 1,1, 0,0, 1,0);
    const v = vc + i * 4;
    indices.push(v,v+1,v+2, v+1,v+3,v+2);
    vc += 4;
  }
  groups.push({ start: si, count: indices.length - si, materialIndex: 2 });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  for (const g of groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  _cardGeometry = geometry;
}

// ===== 加载进度 =====
let _loadedCount = 0;
const _totalLoad = 78 * 3; // 正面+法线+高光，共234张
let _onProgress = null;    // (loaded, total) => void

export function setDeckLoadCallback(cb) { _onProgress = cb; }

function _onTexLoad() {
  _loadedCount++;
  if (_onProgress) _onProgress(_loadedCount, _totalLoad);
}

// ===== 牌背材质（所有牌共享）=====
function _buildBackMaterial() {
  const loader = new THREE.TextureLoader();
  const backTex = loader.load(import.meta.env.BASE_URL + 'tarot_assets/cards/card_back.jpg');
  backTex.colorSpace = THREE.SRGBColorSpace;
  const normTex  = loader.load(import.meta.env.BASE_URL + 'tarot_assets/cards/card_back_normal.png');
  const specTex  = loader.load(import.meta.env.BASE_URL + 'tarot_assets/cards/card_back_specular.png');

  _cardBackMat = new THREE.MeshStandardMaterial({
    map: backTex,
    normalMap: normTex,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughnessMap: specTex,
    roughness: 0.65,
    metalness: 0.05,
    envMapIntensity: 0.15,
  });
}

// ===== 正面材质懒加载 =====
function _getFrontMat(cardIndex) {
  if (_frontMats[cardIndex]) return _frontMats[cardIndex];
  const loader = new THREE.TextureLoader();
  const tex  = loader.load(`${import.meta.env.BASE_URL}tarot_assets/cards/${cardIndex}.jpg`,  _onTexLoad);
  tex.colorSpace = THREE.SRGBColorSpace;
  const norm = loader.load(`${import.meta.env.BASE_URL}tarot_assets/cards/${cardIndex}_normal.png`,  _onTexLoad);
  const spec = loader.load(`${import.meta.env.BASE_URL}tarot_assets/cards/${cardIndex}_specular.png`, _onTexLoad);
  _frontMats[cardIndex] = new THREE.MeshStandardMaterial({
    map: tex,
    normalMap: norm,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughnessMap: spec,
    roughness: 0.65,
    metalness: 0.05,
    envMapIntensity: 0.6,
  });
  return _frontMats[cardIndex];
}

// ===== 侧边材质（共享）=====
const _sideMat = new THREE.MeshStandardMaterial({
  color: 0xd4c9b0, roughness: 0.9, metalness: 0,
});

// ===== 创建78个mesh =====
function _buildAllMeshes() {
  for (let i = 0; i < 78; i++) {
    const cardIdx = deckOrder[i]; // 按牌序排列
    const mesh = new THREE.Mesh(_cardGeometry, [
      _getFrontMat(cardIdx),  // 正面
      _cardBackMat,           // 背面（背面朝上=用户看到的面）
      _sideMat,               // 侧边
    ]);

    // 初始位置：堆在桌面牌堆位置
    mesh.position.set(PILE_X, PILE_Y + i * 0.0002, PILE_Z);
    mesh.rotation.x = -Math.PI / 2; // 平躺在桌面
    mesh.rotation.z = 0;

    mesh.userData = {
      deckIndex: i,          // 在牌序中的位置
      cardIndex: cardIdx,    // 实际牌号（0-77）
      fanX: 0, fanY: FAN_Y, fanZ: 0, fanRZ: 0, // 展开后位置
      isDealt: false,
    };

    mesh.material.forEach(m => {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -i;
      m.polygonOffsetUnits = -i;
    });
    mesh.renderOrder = i;

    _scene.add(mesh);
    deckMeshes.push(mesh);
  }
}

// ===== 计算扇形位置 =====
function _calcFanPos(i) {
  const t = i / (78 - 1); // 0~1
  const angle = FAN_ANGLE_START + (FAN_ANGLE_END - FAN_ANGLE_START) * t + FAN_ROTATION;
  const x = FAN_CENTER_X + Math.cos(angle) * FAN_RADIUS;
  const z = FAN_CENTER_Z + Math.sin(angle) * FAN_RADIUS;
  // 牌朝向：垂直于扇形弧的切线，即沿半径方向
  const rotZ = -angle; // 绕Z轴旋转对齐扇形
  return { x, z, rotZ };
}

// ===== 等待牌组贴图全部加载完 =====
export function waitForDeckReady() {
  return new Promise(resolve => {
    if (_loadedCount >= _totalLoad) { resolve(); return; }
    const origCb = _onProgress;
    _onProgress = (loaded, total) => {
      if (origCb) origCb(loaded, total);
      if (loaded >= total) {
        _onProgress = origCb; // 恢复原回调
        resolve();
      }
    };
  });
}

// ===== 展开成扇形（登录完成后调用）=====
export function spreadToFan(onComplete) {
  // 如果贴图还没加载完，先等加载完再展开
  if (_loadedCount < _totalLoad) {
    waitForDeckReady().then(() => spreadToFan(onComplete));
    return;
  }

  deckState = 'spreading';
  window.__deckState = deckState;
  const DUR = 1800; // 总展开时长
  const DELAY_PER = DUR / 78; // 每张牌的延迟间隔

  // 先计算每张牌的目标扇形位置
  deckMeshes.forEach((mesh, i) => {
    const { x, z, rotZ } = _calcFanPos(i);
    mesh.userData.fanX = x;
    mesh.userData.fanZ = z;
    mesh.userData.fanRZ = rotZ;
    mesh.visible = true;
  });

  let completed = 0;

  deckMeshes.forEach((mesh, i) => {
    setTimeout(() => {
      const startPos = mesh.position.clone();
      const targetX = mesh.userData.fanX;
      const targetZ = mesh.userData.fanZ;
      const targetRZ = mesh.userData.fanRZ;
      const startRZ = mesh.rotation.z;
      const t0 = Date.now();
      const dur = 400; // 单张牌飞行时长

      function step() {
        const t = Math.min((Date.now() - t0) / dur, 1);
        // easeOutCubic
        const e = 1 - Math.pow(1 - t, 3);
        mesh.position.x = startPos.x + (targetX - startPos.x) * e;
        mesh.position.z = startPos.z + (targetZ - startPos.z) * e;
        mesh.position.y = FAN_Y + Math.sin(t * Math.PI) * 0.04; // 轻微弧线
        mesh.rotation.z = startRZ + (targetRZ - startRZ) * e;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          mesh.position.set(targetX, FAN_Y, targetZ);
          mesh.rotation.z = targetRZ;
          completed++;
          if (completed === 78 && onComplete) {
            deckState = 'idle';
            window.__deckState = deckState;
            onComplete();
          }
        }
      }
      step();
    }, i * (DELAY_PER * 0.6)); // 间隔稍短让动画更流畅
  });
}

// ===== 合拢成牌堆（点击水晶球后调用）=====
export function collapseToFile(onComplete) {
  deckState = 'collapsing';
  window.__deckState = deckState;
  const DUR = 1200;
  const DELAY_PER = 8; // 每张牌间隔，从最后一张开始合拢

  let completed = 0;

  // 从最后一张牌开始往前合拢（像收牌一样）
  for (let i = 77; i >= 0; i--) {
    const mesh = deckMeshes[i];
    const delay = (77 - i) * DELAY_PER;
    const targetX = PILE_X;
    const targetY = PILE_Y + i * 0.001;
    const targetZ = PILE_Z;

    setTimeout(() => {
      const startPos = mesh.position.clone();
      const startRZ = mesh.rotation.z;
      const t0 = Date.now();
      const dur = 350;

      function step() {
        const t = Math.min((Date.now() - t0) / dur, 1);
        const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
        mesh.position.x = startPos.x + (targetX - startPos.x) * e;
        mesh.position.z = startPos.z + (targetZ - startPos.z) * e;
        mesh.position.y = startPos.y + (targetY - startPos.y) * e;
        mesh.rotation.z = startRZ + (0 - startRZ) * e;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          mesh.position.set(targetX, targetY, targetZ);
          mesh.rotation.z = 0;
          completed++;
          if (completed === 78) {
            deckState = 'pile';
            window.__deckState = deckState;
            if (onComplete) onComplete();
          }
        }
      }
      step();
    }, delay);
  }
}

// ===== 洗牌（洗牌阶段调用）=====
export function shuffleDeck() {
  deckOrder = _genRandomOrder();
  // 重新分配每个mesh的牌面材质
  deckMeshes.forEach((mesh, i) => {
    const cardIdx = deckOrder[i];
    mesh.userData.cardIndex = cardIdx;
    mesh.material[0] = _getFrontMat(cardIdx);
    mesh.userData.deckIndex = i;
  });
}

// ===== 清理 =====
export function destroyDeck() {
  deckMeshes.forEach(m => _scene.remove(m));
  deckMeshes = [];
  deckOrder = [];
  deckState = 'idle';
}

export function getDeckParams() {
  return {
    FAN_CENTER_X, FAN_CENTER_Z, FAN_RADIUS, FAN_Y,
    FAN_ANGLE_START, FAN_ANGLE_END, FAN_ROTATION,
    PILE_X, PILE_Y, PILE_Z,
  };
}

export function setDeckParam(key, value) {
  if (key === 'FAN_CENTER_X') FAN_CENTER_X = value;
  if (key === 'FAN_CENTER_Z') FAN_CENTER_Z = value;
  if (key === 'FAN_RADIUS')   FAN_RADIUS = value;
  if (key === 'FAN_Y')        FAN_Y = value;
  if (key === 'FAN_ANGLE_START') FAN_ANGLE_START = value;
  if (key === 'FAN_ANGLE_END')   FAN_ANGLE_END = value;
  if (key === 'FAN_ROTATION')    FAN_ROTATION = value;
  if (key === 'PILE_X') PILE_X = value;
  if (key === 'PILE_Y') PILE_Y = value;
  if (key === 'PILE_Z') PILE_Z = value;
}

// ===== 实时应用扇形布局（调试面板滑块变化时调用）=====
export function applyFanLayout() {
  if (!deckMeshes || deckMeshes.length === 0) return;
  deckMeshes.forEach((mesh, i) => {
    const t = i / (78 - 1);
    const angle = FAN_ANGLE_START + (FAN_ANGLE_END - FAN_ANGLE_START) * t + FAN_ROTATION;
    const x = FAN_CENTER_X + Math.cos(angle) * FAN_RADIUS;
    const z = FAN_CENTER_Z + Math.sin(angle) * FAN_RADIUS;
    const rotZ = -angle;
    mesh.position.x = x;
    mesh.position.y = FAN_Y;
    mesh.position.z = z;
    mesh.rotation.z = rotZ;
    mesh.userData.fanX = x;
    mesh.userData.fanZ = z;
    mesh.userData.fanRZ = rotZ;
    mesh.userData.fanY = FAN_Y;
  });
}

// ===== 实时应用牌堆布局（调试面板滑块变化时调用）=====
export function applyPileLayout() {
  if (!deckMeshes || deckMeshes.length === 0) return;
  deckMeshes.forEach((mesh, i) => {
    mesh.position.x = PILE_X;
    mesh.position.y = PILE_Y + i * 0.001;
    mesh.position.z = PILE_Z;
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = 0;
  });
}
