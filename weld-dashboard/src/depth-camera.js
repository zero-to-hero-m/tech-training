/**
 * depth-camera.js — 实时采集区深度图画面
 *
 * 在 #depthCanvas 上绘制伪彩深度图，
 * 方块数据与 rgb-camera 模块共享（通过 getRgbBlocks()）。
 */

import { DEFECT_TYPES } from './config.js';
import { fitCanvas } from './utils.js';
import { getRgbBlocks } from './rgb-camera.js';

/**
 * 绘制一帧深度图
 * @param {HTMLCanvasElement} canvas
 */
export function drawDepthFrame(canvas) {
  const { w, h } = fitCanvas(canvas);
  const ctx = canvas.getContext('2d');

  // ---------- 伪彩深度背景 ----------
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0,   '#000814');
  grad.addColorStop(0.3, '#001D3D');
  grad.addColorStop(0.6, '#003566');
  grad.addColorStop(0.8, '#004E89');
  grad.addColorStop(1,   '#0066CC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // ---------- 传送带区域 ----------
  const beltY = h * 0.55;
  ctx.fillStyle = 'rgba(0,20,60,0.6)';
  ctx.fillRect(0, beltY, w, h - beltY);

  // ---------- 深度网格 ----------
  ctx.strokeStyle = 'rgba(0,184,212,0.08)';
  ctx.lineWidth = 0.5;
  for (let gx = 0; gx < w; gx += 12) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 0; gy < h; gy += 12) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // ---------- 同步绘制方块深度热力 ----------
  const blocks = getRgbBlocks();
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    if (b.x < -b.w || b.x > w + b.w) continue;

    const blockY = beltY - b.h * 0.6;

    // 热力渐变（近=暖色）
    const heatGrad = ctx.createRadialGradient(
      b.x + b.w / 2, blockY + b.h / 2, 2,
      b.x + b.w / 2, blockY + b.h / 2, b.w * 0.8
    );
    heatGrad.addColorStop(0,   'rgba(255,200,80,0.7)');
    heatGrad.addColorStop(0.4, 'rgba(255,120,40,0.5)');
    heatGrad.addColorStop(0.7, 'rgba(100,80,200,0.3)');
    heatGrad.addColorStop(1,   'rgba(0,100,200,0)');
    ctx.fillStyle = heatGrad;
    ctx.fillRect(b.x - 10, blockY - 10, b.w + 20, b.h + 20);

    // 方块轮廓
    ctx.strokeStyle = 'rgba(255,180,50,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, blockY, b.w, b.h);

    // 焊缝线深度高亮
    const weldCY = blockY + b.h * 0.5;
    if (b.defect) {
      const info = DEFECT_TYPES[b.defect];
      // 缺陷热点
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.5, weldCY, 4, 0, Math.PI * 2);
      ctx.fill();
      // 热力扩散
      const dg = ctx.createRadialGradient(
        b.x + b.w * 0.5, weldCY, 1,
        b.x + b.w * 0.5, weldCY, 12
      );
      dg.addColorStop(0, 'rgba(255,255,0,0.4)');
      dg.addColorStop(1, 'rgba(255,255,0,0)');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.5, weldCY, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- 深度色标条 ----------
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(w - 10, 0, 10, h);
  const barGrad = ctx.createLinearGradient(0, 0, 0, h);
  barGrad.addColorStop(0,   '#ffc800');
  barGrad.addColorStop(0.3, '#ff8800');
  barGrad.addColorStop(0.6, '#8844ff');
  barGrad.addColorStop(1,   '#0044aa');
  ctx.fillStyle = barGrad;
  ctx.fillRect(w - 9, 0, 8, h);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10.5px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('近', w - 5, 10);
  ctx.fillText('远', w - 5, h - 4);
}
