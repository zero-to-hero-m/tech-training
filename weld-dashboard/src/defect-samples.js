/**
 * defect-samples.js — 缺陷样本库（改进 3）
 *
 * 每当 YOLO 检测到缺陷，自动"截取当前帧"生成一张缺陷缩略图，
 * 附带工件编号、缺陷类型、置信度、时间戳，存入样本库。
 * 看板展示最近若干张缩略图 + 样本库总量统计。
 *
 * 缩略图用离屏 canvas 绘制一张模拟的缺陷焊缝图（真实系统中为视频帧截图），
 * 数据全部来自检测事件，与检测区、机械臂、分析端保持同源。
 */

import { SAMPLE_CONFIG } from './config.js';
import { $, randFloat, fmtWorkpiece } from './utils.js';
import { on, EVT, state } from './event-bus.js';

// 缩略图配色（按缺陷类型）
const THEME = {
  burn: { c1: '#7f1d1d', c2: '#ef4444', name: '焊穿' },
  lack: { c1: '#7c2d12', c2: '#fb923c', name: '未焊透' },
  bite: { c1: '#0c4a6e', c2: '#38bdf8', name: '咬边' },
};

/**
 * 离屏生成一张"缺陷照片"缩略图，返回 dataURL
 */
function makeThumbnail(type, seed) {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 100;
  const ctx = c.getContext('2d');
  const theme = THEME[type];

  // 金属背景
  const bg = ctx.createLinearGradient(0, 0, 0, 100);
  bg.addColorStop(0, '#2a3340');
  bg.addColorStop(0.5, '#1b2330');
  bg.addColorStop(1, '#111823');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 100);

  // 金属纹理
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let y = 6; y < 100; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(160, y + randFloat(-2, 2));
    ctx.stroke();
  }

  // 焊缝
  const weldY = 52;
  ctx.strokeStyle = 'rgba(190,210,235,0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(8, weldY);
  ctx.lineTo(152, weldY);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220,235,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 10; x < 152; x += 3) {
    ctx.moveTo(x, weldY);
    ctx.lineTo(x + 1.5, weldY + Math.sin(x * 0.6 + seed) * 2);
  }
  ctx.stroke();

  // 缺陷形态
  const dx = 60 + (seed * 37) % 50;
  if (type === 'burn') {
    const g = ctx.createRadialGradient(dx, weldY, 1, dx, weldY, 16);
    g.addColorStop(0, 'rgba(0,0,0,0.95)');
    g.addColorStop(0.6, theme.c1);
    g.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(dx, weldY, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'lack') {
    ctx.fillStyle = theme.c1;
    ctx.fillRect(dx - 12, weldY - 3, 24, 6);
    ctx.strokeStyle = theme.c2;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(dx - 12, weldY - 3, 24, 6);
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = theme.c2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx - 20, weldY - 6);
    ctx.quadraticCurveTo(dx, weldY - 12, dx + 20, weldY - 6);
    ctx.stroke();
  }

  // 检测框
  ctx.strokeStyle = theme.c2;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dx - 24, weldY - 18, 48, 36);
  ctx.fillStyle = theme.c2;
  ctx.fillRect(dx - 24, weldY - 30, 44, 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${theme.name} ${randFloat(0.85, 0.98).toFixed(2)}`, dx - 22, weldY - 21);

  return c.toDataURL('image/png');
}

/**
 * 刷新样本库视图（缩略图 + 总量）
 */
function render() {
  const grid = $('sampleGrid');
  const totalEl = $('sampleTotal');
  if (totalEl) totalEl.textContent = state.sampleTotal.toLocaleString();

  if (!grid) return;
  if (state.defects.length === 0) {
    grid.innerHTML = '<div class="sample-empty">等待缺陷样本采集…</div>';
    return;
  }
  const recent = state.defects.slice(-SAMPLE_CONFIG.MAX_THUMBS).reverse();
  grid.innerHTML = recent.map((d, i) => `
    <div class="sample-thumb" style="--c:${d.color}" title="${fmtWorkpiece(d.workpieceId)} · ${d.cn} · conf ${d.conf.toFixed(2)}">
      <img src="${makeThumbnail(d.type, d.workpieceId + i)}" alt="${d.cn}">
      <div class="sample-overlay">
        <span class="sample-wp">${fmtWorkpiece(d.workpieceId)}</span>
        <span class="sample-time">${d.time}</span>
      </div>
      <span class="sample-type">${d.cn}</span>
    </div>
  `).join('');
}

/**
 * 接收缺陷事件：拍照入库
 */
function onDefect() {
  state.sampleTotal++;
  const totalEl = $('sampleTotal');
  if (totalEl) {
    totalEl.textContent = state.sampleTotal.toLocaleString();
    totalEl.classList.remove('bump');
    void totalEl.offsetWidth;
    totalEl.classList.add('bump');
  }
  render();
}

/**
 * 初始化样本库
 */
export function initDefectSamples() {
  // 用历史数据预填几张样本，让看板一打开就有内容
  const seedTypes = ['burn', 'lack', 'bite', 'burn', 'bite', 'lack'];
  seedTypes.forEach((t, i) => {
    const info = { burn: '#f87171', lack: '#fb923c', bite: '#38bdf8' };
    const cnMap = { burn: '焊穿', lack: '未焊透', bite: '咬边' };
    state.defects.push({
      workpieceId: 1336 + i,
      type: t,
      cn: cnMap[t],
      color: info[t],
      conf: randFloat(0.85, 0.98),
      time: `14:4${5 - i}:0${i}`,
    });
  });
  render();
  on(EVT.DEFECT, onDefect);
}
