/**
 * defect-distribution.js — 缺陷在工件序列中的分布图（分析端 / 改进 2）
 *
 * X 轴 = 工件编号，Y 轴 = 缺陷类型（三条泳道）。
 * 每一个缺陷检测事件都会在对应工件编号、对应泳道上落一个点。
 * 通过点的疏密可以看出"质量下降出现在第几个工件"——
 * 例如焊穿集中在某区间、咬边从某编号开始连续出现，
 * 为模具磨损、电极老化、参数漂移等根因分析提供依据。
 */

import { COLORS, DEFECT_TYPES } from './config.js';
import { fitCanvas, randFloat, fmtWorkpiece } from './utils.js';
import { on, EVT, state } from './event-bus.js';

const LANES = [
  { key: 'burn', cn: '焊穿',   color: DEFECT_TYPES.burn.color },
  { key: 'lack', cn: '未焊透', color: DEFECT_TYPES.lack.color },
  { key: 'bite', cn: '咬边',   color: DEFECT_TYPES.bite.color },
];

let canvasRef = null;
let points = [];          // { wp, type, conf }
let xMin = 1180, xMax = 1420;
let hoverIndex = -1;
let geom = null;          // 缓存最近一次 draw 的几何参数，供 mousemove 命中检测复用
                          // 关键：mousemove 绝不能调用 fitCanvas（它会重设 canvas.width/height 从而清空画布）

/**
 * 生成一段历史数据，构造可解释的缺陷集中分布：
 *  - 焊穿：1200~1250 集中爆发（疑似电极老化）
 *  - 未焊透：零散分布
 *  - 咬边：1340 之后连续出现（疑似焊枪角度漂移）
 */
function seedHistory() {
  points = [];
  for (let i = 0; i < 22; i++) {
    points.push({ wp: Math.round(randFloat(1200, 1252)), type: 'burn', conf: randFloat(0.85, 0.98) });
  }
  for (let i = 0; i < 11; i++) {
    points.push({ wp: Math.round(randFloat(1210, 1390)), type: 'lack', conf: randFloat(0.85, 0.96) });
  }
  for (let i = 0; i < 16; i++) {
    points.push({ wp: Math.round(randFloat(1338, 1400)), type: 'bite', conf: randFloat(0.86, 0.97) });
  }
}

/**
 * 绘制分布图
 */
function draw() {
  if (!canvasRef) return;
  const { w, h } = fitCanvas(canvasRef);
  const ctx = canvasRef.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const pad = { top: 14, right: 14, bottom: 26, left: 52 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const xOf = (wp) => pad.left + ((wp - xMin) / (xMax - xMin)) * cw;
  const laneH = ch / LANES.length;
  const yOf = (i) => pad.top + laneH * i + laneH / 2;

  // 缓存几何参数：mousemove 直接复用，避免重复调用 fitCanvas 清空画布
  geom = { pad, cw, ch, laneH, w, h };

  // 泳道背景
  LANES.forEach((lane, i) => {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.005)';
    ctx.fillRect(pad.left, pad.top + laneH * i, cw, laneH);
    ctx.strokeStyle = 'rgba(30,41,59,0.7)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + laneH * i);
    ctx.lineTo(pad.left + cw, pad.top + laneH * i);
    ctx.stroke();
    ctx.fillStyle = lane.color;
    ctx.font = 'bold 15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(lane.cn, pad.left - 8, yOf(i) + 5);
  });

  // 焊穿集中区间高亮（根因分析示例）
  const bx1 = xOf(1200), bx2 = xOf(1252);
  ctx.fillStyle = 'rgba(248,113,113,0.06)';
  ctx.fillRect(bx1, pad.top, bx2 - bx1, ch);
  ctx.strokeStyle = 'rgba(248,113,113,0.25)';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.strokeRect(bx1, pad.top, bx2 - bx1, ch);
  ctx.setLineDash([]);
  // 集中区注释移到图表左上留白处并加半透明底，避免压在散点上（右上留给"累计缺陷样本"）
  const noteText = '焊穿集中区 1200~1252';
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  const noteW = ctx.measureText(noteText).width + 12;
  const noteX = pad.left + 6;
  const noteY = pad.top + 1;
  ctx.fillStyle = 'rgba(3,12,24,0.85)';
  ctx.fillRect(noteX, noteY, noteW, 16);
  ctx.fillStyle = 'rgba(248,113,113,0.75)';
  ctx.textAlign = 'left';
  ctx.fillText(noteText, noteX + 6, noteY + 12);

  // X 轴刻度
  ctx.fillStyle = COLORS.muted;
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  for (let wp = 1200; wp <= 1400; wp += 50) {
    const x = xOf(wp);
    ctx.fillText(String(wp), x, h - 8);
    ctx.strokeStyle = 'rgba(30,41,59,0.5)';
    ctx.beginPath();
    ctx.moveTo(x, pad.top + ch);
    ctx.lineTo(x, pad.top + ch + 3);
    ctx.stroke();
  }
  // 轴名放到 X 轴右端上方一行，避开最左 1200 与最右 1400 两个刻度
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.muted;
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('工件编号 →', pad.left + cw, h - 22);

  // 散点
  points.forEach((p, idx) => {
    const lane = LANES.findIndex((l) => l.key === p.type);
    if (lane < 0) return;
    const x = xOf(p.wp);
    const jitter = Math.sin(idx * 12.9898) * laneH * 0.22;
    const y = yOf(lane) + jitter;
    const color = LANES[lane].color;
    const isHover = idx === hoverIndex;

    ctx.beginPath();
    ctx.arc(x, y, isHover ? 6 : 3.6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (isHover) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 悬浮标签
      const label = `${fmtWorkpiece(p.wp)} ${LANES[lane].cn}`;
      ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif';
      const tw = ctx.measureText(label).width + 12;
      let lx = x - tw / 2;
      lx = Math.max(pad.left, Math.min(lx, pad.left + cw - tw));
      const ly = Math.max(2, y - 26);
      ctx.fillStyle = 'rgba(6,11,20,0.95)';
      ctx.fillRect(lx, ly, tw, 19);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, ly, tw, 19);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(label, lx + tw / 2, ly + 14);
    }
  });

  // 右上角图例说明
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(248,113,113,0.7)';
  ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(`累计缺陷样本 ${points.length}`, pad.left + cw, pad.top + 14);
}

/**
 * 接收缺陷事件：在分布图上落点，必要时扩展 X 范围
 */
function onDefect(payload) {
  points.push({ wp: payload.workpieceId, type: payload.type, conf: payload.conf });
  if (payload.workpieceId > xMax) {
    xMax = payload.workpieceId + 20;
  }
  draw();
}

/**
 * 初始化缺陷分布图
 */
export function initDefectDistribution(canvas) {
  canvasRef = canvas;
  seedHistory();
  setTimeout(draw, 120);
  on(EVT.DEFECT, onDefect);

  // 鼠标悬浮查看具体工件
  canvas.addEventListener('mousemove', (e) => {
    if (!canvasRef || !geom) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // 复用 draw 缓存的几何参数；不要在这里调用 fitCanvas（重设尺寸会清空画布导致图表消失）
    const { pad, cw, laneH } = geom;

    let found = -1;
    points.forEach((p, idx) => {
      const lane = LANES.findIndex((l) => l.key === p.type);
      if (lane < 0) return;
      const x = pad.left + ((p.wp - xMin) / (xMax - xMin)) * cw;
      const jitter = Math.sin(idx * 12.9898) * laneH * 0.22;
      const y = pad.top + laneH * lane + laneH / 2 + jitter;
      if (Math.hypot(mx - x, my - y) < 9) found = idx;
    });
    if (found !== hoverIndex) {
      hoverIndex = found;
      draw();
    }
  });
  canvas.addEventListener('mouseleave', () => {
    if (hoverIndex !== -1) { hoverIndex = -1; draw(); }
  });
}

/**
 * 重绘（供 resize 调用）
 */
export function redrawDefectDistribution() {
  draw();
}
