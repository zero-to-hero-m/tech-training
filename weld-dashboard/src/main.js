/**
 * main.js — 应用入口
 *
 * 聚合所有模块的初始化函数，统一启动。
 * HTML 通过 <script type="module" src="./main.js"> 加载此文件。
 *
 * 依赖链（无暗依赖，全部显式 import）：
 *
 *   main.js
 *   ├── config.js        (常量)
 *   ├── utils.js         (工具函数)
 *   ├── scale.js         (缩放) ← config
 *   ├── clock.js         (时钟) ← utils
 *   ├── rgb-camera.js    (RGB采集) ← config, utils
 *   ├── depth-camera.js  (深度图) ← config, utils, rgb-camera
 *   ├── defect-detect.js (YOLO检测) ← config, utils
 *   ├── yield-chart.js   (良品率) ← config, utils
 *   ├── accuracy-chart.js(准确率) ← config, utils
 *   ├── defect-stats.js  (缺陷统计) ← config, utils
 *   ├── equipment.js     (设备状态) ← utils
 *   ├── sort-stats.js    (分拣统计) ← config, utils
 *   └── animation-loop.js(动画循环) ← rgb-camera, depth-camera, defect-detect, utils
 */

import { initScale }           from './scale.js';
import { startClock }          from './clock.js';
import { initRgbCamera }       from './rgb-camera.js';
import { initDefectDetect }    from './defect-detect.js';
import { initYieldChart,
         redrawYieldChart }    from './yield-chart.js';
import { drawAccChart }        from './accuracy-chart.js';
import { initDefectStats }     from './defect-stats.js';
import { initEquipment }       from './equipment.js';
import { initSortStats }       from './sort-stats.js';
import { startAnimationLoop }  from './animation-loop.js';
import { $ }                   from './utils.js';

/**
 * 应用启动
 */
function main() {
  // 1. 看板缩放
  initScale();

  // 2. 时钟
  startClock();

  // 3. 初始化各业务模块
  initRgbCamera();
  initDefectDetect();
  initDefectStats();
  initEquipment();
  initSortStats();

  // 4. 图表（延迟以等待 DOM 布局）
  const yieldCanvas = $('yieldCanvas');
  const accCanvas   = $('accCanvas');

  initYieldChart(yieldCanvas);

  setTimeout(() => {
    drawAccChart(accCanvas);
    startAnimationLoop();
  }, 200);

  // 5. resize 重绘静态图表
  window.addEventListener('resize', () => {
    setTimeout(() => {
      drawAccChart(accCanvas);
      redrawYieldChart(yieldCanvas);
    }, 100);
  });
}

// DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
