/**
 * yield-chart.js — 良品率监控区折线图（工件可追溯版）
 *
 * 在 #yieldCanvas 上绘制实时滚动的良品率曲线。
 * 与旧版不同：每一次质量下降都由一次真实的缺陷检测事件驱动，
 * 并在曲线上标注对应的工件编号与缺陷类型（改进 1）。
 * 曲线下方 #yieldTrace 以徽标形式列出最近的缺陷工件，便于管理者追溯。
 */

import { COLORS, DEFECT_TYPES } from './config.js';
import { $, fitCanvas, fmtWorkpiece } from './utils.js';
import { on, EVT, state } from './event-bus.js';

// ========== 模块状态 ==========
const MAX_POINTS = 60;
let canvasRef = null;
// 每个点：{ v:数值, wp:工件编号|null, type:中文缺陷|null, color:颜色|null, conf:置信度|null }
let yieldData = [];
let traceQueue = [];   // 最近的缺陷工件 [{wp, type, color, conf}]

/**
 * 生成一个基线数据点
 */
function basePoint() {
  return {
    v: 94 + Math.random() * 4,
    wp: null, type: null, color: null, conf: null,
  };
}

/**
 * 初始化数据
 */
function initData() {
  yieldData = [];
  for (let i = 0; i < MAX_POINTS; i++) yieldData.push(basePoint());
}

/**
 * 绘制良品率图表
 */
function drawChart(canvas) {
  const { w, h } = fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const pad = { top: 26, right: 10, bottom: 20, left: 46 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const yMin = 80, yMax = 100;
  const yRange = yMax - yMin;
  const yOf = (v) => pad.top + ch - ((v - yMin) / yRange) * ch;
  const xOf = (i) => pad.left + i * (cw / (MAX_POINTS - 1));

  // 网格
  ctx.strokeStyle = 'rgba(30,41,59,0.6)';
  ctx.lineWidth = 0.5;
  ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = COLORS.muted;
  for (let v = 80; v <= 100; v += 5) {
    const y = yOf(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(v + '%', pad.left - 6, y + 4);
  }

  // 目标线 95% / 警戒线 90%
  const drawRefLine = (val, color, text) => {
    const y = yOf(val);
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawRefLine(95, 'rgba(34,197,94,0.3)');
  drawRefLine(90, 'rgba(245,158,11,0.3)');
  // 目标标签放到网格顶部留白处，加半透明底，避免压在折线上
  const tagText = '目标 95%';
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  const tagW = ctx.measureText(tagText).width + 12;
  const tagX = pad.left + cw - tagW;
  const tagY = 2;
  ctx.fillStyle = 'rgba(3,12,24,0.85)';
  ctx.fillRect(tagX, tagY, tagW, 17);
  ctx.strokeStyle = 'rgba(74,222,128,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(tagX, tagY, tagW, 17);
  ctx.fillStyle = 'rgba(74,222,128,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText(tagText, tagX + tagW / 2, tagY + 12);

  // 渐变填充
  ctx.beginPath();
  for (let i = 0; i < yieldData.length; i++) {
    const x = xOf(i), y = yOf(yieldData[i].v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.lineTo(xOf(yieldData.length - 1), pad.top + ch);
  ctx.lineTo(xOf(0), pad.top + ch);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  fillGrad.addColorStop(0, 'rgba(56,189,248,0.15)');
  fillGrad.addColorStop(1, 'rgba(56,189,248,0.01)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // 折线
  ctx.beginPath();
  for (let i = 0; i < yieldData.length; i++) {
    const x = xOf(i), y = yOf(yieldData[i].v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ===== 缺陷下降点标注：工件编号 + 缺陷类型 =====
  const annotated = [];
  for (let i = 0; i < yieldData.length; i++) {
    if (yieldData[i].wp != null) annotated.push(i);
  }
  // 只给最近 3 个缺陷点画文字标签，避免重叠；更早的仅画圆点
  const labelFrom = Math.max(0, annotated.length - 3);
  annotated.forEach((idx, order) => {
    const d = yieldData[idx];
    const x = xOf(idx), y = yOf(d.v);
    // 垂直引导虚线
    ctx.strokeStyle = d.color;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, pad.top + ch);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // 标记圆点
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.strokeStyle = COLORS.bg;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (order >= labelFrom) {
      const label = `${fmtWorkpiece(d.wp)} ${d.type}`;
      ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif';
      const tw = ctx.measureText(label).width + 10;
      let lx = x - tw / 2;
      lx = Math.max(pad.left, Math.min(lx, pad.left + cw - tw));
      const ly = Math.max(2, y - 24);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(lx, ly, tw, 17);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(label, lx + tw / 2, ly + 13);
    }
  });

  // 当前点脉冲
  const lastX = xOf(yieldData.length - 1);
  const lastY = yOf(yieldData[yieldData.length - 1].v);
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
 * 更新顶部数值：显示"今日累计良品率"（与良品/总数自洽），
 * 曲线本身展示近端波动，二者语义不同但共享同一检测事件源。
 */
let lastShownYield = null;
function updateHeader() {
  const valEl = $('yieldValue');
  const deltaEl = $('yieldDelta');
  if (!valEl || !deltaEl) return;

  const ok = state.okCount;
  const total = state.okCount + state.ngCount;
  const value = total > 0 ? (ok / total) * 100 : 0;

  valEl.textContent = value.toFixed(1);
  const delta = lastShownYield == null ? 0 : value - lastShownYield;
  lastShownYield = value;

  if (value >= 95) {
    valEl.style.color = COLORS.accent;
    deltaEl.style.color = COLORS.green2;
    deltaEl.textContent = (delta >= 0 ? '↑ ' : '↓ ') + Math.abs(delta).toFixed(2) + '%';
  } else if (value >= 90) {
    valEl.style.color = COLORS.yellow;
    deltaEl.style.color = COLORS.yellow;
    deltaEl.textContent = (delta >= 0 ? '↑ ' : '↓ ') + Math.abs(delta).toFixed(2) + '%';
  } else {
    valEl.style.color = COLORS.red2;
    deltaEl.style.color = COLORS.red2;
    deltaEl.textContent = '↓ 警报';
  }
}

/**
 * 刷新曲线下方的"缺陷工件追溯"徽标条
 */
function renderTrace() {
  const el = $('yieldTrace');
  if (!el) return;
  if (traceQueue.length === 0) {
    el.innerHTML = '<span class="trace-empty">本时段无质量波动 · 全部工件合格</span>';
    return;
  }
  el.innerHTML = traceQueue.map((t) => `
    <span class="trace-chip" style="--c:${t.color}">
      <span class="trace-arrow">↓</span>${fmtWorkpiece(t.wp)}
      <span class="trace-type">${t.type}</span>
    </span>
  `).join('');
}

/**
 * 推入一个数据点并重绘
 */
function pushPoint(point, canvas) {
  yieldData.shift();
  yieldData.push(point);
  updateHeader();
  drawChart(canvas);
}

/**
 * 接收缺陷事件：制造一次可见的良品率下降并关联工件
 */
function onDefect(payload) {
  if (!canvasRef) return;
  const lastV = yieldData[yieldData.length - 1].v;
  const drop = 1.6 + Math.random() * 1.6;           // 明显下降但可回升
  const next = Math.max(90, Math.min(99, lastV - drop));
  pushPoint({
    v: next,
    wp: payload.workpieceId,
    type: payload.cn,
    color: payload.color,
    conf: payload.conf,
  }, canvasRef);

  traceQueue.unshift({
    wp: payload.workpieceId,
    type: payload.cn,
    color: payload.color,
    conf: payload.conf,
  });
  if (traceQueue.length > 4) traceQueue.pop();
  renderTrace();
}

/**
 * 初始化良品率图表
 * @param {HTMLCanvasElement} canvas
 */
export function initYieldChart(canvas) {
  canvasRef = canvas;
  initData();
  renderTrace();
  updateHeader();
  setTimeout(() => drawChart(canvas), 100);

  // 常态采样：无缺陷时良品率缓慢回升（受监控开关控制）
  setInterval(() => {
    if (!canvasRef || !state.monitorRunning) return;
    const lastV = yieldData[yieldData.length - 1].v;
    const next = Math.max(90, Math.min(99, lastV + 0.25 + Math.random() * 0.45));
    pushPoint({ v: next, wp: null, type: null, color: null, conf: null }, canvasRef);
  }, 2600);

  // 监听缺陷事件（闭环：检测 → 质量追溯）
  on(EVT.DEFECT, onDefect);
}

/**
 * 重绘画布（供 resize 调用）
 */
export function redrawYieldChart(canvas) {
  canvasRef = canvas;
  drawChart(canvas);
}
