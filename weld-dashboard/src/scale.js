/**
 * scale.js — 看板自适应缩放模块
 *
 * 将 1920x1080 固定画布按窗口比例缩放并居中。
 */

import { DASHBOARD } from './config.js';

/**
 * 根据窗口大小缩放看板
 */
export function scaleDashboard() {
  const dw = DASHBOARD.WIDTH;
  const dh = DASHBOARD.HEIGHT;
  const ww = window.innerWidth;
  const wh = window.innerHeight;

  const scale = Math.min(ww / dw, wh / dh);

  const dash = document.getElementById('dashboard');
  if (!dash) return;

  dash.style.transform = `scale(${scale})`;
  dash.style.position = 'absolute';
  dash.style.left = `${(ww - dw * scale) / 2}px`;
  dash.style.top  = `${(wh - dh * scale) / 2}px`;
}

/**
 * 初始化缩放 + 监听 resize
 */
export function initScale() {
  scaleDashboard();
  window.addEventListener('resize', scaleDashboard);
}
