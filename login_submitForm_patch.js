// ============================================================
// 在 login.js 顶部 import 区加入：
// ============================================================

import { submitForm } from './formService.js';


// ============================================================
// 替换 login.js 里的 _submitForm 函数（第729行）
// 把原来的整个函数换成下面这个：
// ============================================================

function _submitForm(type) {
  const state = _cardInputState[type];

  submitForm(type, state, (result) => {
    // 验证+提交成功后才触发燃烧转场
    if (window._formKeyHandler) window.removeEventListener('keydown', window._formKeyHandler);
    if (_cursorTimer) { clearInterval(_cursorTimer); _cursorTimer = null; }
    triggerBurnTransition();
  });

  // 注意：不再立即 triggerBurnTransition()
  // 现在是：提交成功 → 回调里触发
  // 失败 → showError 提示，用户可以修改后重试
}
