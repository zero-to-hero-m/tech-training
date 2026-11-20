/**
 * sort-stats.js — 分拣统计（闭环事件驱动版）
 *
 * 旧版用随机定时器增加计数，与检测、分拣毫无关系。
 * 现在改为订阅检测事件：合格 → 码垛数 +1，缺陷 → 剔除数 +1，
 * 保证良品率、分拣、检测三处的数字始终自洽。
 */

import { INITIAL_COUNTS } from './config.js';
import { $ } from './utils.js';
import { on, EVT, state } from './event-bus.js';

let okCount = INITIAL_COUNTS.ok;
let ngCount = INITIAL_COUNTS.ng;

/**
 * 刷新所有关联 UI
 */
function refresh() {
  $('okCount').textContent = okCount.toLocaleString();
  $('totalCount').textContent = (okCount + ngCount).toLocaleString();
  $('sortOkCount').textContent = okCount.toLocaleString();
  $('sortNgCount').textContent = ngCount.toLocaleString();
}

/**
 * 合格品 → 码垛
 */
function onOk() {
  okCount++;
  state.okCount = okCount;
  refresh();
}

/**
 * 缺陷品 → 剔除
 */
function onDefect() {
  ngCount++;
  state.ngCount = ngCount;
  refresh();
}

/**
 * 初始化分拣统计
 */
export function initSortStats() {
  refresh();
  on(EVT.OK, onOk);
  on(EVT.DEFECT, onDefect);
}
