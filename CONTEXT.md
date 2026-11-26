# Tarot Three — 项目上下文

## 项目概述

维多利亚神秘学风格的塔罗占卜 3D Web 应用。用户进入时选择三张悬浮塔罗牌（登录/注册/游客），选中后翻转显示 Canvas 契约表单，填写后触发燃烧转场进入占卜室。

技术栈：**Vite + Three.js + 原生 JS**，无框架。

---

## 文件结构

```
tarot-three/
├── index.html                  # 入口页面（内嵌登录表单 HTML + 燃烧 canvas 脚本）
├── src/
│   ├── main.js                # 主入口（带完整登录流程：入场动画 → 选牌 → 翻转填表 → 燃烧转场）
│   ├── main(1).js             # 简化版入口（无登录，直接展示桌上塔罗牌）
│   ├── scene.js               # Three.js 场景构建：HDR环境、桌上牌、桌子、蜡烛、窗帘、水晶球、宝石等所有模型
│   ├── login.js               # 登录模块：三张悬浮牌动画、扇形展开、hover、文字标签聚合、Canvas契约表单交互、燃烧转场
│   ├── contractCanvas.js      # Canvas 契约页面绘制（三种类型：login/register/guest），由 login.js 导入使用
│   ├── debug-panel.js         # 调试面板（牌位置/SpotLight/相机/翻转后位置/标签偏移 的滑条控制）
│   ├── style.css              # 最小 CSS（清零 + 隐藏 overflow）
│   └── assets/                # Hero 图、JS/Vite 图标
├── formService.js             # 表单验证 + localStorage mock API（提交成功后调用 onSuccess 触发燃烧）
├── public/
│   ├── tarot_assets/
│   │   ├── cards/             # 77张塔罗牌图（.jpg/.jpeg）+ card_back.jpg + card_back_normal/specular.png
│   │   └── cloth/             # 桌布贴图
│   ├── ziyuan/                # 契约表单素材（背景、边框、印章等图片）
│   ├── hdr/                   # HDR 环境贴图
│   └── models/                # GLB 模型（桌子、布料、蜡烛、水晶球、书本、沙漏、羽毛笔等）
└── node_modules/
```

---

## 各文件职责

### `index.html`
入口 HTML。包含 `#login-form-overlay`（三个 `.login-form-panel`，用于初始未选牌时的备用登录）、`#burn-canvas`（燃烧转场动画）、内联脚本 `selectGender()`/`handleSubmit()`/`startBurn()`。Google Fonts 引用：Cinzel、ZCOOL XiaoWei、Cormorant Garamond。

### `src/main.js`（主要入口）
- 创建相机、渲染器（ACESFilmic tone mapping，曝光 0.35）、OrbitControls
- 调用 `initScene()` 初始化 Three.js 场景
- `initLogin()` 延迟 200ms 初始化登录模块
- 动画循环：烛光呼吸抖动、水晶 emissive 脉动
- 登录阶段：两 pass 渲染（pass1 主场景极低曝光，pass2 渲染登录牌）
- 登录完成后：单 pass 正常渲染
- 暴露 `window.__loginModule` 供 HTML 内联脚本回调

### `src/main(1).js`
简化版入口（无登录）。直接展示桌上牌，烛光效果正常，相机固定或可 orbit。**未接入 login 模块和 formService**。

### `src/scene.js`
`initScene(renderer, camera)` 返回主 Three.js 场景：
1. 加载 HDR 环境贴图 `ferndale_studio_08_1k.hdr`
2. 创建桌上单张塔罗牌（`createCardGeometry` 圆角矩形几何体，正面牌图 + 背面 card_back + 侧面奶白色）
3. 加载 GLB 模型：狮子桌（30x放大）、布料（cloth.glb）、蜡烛（candles.glb）、水晶球（0.25x，透明 + envMapIntensity 2.0）、book_open、old_book_tarot、宝石（crystals.glb，MeshPhysicalMaterial，ior 1.8）、沙漏、羽毛笔
4. 三个 PointLight（flame1/2/3）用于烛光

### `src/login.js`
核心登录流程。**当前主入口 `main.js` 使用此模块。**

- 三张悬浮登录牌扇形排列（登录=返回/注册=初次到来/游客=今夜一问）
- `CENTER = (0, 2.679, 1.290)` 为三张牌世界坐标中心
- `FLIP_TARGET` 翻转后目标位置/缩放/角度（Y=2.64, scale=1.62）
- 入场时序：
  - T+0.3s：语录淡入
  - T+3.8s：语录淡出
  - T+5.4s：黑层淡出，三张叠牌从下方浮现
  - T+6.8s：聚光灯从散开聚焦 + 牌扇形展开（同步 900ms easeOutExpo）
  - T+8s：文字聚合浮现，2秒后流散
- 点击选中牌 → 隐藏其他两张 → 甩牌+翻转（750ms easeOutBack + easeInOutQuart）
- 翻转后预烘焙 Canvas 纹理（契约表单）到牌正面
- 表单交互：键盘输入（`_bindKeyboard`）、点击检测（`_bindFormClick` → UV → `detectClickArea`）
- 提交成功 → `triggerBurnTransition()` → 灯灭 + 曝光渐亮 + 清理场景
- `submitForm()` 验证 state → `_callApi()` → 成功后 `onSuccess()` 回调触发燃烧

### `src/contractCanvas.js`
**`src/` 下的版本是实际被 `login.js` 使用的版本。** `public/ziyuan/contractCanvas.js` 是旧版模板/参考。

512×820px Canvas 绘制，三种类型：
- `register`：NAME / PASSWORD / BIRTHDAY（年/月/日三框）+ 性别（♀/♂/⚧）+ 印章「立约」
- `login`：ACCOUNT / PASSWORD + 印章「进入」
- `guest`：AGE + 性别（♀/♂）+ 印章「进入」+ 备注「今夜不留痕迹」

导出了 `loadContractAssets(basePath)`、`_redrawCanvas(type, ctx, state, activeField)`、`detectClickArea(type, cx, cy)`。

### `src/debug-panel.js`
右侧固定调试面板。滑条控制：
- 三张牌位置（CENTER Y/Z、rotation.x、扇形 X 间距/ Y 错落/ Z 倾斜）
- SpotLight 位置和参数（强度、光锥角度/柔化）
- 相机位置
- 翻转后目标（Y/Z/scale/rotX）
- 三张牌文字标签的像素偏移和 rotateZ

### `formService.js`
`submitForm(type, state, onSuccess)` 导出：
- 验证规则（三种类型各自的必填/格式检查）
- `localStorage` mock 实现（游客每日一次检查用日期字符串）
- 提交中/错误提示 UI（底部居中文字）
- 后端完成后：取消注释 `_callApi` 里的真实 fetch 替换 mock

---

## 当前进度

**已完成：**
- 完整 3D 占卜室场景（桌上模型、HDR 光照、烛光呼吸）
- 登录入场动画（语录 → 黑层渐隐 → 叠牌浮现 → 聚光灯聚焦 → 扇形展开 → 文字聚合流散）
- 三张悬浮牌的选牌、hover 效果、甩牌翻转动画
- Canvas 契约表单（三种类型完整绘制逻辑 + 键盘/点击交互 + 光标闪烁）
- 燃烧转场（Canvas 径向烧穿 + 火焰边缘发光 + 曝光渐亮）
- localStorage mock 后端（注册/登录/游客三种流程）
- 调试面板（所有关键参数实时可调）

**确认可运行入口：** `main.js`（完整登录流程）

---

## 最近变更（每次改完由 Claude Code 更新）

- 2026-04-14：建立跨对话工作流，CONTEXT.md 正式作为项目状态文件
- 2026-04-18：确立产品核心哲学（见下方「产品哲学」章节）
- 2026-11-23：**大模型接入层重构（无密钥可运行）**
  - 新增 `src/ai-client.js`：统一模型访问层。请求走同源路径 `/api/anthropic/v1/messages`（新增 `vite.config.js` 代理，在**服务端**注入 `x-api-key`，前端源码里不再出现密钥）；未配置密钥时服务端直接返回 503，前端自动降级，面板顶部显示当前是「模型 · Claude Sonnet 4」还是「离线模式 · 本地规则桩」
  - 新增 `src/offline-diviner.js`：**降级用规则桩**（词典 + 模板，无推理能力）。刻意复刻系统提示词的产品约束——反射用户用词、不给结论、强制模糊限制语、结尾给双出口、回复 ≤50 字
  - 改 `src/dialogue.js`：`_callClaude()` 改为走 `callModel()`，失败降级到规则桩；面板新增模式标识
  - 改 `src/significator.js`：自拍象征牌改为走 `callModel()`（多模态 image+text），失败降级到**本地图像特征分析**（中心区域平均色相/亮度/饱和度 → 选花色，非 AI）；无照片时仍按登录信息推断
  - ⚠️ **口径**：以上是"接大模型 API 的工程与产品设计 + 降级方案"，**模型本身从未真实返回过内容**（无密钥）。要真跑通：项目根目录建 `.env` 写入 `ANTHROPIC_API_KEY=...` 后重启 dev server，无需改代码
  - `full_flow_v4.html`（2D 原型）未改动，仍是浏览器直连 + 手动选择降级

---

## 未解决的问题 / 待办

1. **占卜室核心功能未实现**：登录燃烧转场完成后，`onLoginComplete()` 是空函数，后续占卜逻辑（抽牌、牌阵、洗牌）尚未开发。

2. **`main(1).js` 是废弃/不完整分支**：无登录逻辑，直接渲染桌上牌。当前未接入任何流程，可视为展示模式模板。

3. **`public/ziyuan/contractCanvas.js` 是旧版模板**：和 `src/contractCanvas.js` 内容不同（旧版用 Cinzel 字体、不同的字段坐标），可能导致混淆，应删除或标注废弃。

4. **`src/contractCanvas.js` vs `public/ziyuan/contractCanvas.js` 的字段配置不一致**：
   - `src/` 版本：register 有 NAME + PASSWORD + BIRTHDAY，login 有 ACCOUNT + PASSWORD，guest 有 AGE
   - `public/ziyuan/` 版本：register 字段顺序和 y 坐标不同
   - `login.js` 使用 `src/contractCanvas.js`；`public/ziyuan/` 是历史模板

5. **游客「每日一次」限制是 localStorage 实现**：换设备/清除浏览器数据可绕过，真实生产需后端 IP 或账号维度限制。

6. **桌上塔罗牌（`scene.js` 中的 `card`）只有一张硬编码的 0.jpg**：后续占卜流程需要随机发牌/选牌逻辑。

7. **`contractCanvas.js` 中 `birthday` 字段**：`src/` 版本将生日拆成三个独立框（年/月/日），但 `login.js` 里 birthday 相关状态 key 为 `birthday_year/month/day`，需确认字段 ID 与 `CONTRACT_CONFIG.fields` 中 id 的一致性（当前 `src/contractCanvas.js` 中 birthday type 为 `'year'` 不是 `'birthday'`，存在潜在不一致）。

8. **字体**：Google Fonts 在 `index.html` 引用的是 `Almendra SC`（英文字体），`src/contractCanvas.js` 里也用的是 `Alendra SC`，但 `public/ziyuan/contractCanvas.js`（旧）用的是 `Cinzel`，需确认实际设计字体偏好。

---

---

## 产品哲学（2026-04-18 确立）

### 核心理念

> 帮助用户接纳理解自己，完善进步自己，重新更好地回到自己的世界。

塔罗不是预言工具，是**自省的入口**。78张牌覆盖了人类几乎所有的处境——抽到一张，不是命运在说话，是用户被迫停下来，用自己的内心去填充那张牌的意义。答案不在牌里，在用户看见那张牌之后的反应里。

### AI占卜师设计原则

**她是镜子，不是方向盘。**

- 永远不引导结局，只提供视角和反映
- 话术使用"也许""可能""大概"等模糊限制语，不用肯定句告知答案
- 结尾给两个出口："你心中应该有了指向" 或 "或许需要更多的时间"——承认两种真实状态
- 读的不只是牌，也读用户说的话：用词、句子长短、停顿、省略都是信号
- 把用户某个词轻轻反射回去，让用户感到被真正听见
- 诚实承认局限："我看不见你现在的状态，但如果你愿意，可以告诉我此刻最真实的感受。"

### 占卜牌阵规划（按难度递进）

| 牌阵 | 张数 | 适合场景 |
|------|------|----------|
| 单张牌 | 1 | 日常自省入口，"今天的我是什么状态" |
| 三张牌 | 3 | 最常用，过去/现在/未来 或 问题/原因/建议 |
| 脉轮七张 | 7 | 身心七个层面的深度自省，适合中期用户 |
| 凯尔特十字 | 10 | 已规划，适合深度解读，需AI辅助串联 |

建议：新用户从单张或三张开始，熟悉牌的语言后解锁更复杂牌阵。

### 感知用户状态的技术设计

**输入时长-情绪匹配**
监听输入框 focus/blur 事件，只计算 active 状态时长（失焦暂停），避免挂机干扰。打字慢/停顿长=犹豫整理情绪；打字快而短=防御或已想清楚。

**私密日记入口**
对话界面设隐藏入口"说给自己听"，默认AI不读，只是记录。AI可在合适节点轻问："有没有什么你想让我知道的？"用户授权后读取一次，之后退出可见状态不再主动引用。设计哲学：了解自己的节奏由自己掌控。

**感受确认选项**
关键节点提供2-3个感受确认，如"抽到这张牌，你第一反应更接近哪个：有点意外，还是早就知道？"用户选择本身暴露状态，AI据此调整方向。

### 塔罗78张牌体系速览

**大阿卡纳 22张（人生核心旅程）**
- 0愚者→7战车：世俗阶段，走入世界、建立自我
- 8力量→14节制：灵魂阶段，向内整合、与自己和解
- 15恶魔→21世界：超越阶段，面对阴影、走向完整

**小阿卡纳 56张（日常四维度）**
- 权杖（火）：热情、创造力、使命感、行动力
- 圣杯（水）：情感、关系、直觉、潜意识
- 宝剑（风）：思维、冲突、决策、真相与痛苦
- 星币（土）：身体、金钱、工作、现实积累

---

## 快速上手（新对话时复制以下内容）

```
我在做一个塔罗占卜应用，技术栈是 Vite + Three.js + 原生 JS，无任何框架。
当前入口是 main.js（完整登录流程）。
关键文件：src/login.js（登录模块）、src/contractCanvas.js（契约表单绘制）、src/scene.js（3D 场景）。
我需要你帮我完成：填写 onLoginComplete 之后的占卜核心逻辑（抽牌、牌阵、洗牌等）。
```
