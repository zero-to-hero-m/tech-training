/* ================================================================
 * 焊缝缺陷分析端数字化看板 - 演示动画逻辑
 * 四阶段自动演示：诊断 → 优化 → 验证 → 反馈
 * ================================================================ */

// ---- 工具函数 ----
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- DOM 引用 ----
const panels = document.querySelectorAll('.panel');
const pDiag = panels[0];
const pOpt = panels[2];
const pVal = panels[3];
const pFb = panels[4];
const loopNodes = document.querySelectorAll('.loop .node');
const loopArrows = document.querySelectorAll('.loop .arrow');

let runId = 0;

// ---- 数字滚动 ----
export function count(el, from, to, dur, fmt) {
  const t0 = performance.now();
  const id = runId;
  (function f(t) {
    if (id !== runId) return;
    const k = Math.min((t - t0) / dur, 1);
    const v = from + (to - from) * (1 - Math.pow(1 - k, 3));
    el.textContent = fmt(v);
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}

// ---- 打字机 ----
export async function type(el, text, dur, id) {
  el.innerHTML = '';
  const step = dur / text.length;
  for (let i = 0; i < text.length; i++) {
    if (id !== runId) return;
    el.innerHTML = text.slice(0, i + 1) + '<span class="caret">&nbsp;</span>';
    await sleep(step);
  }
  if (id === runId) el.innerHTML = text;
}

// ---- 阶段切换：顶栏流程节点 0-3 ----
export function stage(i) {
  loopNodes.forEach((n, k) => {
    n.classList.toggle('active', k === i);
    n.classList.toggle('done', k < i);
  });
  loopArrows.forEach((a, k) => a.classList.toggle('active', k < i));
  [pDiag, pOpt, pVal, pFb].forEach((p, k) => p.classList.toggle('stage-active', k === i));
}

// ---- 重置 ----
export function reset() {
  $('concl').innerHTML = '';
  $('llmStatus').innerHTML = '国产工业大模型 · 推理中<span class="stream">✦</span>';
  $('imgCnt').textContent = '0';
  $('pvCurrent').textContent = '120';
  $('peCurrent').textContent = '等待优化方案…';
  $('pvAngle').textContent = '偏差 2°';
  $('peAngle').textContent = '等待优化方案…';
  ['card1', 'card2'].forEach((i) => $(i).classList.remove('pop'));
  ['arrow1', 'arrow2'].forEach((i) => $(i).classList.remove('pulse'));
  $('barBefore').style.height = '0';
  $('barAfter').style.height = '0';
  $('vBefore').textContent = '0%';
  $('vAfter').textContent = '0%';
  $('dropNum').textContent = '0';
  ['lf1', 'lf2', 'lf3', 'lfa1', 'lfa2'].forEach((i) => $(i).classList.remove('lit'));
  ['sync1', 'sync2', 'sync3'].forEach((i) => $(i).classList.remove('done'));
  stage(-1);
  /* 缺陷分布条重新生长 */
  document.querySelectorAll('.dbar .fill').forEach((f, i) => {
    const w = f.style.width;
    f.style.transition = 'none';
    f.style.width = '0';
    setTimeout(() => {
      f.style.transition = 'width 1s ease';
      f.style.width = w;
    }, 400 + i * 250);
  });
}

// ---- 四阶段完整演示 ----
export async function demo() {
  const id = ++runId;
  reset();

  /* —— 阶段① 诊断 —— */
  stage(0);
  count($('imgCnt'), 0, 103, 1400, (v) => Math.round(v) + '+');
  await sleep(1600);
  if (id !== runId) return;
  await type(
    $('concl'),
    '诊断结论：咬边\n主因① 焊接电流偏移 +8A（偏大）\n主因② 焊枪角度偏差 2°'.replace(/\n/g, '<br>'),
    2600,
    id
  );
  if (id !== runId) return;
  $('concl').innerHTML =
    '诊断结论：<b>咬边</b><br>主因① 焊接电流偏移 <b>+8A（偏大）</b><br>主因② 焊枪角度偏差 <b>2°</b>';
  $('llmStatus').innerHTML = '国产工业大模型 · 诊断完成 ✓';
  await sleep(1200);
  if (id !== runId) return;

  /* —— 阶段② 优化 —— */
  stage(1);
  $('arrow1').classList.add('pulse');
  await sleep(500);
  if (id !== runId) return;
  $('card1').classList.add('pop');
  count($('pvCurrent'), 120, 128, 1200, (v) => Math.round(v));
  $('peCurrent').textContent = '按工艺知识库寻优';
  await sleep(900);
  if (id !== runId) return;
  $('arrow2').classList.add('pulse');
  $('card2').classList.add('pop');
  $('pvAngle').textContent = '修正 2°';
  $('peAngle').textContent = '回到工艺基准角度';
  await sleep(1600);
  if (id !== runId) return;

  /* —— 阶段③ 验证 —— */
  stage(2);
  $('barBefore').style.height = '130px';
  count($('vBefore'), 0, 13, 1200, (v) => Math.round(v) + '%');
  await sleep(1300);
  if (id !== runId) return;
  $('barAfter').style.height = '130px';
  await sleep(300);
  if (id !== runId) return;
  $('barAfter').style.height = '50px';
  count($('vAfter'), 13, 5, 1300, (v) => Math.round(v) + '%');
  count($('dropNum'), 0, 8, 1300, (v) => '-' + Math.round(v));
  await sleep(1800);
  if (id !== runId) return;

  /* —— 阶段④ 反馈 —— */
  stage(3);
  $('lf1').classList.add('lit');
  $('sync1').classList.add('done');
  await sleep(900);
  if (id !== runId) return;
  $('lfa1').classList.add('lit');
  $('lf2').classList.add('lit');
  $('sync2').classList.add('done');
  await sleep(900);
  if (id !== runId) return;
  $('lfa2').classList.add('lit');
  $('lf3').classList.add('lit');
  $('sync3').classList.add('done');
  await sleep(2000);
  if (id !== runId) return;

  /* 完成一轮：全部点亮后停留，再循环 */
  loopNodes.forEach((n) => {
    n.classList.remove('active');
    n.classList.add('done');
  });
  loopArrows.forEach((a) => a.classList.remove('active'));
  [pDiag, pOpt, pVal, pFb].forEach((p) => p.classList.remove('stage-active'));
  await sleep(5000);
  if (id === runId) demo();
}

// ---- 初始化入口 ----
export function init() {
  $('replayBtn').addEventListener('click', demo);
  demo();
}
