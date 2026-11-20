/**
 * robot-arm.js — 机械臂联动剔除（改进 4）
 *
 * 检测区发现缺陷 → 机械臂运动到该工件位置 → 抓取剔除 → 放入废品区，
 * 在看板上以 4 阶段流水线动画呈现，并标注当前处理的工件编号。
 *
 * 该模块订阅 DEFECT 事件，与检测区形成因果关系；
 * 不再像旧版那样播放与检测无关的静态循环动画。
 */

import { $ } from './utils.js';
import { on, EVT } from './event-bus.js';

const STAGES = [
  { id: 'detect', label: '检测触发' },
  { id: 'move',   label: '机械臂定位' },
  { id: 'grab',   label: '抓取剔除' },
  { id: 'drop',   label: '放入废品区' },
];

let busy = false;
let queue = [];
let currentStage = 0;
let stageTimer = null;
let sweepRaf = null;

/**
 * 更新阶段高亮
 */
function setStage(idx) {
  currentStage = idx;
  document.querySelectorAll('.arm-stage').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    el.classList.toggle('done', i < idx);
  });

  const status = $('armStatus');
  if (status) {
    const labels = ['检测触发', '机械臂定位中', '抓取剔除中', '已放入废品区'];
    status.textContent = labels[idx];
  }
}

/**
 * 运行一次完整的剔除动作
 */
function runRejection(payload) {
  if (busy) {
    queue.push(payload);
    return;
  }
  busy = true;

  const wpEl = $('armWorkpiece');
  if (wpEl) wpEl.textContent = payload.workpieceId ? `#W${String(payload.workpieceId).padStart(4, '0')}` : '--';

  const typeEl = $('armDefectType');
  if (typeEl) {
    typeEl.textContent = payload.cn;
    typeEl.style.color = payload.color;
  }

  const badge = $('armWorkpieceBadge');
  if (badge) badge.classList.add('show');

  setStage(0);
  let step = 0;
  const advance = () => {
    step++;
    if (step < STAGES.length) {
      setStage(step);
      stageTimer = setTimeout(advance, step === 2 ? 900 : 750);
    } else {
      // 剔除计数由 sort-stats 统一维护（订阅 DEFECT 事件），此处不重复计数
      setTimeout(() => {
        if (badge) badge.classList.remove('show');
        setStage(0);
        busy = false;
        if (queue.length) runRejection(queue.shift());
      }, 900);
    }
  };
  stageTimer = setTimeout(advance, 750);
}

/**
 * 机械臂 SVG 小车位置的持续轻微扫动（叠加在阶段动画上）
 */
function startSweep() {
  const car = $('armCar');
  if (!car) return;
  const t0 = performance.now();
  const tick = (t) => {
    const phase = ((t - t0) / 2600) % 1;
    const x = 8 + phase * 150;
    car.setAttribute('transform', `translate(${x.toFixed(1)},0)`);
    sweepRaf = requestAnimationFrame(tick);
  };
  sweepRaf = requestAnimationFrame(tick);
}

/**
 * 初始化机械臂联动
 */
export function initRobotArm() {
  setStage(0);
  startSweep();
  on(EVT.DEFECT, runRejection);
}
