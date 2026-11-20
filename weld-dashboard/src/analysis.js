/**
 * analysis.js — 分析端（改进 5）：缺陷诊断 + 工艺参数监控 + 优化建议
 *
 * eduplus 双闭环的后半段：检测发现问题 → 分析原因 → 优化工艺 → 验证反馈。
 * 本模块订阅缺陷事件，当缺陷出现时：
 *  1. 缺陷诊断区高亮成因分析（按缺陷类型）
 *  2. 工艺参数监控区标注参数异常点
 *  3. 优化建议区给出对应的工艺调整建议
 */

import { DIAGNOSIS, PROCESS_PARAMS, DEFECT_TYPES } from './config.js';
import { $, randFloat, fmtWorkpiece } from './utils.js';
import { on, EVT } from './event-bus.js';

// 工艺参数实时状态
const params = {};
Object.keys(PROCESS_PARAMS).forEach((k) => {
  params[k] = PROCESS_PARAMS[k].base;
});

let anomalyTimer = null;

/**
 * 渲染三张缺陷诊断卡
 */
function renderDiagnosisCards() {
  const wrap = $('diagnosisCards');
  if (!wrap) return;
  wrap.innerHTML = Object.keys(DIAGNOSIS).map((key) => {
    const d = DIAGNOSIS[key];
    const info = DEFECT_TYPES[key];
    const causes = d.causes.map((c) => `<span class="cause">${c}</span>`).join('');
    return `
      <div class="diag-card" data-type="${key}" style="--c:${info.color}">
        <div class="diag-head">
          <span class="diag-name">${info.cn}</span>
          <span class="diag-param">关联参数 · ${d.param}</span>
        </div>
        <div class="diag-causes">${causes}</div>
      </div>
    `;
  }).join('');
}

/**
 * 渲染工艺参数条
 */
function renderParams() {
  Object.keys(PROCESS_PARAMS).forEach((key) => {
    const cfg = PROCESS_PARAMS[key];
    const valEl = $(`param-${key}`);
    const barEl = $(`paramBar-${key}`);
    if (!valEl || !barEl) return;
    valEl.textContent = params[key].toFixed(cfg.unit === 'V' ? 1 : 1);
    const pct = ((params[key] - cfg.min) / (cfg.max - cfg.min)) * 100;
    barEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
    const over = params[key] >= cfg.warn;
    barEl.classList.toggle('warn', over);
  });
}

/**
 * 参数缓慢波动（正常生产时的实时感）
 */
function driftParams() {
  Object.keys(PROCESS_PARAMS).forEach((key) => {
    const cfg = PROCESS_PARAMS[key];
    let next = params[key] + randFloat(-0.8, 0.8);
    next = Math.max(cfg.min, Math.min(cfg.warn - 0.3, next));
    params[key] = next;
  });
  renderParams();
}

/**
 * 缺陷出现时：制造参数异常 → 诊断高亮 → 给出建议
 */
function onDefect(payload) {
  const d = DIAGNOSIS[payload.type];
  if (!d) return;

  // (1) 缺陷诊断：根据缺陷类型高亮成因卡
  document.querySelectorAll('.diag-card').forEach((el) => {
    el.classList.toggle('active', el.dataset.type === payload.type);
  });

  // (2) 工艺参数：把关联参数推到异常区间，标注异常点
  const paramKey = d.param === '电流' ? 'current' : 'voltage';
  const cfg = PROCESS_PARAMS[paramKey];
  params[paramKey] = Math.min(cfg.max, cfg.warn + randFloat(0.4, 1.2));
  renderParams();

  const pWrap = $(`paramWrap-${paramKey}`);
  if (pWrap) {
    pWrap.classList.add('anomaly');
    setTimeout(() => pWrap.classList.remove('anomaly'), 2600);
  }

  // 在参数区写入异常标注文字
  const note = $('paramAnomalyNote');
  if (note) {
    note.innerHTML = `<span class="anomaly-dot"></span> ${fmtWorkpiece(payload.workpieceId)} · ${payload.cn} → ${cfg.label}${params[paramKey] >= cfg.warn ? '偏高' : '异常'}`;
    note.classList.add('show');
    clearTimeout(anomalyTimer);
    anomalyTimer = setTimeout(() => note.classList.remove('show'), 2600);
  }

  // (3) 优化建议：展示成因与建议
  const adviceEl = $('adviceText');
  const causeEl = $('adviceCause');
  const wpEl = $('adviceWorkpiece');
  if (causeEl) causeEl.textContent = d.causes.join(' / ');
  if (adviceEl) adviceEl.textContent = d.advice;
  if (wpEl) wpEl.textContent = fmtWorkpiece(payload.workpieceId);

  const panel = $('advicePanel');
  if (panel) {
    panel.classList.remove('flash');
    void panel.offsetWidth;
    panel.classList.add('flash');
  }
}

/**
 * 初始化分析端
 */
export function initAnalysis() {
  renderDiagnosisCards();
  renderParams();
  setInterval(driftParams, 3000);
  on(EVT.DEFECT, onDefect);
}
