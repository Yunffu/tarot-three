# tarot-three

> A 3D Tarot Card Visualization Project built with Three.js

## 在线演示

**[https://yunffu.github.io/tarot-three/](https://yunffu.github.io/tarot-three/)**

浏览器直接打开即可体验完整流程，无需安装。开场有一段本地动效式的「入场仪式」（选牌 → 填昵称 → 燃烧转场），纯前端交互，未接后端账号系统。源码见 [本仓库](https://github.com/Yunffu/tarot-three)。

## 项目状态

**当前版本**: v0.2.0

一个 3D 塔罗占卜应用，用 Three.js 做卡牌可视化，串联"入场 → 提问 → 抽牌 → 解读 → 契约签订"的完整流程。

## 功能列表

### 已完成
- [x] 3D卡牌渲染（PBR 材质 + HDRI 环境光 + glTF 模型）
- [x] 卡牌翻转动画
- [x] 牌阵布局算法
- [x] 用户登录表单
- [x] AI 塔罗师对话（DeepSeek，密钥不出前端）
- [x] 无密钥时的本地规则桩降级（面板如实标注当前模式）
- [x] 自拍测象征牌（本地颜色特征分析）
- [x] 契约签订画布（Canvas 生成 + 导出）
- [x] GitHub Pages 线上部署

### 进行中
- [ ] 卡牌3D旋转交互
- [ ] 更多牌阵样式

## 技术栈

- **Three.js** - 3D渲染
- **Vite** - 构建与开发服务器
- **Vanilla JavaScript** - 核心逻辑
- **HTML/CSS** - 前端界面
- **DeepSeek API** - AI 对话（经服务端代理，密钥不落前端）
- **Cloudflare Workers** - 线上 AI 网关

## 运行项目

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 构建
npm run build
```

### 配置 AI 对话（可选）

在项目根目录建 `.env`（已被 gitignore，勿提交）：

```
DEEPSEEK_API_KEY=你的密钥
```

开发服务器会把 `/api/deepseek/*` 代理到 `api.deepseek.com` 并在**服务端**注入密钥。
不配置也能跑 —— 此时 AI 对话自动降级到本地规则桩，界面标注「离线模式」。

## 线上部署

线上是纯静态站点（GitHub Pages），密钥不能放在前端，因此额外用一个
Cloudflare Worker 当 AI 网关：

```bash
cd worker
npx wrangler login
npx wrangler secret put DEEPSEEK_API_KEY   # 密钥写入 Worker secret
npx wrangler deploy                          # 拿到 https://<name>.<subdomain>.workers.dev
```

然后把 Worker 地址写进构建环境变量 `VITE_AI_BASE`，重新构建发布即可。

线上站点当前使用的网关：`https://tarot-ai-worker.yunffu-tarot.workers.dev`（密钥在 Worker secret 里）。

Worker 做了三件事：白名单来源校验（只允许本站和本地开发）、`max_tokens` 上限、
密钥只存服务端。

## 项目结构

```
tarot-three/
├── index.html          # 主页面
├── full_flow_v4.html   # 完整流程测试页
├── src/                # 源代码
│   ├── ai-client.js    # 模型访问层（带离线降级）
│   ├── offline-diviner.js # 离线占卜师规则桩
│   └── ...
├── public/             # 静态资源（卡牌贴图、模型、字体）
├── worker/             # Cloudflare Worker：线上 AI 网关
└── dist/               # 构建输出
```

## 学习笔记

项目开发过程中的架构思考和技术记录：

- [架构重构记录](./11_refactor_architecture.md)
- [开发上下文](./CONTEXT.md)

## 关于

用 Three.js 做 3D 塔罗可视化，并把"AI 对话"在保证密钥不泄露的前提下搬到线上。
