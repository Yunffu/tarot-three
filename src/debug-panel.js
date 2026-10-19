// debug-panel.js
export function initDebugPanel(scene, loginCards, spotLeft, spotRight, camera, controls, labelEls, flipTarget) {

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '10px', left: '10px',
    zIndex: '9999', background: 'rgba(0,0,0,0.85)',
    border: '1px solid #a8916a', padding: '12px 16px',
    color: '#e8dcc8', fontFamily: 'monospace', fontSize: '11px',
    width: '300px', userSelect: 'none',
    maxHeight: '95vh', overflowY: 'auto',
  });

  function makeSlider(label, min, max, value, step, onChange) {
    const row = document.createElement('div');
    Object.assign(row.style, { marginBottom: '6px' });
    const lbl = document.createElement('div');
    const valEl = document.createElement('span');
    valEl.innerText = value.toFixed(2);
    lbl.innerHTML = `<span style="color:#a8916a">${label}</span> `;
    lbl.appendChild(valEl);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max;
    input.step = step; input.value = value;
    Object.assign(input.style, { width: '100%', margin: '2px 0' });
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valEl.innerText = v.toFixed(2);
      onChange(v);
      _printValues();
    });
    row.appendChild(lbl);
    row.appendChild(input);
    panel.appendChild(row);
    return input;
  }

  function makeSep(text) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      borderTop: '0.5px solid #a8916a44',
      margin: '8px 0 6px', paddingTop: '6px',
      color: '#a8916a', fontSize: '10px',
    });
    el.innerText = text;
    panel.appendChild(el);
  }

  const output = document.createElement('pre');
  Object.assign(output.style, {
    marginTop: '10px', padding: '8px',
    background: 'rgba(168,145,106,0.1)',
    fontSize: '10px', color: '#d4b876',
    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
  });

  function _printValues() {
    if (!loginCards || loginCards.length === 0) { output.innerText = '牌未加载'; return; }
    const c = loginCards[1];
    const sl = spotLeft, sr = spotRight;
    output.innerText =
`// 复制给Claude:
CENTER: (${c.position.x.toFixed(3)}, ${c.position.y.toFixed(3)}, ${c.position.z.toFixed(3)})
card.rotation.x: ${c.rotation.x.toFixed(3)}
spotLeft:  (${sl.position.x.toFixed(2)}, ${sl.position.y.toFixed(2)}, ${sl.position.z.toFixed(2)})
spotRight: (${sr.position.x.toFixed(2)}, ${sr.position.y.toFixed(2)}, ${sr.position.z.toFixed(2)})
fan_offset_x: ±${Math.abs((loginCards[0].position.x - loginCards[1].position.x)).toFixed(3)}
fan_offset_y: ${Math.abs((loginCards[0].position.y - loginCards[1].position.y)).toFixed(3)}
camera.pos: (${camera.position.x.toFixed(3)}, ${camera.position.y.toFixed(3)}, ${camera.position.z.toFixed(3)})
label offsets: [${labelOffsetY.map((v,i)=>'(dx:'+labelOffsetX[i]+',dy:'+v+',rx:'+labelRotateZ[i]+'deg)').join(', ')}]
flip: y=${flipTarget?.y?.toFixed(2)} z=${flipTarget?.z?.toFixed(2)} scale=${flipTarget?.scale?.toFixed(2)} rotX=${flipTarget?.rotX?.toFixed(2)}`;
  }

  // ===== 牌位置 =====
  makeSep('📍 三张牌位置');

  let cardY = 2.64, cardZ = 1.24, cardRX = -0.50;
  let fanOffsetX = 0.23, fanOffsetY = 0.01;

  makeSlider('CENTER Y',    0.5,  5.0, cardY,      0.01, v => { cardY = v; _applyCards(); });
  makeSlider('CENTER Z',   -2.0,  4.0, cardZ,      0.01, v => { cardZ = v; _applyCards(); });
  makeSlider('rotation.x', -1.5,  1.5, cardRX,     0.01, v => { cardRX = v; if(loginCards) loginCards.forEach(c => c.rotation.x = v); });
  makeSlider('扇形 X 间距',  0.0,  1.5, fanOffsetX, 0.01, v => { fanOffsetX = v; _applyCards(); });
  makeSlider('扇形 Y 错落',  0.0,  0.5, fanOffsetY, 0.01, v => { fanOffsetY = v; _applyCards(); });
  makeSlider('扇形 Z 倾斜', -0.5,  0.5, 0.26,       0.01, v => {
    if (!loginCards) return;
    loginCards[0].rotation.z =  v;
    loginCards[2].rotation.z = -v;
    _printValues();
  });

  function _applyCards() {
    if (!loginCards || loginCards.length === 0) return;
    const offsets = [
      { x: -fanOffsetX, y: -fanOffsetY },
      { x:  0,          y:  0          },
      { x:  fanOffsetX, y: -fanOffsetY },
    ];
    loginCards.forEach((card, i) => {
      card.position.x = offsets[i].x;
      card.position.y = cardY + offsets[i].y;
      card.position.z = cardZ + (i - 1) * 0.01;
      card.userData.baseY = cardY + offsets[i].y;
      card.userData.fanY  = cardY + offsets[i].y;
    });
    _printValues();
  }

  // ===== SpotLight =====
  makeSep('💡 SpotLight');

  let slX = 1.5, slY = 3.10, slZ = 3.00, slInt = 15.0, slAngle = Math.PI/6;

  makeSlider('灯 X（左右各）', 0.0,  5.0, slX,   0.05, v => {
    slX = v;
    if (spotLeft)  spotLeft.position.x  = -v;
    if (spotRight) spotRight.position.x =  v;
    _printValues();
  });
  makeSlider('灯 Y（高度）',   1.0,  8.0, slY,   0.05, v => {
    slY = v;
    if (spotLeft)  spotLeft.position.y  = v;
    if (spotRight) spotRight.position.y = v;
    _printValues();
  });
  makeSlider('灯 Z（前后）',  -2.0,  5.0, slZ,   0.05, v => {
    slZ = v;
    if (spotLeft)  spotLeft.position.z  = v;
    if (spotRight) spotRight.position.z = v;
    _printValues();
  });
  makeSlider('灯强度',         0.0, 30.0, slInt, 0.5,  v => {
    if (spotLeft)  spotLeft.intensity  = v;
    if (spotRight) spotRight.intensity = v * 0.7;
  });
  makeSlider('光锥角度',       0.1,  1.2, slAngle, 0.01, v => {
    if (spotLeft)  spotLeft.angle  = v;
    if (spotRight) spotRight.angle = v;
  });
  makeSlider('光锥柔化',       0.0,  1.0, 0.3, 0.01, v => {
    if (spotLeft)  spotLeft.penumbra  = v;
    if (spotRight) spotRight.penumbra = v;
  });

  // ===== 相机位置 =====
  makeSep('🎥 相机位置');

  let camX = camera.position.x;
  let camY = camera.position.y;
  let camZ = camera.position.z;

  makeSlider('camera X', -3.0, 3.0, camX, 0.01, v => {
    camera.position.x = v;
    if (controls) controls.update();
    _printValues();
  });
  makeSlider('camera Y',  0.5, 6.0, camY, 0.01, v => {
    camera.position.y = v;
    if (controls) controls.update();
    _printValues();
  });
  makeSlider('camera Z', -1.0, 6.0, camZ, 0.01, v => {
    camera.position.z = v;
    if (controls) controls.update();
    _printValues();
  });

  // ===== 翻转后牌的位置/大小/角度 =====
  makeSep('🃏 翻转后位置');

  // 获取当前选中牌（已翻转）
  function _getFlippedCard() {
    if (!loginCards) return null;
    return loginCards.find(c => c.userData.isSelected);
  }

  function _applyFlipToCard() {
    const c = _getFlippedCard();
    if (!c || !flipTarget) return;
    c.position.x = flipTarget.x;
    c.position.y = flipTarget.y;
    c.position.z = flipTarget.z;
    const s = flipTarget.scale;
    c.scale.set(s, s, s);
    c.rotation.x = flipTarget.rotX;
    _printValues();
  }

  makeSlider('flip Y',     1.0, 4.0,  2.68,  0.01, v => { if(flipTarget) flipTarget.y     = v; _applyFlipToCard(); });
  makeSlider('flip Z',    -1.0, 4.0,  1.9,   0.01, v => { if(flipTarget) flipTarget.z     = v; _applyFlipToCard(); });
  makeSlider('flip scale', 0.5, 3.0,  1.8,   0.01, v => { if(flipTarget) flipTarget.scale = v; _applyFlipToCard(); });
  makeSlider('flip rotX', -1.5, 1.5, -0.42,  0.01, v => { if(flipTarget) flipTarget.rotX  = v; _applyFlipToCard(); });
  makeSep('✦ 文字标签位置');

  // 强制显示开关，方便调试时不依赖hover
  const forceShowRow = document.createElement('div');
  Object.assign(forceShowRow.style, { marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' });
  const forceShowCb = document.createElement('input');
  forceShowCb.type = 'checkbox';
  const forceShowLbl = document.createElement('label');
  forceShowLbl.innerText = '强制显示文字（调试用）';
  forceShowLbl.style.fontSize = '11px';
  forceShowCb.addEventListener('change', () => {
    if (!labelEls) return;
    labelEls.forEach(el => {
      if (forceShowCb.checked) {
        el.dataset.forceShow = '1';
        el.style.opacity = '1';
        el.style.filter = 'blur(0px)';
      } else {
        delete el.dataset.forceShow;
        el.style.opacity = '0';
      }
    });
  });
  forceShowRow.appendChild(forceShowCb);
  forceShowRow.appendChild(forceShowLbl);
  panel.appendChild(forceShowRow);

  const LABEL_NAMES = ['回来了（登录）', '初次到来（注册）', '今夜一问（游客）'];
  const labelOffsetY = [0, 0, 0];
  const labelOffsetX = [0, 0, 0];
  const labelRotateZ = [0, 0, 0];

  function _applyLabelTransform(i) {
    if (!labelEls || !labelEls[i]) return;
    labelEls[i].style.marginTop  = labelOffsetY[i] + 'px';
    labelEls[i].style.marginLeft = labelOffsetX[i] + 'px';
    // 把rotateX存到dataset，updateLogin每帧读取
    labelEls[i].dataset.rotateZ = labelRotateZ[i];
    // 立即更新当前transform（不等下一帧）
    const currentTransform = labelEls[i].style.transform || '';
    const base = currentTransform.replace(/rotateZ\(.*?\)/g, '').trim();
    labelEls[i].style.transform = `${base} rotateZ(${labelRotateZ[i]}deg)`;
  }

  LABEL_NAMES.forEach((name, i) => {
    makeSep(`✏️ ${name}`);
    makeSlider('上下 px', -400, 400, 0, 1, v => {
      labelOffsetY[i] = v; _applyLabelTransform(i); _printValues();
    });
    makeSlider('左右 px', -400, 400, 0, 1, v => {
      labelOffsetX[i] = v; _applyLabelTransform(i); _printValues();
    });
    makeSlider('rotateZ °', -80, 80, 0, 1, v => {
      labelRotateZ[i] = v; _applyLabelTransform(i); _printValues();
    });
  });

  // ===== 切牌/发牌相机视角 =====
  makeSep('✂️ 切牌视角（洗牌阶段用）');
  makeSlider('cut Y（高度）', 2.0, 7.0, 4.2, 0.05, v => {
    if (window.__CUT_CAM) { window.__CUT_CAM.y = v; _applyDebugCam(); }
  });
  makeSlider('cut Z（前后）', 0.0, 3.0, 1.2, 0.05, v => {
    if (window.__CUT_CAM) { window.__CUT_CAM.z = v; _applyDebugCam(); }
  });
  makeSlider('cut target Y', 1.0, 3.0, 2.0, 0.05, v => {
    if (window.__CUT_CAM) { window.__CUT_CAM.ty = v; _applyDebugCam(); }
  });

  makeSep('🃏 发牌视角');
  makeSlider('deal Y（高度）', 2.0, 5.0, 3.2, 0.05, v => {
    if (window.__DEAL_CAM) { window.__DEAL_CAM.y = v; }
  });
  makeSlider('deal Z（前后）', 0.0, 2.0, 0.9, 0.05, v => {
    if (window.__DEAL_CAM) { window.__DEAL_CAM.z = v; }
  });

  // 实时预览切牌视角按钮
  function _applyDebugCam() {
    if (!window.__CUT_CAM || !camera) return;
    const c = window.__CUT_CAM;
    camera.position.set(c.x, c.y, c.z);
    camera.lookAt(c.tx || 0, c.ty || 2.0, c.tz || 0);
    if (controls) controls.update();
    _printValues();
  }
  const cutCamBtn = document.createElement('button');
  cutCamBtn.innerText = '📷 预览切牌视角';
  Object.assign(cutCamBtn.style, {
    marginTop: '6px', width: '100%', padding: '6px',
    background: 'rgba(168,145,106,0.15)',
    border: '0.5px solid rgba(168,145,106,0.4)',
    color: '#d4b876', cursor: 'pointer', fontSize: '11px',
  });
  cutCamBtn.addEventListener('click', _applyDebugCam);
  panel.appendChild(cutCamBtn);

  // 记录当前相机参数按钮
  const camRecordBtn = document.createElement('button');
  camRecordBtn.innerText = '📌 记录当前相机参数';
  Object.assign(camRecordBtn.style, {
    marginTop: '6px', width: '100%', padding: '6px',
    background: 'rgba(100,180,100,0.15)',
    border: '0.5px solid rgba(100,180,100,0.4)',
    color: '#90d090', cursor: 'pointer', fontSize: '11px',
  });
  camRecordBtn.addEventListener('click', () => {
    if (!camera) return;
    const p = camera.position;
    const t = controls ? controls.target : { x: 0, y: 1.88, z: 0 };
    const str = `camera: pos(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}) target(${t.x.toFixed(3)}, ${t.y.toFixed(3)}, ${t.z.toFixed(3)})`;
    // 显示在调试输出区
    const out = document.getElementById('debug-output');
    if (out) {
      out.textContent = str;
      out.style.color = '#90d090';
    }
    // 同时复制到剪贴板
    navigator.clipboard?.writeText(str);
    console.log('[CAM RECORD]', str);
  });
  panel.appendChild(camRecordBtn);

  // 自由视角模式开关
  const freeViewBtn = document.createElement('button');
  freeViewBtn.innerText = '🎮 自由视角模式：关';
  Object.assign(freeViewBtn.style, {
    marginTop: '6px', width: '100%', padding: '6px',
    background: 'rgba(100,100,200,0.15)',
    border: '0.5px solid rgba(100,100,200,0.4)',
    color: '#9090d0', cursor: 'pointer', fontSize: '11px',
  });
  let _freeView = false;
  freeViewBtn.addEventListener('click', () => {
    _freeView = !_freeView;
    if (controls) {
      controls.enabled = _freeView;
      controls.enableRotate = _freeView;
      controls.enableZoom   = _freeView;
      controls.enablePan    = _freeView;
    }
    window.__freeViewMode = _freeView;
    freeViewBtn.innerText = `🎮 自由视角模式：${_freeView ? '开（可拖动）' : '关'}`;
    freeViewBtn.style.background = _freeView
      ? 'rgba(100,100,200,0.35)' : 'rgba(100,100,200,0.15)';
  });
  panel.appendChild(freeViewBtn);

  // ===== 收起/展开 =====
  const title = document.createElement('div');
  Object.assign(title.style, {
    cursor: 'pointer', marginBottom: '8px',
    color: '#a8916a', fontSize: '12px', fontWeight: 'bold',
  });
  title.innerText = '🔧 调试面板（点击收起）';
  let collapsed = false;
  title.addEventListener('click', () => {
    collapsed = !collapsed;
    Array.from(panel.children).forEach((el, i) => {
      if (i === 0) return; // title本身不隐藏
      el.style.display = collapsed ? 'none' : '';
    });
    title.innerText = collapsed ? '🔧 调试面板（点击展开）' : '🔧 调试面板（点击收起）';
  });
  panel.prepend(title);
  panel.appendChild(output);
  document.body.appendChild(panel);

  setTimeout(_printValues, 200);
  window.__debugRefresh = _printValues;
}
