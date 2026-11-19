/**
 * animation-loop.js — 统一动画循环
 *
 * 使用 requestAnimationFrame 驱动三个 Canvas 的持续渲染：
 *   - RGB 采集画面
 *   - 深度图画面
 *   - YOLO 检测画面
 *
 * 各绘制函数由各自模块 export，此处统一调度。
 */

import { drawRgbFrame }     from './rgb-camera.js';
import { drawDepthFrame }   from './depth-camera.js';
import { drawDetectFrame }  from './defect-detect.js';
import { $ }                from './utils.js';

/**
 * 启动统一动画循环
 */
export function startAnimationLoop() {
  const rgbCanvas    = $('rgbCanvas');
  const depthCanvas  = $('depthCanvas');
  const detectCanvas = $('detectCanvas');

  function loop() {
    drawRgbFrame(rgbCanvas);
    drawDepthFrame(depthCanvas);
    drawDetectFrame(detectCanvas);
    requestAnimationFrame(loop);
  }

  loop();
}
