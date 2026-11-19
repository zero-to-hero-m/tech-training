/**
 * yield-chart.js — 良品率监控区折线图
 *
 * 在 #yieldCanvas 上绘制实时滚动的良品率曲线，
 * 包含目标线、警戒线、渐变填充、当前点脉冲。
 * 同时更新 #yieldValue、#yieldDelta、#okCount、#totalCount。
 */

import { COLORS } from './config.js';
import { $, fitCanvas } from './utils.js';

// ========== 模块状态 ==========
const MAX_POINTS = 60;
let yieldData = [];

/**
 * 初始化数据
 */
function initData() {
  yieldData = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    yieldData.push(94 + Math.random() * 4);
  }
}

/**
 * 绘制良品率图表
 */
function drawChart(canvas) {
  const { w, h } = fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const pad = { top: 10, right: 10, bottom: 20, left: 30 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const yMin = 80, yMax = 100;
  const yRange = yMax - yMin;

  // 网格
  ctx.strokeStyle = 'rgba(30,41,59,0.6)';
  ctx.lineWidth = 0.5;
  ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = COLORS.muted;
  for (let v = 80; v <= 100; v += 5) {
    const y = pad.top + ch - ((v - yMin) / yRange) * ch;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(v + '%', pad.left - 4, y + 3);
  }

  // 目标线 95%
  const targetY = pad.top + ch - ((95 - yMin) / yRange) * ch;
  ctx.strokeStyle = 'rgba(34,197,94,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(pad.left, targetY);
  ctx.lineTo(pad.left + cw, targetY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(74,222,128,0.5)';
  ctx.textAlign = 'left';
  ctx.fillText('目标 95%', pad.left + cw - 55, targetY - 4);

  // 警戒线 90%
  const warnY = pad.top + ch - ((90 - yMin) / yRange) * ch;
  ctx.strokeStyle = 'rgba(245,158,11,0.3)';
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(pad.left, warnY);
  ctx.lineTo(pad.left + cw, warnY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 曲线 + 渐变填充
  const step = cw / (MAX_POINTS - 1);

  // 填充
  ctx.beginPath();
  for (let i = 0; i < yieldData.length; i++) {
    const x = pad.left + i * step;
    const y = pad.top + ch - ((yieldData[i] - yMin) / yRange) * ch;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(pad.left + (yieldData.length - 1) * step, pad.top + ch);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  fillGrad.addColorStop(0, 'rgba(56,189,248,0.15)');
  fillGrad.addColorStop(1, 'rgba(56,189,248,0.01)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // 线
  ctx.beginPath();
  for (let i = 0; i < yieldData.length; i++) {
    const x = pad.left + i * step;
    const y = pad.top + ch - ((yieldData[i] - yMin) / yRange) * ch;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 当前点
  const lastX = pad.left + (yieldData.length - 1) * step;
  const lastY = pad.top + ch - ((yieldData[yieldData.length - 1] - yMin) / yRange) * ch;

  ctx.beginPath();
  ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(56,189,248,0.15)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.accent;
  ctx.fill();
}

/**
 * 更新良品率数据并刷新 UI
 */
function updateData(canvas) {
  const last = yieldData[yieldData.length - 1];
  let next = last + (Math.random() - 0.5) * 1.5;
  next = Math.max(88, Math.min(99, next));
  yieldData.shift();
  yieldData.push(next);

  const valEl = $('yieldValue');
  const deltaEl = $('yieldDelta');
  valEl.textContent = next.toFixed(1);

  if (next >= 95) {
    valEl.style.color = COLORS.accent;
    deltaEl.style.color = COLORS.green2;
    deltaEl.textContent = '↑ ' + (Math.random() * 0.5).toFixed(1) + '%';
  } else if (next >= 90) {
    valEl.style.color = COLORS.yellow;
    deltaEl.style.color = COLORS.yellow;
    deltaEl.textContent = '↓ ' + (Math.random() * 0.3).toFixed(1) + '%';
  } else {
    valEl.style.color = COLORS.red2;
    deltaEl.style.color = COLORS.red2;
    deltaEl.textContent = '↓ 警报';
  }

  drawChart(canvas);
}

/**
 * 初始化良品率图表
 * @param {HTMLCanvasElement} canvas
 */
export function initYieldChart(canvas) {
  initData();
  setTimeout(() => drawChart(canvas), 100);
  setInterval(() => updateData(canvas), 2000);
}

/**
 * 重绘画布（供 resize 调用）
 * @param {HTMLCanvasElement} canvas
 */
export function redrawYieldChart(canvas) {
  drawChart(canvas);
}
