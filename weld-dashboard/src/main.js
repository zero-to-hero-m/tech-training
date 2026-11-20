/**
 * main.js — 应用入口
 *
 * 聚合所有模块的初始化函数，统一启动。
 *
 * 架构（事件驱动的检测—分析双闭环）：
 *
 *   defect-detect.js  ──emit DEFECT/OK──▶  event-bus.js
 *                                            │
 *        ┌───────────────────────────────────┼───────────────────────────┐
 *        ▼               ▼                   ▼              ▼            ▼
 *   defect-stats   defect-samples       robot-arm      yield-chart   sort-stats
 *   (计数/日志)    (拍照入库)           (联动剔除)      (工件追溯)     (码垛/剔除)
 *                                                                          │
 *                          ┌───────────────────────────────────────────────┘
 *                          ▼
 *                   analysis.js (诊断/工艺参数/优化建议)
 *
 *   defect-distribution.js ── 订阅 DEFECT ──▶ 工件序列缺陷分布（趋势分析）
 */

import { initScale }               from './scale.js';
import { startClock }              from './clock.js';
import { initRgbCamera }           from './rgb-camera.js';
import { initDefectDetect }        from './defect-detect.js';
import { initYieldChart,
         redrawYieldChart }        from './yield-chart.js';
import { drawAccChart }            from './accuracy-chart.js';
import { initDefectStats }         from './defect-stats.js';
import { initEquipment }           from './equipment.js';
import { initDefectSamples }       from './defect-samples.js';
import { initRobotArm }            from './robot-arm.js';
import { initDefectDistribution,
         redrawDefectDistribution } from './defect-distribution.js';
import { initAnalysis }            from './analysis.js';
import { initSortStats }           from './sort-stats.js';
import { startAnimationLoop }      from './animation-loop.js';
import { initUIAnimations }        from './ui-animation.js';
import { initControlCenter }       from './control-center.js';
import { initControlBatch2 }       from './control-batch2.js';
import { initControlBatch3 }       from './control-batch3.js';
import { $ }                       from './utils.js';

/**
 * 应用启动
 */
function main() {
  // 1. 看板缩放
  initScale();

  // 2. 时钟
  startClock();

  // 3. 初始化各业务模块（先建立事件订阅，再启动检测动画）
  initRgbCamera();
  initDefectStats();
  initEquipment();
  initSortStats();
  initDefectSamples();
  initRobotArm();
  initAnalysis();
  initDefectDetect();   // 检测源最后初始化，确保订阅者已就绪

  // 4. 图表（延迟以等待 DOM 布局）
  const yieldCanvas = $('yieldCanvas');
  const accCanvas   = $('accCanvas');
  const distCanvas  = $('distCanvas');

  initYieldChart(yieldCanvas);
  initDefectDistribution(distCanvas);

  setTimeout(() => {
    drawAccChart(accCanvas);
    startAnimationLoop();
  }, 200);

  // 6. 交互控制中心（传送带/拍照/采集/检测/日志）
  initControlCenter();
  initControlBatch2();   // 第二批：调参/阈值/饼图/对比/监控/码垛/气缸/报警
  initControlBatch3();   // 第三批：语音/文本检索/四模态联动/DIY布局/双屏联动

  // 7. 界面入场动画（等柱状图初始高度 ~300ms 设置完成后再启动）
  setTimeout(() => {
    initUIAnimations();
  }, 400);

  // 5. resize 重绘静态/画布图表
  window.addEventListener('resize', () => {
    setTimeout(() => {
      drawAccChart(accCanvas);
      redrawYieldChart(yieldCanvas);
      redrawDefectDistribution();
    }, 100);
  });
}

// DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
