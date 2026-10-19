# 任务：拆分代码架构 + 整理道具布局

## 目标
1. 把main.js拆分成 scene.js（场景）和 main.js（入口）
2. 整理道具位置，让牌阵活动区域清晰，左右对称

## 第一步：创建 src/scene.js

把main.js里从 `function buildCard()` 开始到结尾的所有内容，移到新文件 `src/scene.js`，并做以下修改：

```javascript
// src/scene.js
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 导出场景初始化函数
export function initScene(renderer, camera) {
  const scene = new THREE.Scene();
  const gltfLoader = new GLTFLoader();

  // ===== HDR =====
  const rgbeLoader = new RGBELoader();
  rgbeLoader.load('/hdr/ferndale_studio_08_1k.hdr', (hdrTexture) => {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = new THREE.Color(0x0f0c09);
    scene.environment = hdrTexture;
    buildScene(scene, camera, renderer, gltfLoader);
  });

  return scene;
}

// 场景内容构建（原buildCard函数改名）
function buildScene(scene, camera, renderer, gltfLoader) {
  // ... 原来buildCard里的所有代码放这里
  // 注意：把所有道具位置按下面第二步的布局调整
}
```

## 第二步：整理道具布局

**牌阵活动区域：** 桌面中央偏前，z从0到0.6，x从-0.5到0.5，这个区域不能有任何道具。

**道具分区（左右对称）：**

```
        [后方区域]
   书组        水晶球
  (-0.4,y,-0.5) (0.5,y,-0.45)

   水晶簇      羽毛笔+墨水
  (-0.55,y,-0.3) (0.55,y,-0.2)

        蜡烛组
      (0, y, -0.55) 居中后方

   沙漏              空
  (-0.6,y,0.1)

        [前方牌阵区域 - 空]
```

**具体位置代码，找到每个道具的position，统一替换：**

```javascript
// 蜡烛 - 居中后方
candlesModel.position.set(0, 2.25, -0.6);
candlesModel.scale.set(0.3, 0.3, 0.3);

// 同步更新火焰位置
flame1.position.set(0, 2.8, -0.6);
flame2.position.set(-0.18, 2.55, -0.45);
flame3.position.set(0.18, 2.52, -0.72);

// 水晶球 - 右后方
crystalModel.position.set(0.55, 2.2, -0.45);
crystalModel.scale.set(0.25, 0.25, 0.25);

// 水晶簇 - 左中后方
crystals.position.set(-0.55, 1.95, -0.3);
crystals.scale.set(0.0035, 0.0035, 0.0035);

// 书组 - 左后方
bookOpen.position.set(-0.35, 1.88, -0.52);
bookOpen.rotation.y = 0.2;

bookTarot.position.set(-0.38, 1.99, -0.5);
bookTarot.rotation.y = -0.15;

// 沙漏 - 左侧
hourglass.position.set(-0.62, 1.88, -0.1);
hourglass.rotation.y = 0.5;

// 羽毛笔 - 右中
quill.position.set(0.5, 1.92, -0.2);
quill.rotation.y = -0.8;
```

## 第三步：更新main.js为纯入口文件

```javascript
// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initScene } from './scene.js';

// ===== 相机 =====
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 3.2, 2.2);
camera.lookAt(0, 1.88, 0);

// ===== 渲染器 =====
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.35;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ===== 初始化场景 =====
const scene = initScene(renderer, camera);

// ===== 相机控制 =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 1.88, 0);
controls.minDistance = 1.5;
controls.maxDistance = 5;
controls.maxPolarAngle = Math.PI / 2.2;
controls.update();

// ===== 动画循环 =====
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  // 后续divination.js的动画也在这里调用
  renderer.render(scene, camera);
}
animate();

// ===== 窗口缩放 =====
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

## 注意
- scene.js里的animate()函数要删掉，动画循环统一在main.js里
- scene.js里的OrbitControls也删掉，控制器统一在main.js里
- scene.js需要export出来给动画循环用的对象：card, flame1, flame2, flame3, crystals
