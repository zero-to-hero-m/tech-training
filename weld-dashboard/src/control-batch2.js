/**
 * control-batch2.js — 交互控制第二批（增强与实验）
 *
 * 覆盖清单 9/14/15/16/17/18/19/20/21/22：
 *   - 相机曝光 / 增益调节（实时影响 RGB 成像）
 *   - 置信度阈值实验（同一批样本按不同阈值重判，观察检出数变化）
 *   - 缺陷占比饼图（Canvas 绘制）
 *   - 准确率迭代曲线（放大查看）
 *   - 人机对比（多维度视图）
 *   - 良品率监控启停
 *   - PLC 状态面板（点击设备卡调出）
 *   - 机械臂码垛演示
 *   - 气缸剔除演示
 *   - 设备报警触发与确认复位
 *
 * 设计原则同第一批：所有真实判定仍走 event-bus 既有闭环；
 * 本模块只负责「触发 + 呈现 + 状态」，不改动外观与图表展示层。
 */

import { $ } from './utils.js';
import { state, emit, on, EVT } from './event-bus.js';
import { COLORS, DEFECT_TYPES } from './config.js';
import { drawAccChart } from './accuracy-chart.js';

const byId = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ========== 复用第一批的 toast（通过事件总线解耦，避免重复实现） ==========
function toast(msg, type = 'info') {
  const stack = byId('toastStack');
  if (stack) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2400);
  }
  emit(EVT.TOAST, { msg, type });
}

// ========== 模态浮层开关 ==========
// 实验中心为主面板；子弹窗（饼图/曲线/对比/PLC）叠加其上。
// 打开子弹窗时暂存实验中心状态，关闭子弹窗后恢复，保证连续操作流畅。
let labWasOpen = false;
function openLab() {
  byId('b2ModalMask')?.classList.add('show');
  byId('labModal')?.classList.add('show');
}
function openSubModal(id) {
  const lab = byId('labModal');
  labWasOpen = !!lab && lab.classList.contains('show');
  if (labWasOpen) lab.classList.remove('show');
  byId('b2ModalMask')?.classList.add('show');
  byId(id)?.classList.add('show');
}
function closeSubModal(modalEl) {
  modalEl?.classList.remove('show');
  const lab = byId('labModal');
  if (labWasOpen && lab) { lab.classList.add('show'); labWasOpen = false; }
  else byId('b2ModalMask')?.classList.remove('show');
}
function closeAll() {
  byId('b2ModalMask')?.classList.remove('show');
  document.querySelectorAll('.b2-modal').forEach(m => m.classList.remove('show'));
  labWasOpen = false;
}

// ========== 9. 曝光 / 增益调节 ==========
function applyCameraParam() {
  const expEl = byId('sldExposure');
  const gainEl = byId('sldGain');
  state.exposure = expEl ? parseFloat(expEl.value) : 1;
  state.gain = gainEl ? parseFloat(gainEl.value) : 1;
  const expVal = byId('valExposure');
  const gainVal = byId('valGain');
  if (expVal) expVal.textContent = state.exposure.toFixed(2);
  if (gainVal) gainVal.textContent = state.gain.toFixed(2);
  // 进度条填充
  if (expEl) expEl.style.setProperty('--fill', `${(state.exposure - 0.4) / 1.4 * 100}%`);
  if (gainEl) gainEl.style.setProperty('--fill', `${(state.gain - 0.5) / 1.5 * 100}%`);
  emit(EVT.CAMERA_PARAM, { exposure: state.exposure, gain: state.gain });
}

// ========== 14. 置信度阈值实验 ==========
// 用一组"固定样本"模拟同一批数据在不同阈值下的检出数量变化
const THRESHOLD_SAMPLES = [
  0.97, 0.95, 0.93, 0.91, 0.90, 0.88, 0.86, 0.85, 0.83, 0.81,
  0.79, 0.77, 0.75, 0.72, 0.70, 0.68, 0.65, 0.62, 0.58, 0.55,
];

function renderThresholdExperiment() {
  const sld = byId('sldThreshold');
  const threshold = sld ? parseFloat(sld.value) : state.confThreshold;
  state.confThreshold = threshold;
  if (sld) sld.style.setProperty('--fill', `${(threshold - 0.3) / 0.6 * 100}%`);
  const valEl = byId('valThreshold');
  if (valEl) valEl.textContent = threshold.toFixed(2);

  // 统计：真实缺陷（conf>=0.55 视为样本中的缺陷）在各阈值下的检出/漏检
  const defectSamples = THRESHOLD_SAMPLES.filter(c => c >= 0.55); // 20 个缺陷样本
  const detected = defectSamples.filter(c => c >= threshold).length;
  const missed = defectSamples.length - detected;

  const detectedEl = byId('thDetected');
  const missedEl = byId('thMissed');
  const recallEl = byId('thRecall');
  if (detectedEl) detectedEl.textContent = detected;
  if (missedEl) missedEl.textContent = missed;
  if (recallEl) recallEl.textContent = `${Math.round(detected / defectSamples.length * 100)}%`;

  // 画出阈值轴上的样本点分布（检出=实心红，漏检=空心灰）
  drawThresholdDots(threshold);

  // 结论文字
  const hint = byId('thHint');
  if (hint) {
    if (threshold <= 0.5) hint.textContent = '阈值偏低：检出多、误报风险高（激进）';
    else if (threshold <= 0.75) hint.textContent = '阈值适中：兼顾检出与误报（推荐）';
    else hint.textContent = '阈值偏高：漏检多、更保守（精度优先）';
  }
  emit(EVT.THRESHOLD, { value: threshold, detected, missed });
}

function drawThresholdDots(threshold) {
  const canvas = byId('thresholdCanvas');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(200, rect.width - 20);
  canvas.height = 70;
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const padL = 10, padR = 10;
  const axisY = h * 0.62;
  const xOf = (v) => padL + ((v - 0.3) / 0.6) * (w - padL - padR);

  // 阈值竖线
  const tx = xOf(threshold);
  ctx.strokeStyle = 'rgba(56,189,248,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(tx, 8); ctx.lineTo(tx, h - 14); ctx.stroke();
  ctx.fillStyle = 'rgba(56,189,248,0.9)';
  ctx.font = '11px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`阈值 ${threshold.toFixed(2)}`, tx, h - 3);

  // 样本点
  THRESHOLD_SAMPLES.forEach((c, i) => {
    const x = xOf(c);
    const y = axisY - (i % 3) * 9;
    const detected = c >= threshold;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    if (detected) {
      ctx.fillStyle = 'rgba(248,113,113,0.9)';
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(15,23,42,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

// ========== 15. 缺陷占比饼图 ==========
function drawPieChart() {
  const canvas = byId('pieCanvas');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const size = Math.min(rect.width - 20, rect.height - 20, 300);
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2, r = size * 0.4;

  const burn = state.defects.filter(d => d.type === 'burn').length + 37; // 叠加初始基数
  const lack = state.defects.filter(d => d.type === 'lack').length + 29;
  const bite = state.defects.filter(d => d.type === 'bite').length + 23;
  const segs = [
    { label: '焊穿', value: burn, color: DEFECT_TYPES.burn.color },
    { label: '未焊透', value: lack, color: DEFECT_TYPES.lack.color },
    { label: '咬边', value: bite, color: DEFECT_TYPES.bite.color },
  ];
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  let start = -Math.PI / 2;
  segs.forEach(seg => {
    const ang = seg.value / total * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + ang);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,11,20,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    start += ang;
  });
  // 中心镂空
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#0b1422';
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 15px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(total), cx, cy - 2);
  ctx.font = '11px "PingFang SC", sans-serif';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText('缺陷总数', cx, cy + 14);

  // 图例
  const legend = byId('pieLegend');
  if (legend) {
    legend.innerHTML = segs.map(s => `
      <div class="pie-legend-item">
        <span class="pie-dot" style="background:${s.color}"></span>
        <span>${s.label}</span>
        <b>${s.value}</b>
        <span class="pie-pct">${Math.round(s.value / total * 100)}%</span>
      </div>`).join('');
  }
}

// ========== 18. 良品率监控启停 ==========
function toggleMonitor() {
  state.monitorRunning = !state.monitorRunning;
  emit(EVT.MONITOR, { running: state.monitorRunning });
  syncMonitorBtn();
  toast(state.monitorRunning ? '良品率实时监控已启动' : '良品率实时监控已暂停',
    state.monitorRunning ? 'success' : 'warn');
}
function syncMonitorBtn() {
  const btn = byId('btnMonitor');
  if (!btn) return;
  btn.textContent = state.monitorRunning ? '⏸ 暂停良品率监控' : '▶ 启动良品率监控';
  btn.classList.toggle('is-on', state.monitorRunning);
  const tag = document.querySelector('.p-yield .tag');
  if (tag) tag.textContent = state.monitorRunning ? '实时 · 可追溯' : '已暂停';
}

// ========== 20. 机械臂码垛演示 ==========
async function runStackDemo() {
  const wp = state.workpieceSeq + 1;
  emit(EVT.STACK, { workpieceId: wp });
  const badge = $('armWorkpieceBadge');
  const wpEl = $('armWorkpiece');
  const typeEl = $('armDefectType');
  const statusEl = $('armStatus');
  if (wpEl) wpEl.textContent = `#W${String(wp).padStart(4, '0')}`;
  if (typeEl) { typeEl.textContent = '良品'; typeEl.style.color = 'var(--green2)'; }
  if (badge) badge.classList.add('show');
  if (statusEl) statusEl.textContent = '码垛中';
  const stages = document.querySelectorAll('.arm-stage');
  for (let i = 0; i < stages.length; i++) {
    stages.forEach((el, j) => { el.classList.toggle('active', j === i); el.classList.toggle('done', j < i); });
    await sleep(420);
  }
  stages.forEach(el => { el.classList.remove('active'); el.classList.remove('done'); });
  state.stackCount++;
  if (badge) badge.classList.remove('show');
  if (statusEl) statusEl.textContent = '待机';
  toast(`良品 #W${String(wp).padStart(4, '0')} 已码垛入库（第 ${state.stackCount} 件演示）`, 'success');
}

// ========== 21. 气缸剔除演示 ==========
async function runCylinderDemo() {
  const wp = state.workpieceSeq + 1;
  const view = byId('cylinderStage');
  if (view) view.classList.add('firing');
  emit(EVT.CYLINDER, { workpieceId: wp, cn: '焊穿', color: DEFECT_TYPES.burn.color });
  toast(`气缸推出：缺陷件 #W${String(wp).padStart(4, '0')} 已剔除`, 'danger');
  await sleep(1200);
  if (view) view.classList.remove('firing');
}

// ========== 22. 设备报警触发与处置 ==========
function raiseAlarm(reason) {
  if (state.alarmActive) return;
  state.alarmActive = true;
  state.alarmReason = reason || '连续缺陷检出，超出工艺容忍';
  emit(EVT.ALARM, { active: true, reason: state.alarmReason });
  const bar = byId('alarmBar');
  const reasonEl = byId('alarmReason');
  if (reasonEl) reasonEl.textContent = state.alarmReason;
  if (bar) bar.classList.add('show');
  // 顶部状态总览同步
  const badge = document.querySelector('.header-right .item:nth-child(3) span');
  if (badge) { badge.textContent = '报警'; badge.style.color = 'var(--red2)'; }
  toast('设备报警：' + state.alarmReason, 'danger');
}
function clearAlarm() {
  state.alarmActive = false;
  state.alarmReason = '';
  emit(EVT.ALARM, { active: false, reason: '' });
  byId('alarmBar')?.classList.remove('show');
  const badge = document.querySelector('.header-right .item:nth-child(3) span');
  if (badge) { badge.textContent = '正常运行'; badge.style.color = 'var(--green2)'; }
  toast('报警已确认复位，设备恢复正常', 'success');
}

// ========== 19. PLC 状态面板 ==========
function renderPlcPanel() {
  const uptime = $('plcUptime')?.textContent || '4h 23min';
  const body = byId('plcPanelBody');
  if (!body) return;
  body.innerHTML = `
    <div class="b2-kv-grid">
      <div class="b2-kv"><span>型号</span><b>SIMATIC S7-1200</b></div>
      <div class="b2-kv"><span>运行状态</span><b style="color:var(--green2)">RUN</b></div>
      <div class="b2-kv"><span>扫描周期</span><b>12 ms</b></div>
      <div class="b2-kv"><span>上线时长</span><b>${uptime}</b></div>
      <div class="b2-kv"><span>CPU 负载</span><b>23%</b></div>
      <div class="b2-kv"><span>通信状态</span><b style="color:var(--green2)">PROFINET 正常</b></div>
    </div>
    <div class="b2-io-title">数字量输入 DI</div>
    <div class="b2-io-grid">
      <span class="io on">I0.0 传送带运行</span><span class="io on">I0.1 工件到位</span>
      <span class="io">I0.2 急停</span><span class="io on">I0.3 视觉触发</span>
    </div>
    <div class="b2-io-title">数字量输出 DO</div>
    <div class="b2-io-grid">
      <span class="io on">Q0.0 传送带使能</span><span class="io">Q0.1 气缸剔除</span>
      <span class="io on">Q0.2 指示灯</span><span class="io">Q0.3 蜂鸣器</span>
    </div>`;
}

// ========== 16/17. 准确率曲线 / 人机对比（放大查看，数据取自现状） ==========
function renderComparePanel() {
  const rows = [
    { dim: '检测准确率', ai: 94, human: 87, unit: '%' },
    { dim: '检测速度', ai: 92, human: 45, unit: '件/min' },
    { dim: '漏检率', ai: 3, human: 11, unit: '%', lowerBetter: true },
    { dim: '连续工作', ai: 100, human: 68, unit: '%' },
  ];
  const body = byId('comparePanelBody');
  if (!body) return;
  body.innerHTML = rows.map(r => {
    const max = Math.max(r.ai, r.human) || 1;
    return `<div class="b2-cmp-row">
      <div class="b2-cmp-label">${r.dim}</div>
      <div class="b2-cmp-bars">
        <div class="b2-cmp-bar ai"><span style="width:${r.ai / max * 100}%"></span><b>AI ${r.ai}${r.unit}</b></div>
        <div class="b2-cmp-bar human"><span style="width:${r.human / max * 100}%"></span><b>人工 ${r.human}${r.unit}</b></div>
      </div>
    </div>`;
  }).join('');
}

// ========== 事件绑定 ==========
function bindBatch2() {
  // 打开/关闭实验中心
  byId('btnLab')?.addEventListener('click', () => {
    openLab();
    applyCameraParam();
    renderThresholdExperiment();
    drawPieChart();
    syncMonitorBtn();
  });
  byId('b2ModalMask')?.addEventListener('click', closeAll);
  // 关闭按钮：子弹窗关闭后恢复实验中心；实验中心则全部关闭
  document.querySelectorAll('.b2-modal-close').forEach(el => el.addEventListener('click', (e) => {
    const modal = e.currentTarget.closest('.b2-modal');
    if (modal?.id === 'labModal') closeAll();
    else closeSubModal(modal);
  }));

  // 相机调参
  ['sldExposure', 'sldGain'].forEach(id => byId(id)?.addEventListener('input', applyCameraParam));
  byId('btnCameraReset')?.addEventListener('click', () => {
    if (byId('sldExposure')) byId('sldExposure').value = 1;
    if (byId('sldGain')) byId('sldGain').value = 1;
    applyCameraParam();
    toast('相机参数已复位为默认值', 'info');
  });

  // 置信度阈值
  byId('sldThreshold')?.addEventListener('input', renderThresholdExperiment);

  // 结果呈现：饼图刷新 / 准确率曲线 / 人机对比
  byId('btnPieRefresh')?.addEventListener('click', () => { drawPieChart(); openSubModal('pieModal'); });
  byId('btnShowAcc')?.addEventListener('click', () => {
    openSubModal('accModal');
    // 浮层显示后再按实际尺寸绘制，避免 0 宽高
    requestAnimationFrame(() => { const c = byId('accBigCanvas'); if (c) drawAccChart(c); });
  });
  byId('btnShowCompare')?.addEventListener('click', () => { renderComparePanel(); openSubModal('compareModal'); });

  // 良品率监控
  byId('btnMonitor')?.addEventListener('click', toggleMonitor);

  // PLC 状态：点击设备卡 PLC 或实验中心按钮
  byId('btnShowPlc')?.addEventListener('click', () => { renderPlcPanel(); openSubModal('plcModal'); });
  document.querySelector('.p-equip .equip-card:first-child')?.addEventListener('click', () => {
    renderPlcPanel(); openSubModal('plcModal');
  });

  // 执行机构：码垛 / 气缸
  byId('btnStack')?.addEventListener('click', runStackDemo);
  byId('btnCylinder')?.addEventListener('click', runCylinderDemo);

  // 报警：触发 / 确认复位
  byId('btnRaiseAlarm')?.addEventListener('click', () => raiseAlarm());
  byId('btnClearAlarm')?.addEventListener('click', clearAlarm);
  byId('btnConfirmAlarm')?.addEventListener('click', clearAlarm);

  // ESC 关闭弹窗
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
}

/**
 * 初始化第二批交互
 */
export function initControlBatch2() {
  bindBatch2();
  syncMonitorBtn();
  applyCameraParam();

  // 连续 3 件缺陷自动触发报警；合格工件重置连击计数
  let consecutive = 0;
  on(EVT.DEFECT, () => {
    consecutive++;
    if (consecutive >= 3 && !state.alarmActive) {
      raiseAlarm('连续 3 件缺陷检出，超出工艺容忍');
      consecutive = 0;
    }
  });
  on(EVT.OK, () => { consecutive = 0; });
}

// 供外部调用（报警演示按钮等）
export { raiseAlarm, clearAlarm };
