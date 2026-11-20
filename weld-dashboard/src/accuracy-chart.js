/**
 * accuracy-chart.js — 质量指标区准确率迭代折线图
 *
 * 在 #accCanvas 上绘制 AI 检测准确率随迭代轮次增长的折线图，
 * 包含人工基准线、关键节点标注、渐变填充。
 * 静态图，只绘制一次。
 */

import { COLORS } from './config.js';
import { fitCanvasPadded } from './utils.js';

/**
 * 绘制准确率迭代图（静态）
 * @param {HTMLCanvasElement} canvas
 */
export function drawAccChart(canvas) {
  const { w, h } = fitCanvasPadded(canvas, 16);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const pad = { top: 15, right: 20, bottom: 25, left: 46 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  // 生成数据点：82% → 94%，40 轮
  const rounds = 40;
  const points = [];
  for (let i = 0; i <= rounds; i++) {
    const t = i / rounds;
    const base = 82 + (94 - 82) * t;
    const noise = Math.sin(t * 15) * 1.5 + (Math.random() - 0.5) * 1;
    points.push(base + noise);
  }

  const yMin = 75, yMax = 100;

  // 网格
  ctx.strokeStyle = 'rgba(30,41,59,0.6)';
  ctx.lineWidth = 0.5;
  ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = COLORS.muted;
  for (let v = 75; v <= 100; v += 5) {
    const y = pad.top + ch - ((v - yMin) / (yMax - yMin)) * ch;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(v + '%', pad.left - 6, y + 4);
  }

  // X 轴标注
  const xLabels = [1, 10, 20, 30, 40];
  for (let xi = 0; xi < xLabels.length; xi++) {
    const x = pad.left + (xLabels[xi] - 1) / (rounds - 1) * cw;
    ctx.textAlign = 'center';
    ctx.fillText('v' + xLabels[xi], x, h - 5);
  }

  // 人工基准线 87%
  const humanY = pad.top + ch - ((87 - yMin) / (yMax - yMin)) * ch;
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.setLineDash([6, 3]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, humanY);
  ctx.lineTo(pad.left + cw, humanY);
  ctx.stroke();
  ctx.setLineDash([]);
  // 标注加半透明底并上移到网格顶部，避免与上升曲线交叉
  const hText = '人工目检 87%';
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  const hw = ctx.measureText(hText).width + 12;
  const hx = pad.left + 4;
  const hy = 1;
  ctx.fillStyle = 'rgba(3,12,24,0.85)';
  ctx.fillRect(hx, hy, hw, 17);
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(hx, hy, hw, 17);
  ctx.fillStyle = 'rgba(203,213,225,0.9)';
  ctx.textAlign = 'center';
  ctx.fillText(hText, hx + hw / 2, hy + 12);

  // 折线
  const step = cw / rounds;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = pad.left + i * step;
    const y = pad.top + ch - ((points[i] - yMin) / (yMax - yMin)) * ch;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // 填充
  ctx.lineTo(pad.left + points.length * step - step, pad.top + ch);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  grad.addColorStop(0, 'rgba(34,197,94,0.12)');
  grad.addColorStop(1, 'rgba(34,197,94,0.01)');
  ctx.fillStyle = grad;
  ctx.fill();

  // 线条
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = pad.left + i * step;
    const y = pad.top + ch - ((points[i] - yMin) / (yMax - yMin)) * ch;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 关键节点
  const keyPoints = [
    { idx: 0,      val: 82, color: COLORS.yellow },
    { idx: rounds, val: 94, color: COLORS.green  },
  ];
  for (let ki = 0; ki < keyPoints.length; ki++) {
    const kp = keyPoints[ki];
    const kx = pad.left + kp.idx * step;
    const ky = pad.top + ch - ((kp.val - yMin) / (yMax - yMin)) * ch;
    ctx.beginPath();
    ctx.arc(kx, ky, 5, 0, Math.PI * 2);
    ctx.fillStyle = kp.color;
    ctx.fill();
    ctx.strokeStyle = COLORS.bg;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 终点光圈
  const endX = pad.left + rounds * step;
  const endY = pad.top + ch - ((94 - yMin) / (yMax - yMin)) * ch;
  ctx.beginPath();
  ctx.arc(endX, endY, 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34,197,94,0.15)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(endX, endY, 5, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.green;
  ctx.fill();
  ctx.strokeStyle = COLORS.bg;
  ctx.lineWidth = 2;
  ctx.stroke();
}
