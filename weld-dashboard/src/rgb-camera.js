/**
 * rgb-camera.js — 实时采集区 RGB 彩色画面
 *
 * 在 #rgbCanvas 上绘制蓝色工件方块流水线动画，
 * 包含传送带纹理、相机视野、检测区指示、缺陷标记。
 */

import { RGB_CONFIG, DEFECT_TYPES } from './config.js';
import { fitCanvas, pick, chance } from './utils.js';

// ========== 模块状态 ==========
let blocks = [];
let blockId = 0;

/**
 * 生成一个新方块
 */
function spawnBlock() {
  blockId++;
  const isDefect = chance(RGB_CONFIG.DEFECT_RATE);
  const defectType = isDefect ? pick(['burn', 'lack', 'bite']) : null;
  blocks.push({
    id: blockId,
    x: -RGB_CONFIG.BLOCK_W,
    w: RGB_CONFIG.BLOCK_W,
    h: RGB_CONFIG.BLOCK_H,
    speed: RGB_CONFIG.BLOCK_SPEED,
    defect: defectType,
    inspected: false,
  });
}

/**
 * 初始化方块队列
 */
function initBlocks() {
  for (let i = 0; i < RGB_CONFIG.MAX_VISIBLE; i++) {
    spawnBlock();
    blocks[blocks.length - 1].x = -RGB_CONFIG.BLOCK_W + i * RGB_CONFIG.BLOCK_GAP;
  }
}

/**
 * 绘制一帧 RGB 画面
 * @param {HTMLCanvasElement} canvas
 */
export function drawRgbFrame(canvas) {
  const { w, h } = fitCanvas(canvas);
  const ctx = canvas.getContext('2d');

  // ---------- 背景 ----------
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  // 顶部暗区
  const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  topGrad.addColorStop(0, '#151515');
  topGrad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, h * 0.55);

  // ---------- 传送带 ----------
  const beltY = h * 0.55;
  const beltH = h - beltY;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, beltY, w, beltH);

  // 传送带纹理（滚动斜线）
  ctx.strokeStyle = 'rgba(50,50,50,0.4)';
  ctx.lineWidth = 1;
  const beltOffset = (Date.now() * 0.05) % 20;
  for (let i = -20; i < w + 20; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i + beltOffset, beltY);
    ctx.lineTo(i + beltOffset + 10, h);
    ctx.stroke();
  }

  // 传送带边缘
  ctx.strokeStyle = 'rgba(80,80,80,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, beltY);
  ctx.lineTo(w, beltY);
  ctx.stroke();

  // ---------- 相机图标 ----------
  const camX = w / 2, camY = 8;
  ctx.fillStyle = 'rgba(0,184,212,0.15)';
  ctx.fillRect(camX - 20, camY, 40, 16);
  ctx.strokeStyle = 'rgba(0,184,212,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(camX - 20, camY, 40, 16);
  ctx.fillStyle = 'rgba(0,184,212,0.8)';
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('D435i', camX, camY + 11);

  // 相机视野锥
  ctx.strokeStyle = 'rgba(0,184,212,0.12)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(camX - 15, camY + 16);
  ctx.lineTo(0, beltY);
  ctx.moveTo(camX + 15, camY + 16);
  ctx.lineTo(w, beltY);
  ctx.stroke();
  ctx.setLineDash([]);

  // ---------- 检测区指示 ----------
  const inspectX = w * 0.45;
  const inspectR = w * 0.55;
  ctx.strokeStyle = 'rgba(0,184,212,0.2)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(inspectX, 0); ctx.lineTo(inspectX, h);
  ctx.moveTo(inspectR, 0); ctx.lineTo(inspectR, h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,184,212,0.4)';
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('检测区', (inspectX + inspectR) / 2, beltY - 4);

  // ---------- 方块更新与绘制 ----------
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const b = blocks[bi];
    b.x += b.speed;
    if (b.x > w + 60) {
      blocks.splice(bi, 1);
      continue;
    }

    const blockY = beltY - b.h * 0.6;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.x + 2, blockY + b.h - 4, b.w, 4);

    // 蓝色方块渐变
    const blkGrad = ctx.createLinearGradient(b.x, blockY, b.x, blockY + b.h);
    blkGrad.addColorStop(0,   '#2196F3');
    blkGrad.addColorStop(0.5, '#1976D2');
    blkGrad.addColorStop(1,   '#0D47A1');
    ctx.fillStyle = blkGrad;
    ctx.fillRect(b.x, blockY, b.w, b.h);

    // 边框高光
    ctx.strokeStyle = 'rgba(100,181,246,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, blockY, b.w, b.h);

    // 顶部高光
    ctx.fillStyle = 'rgba(100,181,246,0.3)';
    ctx.fillRect(b.x + 2, blockY + 2, b.w - 4, 3);

    // 焊缝线
    const weldCY = blockY + b.h * 0.5;
    ctx.strokeStyle = 'rgba(180,220,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b.x + 4, weldCY);
    ctx.lineTo(b.x + b.w - 4, weldCY);
    ctx.stroke();

    // 缺陷标记
    if (b.defect && b.x > inspectX) {
      const info = DEFECT_TYPES[b.defect];
      // 检测框
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x - 1, blockY - 1, b.w + 2, b.h + 2);
      // 角标
      ctx.fillStyle = info.color;
      ctx.fillRect(b.x - 1, blockY - 11, 26, 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10.5px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(info.cn, b.x, blockY - 3);
      // 缺陷点
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.5, weldCY, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (!b.defect && b.x > inspectX && b.x < inspectR) {
      // 合格淡框
      ctx.strokeStyle = 'rgba(34,197,94,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(b.x - 1, blockY - 1, b.w + 2, b.h + 2);
      ctx.setLineDash([]);
    }

    // 工件编号
    if (b.x > 20 && b.x < w - 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10.5px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('#' + b.id, b.x + b.w / 2, blockY + b.h + 10);
    }
  }

  // ---------- 生成新方块 ----------
  if (blocks.length > 0) {
    const last = blocks[blocks.length - 1];
    if (last.x >= RGB_CONFIG.BLOCK_GAP - RGB_CONFIG.BLOCK_W && blocks.length < RGB_CONFIG.MAX_VISIBLE) {
      spawnBlock();
    }
  } else {
    spawnBlock();
  }

  // ---------- 扫描线 ----------
  const scanY = beltY - 10 + Math.sin(Date.now() / 300) * 5;
  ctx.strokeStyle = 'rgba(0,184,212,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(inspectX, scanY);
  ctx.lineTo(inspectR, scanY);
  ctx.stroke();
}

/**
 * 获取当前方块列表（供 depth-camera 模块同步使用）
 * @returns {Array}
 */
export function getRgbBlocks() {
  return blocks;
}

/**
 * 初始化 RGB 采集区
 */
export function initRgbCamera() {
  initBlocks();
}
