// vite.config.js — 开发服务器配置
//
// 作用：把 /api/deepseek/* 代理到 DeepSeek 官方 API，并在**服务端**注入 Authorization 头。
// 这样前端源码里永远不出现密钥；同时未配置密钥时直接返回 503，
// 前端 ai-client.js 会自动进入离线降级模式（规则桩），演示不会中断。
//
// 用法：在 .env 里填入 DEEPSEEK_API_KEY 后重启 dev server。
// 没有密钥也能跑 —— 此时 AI 对话走本地规则桩，界面上会标注「离线模式」。

import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const key = env.DEEPSEEK_API_KEY;

  return {
    // GitHub Pages 部署在 /tarot-three/ 子路径下，base 必须带上前缀，
    // 否则静态资源（/models/... 等）会 404。dev 时保持根路径。
    base: command === 'serve' ? '/' : '/tarot-three/',
    server: {
      proxy: {
        '/api/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/deepseek/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (key) proxyReq.setHeader('Authorization', `Bearer ${key}`);
            });
          }
        }
      }
    },
    plugins: [
      {
        name: 'deepseek-proxy-guard',
        configureServer(server) {
          // 密钥未配置时，直接短路返回 503，让前端进入离线降级，
          // 而不是把一个必然 401 的请求打出去。
          server.middlewares.use('/api/deepseek/health', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            if (!key) {
              res.statusCode = 503;
              res.end(JSON.stringify({ ok: false, mode: 'offline', reason: 'no_api_key' }));
              return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true, mode: 'model' }));
          });

          server.middlewares.use('/api/deepseek', (req, res, next) => {
            if (key) return next();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 503;
            res.end(JSON.stringify({
              error: { type: 'no_api_key', message: '未配置 DEEPSEEK_API_KEY，当前为离线降级模式' }
            }));
          });
        }
      }
    ]
  };
});
