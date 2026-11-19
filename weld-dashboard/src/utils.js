/**
 * utils.js — 通用工具函数
 *
 * 提供 DOM 查询、随机数、Canvas 尺寸适配等基础能力，
 * 被各业务模块按需 import。
 */

/**
 * 根据 id 获取 DOM 元素，带类型断言
 * @param {string} id
 * @returns {HTMLElement}
 */
export function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

/**
 * 获取指定秒数格式化的时间字符串 HH:MM:SS
 * @returns {string}
 */
export function nowTimeString() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * 随机浮点数 [min, max)
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randFloat(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * 随机整数 [min, max]
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randInt(min, max) {
  return Math.floor(randFloat(min, max + 1));
}

/**
 * 从数组中随机取一个元素
 * @param {Array<T>} arr
 * @returns {T}
 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 概率命中
 * @param {number} probability 0~1
 * @returns {boolean}
 */
export function chance(probability) {
  return Math.random() < probability;
}

/**
 * 将 canvas 尺寸适配到父元素的实际大小
 * @param {HTMLCanvasElement} canvas
 * @returns {{w: number, h: number}}
 */
export function fitCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  return { w: rect.width, h: rect.height };
}

/**
 * 将 canvas 适配到父元素，但减去 padding
 * @param {HTMLCanvasElement} canvas
 * @param {number} pad 减去的像素值
 * @returns {{w: number, h: number}}
 */
export function fitCanvasPadded(canvas, pad) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = rect.width - pad;
  const h = rect.height - pad;
  canvas.width = w;
  canvas.height = h;
  return { w, h };
}

/**
 * 将 hex 颜色转为 rgba 字符串
 * @param {string} hex  e.g. '#f87171'
 * @param {number} alpha 0~1
 * @returns {string} e.g. 'rgba(248,113,113,0.5)'
 */
export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
