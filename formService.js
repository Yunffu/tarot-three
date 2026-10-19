// ============================================================
// formService.js
// 表单验证 + API提交
// 现在用 localStorage 模拟，后端好了只改 _callApi 部分
// ============================================================

// ===== 验证规则 =====

const VALIDATORS = {
  register: (state) => {
    if (!state.username?.trim())
      return '请填写你的名字';
    if (!state.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email))
      return '请填写有效的邮箱地址';
    if (!state.password || state.password.length < 6)
      return '密码至少6位';
    if (!state.birthday_year || state.birthday_year.length < 4)
      return '请填写完整出生年份';
    if (!state.birthday_month || parseInt(state.birthday_month) < 1 || parseInt(state.birthday_month) > 12)
      return '请填写正确的月份';
    if (!state.birthday_day || parseInt(state.birthday_day) < 1 || parseInt(state.birthday_day) > 31)
      return '请填写正确的日期';
    if (!state.gender)
      return '请选择性别';
    return null; // 通过
  },

  login: (state) => {
    if (!state.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email))
      return '请填写有效的邮箱';
    if (!state.password)
      return '请填写密码';
    return null;
  },

  guest: (state) => {
    const age = parseInt(state.age);
    if (!state.age || isNaN(age) || age < 1 || age > 120)
      return '请填写有效年龄';
    return null;
  },
};

// ===== 构建提交数据 =====

function _buildPayload(type, state) {
  if (type === 'register') {
    return {
      username: state.username.trim(),
      email: state.email.trim(),
      password: state.password,
      birthday: `${state.birthday_year}-${state.birthday_month.padStart(2,'0')}-${state.birthday_day.padStart(2,'0')}`,
      gender: state.gender,
    };
  }
  if (type === 'login') {
    return {
      email: state.email.trim(),
      password: state.password,
    };
  }
  if (type === 'guest') {
    return {
      age: parseInt(state.age),
      gender: state.gender || null,
    };
  }
  return {};
}

// ===== API调用层（后端好了只改这里）=====

async function _callApi(type, payload) {
  // ── 阶段一：localStorage 模拟（现在用这个）──
  return _mockApi(type, payload);

  // ── 阶段二：真实后端（注释掉上面一行，取消注释下面）──
  // const endpoints = {
  //   register: '/api/auth/register',
  //   login:    '/api/auth/login',
  //   guest:    '/api/auth/guest',
  // };
  // const res = await fetch(endpoints[type], {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(payload),
  // });
  // const data = await res.json();
  // if (!res.ok) throw new Error(data.message || '提交失败');
  // return data;
}

// ===== localStorage 模拟 =====

function _mockApi(type, payload) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (type === 'register') {
        // 检查名字是否已被注册
        const users = JSON.parse(localStorage.getItem('tarot_users') || '[]');
        const exists = users.find(u => u.username === payload.username);
        if (exists) {
          reject(new Error('这个名字已经签过契约了'));
          return;
        }
        // 存入
        users.push({ ...payload, id: Date.now(), createdAt: new Date().toISOString() });
        localStorage.setItem('tarot_users', JSON.stringify(users));
        // 模拟返回 token
        const token = `mock_token_${Date.now()}`;
        localStorage.setItem('tarot_token', token);
        localStorage.setItem('tarot_user', JSON.stringify({ name: payload.username, gender: payload.gender }));
        resolve({ token, user: { name: payload.username, gender: payload.gender } });
      }

      else if (type === 'login') {
        const users = JSON.parse(localStorage.getItem('tarot_users') || '[]');
        // 支持 username 或旧的 name 字段
        const user = users.find(u => (u.username === payload.email || u.email === payload.email || u.name === payload.email) && u.password === payload.password);
        if (!user) {
          reject(new Error('账号或密码不对，契约无法认证'));
          return;
        }
        const token = `mock_token_${Date.now()}`;
        localStorage.setItem('tarot_token', token);
        localStorage.setItem('tarot_user', JSON.stringify({ name: user.name, gender: user.gender }));
        resolve({ token, user: { name: user.name, gender: user.gender } });
      }

      else if (type === 'guest') {
        // 游客：检查今日次数（IP限制在真实后端做，这里用日期模拟）
        const today = new Date().toDateString();
        const lastGuest = localStorage.getItem('tarot_guest_date');
        if (lastGuest === today) {
          reject(new Error('今夜已问过一次，明日再来'));
          return;
        }
        localStorage.setItem('tarot_guest_date', today);
        localStorage.setItem('tarot_user', JSON.stringify({ name: '游客', gender: payload.gender, isGuest: true }));
        resolve({ user: { name: '游客', isGuest: true } });
      }
    }, 600); // 模拟网络延迟
  });
}

// ===== 错误提示 UI =====

let _errorEl = null;

function _showError(msg) {
  if (!_errorEl) {
    _errorEl = document.createElement('div');
    Object.assign(_errorEl.style, {
      position: 'fixed',
      bottom: '12%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '100',
      fontFamily: "'Almendra SC', serif",
      fontSize: '14px',
      color: '#c8a060',
      background: 'rgba(10, 6, 4, 0.85)',
      border: '0.5px solid rgba(168, 145, 106, 0.4)',
      padding: '10px 24px',
      letterSpacing: '0.1em',
      textAlign: 'center',
      opacity: '0',
      transition: 'opacity 0.4s ease',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    });
    document.body.appendChild(_errorEl);
  }
  _errorEl.innerText = msg;
  _errorEl.style.opacity = '1';
  clearTimeout(_errorEl._hideTimer);
  _errorEl._hideTimer = setTimeout(() => {
    _errorEl.style.opacity = '0';
  }, 3000);
}

// ===== 提交中 UI =====

let _submitting = false;

function _showSubmitting(show) {
  _submitting = show;
  // 可以在这里加 loading 动画，现在先用印章变暗来表示
  // 你的 Canvas 可以检查 _submitting 状态决定是否绘制 loading
}

// ===== 主入口：供 login.js 调用 =====

/**
 * 提交表单
 * @param {'register'|'login'|'guest'} type
 * @param {Object} state - _cardInputState[type]
 * @param {Function} onSuccess - 成功回调，触发燃烧转场
 */
export async function submitForm(type, state, onSuccess) {
  if (_submitting) return;

  // 1. 验证
  const error = VALIDATORS[type]?.(state);
  if (error) {
    _showError(error);
    return;
  }

  // 2. 构建数据
  const payload = _buildPayload(type, state);

  // 3. 提交
  _showSubmitting(true);
  try {
    const result = await _callApi(type, payload);
    console.log(`[formService] ${type} 成功:`, result);
    _showSubmitting(false);
    // 成功：触发燃烧转场
    onSuccess(result);
  } catch (err) {
    _showSubmitting(false);
    _showError(err.message || '发生了未知错误');
    console.warn(`[formService] ${type} 失败:`, err.message);
  }
}

/**
 * 获取当前登录用户信息
 * @returns {Object|null}
 */
export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('tarot_user'));
  } catch {
    return null;
  }
}

/**
 * 获取 token（后端阶段用于 Authorization 头）
 * @returns {string|null}
 */
export function getToken() {
  return localStorage.getItem('tarot_token');
}
