// ============================================================
// contractCanvas.js — 完整最新版
// Canvas契约页面绘制函数，用于 THREE.CanvasTexture
// 规格：512 x 820px
// ============================================================

// ---------- 常量配置 ----------
const CONTRACT_CONFIG = {
  width: 512,
  height: 820,

  colors: {
    gold: '#8a5a10',
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

  fonts: {
    en: 'Almendra SC',
    zh: 'ZCOOL XiaoWei',
    italic: 'Cormorant Garamond',
  },

  // 实测字体宽度（26px Almendra SC）
  labelWidths: {
    NAME:     69.73,
    USERNAME: 128.54,
    EMAIL:     71.99,
    PASSWORD: 124.49,
    BIRTHDAY: 117.60,
    ACCOUNT:  99.0,
    AGE:      36.0,
    Sex:      37.44,
  },

  // 三种牌型字段（含完整坐标）
  fields: {
    register: [
      { id: 'username', labelEn: 'USERNAME', x: 49, y: 200, w: 160, h: 52, type: 'text'     },
      { id: 'email',    labelEn: 'EMAIL',    x: 49, y: 264, w: 160, h: 52, type: 'text'     },
      { id: 'password', labelEn: 'PASSWORD', x: 49, y: 328, w: 160, h: 52, type: 'password' },
      { id: 'birthday', labelEn: 'BIRTHDAY', x: 49, y: 392, w: 160, h: 52, type: 'birthday' },
    ],
    login: [
      { id: 'email',    labelEn: 'EMAIL',    x: 49, y: 300, w: 160, h: 50, type: 'text'     },
      { id: 'password', labelEn: 'PASSWORD', x: 49, y: 420, w: 160, h: 50, type: 'password' },
    ],
    guest: [
      { id: 'age',      labelEn: 'AGE',      x: 49, y: 360, w: 160, h: 50, type: 'number'   },
    ],
  },

  titles: {
    register: { zh: '初次到来', en: 'BEGIN',     stamp: '立　约' },
    login:    { zh: '回来了',   en: 'RETURN',    stamp: '进　入' },
    guest:    { zh: '今夜一问', en: 'ONE NIGHT', stamp: '进　入' },
  },

  // 性别区
  gender: {
    register: { x: 49, y: 456, w: 160, h: 52 },
    guest:    { x: 49, y: 300, w: 160, h: 50 },
  },

  // 印章（Figma实测）
  stamp: { x: 353, y: 515, w: 148, h: 133 },

  // 顶底横线
  lines: { top1: 72, top2: 76, bottom1: 744, bottom2: 748 },

  // 眼睛按钮配置
  eyeBtn: { offsetX: 8, y_offset: 0, size: 22 },
};

// ---------- 资源缓存 ----------
const _assets = { bg: null, head: null, bottom: null, left: null, right: null, stamp: null, blank: null };

export async function loadContractAssets(basePath = import.meta.env.BASE_URL + 'ziyuan') {
  const map = {
    bg: 'contract_bg.jpg', head: 'head.png', bottom: 'bottom.png',
    left: 'left.png', right: 'right.png', stamp: 'stamp.png', blank: 'blank.png',
  };
  await Promise.all(Object.entries(map).map(([key, file]) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { _assets[key] = img; resolve(); };
      img.onerror = () => { console.warn(`[Contract] 素材加载失败: ${file}`); resolve(); };
      img.src = `${basePath}/${file}`;
    })
  ));
}

// ---------- 主绘制函数 ----------
export function _redrawCanvas(type, ctx, state, activeField) {
  const C = CONTRACT_CONFIG;
  const { width, height } = C;
  ctx.clearRect(0, 0, width, height);

  // 水平翻转匹配Three.js UV
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);

  _drawBg(ctx, width, height);
  _drawLines(ctx, C);
  _drawHead(ctx);
  _drawBottomOrnaments(ctx);
  _drawEnTitle(ctx, type, C);
  _drawZhTitle(ctx, type, C, width);

  if (type === 'register' || type === 'guest') {
    _drawGender(ctx, type, state, C);
  }

  (C.fields[type] || []).forEach(field => {
    _drawField(ctx, field, state, activeField, C);
  });

  if (type === 'guest') _drawGuestNote(ctx, C, width);
  _drawStamp(ctx, type, C, !!state._overStamp);

  ctx.restore();
}

// ---------- 子绘制函数 ----------

function _drawBg(ctx, width, height) {
  if (_assets.bg) {
    ctx.drawImage(_assets.bg, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#c8b89a';
    ctx.fillRect(0, 0, width, height);
  }
}

function _drawLines(ctx, C) {
  ctx.save();
  ctx.strokeStyle = C.colors.gold;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.8;
  [C.lines.top1, C.lines.top2, C.lines.bottom1, C.lines.bottom2].forEach(y => {
    ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(482, y); ctx.stroke();
  });
  ctx.restore();
}

function _drawHead(ctx) {
  if (!_assets.head) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(_assets.head, 60, 0, 392, 148);
  ctx.restore();
}

function _drawBottomOrnaments(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.85;
  if (_assets.bottom) ctx.drawImage(_assets.bottom, 39, 709, 458, 110);
  if (_assets.left)   ctx.drawImage(_assets.left,   49, 541,  94, 207);
  if (_assets.right)  ctx.drawImage(_assets.right, 378, 541,  94, 207);
  ctx.restore();
}

function _drawEnTitle(ctx, type, C) {
  const title = C.titles[type]?.en || '';
  ctx.save();
  ctx.font = `32px 'Almendra SC'`;
  ctx.fillStyle = C.colors.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 175 + 177 / 2, 150 + 48 / 2);
  ctx.restore();
}

function _drawZhTitle(ctx, type, C, width) {
  const title = C.titles[type]?.zh || '';
  ctx.save();
  ctx.font = `18px '${C.fonts.zh}'`;
  ctx.fillStyle = C.colors.goldDim;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, width / 2, 128);
  ctx.restore();
}

function _drawGender(ctx, type, state, C) {
  const area = C.gender[type];
  if (!area) return;
  const { x: aX, y: aY, h: aH } = area;
  const SEX_LABEL_W = C.labelWidths['Sex']; // 37.44
  const boxH = 36, gap = 18, boxW = 52;
  const boxY = aY + (aH - boxH) / 2;

  // 标签
  ctx.save();
  ctx.font = `26px 'Almendra SC'`;
  ctx.fillStyle = C.colors.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Sex', aX, aY + aH / 2);
  ctx.restore();

  // 三框（起点 = aX + 标签宽 + 间距）
  const boxStartX = aX + SEX_LABEL_W + 12;
  const options = [
    { symbol: '♀', label: 'F', value: 'female'    },
    { symbol: '♂', label: 'M', value: 'male'      },
    { symbol: '⚧', label: 'X', value: 'nonbinary' },
  ];

  options.forEach(({ symbol, label, value }, i) => {
    const bx = boxStartX + i * (boxW + gap);
    const selected = state.gender === value;
    ctx.save();
    if (selected) { ctx.fillStyle = C.colors.selectedBg; ctx.fillRect(bx, boxY, boxW, boxH); }
    ctx.strokeStyle = selected ? C.colors.goldLight : C.colors.goldDim;
    ctx.lineWidth = selected ? 1.2 : 0.8;
    ctx.strokeRect(bx + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.font = `20px serif`;
    ctx.fillStyle = selected ? C.colors.selected : C.colors.textLight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, bx + 8, boxY + boxH / 2);
    ctx.font = `15px 'Almendra SC'`;
    ctx.fillText(label, bx + 30, boxY + boxH / 2);
    ctx.restore();
  });
}

function _drawField(ctx, field, state, activeField, C) {
  const { id, labelEn, x, y, w, h, type } = field;
  const isActive = activeField === id ||
    activeField === id + '_year' ||
    activeField === id + '_month' ||
    activeField === id + '_day';

  // birthday 单独处理
  if (type === 'birthday') {
    _drawBirthdayRow(ctx, field, state, activeField, C);
    return;
  }

  // 激活态：金色背景条
  if (isActive) {
    ctx.save();
    ctx.fillStyle = 'rgba(168, 145, 106, 0.08)';
    ctx.fillRect(x - 4, y + 2, 460, h - 4);
    ctx.restore();
  }

  // 标签
  ctx.save();
  ctx.font = `26px 'Almendra SC'`;
  ctx.fillStyle = isActive ? C.colors.gold : C.colors.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelEn, x, y + h / 2);
  ctx.restore();

  // 下划线
  _drawUnderline(ctx, x, y + h - 4, 452, C, isActive);

  // 输入内容（用实测宽度定位）
  const labelW = C.labelWidths[labelEn] || 80;
  const inputX = x + labelW + 12;
  const value = state[id] || '';
  const display = (type === 'password' && !state._eyeOpen)
    ? '•'.repeat(value.length)
    : value;

  if (display) {
    ctx.save();
    ctx.font = `22px 'Almendra SC'`;
    ctx.fillStyle = C.colors.inputText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(display, inputX, y + h / 2);
    ctx.restore();
  }

  // 光标
  if (activeField === id && state.cursorVisible) {
    ctx.save();
    ctx.font = `22px 'Almendra SC'`;
    const valW = ctx.measureText(display).width;
    const cursorX = inputX + valW + 1;
    ctx.strokeStyle = C.colors.cursor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cursorX, y + 10);
    ctx.lineTo(cursorX, y + h - 10);
    ctx.stroke();
    ctx.restore();
  }

  // 眼睛按钮（password 字段）
  if (type === 'password') {
    const eyeX = 452 - C.eyeBtn.offsetX - C.eyeBtn.size / 2;
    const eyeY = y + h / 2;
    const r = C.eyeBtn.size / 2;
    const isOpen = !!state._eyeOpen;

    ctx.save();
    ctx.strokeStyle = isActive ? C.colors.gold : C.colors.goldDim;
    ctx.lineWidth = 1.0;

    // 外轮廓（杏仁形）
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (isOpen) {
      // 睁眼：实心圆瞳孔
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? C.colors.gold : C.colors.goldDim;
      ctx.fill();
    } else {
      // 闭眼：一条横线
      ctx.beginPath();
      ctx.moveTo(eyeX - r, eyeY);
      ctx.lineTo(eyeX + r, eyeY);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function _drawBirthdayRow(ctx, field, state, activeField, C) {
  const { x, y, h } = field;
  const BDAY_LABEL_W = C.labelWidths['BIRTHDAY']; // 117.60
  const boxH = 36, gap = 8;
  const boxY = y + (h - boxH) / 2;
  const isFieldActive = activeField && activeField.startsWith(field.id);

  // 标签
  ctx.save();
  ctx.font = `26px 'Almendra SC'`;
  ctx.fillStyle = isFieldActive ? C.colors.gold : C.colors.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('BIRTHDAY', x, y + h / 2);
  ctx.restore();

  // 三框（起点 = x + 标签宽 + 间距）
  const boxes = [
    { sub: 'year',  label: '年', w: 80, maxLen: 4, placeholder: 'YYYY' },
    { sub: 'month', label: '月', w: 50, maxLen: 2, placeholder: 'MM'   },
    { sub: 'day',   label: '日', w: 50, maxLen: 2, placeholder: 'DD'   },
  ];

  let curX = x + BDAY_LABEL_W + 12;
  boxes.forEach(({ sub, label, w, placeholder }) => {
    const fieldKey = field.id + '_' + sub;
    const isActive = activeField === fieldKey;
    const value = state[fieldKey] || '';

    ctx.save();
    if (isActive) { ctx.fillStyle = C.colors.selectedBg; ctx.fillRect(curX, boxY, w, boxH); }
    ctx.strokeStyle = isActive ? C.colors.goldLight : C.colors.goldDim;
    ctx.lineWidth = isActive ? 1.2 : 0.8;
    ctx.strokeRect(curX + 0.5, boxY + 0.5, w - 1, boxH - 1);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (value) {
      ctx.font = `20px 'Almendra SC'`;
      ctx.fillStyle = C.colors.inputText;
      ctx.fillText(value, curX + w / 2, boxY + boxH / 2);
    } else {
      ctx.font = `13px 'Almendra SC'`;
      ctx.fillStyle = C.colors.placeholder;
      ctx.fillText(placeholder, curX + w / 2, boxY + boxH / 2);
    }

    // 光标
    if (isActive && state.cursorVisible) {
      ctx.font = `20px 'Almendra SC'`;
      const valW = ctx.measureText(value).width;
      const cursorX = curX + w / 2 + valW / 2 + 2;
      ctx.strokeStyle = C.colors.cursor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cursorX, boxY + 5);
      ctx.lineTo(cursorX, boxY + boxH - 5);
      ctx.stroke();
    }

    // 年月日小标签
    ctx.font = `12px 'Almendra SC'`;
    ctx.fillStyle = C.colors.goldDim;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, curX + w / 2, boxY + boxH + 3);

    ctx.restore();
    curX += w + gap;
  });
}

function _drawUnderline(ctx, x, y, endX, C, isActive = false) {
  if (_assets.blank) {
    const img = _assets.blank;
    const drawW = endX - x;
    const drawH = (img.naturalHeight / img.naturalWidth) * drawW;
    ctx.save();
    ctx.globalAlpha = isActive ? 1.0 : 0.55;
    ctx.drawImage(img, x, y - drawH / 2, drawW, drawH);
    ctx.restore();
  } else {
    ctx.save();
    ctx.strokeStyle = isActive ? C.colors.gold : C.colors.goldDim;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, y); ctx.stroke();
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

function _drawStamp(ctx, type, C, isHover) {
  if (!_assets.stamp) return;
  const { x, y, w, h } = C.stamp;

  // 悬停时：印章区域做金色描边发光
  if (isHover) {
    ctx.save();
    ctx.shadowColor = 'rgba(212,184,118,0.9)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(212,184,118,0.7)';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(_assets.stamp, x, y, w, h);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(_assets.stamp, x, y, w, h);
  ctx.restore();

  // 印章上方文字
  const stampText = C.titles[type]?.stamp || '';
  ctx.save();
  ctx.font = `bold 16px 'ZCOOL XiaoWei'`;
  ctx.fillStyle = isHover ? 'rgba(255,210,120,1)' : 'rgba(212,168,80,0.85)';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(100,60,20,0.5)';
  ctx.shadowBlur = isHover ? 8 : 4;
  ctx.fillText(stampText, x + w / 2, y - 10);
  ctx.restore();
}

// ---------- 点击区域检测 ----------
export function detectClickArea(type, cx, cy) {
  const C = CONTRACT_CONFIG;

  // 印章
  const { x: sx, y: sy, w: sw, h: sh } = C.stamp;
  if (cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh) return 'stamp';

  // 性别框（三个）
  if (type === 'register' || type === 'guest') {
    const area = C.gender[type];
    if (area) {
      const boxH = 36, boxW = 52, gap = 18;
      const boxY = area.y + (area.h - boxH) / 2;
      const boxStartX = area.x + C.labelWidths['Sex'] + 12;
      if (cy >= boxY && cy <= boxY + boxH) {
        if (cx >= boxStartX && cx <= boxStartX + boxW) return 'gender_female';
        if (cx >= boxStartX + boxW + gap && cx <= boxStartX + boxW * 2 + gap) return 'gender_male';
        if (cx >= boxStartX + (boxW + gap) * 2 && cx <= boxStartX + boxW * 3 + gap * 2) return 'gender_nonbinary';
      }
    }
  }

  // 输入字段
  for (const field of (C.fields[type] || [])) {
    // 眼睛按钮热区
    if (field.type === 'password') {
      const eyeX = 452 - 8 - 11; // 452 - offsetX - size/2
      const eyeY = field.y + field.h / 2;
      if (Math.abs(cx - eyeX) < 14 && Math.abs(cy - eyeY) < 14) {
        return 'eye_password';
      }
    }

    if (field.type === 'birthday') {
      const boxH = 36;
      const boxY = field.y + (field.h - boxH) / 2;
      const bStart = field.x + C.labelWidths['BIRTHDAY'] + 12; // 실측 49+117.60+12 = 178.6
      if (cy >= boxY && cy <= boxY + boxH + 16) {
        const boxes = [
          { sub: 'year',  x: bStart,          w: 80 },
          { sub: 'month', x: bStart + 88,     w: 50 },
          { sub: 'day',   x: bStart + 88 + 58, w: 50 },
        ];
        for (const b of boxes) {
          if (cx >= b.x && cx <= b.x + b.w) return field.id + '_' + b.sub;
        }
      }
      continue;
    }
    // 普通字段：整行可点击
    if (cy >= field.y && cy <= field.y + field.h) {
      if (cx >= field.x && cx <= 452) return field.id;
    }
  }

  return null;
}
