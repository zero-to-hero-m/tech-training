/**
 * ui-animation.js — 基于 anime.js 的界面入场与环境动效
 *
 * 职责：
 *   1. 面板/标题错峰入场（淡入 + 上浮 + 轻微缩放）
 *   2. 关键数字滚动计数（良品率、缺陷计数、样本总数、计数徽标）
 *   3. 柱状图从 0 长到目标高度
 *   4. 环境动效：角标呼吸、header 徽章、全局光晕漂浮
 *
 * 设计原则：
 *   - 只做「一次性入场」或「纯装饰」动画，不接管业务模块持续更新的 DOM。
 *   - 业务模块（defect-stats / analysis / sort-stats 等）在各自事件里
 *     通过 textContent / style 更新数值，本模块在入场结束后即"功成身退"。
 *   - anime.js 通过 <script> 全局引入， exposed as window.anime。
 */

const anime = window.anime;

/** 数字滚动：从 0 动画到元素的当前文本值，自动保留前后缀（如 % + 等） */
function countUp(el, { duration = 1400, decimals = 0, delay = 0 } = {}) {
  if (!el) return;
  const text = (el.textContent || '').trim();

  // 拆分出：前缀 / 数字 / 后缀
  const m = text.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return;
  let [, prefix = '', numStr = '', suffix = ''] = m;
  const cleanNum = numStr.replace(/,/g, '');
  const target = parseFloat(cleanNum);
  if (isNaN(target)) return;

  // 小数位数：显式指定优先，否则按原文推断
  const digits = decimals > 0 ? decimals : (cleanNum.includes('.') ? cleanNum.split('.')[1].length : 0);

  const obj = { v: 0 };
  anime({
    targets: obj,
    v: target,
    duration,
    delay,
    easing: 'easeOutExpo',
    update: () => {
      let val = digits > 0 ? obj.v.toFixed(digits) : String(Math.round(obj.v));
      const [int, dec] = val.split('.');
      const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + dec : '');
      el.textContent = prefix + formatted + suffix;
    },
    complete: () => {
      // 精确还原为原始文本，避免浮点误差
      el.textContent = text;
    },
  });
}

/** 入场：整体面板错峰淡入上浮 */
function entrance() {
  const ease = 'easeOutExpo';

  // 顶部标题栏
  anime({
    targets: '.header',
    opacity: [0, 1],
    translateY: [-24, 0],
    duration: 900,
    easing: ease,
  });

  // 标题 logo 弹入
  anime({
    targets: '.header-logo',
    scale: [0.4, 1],
    rotate: [-25, 0],
    opacity: [0, 1],
    duration: 1000,
    delay: 150,
    easing: 'easeOutBack',
  });

  // 两条带标签
  anime({
    targets: '.band-label',
    opacity: [0, 1],
    translateX: [-18, 0],
    duration: 700,
    delay: anime.stagger(120, { start: 200 }),
    easing: ease,
  });

  // 全部面板（普通 panel + 堆叠 sub-panel），按出现顺序错峰
  const panels = document.querySelectorAll('.panel:not(.stack), .sub-panel');
  anime({
    targets: panels,
    opacity: [0, 1],
    translateY: [26, 0],
    scale: [0.97, 1],
    duration: 850,
    delay: anime.stagger(70, { start: 320 }),
    easing: ease,
    complete: () => {
      // 动画结束后清除 transform，避免影响 hover 的 translateY
      panels.forEach(p => { p.style.transform = ''; });
    },
  });

  // 面板内部标题依次轻微滑入
  anime({
    targets: '.panel-title',
    opacity: [0, 1],
    translateX: [-10, 0],
    duration: 600,
    delay: anime.stagger(45, { start: 520 }),
    easing: ease,
  });

  // 底部底线栏
  anime({
    targets: '.footer',
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 800,
    delay: 700,
    easing: ease,
  });
}

/** 数字滚动计数（在入场后触发） */
function numberRoll() {
  // 良品率（保留 1 位小数 + %）
  countUp(document.getElementById('yieldValue'), { decimals: 1, duration: 1600, delay: 600 });
  // 缺陷计数
  ['cntBurn', 'cntLack', 'cntBite'].forEach((id, i) => {
    countUp(document.getElementById(id), { duration: 1300, delay: 700 + i * 120 });
  });
  // 累计良品 / 总检
  countUp(document.getElementById('okCount'), { duration: 1600, delay: 750 });
  countUp(document.getElementById('totalCount'), { duration: 1600, delay: 750 });
  // 分拣计数
  countUp(document.getElementById('sortOkCount'), { duration: 1600, delay: 800 });
  countUp(document.getElementById('sortNgCount'), { duration: 1600, delay: 800 });
  // 样本总量
  countUp(document.getElementById('sampleTotal'), { duration: 1700, delay: 850 });
  // 质量指标对比值（AI / 人工 / 迭代轮次）
  document.querySelectorAll('.compare-value').forEach((el, i) => {
    countUp(el, { duration: 1400, delay: 900 + i * 120 });
  });
}

/** 缺陷卡片占比进度条错峰显现（宽度由 defect-stats 的 CSS transition 驱动生长） */
function barsGrow() {
  const fills = document.querySelectorAll('.defect-card .ratio-track');
  if (!fills.length) return;
  anime({
    targets: fills,
    opacity: [0, 1],
    duration: 700,
    delay: anime.stagger(130, { start: 850 }),
    easing: 'easeOutQuad',
  });
}

/** 环境 / 氛围动效（持续循环） */
function ambience() {
  // 缺陷卡片轻微呼吸式明暗（仅装饰，不改数值）
  anime({
    targets: '.defect-card',
    boxShadow: [
      '0 4px 12px rgba(0,0,0,0.25)',
      '0 6px 22px rgba(56,189,248,0.16), 0 4px 12px rgba(0,0,0,0.3)',
      '0 4px 12px rgba(0,0,0,0.25)',
    ],
    duration: 3200,
    delay: anime.stagger(300),
    loop: true,
    easing: 'easeInOutSine',
  });

  // 统计大数字轻微脉冲缩放（良品率）
  const yieldEl = document.getElementById('yieldValue');
  if (yieldEl) {
    anime({
      targets: yieldEl,
      scale: [1, 1.035, 1],
      duration: 3600,
      loop: true,
      easing: 'easeInOutSine',
    });
  }

  // 样本总量呼吸辉光
  const sampleEl = document.getElementById('sampleTotal');
  if (sampleEl) {
    anime({
      targets: sampleEl,
      opacity: [1, 0.78, 1],
      duration: 2800,
      loop: true,
      easing: 'easeInOutSine',
    });
  }
}

/**
 * 初始化界面动画
 * anime.js 加载失败时降级：直接把所有元素设为可见，保证看板可用。
 */
export function initUIAnimations() {
  if (!anime) {
    // 降级：清除入场隐藏态
    document.querySelectorAll(
      '.header, .band-label, .panel:not(.stack), .sub-panel, .footer'
    ).forEach(el => { el.style.opacity = '1'; });
    return;
  }
  entrance();
  numberRoll();
  barsGrow();
  ambience();
}
