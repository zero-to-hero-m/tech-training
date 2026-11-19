/**
 * defect-stats.js — 缺陷统计计数 + 柱状图动画
 *
 * 管理 #cntBurn / #cntLack / #cntBite 计数器，
 * 驱动 #barBurn / #barLack / #barBite 柱状图高度动画，
 * 并处理底部 log 列表滚动。
 */

import { INITIAL_COUNTS } from './config.js';
import { $ } from './utils.js';

// ========== 模块状态 ==========
let burnCount = INITIAL_COUNTS.burn;
let lackCount = INITIAL_COUNTS.lack;
let biteCount = INITIAL_COUNTS.bite;

const BAR_MAX = 50;
const BAR_BASE_H = 100; // 像素

/**
 * 更新单个柱子高度
 * @param {string} barId
 * @param {number} count
 */
function updateBar(barId, count) {
  const bar = $(barId);
  const h = (count / BAR_MAX) * BAR_BASE_H;
  bar.style.height = h + 'px';
}

/**
 * 初始化柱状图（带入场动画）
 */
function initBars() {
  setTimeout(() => {
    updateBar('barBurn', burnCount);
    updateBar('barLack', lackCount);
    updateBar('barBite', biteCount);

    // 更新 bar-num 文本
    $('barBurn').querySelector('.bar-num').textContent = burnCount;
    $('barLack').querySelector('.bar-num').textContent = lackCount;
    $('barBite').querySelector('.bar-num').textContent = biteCount;
  }, 300);
}

/**
 * 启动缺陷计数定时增长
 */
function startCounter() {
  setInterval(() => {
    const r = Math.random();
    if (r < 0.3) {
      burnCount++;
      $('cntBurn').textContent = burnCount;
      $('barBurn').querySelector('.bar-num').textContent = burnCount;
      updateBar('barBurn', burnCount);
    } else if (r < 0.6) {
      lackCount++;
      $('cntLack').textContent = lackCount;
      $('barLack').querySelector('.bar-num').textContent = lackCount;
      updateBar('barLack', lackCount);
    } else if (r < 0.8) {
      biteCount++;
      $('cntBite').textContent = biteCount;
      $('barBite').querySelector('.bar-num').textContent = biteCount;
      updateBar('barBite', biteCount);
    }
  }, 5000);
}

/**
 * 初始化缺陷统计模块
 */
export function initDefectStats() {
  initBars();
  startCounter();
}
