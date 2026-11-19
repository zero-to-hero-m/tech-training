/**
 * clock.js — 顶部时钟模块
 *
 * 负责 #clock 元素的实时时间更新。
 */

import { $, nowTimeString } from './utils.js';

/**
 * 启动时钟，每秒更新一次
 */
export function startClock() {
  const clockEl = $('clock');

  function tick() {
    clockEl.textContent = nowTimeString();
  }

  tick();
  setInterval(tick, 1000);
}
