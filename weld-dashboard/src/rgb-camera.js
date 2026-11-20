/**
 * rgb-camera.js — 实时采集区 RGB 彩色画面
 *
 * 在 #rgbCanvas 上绘制蓝色工件方块流水线动画，
 * 包含传送带纹理、相机视野、检测区指示、缺陷标记。
 */

import { RGB_CONFIG, DEFECT_TYPES } from './config.js';
import { fitCanvas, pick, chance, randFloat, nowTimeString } from './utils.js';
import { state } from './event-bus.js';

// ========== 模块状态 ==========
let blocks = [];
let blockId = 0;
let rgbCanvasRef = null;  // 保存画布引用，供拍照抓帧使用
let beltPhase = 0;        // 传送带纹理相位：仅运行时推进，停机时纹理静止

/**
 * 抓拍当前 RGB 画面，返回 PNG dataURL
 * 供「拍照 / 连续采集」使用——真实系统中对应 D435i 取一帧图像。
 */
export function captureRgbFrame() {
  if (!rgbCanvasRef) return null;
  try {
    return rgbCanvasRef.toDataURL('image/png');
  } catch (err) {
    console.warn('[rgb-camera] 抓拍失败:', err);
    return null;
  }
}

/**
 * 生成一张模拟的彩色工件照片（无实时画面时用离屏画布生成）
 */
function makeSimPhoto(workpieceId, isDefect, defectType) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 200;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 200);
  g.addColorStop(0, '#2a3340'); g.addColorStop(1, '#111823');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 200);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  for (let y = 8; y < 200; y += 9) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(320, y); ctx.stroke();
  }
  // 焊缝
  ctx.strokeStyle = 'rgba(190,210,235,0.35)'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(20, 105); ctx.lineTo(300, 105); ctx.stroke();
  // 工件
  const bx = 90, by = 82, bw = 140, bh = 46;
  const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
  bg.addColorStop(0, '#42A5F5'); bg.addColorStop(1, '#0D47A1');
  ctx.fillStyle = bg; ctx.fillRect(bx, by, bw, bh);
  if (isDefect && defectType) {
    const info = DEFECT_TYPES[defectType];
    ctx.strokeStyle = info.color; ctx.lineWidth = 2;
    ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
    ctx.fillStyle = info.color; ctx.fillRect(bx - 3, by - 18, 96, 15);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
    ctx.fillText(info.cn, bx + 2, by - 7);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px "Microsoft YaHei", sans-serif';
  ctx.fillText(`#W${String(workpieceId).padStart(4, '0')}  ${nowTimeString()}`, 12, 185);
  return c.toDataURL('image/png');
}

/**
 * 连续采集 n 件工件（返回照片记录数组），不依赖传送带运行
 */
export function captureBatch(count) {
  const shots = [];
  for (let i = 0; i < count; i++) {
    const workpieceId = state.workpieceSeq++;
    const isDefect = chance(RGB_CONFIG.DEFECT_RATE);
    const defectType = isDefect ? pick(['burn', 'lack', 'bite']) : null;
    const dataUrl = captureRgbFrame() || makeSimPhoto(workpieceId, isDefect, defectType);
    shots.push({
      workpieceId,
      type: defectType,
      conf: isDefect ? randFloat(0.85, 0.98) : randFloat(0.92, 0.99),
      dataUrl,
      time: nowTimeString(),
    });
  }
  return shots;
}

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
  rgbCanvasRef = canvas;
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

  // 传送带纹理（滚动斜线）——停机时相位不推进，纹理静止
  if (state.beltRunning) beltPhase += RGB_CONFIG.BLOCK_SPEED;
  const beltOffset = beltPhase % 20;
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
    // 传送带停止时工件驻留，不再移动
    if (state.beltRunning) b.x += b.speed;
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

  // ---------- 生成新方块（仅传送带运行时，停机不补件） ----------
  if (state.beltRunning) {
    if (blocks.length > 0) {
      const last = blocks[blocks.length - 1];
      if (last.x >= RGB_CONFIG.BLOCK_GAP - RGB_CONFIG.BLOCK_W && blocks.length < RGB_CONFIG.MAX_VISIBLE) {
        spawnBlock();
      }
    } else {
      spawnBlock();
    }
  }

  // ---------- 扫描线 ----------
  const scanY = beltY - 10 + Math.sin(Date.now() / 300) * 5;
  ctx.strokeStyle = 'rgba(0,184,212,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(inspectX, scanY);
  ctx.lineTo(inspectR, scanY);
  ctx.stroke();

  // ---------- 相机参数：曝光（明暗） + 增益（噪点） ----------
  // 曝光 <1 叠暗、>1 叠亮；增益越高噪点越明显。真实反映调参对成像的影响。
  const exposure = state.exposure ?? 1;
  const gain = state.gain ?? 1;
  if (exposure < 1) {
    ctx.fillStyle = `rgba(0,0,0,${((1 - exposure) * 0.7).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  } else if (exposure > 1) {
    ctx.fillStyle = `rgba(255,255,255,${((exposure - 1) * 0.45).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (gain > 1) {
    const noiseN = Math.round((gain - 1) * 260);
    for (let n = 0; n < noiseN; n++) {
      const nx = (Math.random() * w) | 0;
      const ny = (Math.random() * h) | 0;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)';
      ctx.fillRect(nx, ny, 1.5, 1.5);
    }
  }
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
