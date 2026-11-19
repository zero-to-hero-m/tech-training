/**
 * sort-stats.js — 分拣执行区计数
 *
 * 更新 #sortOkCount（码垛数）、#sortNgCount（剔除数），
 * 以及良品率统计中的 #okCount 和 #totalCount。
 */

import { INITIAL_COUNTS } from './config.js';
import { $, chance } from './utils.js';

// ========== 模块状态 ==========
let okCount = INITIAL_COUNTS.ok;
let ngCount = INITIAL_COUNTS.ng;

/**
 * 更新分拣计数并刷新所有关联 UI
 */
function updateCounts() {
  okCount++;
  if (chance(0.08)) ngCount++;

  $('okCount').textContent = okCount.toLocaleString();
  $('totalCount').textContent = (okCount + ngCount).toLocaleString();
  $('sortOkCount').textContent = okCount.toLocaleString();
  $('sortNgCount').textContent = ngCount;
}

/**
 * 初始化分拣统计模块
 */
export function initSortStats() {
  setInterval(updateCounts, 3000);
}
