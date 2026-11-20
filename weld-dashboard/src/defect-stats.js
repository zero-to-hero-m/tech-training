/**
 * defect-stats.js — 缺陷统计计数 + 占比进度条
 *
 * 管理 #cntBurn / #cntLack / #cntBite 计数器，
 * 以卡片内的细进度条呈现三类缺陷各自占比（避免原柱状图遮挡卡片数字），
 * 并处理底部 log 列表滚动。
 */

import { INITIAL_COUNTS } from './config.js';
import { $, fmtWorkpiece } from './utils.js';
import { on, EVT } from './event-bus.js';

// ========== 模块状态 ==========
let burnCount = INITIAL_COUNTS.burn;
let lackCount = INITIAL_COUNTS.lack;
let biteCount = INITIAL_COUNTS.bite;

/**
 * 更新三类缺陷的占比进度条（相对三类缺陷总数）
 */
function updateRatios() {
  const total = burnCount + lackCount + biteCount || 1;
  const set = (id, count) => {
    const el = $(id);
    if (el) el.style.width = ((count / total) * 100).toFixed(1) + '%';
  };
  set('ratioBurn', burnCount);
  set('ratioLack', lackCount);
  set('ratioBite', biteCount);
}

/**
 * 初始化占比进度条（带入场动画）
 */
function initRatios() {
  // 先清零，下一帧再撑到目标宽度，形成生长动画
  ['ratioBurn', 'ratioLack', 'ratioBite'].forEach((id) => {
    const el = $(id);
    if (el) el.style.width = '0%';
  });
  setTimeout(updateRatios, 300);
}

const TYPE_KEY = { burn: 'burn', lack: 'lack', bite: 'bite' };

/**
 * 追加一条检测日志到列表顶部
 */
function prependLog(payload) {
  const list = $('defectLog');
  if (!list) return;
  const isDefect = !!payload.type;
  const typeText = isDefect ? payload.cn : '合格';
  const typeColor = isDefect ? payload.color : 'var(--green2)';
  const item = document.createElement('div');
  item.className = 'defect-log-item';
  item.innerHTML = `
    <span class="ts">${payload.time}</span>
    <span class="id">${fmtWorkpiece(payload.workpieceId)}</span>
    <span class="type" style="color:${typeColor}">${typeText}</span>
    <span>conf ${payload.conf.toFixed(2)}</span>
  `;
  list.prepend(item);
  while (list.children.length > 6) list.removeChild(list.lastChild);
}

/**
 * 接收缺陷事件：计数 + 占比进度条 + 日志
 */
function onDefect(payload) {
  const key = TYPE_KEY[payload.type];
  const cntEl = $(`cnt${key.charAt(0).toUpperCase() + key.slice(1)}`);
  if (key === 'burn') burnCount++;
  else if (key === 'lack') lackCount++;
  else if (key === 'bite') biteCount++;
  const count = key === 'burn' ? burnCount : key === 'lack' ? lackCount : biteCount;
  if (cntEl) cntEl.textContent = count;
  updateRatios();
  prependLog(payload);
}

/**
 * 接收合格事件：仅记录日志
 */
function onOk(payload) {
  prependLog(payload);
}

/**
 * 初始化缺陷统计模块（改为事件驱动）
 */
export function initDefectStats() {
  initRatios();
  on(EVT.DEFECT, onDefect);
  on(EVT.OK, onOk);
}
