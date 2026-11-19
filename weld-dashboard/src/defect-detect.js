/**
 * defect-detect.js — YOLO 缺陷检测画面
 *
 * 在 #detectCanvas 上绘制精细流水线检测动画，
 * 包含四角 L 型检测框、置信度标签、缺陷光晕、合格 OK 标签。
 */

import { DET_CONFIG, DEFECT_TYPES } from './config.js';
import { fitCanvas, pick, chance, randFloat, hexToRgba } from './utils.js';

// ========== 模块状态 ==========
let blocks = [];
let blockId = 0;

/**
 * 生成新方块
 */
function spawnBlock() {
  blockId++;
  const isDefect = chance(DET_CONFIG.DEFECT_RATE);
  const defectType = isDefect ? pick(['burn', 'lack', 'bite']) : null;
  const conf = isDefect
    ? randFloat(0.85, 0.98)
    : randFloat(0.92, 0.99);
  blocks.push({
    id: blockId,
    x: -DET_CONFIG.BLOCK_W,
    w: DET_CONFIG.BLOCK_W,
    h: DET_CONFIG.BLOCK_H,
    speed: DET_CONFIG.BLOCK_SPEED,
    defect: defectType,
    conf: conf,
    inspected: false,
    flash: 0,
    _flashed: false,
  });
}

/**
 * 初始化方块队列
 */
function initBlocks() {
  for (let i = 0; i < DET_CONFIG.MAX_VISIBLE; i++) {
    spawnBlock();
    blocks[blocks.length - 1].x = -DET_CONFIG.BLOCK_W + i * DET_CONFIG.BLOCK_GAP;
  }
}

/**
 * 绘制一帧检测画面
 * @param {HTMLCanvasElement} canvas
 */
export function drawDetectFrame(canvas) {
  const { w, h } = fitCanvas(canvas);
  const ctx = canvas.getContext('2d');

  // ---------- 背景 ----------
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0,   '#0C0F14');
  bgGrad.addColorStop(0.5, '#0A0D12');
  bgGrad.addColorStop(1,   '#080A0F');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // ---------- 传送带 ----------
  const beltY = h * 0.62;

  const beltGrad = ctx.createLinearGradient(0, beltY, 0, h);
  beltGrad.addColorStop(0,   '#1E1E1E');
  beltGrad.addColorStop(0.5, '#151515');
  beltGrad.addColorStop(1,   '#0A0A0A');
  ctx.fillStyle = beltGrad;
  ctx.fillRect(0, beltY, w, h - beltY);

  // 传送带纹理
  const beltOffset = (Date.now() * 0.06) % 24;
  ctx.strokeStyle = 'rgba(50,50,55,0.5)';
  ctx.lineWidth = 1;
  for (let bx = -24; bx < w + 24; bx += 24) {
    ctx.beginPath();
    ctx.moveTo(bx + beltOffset, beltY);
    ctx.lineTo(bx + beltOffset + 12, h);
    ctx.stroke();
  }

  // 传送带边线
  ctx.strokeStyle = 'rgba(90,90,95,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, beltY);
  ctx.lineTo(w, beltY);
  ctx.stroke();

  // ---------- 检测区指示 ----------
  const inspectL = w * 0.15;
  const inspectR = w * 0.85;
  ctx.fillStyle = 'rgba(0,184,212,0.03)';
  ctx.fillRect(inspectL, 0, inspectR - inspectL, h);
  ctx.strokeStyle = 'rgba(0,184,212,0.15)';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(inspectL, 0); ctx.lineTo(inspectL, h);
  ctx.moveTo(inspectR, 0); ctx.lineTo(inspectR, h);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(0,184,212,0.4)';
  ctx.font = 'bold 13.5px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YOLO DETECTION ZONE', (inspectL + inspectR) / 2, 14);

  // 顶部相机标识
  ctx.fillStyle = 'rgba(0,184,212,0.12)';
  ctx.fillRect(w / 2 - 30, 2, 60, 14);
  ctx.strokeStyle = 'rgba(0,184,212,0.3)';
  ctx.strokeRect(w / 2 - 30, 2, 60, 14);
  ctx.fillStyle = 'rgba(0,184,212,0.6)';
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('D435i -> YOLO', w / 2, 12);

  // ---------- 方块更新与绘制 ----------
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const b = blocks[bi];
    b.x += b.speed;
    if (b.flash > 0) b.flash -= 0.05;
    if (b.x > w + DET_CONFIG.BLOCK_W) {
      blocks.splice(bi, 1);
      continue;
    }

    const blockY = beltY - b.h * 0.65;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, beltY + 2, b.w * 0.45, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 蓝色方块
    const blkGrad = ctx.createLinearGradient(b.x, blockY, b.x + b.w, blockY + b.h);
    blkGrad.addColorStop(0,   '#42A5F5');
    blkGrad.addColorStop(0.3, '#1E88E5');
    blkGrad.addColorStop(0.7, '#1565C0');
    blkGrad.addColorStop(1,   '#0D47A1');
    ctx.fillStyle = blkGrad;
    ctx.fillRect(b.x, blockY, b.w, b.h);

    // 边框
    ctx.strokeStyle = 'rgba(100,181,246,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, blockY + 0.5, b.w - 1, b.h - 1);

    // 顶部高光
    ctx.fillStyle = 'rgba(187,222,251,0.25)';
    ctx.fillRect(b.x + 3, blockY + 3, b.w - 6, 4);

    // 焊缝线
    const weldY = blockY + b.h * 0.5;
    ctx.strokeStyle = 'rgba(200,230,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x + 5, weldY);
    ctx.lineTo(b.x + b.w - 5, weldY);
    ctx.stroke();

    // 焊缝波纹纹理
    ctx.strokeStyle = 'rgba(150,200,255,0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 3) {
      ctx.moveTo(wx, weldY);
      ctx.lineTo(wx + 1.5, weldY + Math.sin(wx * 0.5) * 1.5);
    }
    ctx.stroke();

    // ---------- 检测结果 ----------
    if (b.x > inspectL && b.x < inspectR) {
      b.inspected = true;
      if (b.flash === 0 && !b._flashed) {
        b.flash = 1;
        b._flashed = true;
      }

      if (b.defect) {
        const info = DEFECT_TYPES[b.defect];

        // 闪光
        if (b.flash > 0) {
          ctx.fillStyle = hexToRgba(info.color, b.flash * 0.2);
          ctx.fillRect(b.x - 5, blockY - 5, b.w + 10, b.h + 10);
        }

        // 四角 L 型检测框
        const pad = 3;
        const bx0 = b.x - pad, by0 = blockY - pad;
        const bw0 = b.w + pad * 2, bh0 = b.h + pad * 2;
        const cl = 6;

        ctx.strokeStyle = info.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // 左上
        ctx.moveTo(bx0, by0 + cl); ctx.lineTo(bx0, by0); ctx.lineTo(bx0 + cl, by0);
        // 右上
        ctx.moveTo(bx0 + bw0 - cl, by0); ctx.lineTo(bx0 + bw0, by0); ctx.lineTo(bx0 + bw0, by0 + cl);
        // 左下
        ctx.moveTo(bx0, by0 + bh0 - cl); ctx.lineTo(bx0, by0 + bh0); ctx.lineTo(bx0 + cl, by0 + bh0);
        // 右下
        ctx.moveTo(bx0 + bw0 - cl, by0 + bh0); ctx.lineTo(bx0 + bw0, by0 + bh0); ctx.lineTo(bx0 + bw0, by0 + bh0 - cl);
        ctx.stroke();

        // 标签栏
        const labelText = `${info.cn} ${b.conf.toFixed(2)}`;
        ctx.font = 'bold 13.5px Microsoft YaHei';
        const labelW = ctx.measureText(labelText).width + 8;
        const labelH = 13;
        ctx.fillStyle = info.color;
        ctx.fillRect(bx0, by0 - labelH, labelW, labelH);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(labelText, bx0 + 4, by0 - 3);

        // 缺陷位置标记
        const defectX = b.x + b.w * 0.5;
        ctx.fillStyle = info.color;
        ctx.beginPath();
        ctx.arc(defectX, weldY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // 光晕
        const halo = ctx.createRadialGradient(defectX, weldY, 0, defectX, weldY, 7);
        halo.addColorStop(0, hexToRgba(info.color, 0.67));
        halo.addColorStop(1, hexToRgba(info.color, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(defectX, weldY, 7, 0, Math.PI * 2);
        ctx.fill();

        // 英文小标签
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(info.label, bx0 + bw0 - 2, by0 + bh0 - 2);

      } else {
        // 合格品
        ctx.strokeStyle = 'rgba(34,197,94,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(b.x - 2, blockY - 2, b.w + 4, b.h + 4);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(34,197,94,0.7)';
        ctx.font = 'bold 15px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`OK ${b.conf.toFixed(2)}`, b.x, blockY - 5);
      }
    } else if (b.x <= inspectL) {
      // 未进入检测区
      ctx.strokeStyle = 'rgba(100,100,100,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.strokeRect(b.x, blockY, b.w, b.h);
      ctx.setLineDash([]);
    }

    // 工件编号
    if (b.x > 30 && b.x < w - 30) {
      ctx.fillStyle = 'rgba(150,160,170,0.4)';
      ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`#W${String(b.id).padStart(4, '0')}`, b.x + b.w / 2, beltY + 14);
    }
  }

  // ---------- 生成新方块 ----------
  if (blocks.length > 0) {
    const last = blocks[blocks.length - 1];
    if (last.x >= DET_CONFIG.BLOCK_GAP - DET_CONFIG.BLOCK_W && blocks.length < DET_CONFIG.MAX_VISIBLE) {
      spawnBlock();
    }
  } else {
    spawnBlock();
  }

  // ---------- 底部状态条 ----------
  ctx.fillStyle = 'rgba(56,189,248,0.08)';
  ctx.fillRect(0, h - 22, w, 22);
  ctx.strokeStyle = 'rgba(56,189,248,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - 22);
  ctx.lineTo(w, h - 22);
  ctx.stroke();

  const defTotal = blocks.filter(b => b.defect && b.inspected).length;
  const okTotal = blocks.filter(b => !b.defect && b.inspected).length;

  ctx.fillStyle = 'rgba(74,222,128,0.7)';
  ctx.font = 'bold 15px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`OK: ${okTotal}`, 8, h - 7);

  ctx.fillStyle = 'rgba(248,113,113,0.7)';
  ctx.fillText(`NG: ${defTotal}`, 70, h - 7);

  ctx.fillStyle = 'rgba(148,163,184,0.6)';
  ctx.font = '13.5px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('MODEL: YOLOv8  |  FPS: 15  |  CONF THR: 0.50', w - 8, h - 7);
}

/**
 * 初始化检测画面
 */
export function initDefectDetect() {
  initBlocks();
}
