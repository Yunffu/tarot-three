// ============================================
// 批量生成塔罗牌法线贴图脚本（sharp版本）
// 用法：node generate_normals.js
// 输入：public/tarot_assets/cards/0.jpg ~ 77.jpg
// 输出：public/tarot_assets/cards/0_normal.png ~ 77_normal.png
// ============================================

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsDir = path.join(__dirname, 'public/tarot_assets/cards');

// 法线凹凸强度，4适合塔罗牌正面
const STRENGTH = 4;

// ============================================
// 核心函数：把彩色图片转换成法线贴图
// ============================================
async function generateNormalMap(inputPath, outputPath) {
  // 用sharp读取图片，转成原始像素数据（RGB格式）
  const { data, info } = await sharp(inputPath)
    .toColorspace('srgb')
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // 处理可能的透明通道
    .removeAlpha()   // 强制去掉Alpha通道，统一成RGB三通道
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const output = Buffer.alloc(width * height * 3);

  // 获取某个坐标的亮度值（0-1）
  function getLuminance(x, y) {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    const idx = (cy * width + cx) * channels;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    // 标准亮度公式（人眼对绿色最敏感）
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // 遍历每个像素，用Sobel算子计算法线
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 读取周围8个像素的亮度
      const tl = getLuminance(x-1, y-1), t = getLuminance(x, y-1), tr = getLuminance(x+1, y-1);
      const l  = getLuminance(x-1, y),                               r  = getLuminance(x+1, y);
      const bl = getLuminance(x-1, y+1), b = getLuminance(x, y+1),  br = getLuminance(x+1, y+1);

      // Sobel算子计算水平和垂直坡度
      const dX = (tr + 2*r + br) - (tl + 2*l + bl);
      const dY = (bl + 2*b + br) - (tl + 2*t + tr);

      // 转换成法线向量并归一化
      const nX = -dX * STRENGTH;
      const nY = -dY * STRENGTH;
      const nZ = 1.0;
      const len = Math.sqrt(nX*nX + nY*nY + nZ*nZ);

      // 映射到0-255的RGB值写入输出
      const outIdx = (y * width + x) * 3;
      output[outIdx]     = Math.floor(((nX / len) * 0.5 + 0.5) * 255); // R → X方向
      output[outIdx + 1] = Math.floor(((nY / len) * 0.5 + 0.5) * 255); // G → Y方向
      output[outIdx + 2] = Math.floor(((nZ / len) * 0.5 + 0.5) * 255); // B → Z方向（朝外）
    }
  }

  // 把原始像素数组保存成PNG
  await sharp(output, {
    raw: { width, height, channels: 3 }
  }).png().toFile(outputPath);
}

// ============================================
// 主流程：批量处理0.jpg到77.jpg
// ============================================
async function main() {
  console.log('开始生成法线贴图...\n');

  for (let i = 0; i < 78; i++) {
    const inputPath = path.join(cardsDir, `${i}.jpg`);
    const outputPath = path.join(cardsDir, `${i}_normal.png`);

    process.stdout.write(`处理第 ${i}/77 张...`);

    try {
  await generateNormalMap(inputPath, outputPath);
  
  // 同时生成specular贴图——就是灰度图
  // 亮=光滑=高光，暗=粗糙=漫反射
  await sharp(inputPath)
    .toColorspace('srgb')
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .grayscale()
    .png()
    .toFile(path.join(cardsDir, `${i}_specular.png`));
  
  console.log(' ✓');
} catch (err) {
  console.log(` ✗ 失败: ${err.message}`);
}
  }

  console.log('\n全部完成！');
}

main();
