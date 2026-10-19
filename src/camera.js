import * as THREE from 'three';

// ===== 占卜固定视角参数 =====
export const DIVINATION_CAM = {
  position: { x: 0.18, y: 3.94, z: 1.38 },
  target:   { x: 0,    y: 1.88, z: 0    },
};

// ===== 内部状态 =====
let _camera   = null;
let _controls = null;
let _animating = false;

// ===== 初始化 =====
export function initCamera(camera, controls) {
  _camera   = camera;
  _controls = controls;
}

// ===== 平滑移动相机到目标位置 =====
// targetPos: { x, y, z }
// targetLookAt: { x, y, z }
// duration: 毫秒
// onComplete: 到位回调
export function moveTo(targetPos, targetLookAt, duration = 2000, onComplete = null) {
  if (!_camera) return;
  if (_animating) return;
  _animating = true;

  // 禁用OrbitControls，防止动画期间被用户打断
  if (_controls) _controls.enabled = false;

  const startPos    = _camera.position.clone();
  const startTarget = _controls
    ? _controls.target.clone()
    : new THREE.Vector3(0, 1.88, 0);

  const endPos    = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
  const endTarget = new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);

  const t0 = Date.now();

  function step() {
    const t = Math.min((Date.now() - t0) / duration, 1);
    // easeInOutCubic — 慢启慢收，有电影镜头质感
    const e = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    _camera.position.lerpVectors(startPos, endPos, e);

    if (_controls) {
      _controls.target.lerpVectors(startTarget, endTarget, e);
      _controls.update();
    } else {
      const lookAt = new THREE.Vector3().lerpVectors(startTarget, endTarget, e);
      _camera.lookAt(lookAt);
    }

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // 到位，锁死相机
      _camera.position.copy(endPos);
      if (_controls) {
        _controls.target.copy(endTarget);
        _controls.update();
        // 调试阶段保留OrbitControls
        // _controls.enabled = false;
        // _controls.enableRotate = false;
        // _controls.enableZoom   = false;
        // _controls.enablePan    = false;
      } else {
        _camera.lookAt(endTarget);
      }
      _animating = false;
      if (onComplete) onComplete();
    }
  }

  step();
}

// ===== 移动到占卜固定视角 =====
export function moveToDivinationView(duration = 2000, onComplete = null) {
  moveTo(DIVINATION_CAM.position, DIVINATION_CAM.target, duration, onComplete);
}

// ===== 恢复OrbitControls（开发调试用）=====
export function enableControls() {
  if (_controls) {
    _controls.enabled = true;
    _controls.enableRotate = true;
    _controls.enableZoom   = true;
    _controls.enablePan    = true;
  }
}

// ===== 是否正在动画中 =====
export function isCameraAnimating() {
  return _animating;
}
