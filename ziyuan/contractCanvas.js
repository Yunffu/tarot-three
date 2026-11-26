// ============================================================
// contractCanvas.js
// Canvas契约页面绘制函数，用于 THREE.CanvasTexture
// 规格：512 x 820px
// 用法：_redrawCanvas('register', ctx, state, activeField)
// ============================================================

// ---------- 常量配置 ----------

const CONTRACT_CONFIG = {
  width: 512,
  height: 820,

  // 颜色
  colors: {
    gold: '#a8916a',
    goldLight: '#c8a97a',
    goldDim: 'rgba(168, 145, 106, 0.5)',
    text: '#2a1f0e',
    textLight: '#4a3520',
    inputText: '#1a1008',
    placeholder: 'rgba(80, 60, 30, 0.4)',
    cursor: '#a8916a',
    selected: '#5a3a1a',
    selectedBg: 'rgba(168, 145, 106, 0.15)',
  },

  // 字体（需提前在页面加载 Google Fonts）
  fonts: {
    en: 'Cinzel',
    zh: 'ZCOOL XiaoWei',
    italic: 'Cormorant Garamond',
  },

  // 三种牌型的字段配置
  fields: {
    register: [
      { id: 'name',     labelZh: '你的名字', labelEn: 'NAME',     y: 310, type: 'text' },
      { id: 'birthday', labelZh: '出生年份', labelEn: 'BIRTHDAY', y: 420, type: 'year' },
      { id: 'password', labelZh: '设置密码', labelEn: 'PASSWORD', y: 530, type: 'password' },
    ],
    login: [
      { id: 'account',  labelZh: '账　号',  labelEn: 'ACCOUNT',  y: 330, type: 'text' },
      { id: 'password', labelZh: '密　码',  labelEn: 'PASSWORD', y: 460, type: 'password' },
    ],
    guest: [
      { id: 'age',      labelZh: '年　龄',  labelEn: 'AGE',      y: 380, type: 'number' },
    ],
  },

  // 各牌型标题
  titles: {
    register: { zh: '初次到来', en: 'BEGIN',    stamp: '立　约' },
    login:    { zh: '回来了',   en: 'RETURN',   stamp: '进　入' },
    guest:    { zh: '今夜一问', en: 'ONE NIGHT', stamp: '进　入' },
  },

  // 性别选择区（register / guest 有）
  genderY: {
    register: 230,
    guest: 260,
  },

  // 印章位置
  stamp: { x: 380, y: 690, size: 100 },

  // 顶底横线
  lines: {
    top1: 72, top2: 76,
    bottom1: 744, bottom2: 748,
  },

  // 输入框下划线
  input: {
    x: 60, endX: 452,
    lineY: 28, // 相对字段y的偏移
  },
};

// ---------- 资源缓存 ----------

const _assets = {
  bg: null,
  head: null,
  bottom: null,
  left: null,
  right: null,
  stamp: null,
  blank: null, // »——« 下划线装饰
};

/**
 * 预加载所有素材图片
 * @param {string} basePath - 素材目录路径，如 '/ziyuan'
 * @returns {Promise}
 */
export async function loadContractAssets(basePath = '/ziyuan') {
  const map = {
    bg:     'contract_bg.jpg',
    head:   'head.png',
    bottom: 'bottom.png',
    left:   'left.png',
    right:  'right.png',
    stamp:  'stamp.png',
    blank:  'blank.png',
  };

  await Promise.all(
    Object.entries(map).map(([key, file]) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { _assets[key] = img; resolve(); };
        img.onerror = () => { console.warn(`[Contract] 素材加载失败: ${file}`); resolve(); };
        img.src = `${basePath}/${file}`;
      })
    )
  );
}

// ---------- 光标闪烁状态（外部维护） ----------
// state 结构示例：
// {
//   name: '',
//   birthday: '',
//   password: '',
//   gender: null,   // 'male' | 'female' | null
//   cursorVisible: true,  // 由外部每500ms切换
// }

// ---------- 主绘制函数 ----------

/**
 * 重绘契约Canvas
 * @param {'register'|'login'|'guest'} type - 牌型
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} state - 当前输入状态
 * @param {string|null} activeField - 当前激活的字段id
 */
export function _redrawCanvas(type, ctx, state, activeField) {
  const C = CONTRACT_CONFIG;
  const { width, height } = C;

  ctx.clearRect(0, 0, width, height);

  // 1. 底图
  _drawBg(ctx, width, height);

  // 2. 顶底金色横线
  _drawLines(ctx, C);

  // 3. 顶部花纹 head
  _drawHead(ctx, width);

  // 4. 底部花纹 bottom + 左右叶片
  _drawBottomOrnaments(ctx, width, height);

  // 5. 英文标题
  _drawEnTitle(ctx, type, C, width);

  // 6. 中文标题
  _drawZhTitle(ctx, type, C, width);

  // 7. 性别选择（register / guest）
  if (type === 'register' || type === 'guest') {
    _drawGender(ctx, type, state, activeField, C, width);
  }

  // 8. 输入字段
  const fields = C.fields[type] || [];
  fields.forEach(field => {
    _drawField(ctx, field, state, activeField, C, width);
  });

  // 9. guest 备注文字
  if (type === 'guest') {
    _drawGuestNote(ctx, C, width);
  }

  // 10. 印章
  _drawStamp(ctx, type, C);
}

// ---------- 子绘制函数 ----------

function _drawBg(ctx, width, height) {
  if (_assets.bg) {
    ctx.drawImage(_assets.bg, 0, 0, width, height);
  } else {
    // fallback
    ctx.fillStyle = '#c8b89a';
    ctx.fillRect(0, 0, width, height);
  }
}

function _drawLines(ctx, C) {
  const { lines, colors, width: w } = { ...C, width: CONTRACT_CONFIG.width };
  ctx.save();
  ctx.strokeStyle = colors.gold;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.8;
  [lines.top1, lines.top2, lines.bottom1, lines.bottom2].forEach(y => {
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(482, y);
    ctx.stroke();
  });
  ctx.restore();
}

function _drawHead(ctx, width) {
  if (!_assets.head) return;
  const img = _assets.head;
  const drawW = 340;
  const drawH = (img.naturalHeight / img.naturalWidth) * drawW;
  const x = (width - drawW) / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; // 去黑底（如果不是透明PNG则用此）
  // 如果已是透明PNG，改为 'source-over'
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(img, x, -10, drawW, drawH);
  ctx.restore();
}

function _drawBottomOrnaments(ctx, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  // bottom 花纹居中
  if (_assets.bottom) {
    const img = _assets.bottom;
    const drawW = 300;
    const drawH = (img.naturalHeight / img.naturalWidth) * drawW;
    ctx.drawImage(img, (width - drawW) / 2, height - drawH - 10, drawW, drawH);
  }

  // left 叶片
  if (_assets.left) {
    const img = _assets.left;
    const drawH = 160;
    const drawW = (img.naturalWidth / img.naturalHeight) * drawH;
    ctx.drawImage(img, 10, height - drawH - 20, drawW, drawH);
  }

  // right 叶片（水平翻转）
  if (_assets.right) {
    const img = _assets.right;
    const drawH = 160;
    const drawW = (img.naturalWidth / img.naturalHeight) * drawH;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(img, -(width - 10), height - drawH - 20, drawW, drawH);
    ctx.restore();
  }

  ctx.restore();
}

function _drawEnTitle(ctx, type, C, width) {
  const title = C.titles[type]?.en || '';
  ctx.save();
  ctx.font = `500 13px '${C.fonts.en}'`;
  ctx.fillStyle = C.colors.gold;
  ctx.globalAlpha = 0.9;
  ctx.letterSpacing = '6px';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, C.lines.top1 - 10);
  ctx.restore();
}

function _drawZhTitle(ctx, type, C, width) {
  const title = C.titles[type]?.zh || '';
  ctx.save();
  ctx.font = `38px '${C.fonts.zh}'`;
  ctx.fillStyle = C.colors.text;
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 160);
  ctx.restore();
}

function _drawGender(ctx, type, state, activeField, C, width) {
  const y = C.genderY[type];
  const isActive = activeField === 'gender';

  // 标签
  ctx.save();
  ctx.font = `14px '${C.fonts.en}'`;
  ctx.fillStyle = C.colors.textLight;
  ctx.textAlign = 'left';
  ctx.fillText('SEX', C.input.x, y);
  ctx.restore();

  // 两个选择框
  const boxW = 60, boxH = 28;
  const startX = (width - boxW * 2 - 20) / 2;
  const boxY = y + 14;

  [
    { label: '♀', value: 'female', x: startX },
    { label: '♂', value: 'male',   x: startX + boxW + 20 },
  ].forEach(({ label, value, x }) => {
    const selected = state.gender === value;

    ctx.save();
    // 选中背景
    if (selected) {
      ctx.fillStyle = C.colors.selectedBg;
      ctx.fillRect(x, boxY, boxW, boxH);
    }
    // 框线
    ctx.strokeStyle = selected ? C.colors.goldLight : C.colors.goldDim;
    ctx.lineWidth = selected ? 1 : 0.6;
    ctx.strokeRect(x + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    // 符号
    ctx.font = `16px serif`;
    ctx.fillStyle = selected ? C.colors.selected : C.colors.textLight;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + boxW / 2, boxY + boxH / 2 + 6);
    ctx.restore();
  });
}

function _drawField(ctx, field, state, activeField, C, width) {
  const { id, labelEn, y, type } = field;
  const isActive = activeField === id;
  const value = state[id] || '';

  // 标签
  ctx.save();
  ctx.font = `13px '${C.fonts.en}'`;
  ctx.fillStyle = isActive ? C.colors.gold : C.colors.textLight;
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'left';
  ctx.fillText(labelEn, C.input.x, y);
  ctx.restore();

  // »——« 装饰下划线（用blank.png或直接画线）
  const lineY = y + C.input.lineY;
  if (_assets.blank) {
    const img = _assets.blank;
    const drawW = C.input.endX - C.input.x;
    const drawH = (img.naturalHeight / img.naturalWidth) * drawW;
    ctx.save();
    ctx.globalAlpha = isActive ? 1.0 : 0.6;
    ctx.drawImage(img, C.input.x, lineY - drawH / 2, drawW, drawH);
    ctx.restore();
  } else {
    // fallback 纯线
    ctx.save();
    ctx.strokeStyle = isActive ? C.colors.gold : C.colors.goldDim;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(C.input.x, lineY);
    ctx.lineTo(C.input.endX, lineY);
    ctx.stroke();
    ctx.restore();
  }

  // 输入内容
  let displayValue = value;
  if (type === 'password') {
    displayValue = '•'.repeat(value.length);
  }

  ctx.save();
  ctx.font = `16px '${C.fonts.zh}'`;
  ctx.fillStyle = C.colors.inputText;
  ctx.textAlign = 'left';
  ctx.fillText(displayValue, C.input.x + 20, lineY - 4);
  ctx.restore();

  // 光标
  if (isActive && state.cursorVisible) {
    const textWidth = ctx.measureText(displayValue).width;
    const cursorX = C.input.x + 20 + textWidth + 2;
    ctx.save();
    ctx.strokeStyle = C.colors.cursor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cursorX, lineY - 18);
    ctx.lineTo(cursorX, lineY - 2);
    ctx.stroke();
    ctx.restore();
  }
}

function _drawGuestNote(ctx, C, width) {
  ctx.save();
  ctx.font = `italic 11px '${C.fonts.italic}'`;
  ctx.fillStyle = 'rgba(168, 145, 106, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('「今夜不留痕迹　每日一次」', width / 2, 520);
  ctx.restore();
}

function _drawStamp(ctx, type, C) {
  if (!_assets.stamp) return;
  const { x, y, size } = C.stamp;
  ctx.save();
  ctx.drawImage(_assets.stamp, x - size / 2, y - size / 2, size, size);
  ctx.restore();

  // 印章文字（叠在印章上）
  const stampText = C.titles[type]?.stamp || '';
  ctx.save();
  ctx.font = `bold 13px '${C.fonts.en}'`;
  ctx.fillStyle = 'rgba(255,240,200,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText(stampText, x, y + 5);
  ctx.restore();
}

// ---------- 点击区域检测 ----------

/**
 * 根据点击坐标判断点击了哪个区域
 * Canvas坐标需先从Three.js UV坐标换算
 * @param {'register'|'login'|'guest'} type
 * @param {number} cx - Canvas x坐标 (0-512)
 * @param {number} cy - Canvas y坐标 (0-820)
 * @returns {string|null} 字段id 或 'gender_female' | 'gender_male' | 'stamp' | null
 */
export function detectClickArea(type, cx, cy) {
  const C = CONTRACT_CONFIG;

  // 印章
  const { x: sx, y: sy, size } = C.stamp;
  if (Math.abs(cx - sx) < size / 2 && Math.abs(cy - sy) < size / 2) {
    return 'stamp';
  }

  // 性别框
  if (type === 'register' || type === 'guest') {
    const gY = C.genderY[type];
    const boxW = 60, boxH = 28;
    const
    const startX = (CONTRACT_CONFIG.width - boxW * 2 - 20) / 2;
    const boxY = gY + 14;

    if (cy >= boxY && cy <= boxY + boxH) {
      if (cx >= startX && cx <= startX + boxW) return 'gender_female';
      if (cx >= startX + boxW + 20 && cx <= startX + boxW * 2 + 20) return 'gender_male';
    }
  }

  // 输入字段
  const fields = C.fields[type] || [];
  for (const field of fields) {
    const lineY = field.y + C.input.lineY;
    if (cy >= field.y - 10 && cy <= lineY + 10) {
      if (cx >= C.input.x && cx <= C.input.endX) {
        return field.id;
      }
    }
  }

  return null;
}

// ---------- 使用示例（在你的 Three.js 文件里）----------
/*

import { loadContractAssets, _redrawCanvas, detectClickArea } from './contractCanvas.js';

// 1. 初始化Canvas和纹理
const canvas = document.createElement('canvas');
canvas.width = 512;
canvas.height = 820;
const ctx = canvas.getContext('2d');
const texture = new THREE.CanvasTexture(canvas);

// 2. 加载素材（只需一次）
await loadContractAssets('/ziyuan');

// 3. 状态
const state = {
  name: '', birthday: '', password: '',
  gender: null, cursorVisible: true,
};
let activeField = null;

// 4. 光标闪烁
setInterval(() => {
  state.cursorVisible = !state.cursorVisible;
  _redrawCanvas('register', ctx, state, activeField);
  texture.needsUpdate = true;
}, 500);

// 5. 键盘输入
window.addEventListener('keydown', (e) => {
  if (!activeField || activeField.startsWith('gender') || activeField === 'stamp') return;
  if (e.key === 'Backspace') {
    state[activeField] = state[activeField].slice(0, -1);
  } else if (e.key.length === 1) {
    state[activeField] += e.key;
  }
  _redrawCanvas('register', ctx, state, activeField);
  texture.needsUpdate = true;
});

// 6. 点击检测（Three.js Raycaster → UV → Canvas坐标）
function onCardClick(uv) {
  const cx = uv.x * 512;
  const cy = (1 - uv.y) * 820; // UV的y轴是反的
  const area = detectClickArea('register', cx, cy);

  if (area === 'stamp') {
    onSubmit(state); // 你自己的提交回调
  } else if (area === 'gender_female') {
    state.gender = 'female';
  } else if (area === 'gender_male') {
    state.gender = 'male';
  } else if (area) {
    activeField = area;
  } else {
    activeField = null;
  }

  _redrawCanvas('register', ctx, state, activeField);
  texture.needsUpdate = true;
}

*/
