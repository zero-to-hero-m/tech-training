/**
 * control-center.js — 交互控制中心（第一批：核心闭环）
 *
 * 把看板从「自动播放的演示片」升级为「可操作的仿真控制台」：
 *   - 传送带启停：控制工件是否流动（停机则驻留，便于检测当前帧）
 *   - 拍照 / 连续采集×10：从 D435i 画面抓帧，形成待检批次
 *   - 彩色 / 深度图切换：切换采集区主视图
 *   - 加载 YOLO 模型：检测类操作的前置条件
 *   - 检测当前帧 / 批量检测：人工触发判定，命中则走既有事件闭环
 *   - 缺陷日志：右侧滑出抽屉，按类型/编号检索历史记录
 *
 * 所有判定结果仍通过 event-bus 广播，下游（统计/样本库/机械臂/分析端）
 * 无需改动即被驱动——外观与图表作为「结果展示层」保持不变。
 */

import { $ } from './utils.js';
import { state, emit, EVT } from './event-bus.js';
import { captureRgbFrame, captureBatch } from './rgb-camera.js';
import { detectCurrentFrame, detectBatchFrames } from './defect-detect.js';

const byId = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 批量操作进行中标志，避免重复点击
let capturing = false;
let detecting = false;
let loadingModel = false;
let logFilter = 'all';

// ========== 状态提示 toast ==========
function toast(msg, type = 'info') {
  const stack = byId('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2400);
  emit(EVT.TOAST, { msg, type });
}

// ========== 进度条（批量操作时显示） ==========
function setProgress(text, pct) {
  const box = byId('ctrlProgress');
  if (!box) return;
  if (text === null) {
    box.classList.remove('active');
    box.innerHTML = '';
    return;
  }
  box.classList.add('active');
  box.innerHTML = `<span class="pg-text">${text}</span><span class="pg-track"><span class="pg-fill" style="width:${pct}%"></span></span>`;
}

// ========== 按钮可用性 / 状态栏统一刷新 ==========
function updateControls() {
  const modelBtn = byId('btnLoadModel');
  const detectBtn = byId('btnDetect');
  const batchBtn = byId('btnBatchDetect');

  if (modelBtn) {
    modelBtn.disabled = state.modelLoaded || loadingModel;
    modelBtn.textContent = state.modelLoaded ? '✓ 模型已就绪' : (loadingModel ? '加载中…' : '加载模型');
    modelBtn.classList.toggle('is-ready', state.modelLoaded);
  }
  if (detectBtn) detectBtn.disabled = !state.modelLoaded || detecting;
  if (batchBtn) batchBtn.disabled = !state.modelLoaded || detecting || state.batch.length === 0;

  const beltBtn = byId('btnBelt');
  if (beltBtn) {
    beltBtn.textContent = state.beltRunning ? '⏸ 停止传送带' : '▶ 启动传送带';
    beltBtn.classList.toggle('is-on', state.beltRunning);
  }
  const viewBtn = byId('btnView');
  if (viewBtn) {
    viewBtn.textContent = state.viewMode === 'color' ? '◧ 切到深度图' : '◨ 切到彩色图';
    viewBtn.classList.toggle('is-on', state.viewMode === 'depth');
  }

  const badge = byId('batchBadge');
  if (badge) {
    badge.textContent = state.batch.length ? `待检 ${state.batch.length}` : '无待检批次';
    badge.classList.toggle('has-batch', state.batch.length > 0);
  }

  const status = byId('ctrlState');
  if (status) {
    const parts = [state.modelLoaded ? '模型就绪' : '模型未加载'];
    parts.push(state.beltRunning ? '传送带运行' : '传送带停止');
    if (state.batch.length) parts.push(`待检 ${state.batch.length}`);
    status.textContent = parts.join(' · ');
    status.classList.toggle('ready', state.modelLoaded);
  }
}

// ========== 6. 传送带启停 ==========
function toggleBelt() {
  state.beltRunning = !state.beltRunning;
  emit(EVT.BELT, { running: state.beltRunning });
  updateControls();
  toast(state.beltRunning ? '传送带已启动，工件开始流动' : '传送带已停止，工件驻留检测位',
    state.beltRunning ? 'success' : 'warn');
}

// ========== 快门反馈：在 RGB 画面上闪一下 ==========
function shutterFlash() {
  const view = document.querySelector('.cam-view.cam-rgb');
  if (!view) return;
  const flash = document.createElement('div');
  flash.className = 'shutter-flash';
  view.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}

// ========== 最近抓拍预览 ==========
function showShot(dataUrl, label) {
  const box = byId('shotPreview');
  if (!box) return;
  box.innerHTML = `<img src="${dataUrl}" alt="抓拍"><span>${label}</span>`;
  box.classList.add('has-shot');
}

// ========== 7. D435i 拍照 ==========
function takePhoto() {
  const workpieceId = state.workpieceSeq++;
  const dataUrl = captureRgbFrame();
  if (!dataUrl) {
    toast('画面尚未就绪，请稍后重试', 'warn');
    return;
  }
  const shot = { workpieceId, dataUrl, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) };
  state.photos.unshift(shot);
  if (state.photos.length > 30) state.photos.pop();
  showShot(dataUrl, `#W${String(workpieceId).padStart(4, '0')}`);
  shutterFlash();
  emit(EVT.PHOTO, shot);
  toast(`已抓拍 #W${String(workpieceId).padStart(4, '0')}`, 'success');
}

// ========== 8. 彩色 / 深度图切换 ==========
function toggleView() {
  state.viewMode = state.viewMode === 'color' ? 'depth' : 'color';
  const container = document.querySelector('.cam-container');
  if (container) container.classList.toggle('view-depth', state.viewMode === 'depth');
  emit(EVT.VIEW, { mode: state.viewMode });
  updateControls();
  toast(state.viewMode === 'depth' ? '已切换到深度图（焊缝轮廓起伏）' : '已切换到彩色图（外观缺陷）');
}

// ========== 10. 连续采集 10 件 ==========
async function runBatchCapture() {
  if (capturing) return;
  if (!state.beltRunning) {
    toast('请先启动传送带，让工件流过采集位', 'warn');
    return;
  }
  capturing = true;
  const btn = byId('btnBatch10');
  if (btn) btn.disabled = true;
  const shots = [];
  try {
    for (let i = 1; i <= 10; i++) {
      const shot = captureBatch(1)[0];
      shots.push(shot);
      state.photos.unshift({ workpieceId: shot.workpieceId, dataUrl: shot.dataUrl, time: shot.time });
      showShot(shot.dataUrl, `采集中 ${i}/10`);
      shutterFlash();
      setProgress(`连续采集 ${i}/10 件`, i * 10);
      await sleep(180);
    }
    state.batch = shots;
    emit(EVT.BATCH_CAPTURE, { count: shots.length });
    toast('采集完成：10 件工件进入待检批次', 'success');
  } finally {
    capturing = false;
    if (btn) btn.disabled = false;
    setProgress(null);
    updateControls();
  }
}

// ========== 11. 加载 YOLO 模型 ==========
async function loadModel() {
  if (state.modelLoaded || loadingModel) return;
  loadingModel = true;
  updateControls();
  setProgress('加载 YOLOv8 模型权重…', 5);
  await sleep(320);
  setProgress('加载 YOLOv8 模型权重…', 45);
  await sleep(420);
  setProgress('初始化推理引擎…', 80);
  await sleep(360);
  state.modelLoaded = true;
  loadingModel = false;
  emit(EVT.MODEL, { loaded: true });
  setProgress(null);
  updateControls();
  toast('YOLOv8 模型加载完成，检测功能已解锁', 'success');
}

// ========== 12. 检测当前帧 ==========
function detectFrame() {
  if (!state.modelLoaded) {
    toast('请先加载模型', 'warn');
    return;
  }
  const result = detectCurrentFrame();
  if (!result) {
    toast('检测区暂无工件，请先启动传送带', 'warn');
    return;
  }
  emit(EVT.DETECT, { result });
  if (byId('logDrawer')?.classList.contains('open')) renderLog();
  toast(result.type
    ? `检出 ${result.cn} · #W${String(result.workpieceId).padStart(4, '0')} · conf ${result.conf.toFixed(2)} · 已存证`
    : `#W${String(result.workpieceId).padStart(4, '0')} 判定合格`,
    result.type ? 'danger' : 'success');
}

// ========== 13. 批量检测并统计 ==========
async function runBatchDetect() {
  if (!state.modelLoaded) {
    toast('请先加载模型', 'warn');
    return;
  }
  if (state.batch.length === 0) {
    toast('暂无待检批次，请先连续采集 10 件', 'warn');
    return;
  }
  if (detecting) return;
  detecting = true;
  updateControls();
  const shots = [...state.batch];
  const stats = { total: shots.length, ok: 0, defect: 0, burn: 0, lack: 0, bite: 0 };
  try {
    for (let i = 0; i < shots.length; i++) {
      const s = detectBatchFrames([shots[i]]); // 逐张判定并广播，下游逐条更新
      stats.ok += s.ok; stats.defect += s.defect;
      stats.burn += s.burn; stats.lack += s.lack; stats.bite += s.bite;
      setProgress(`批量检测 ${i + 1}/${shots.length} 件`, Math.round((i + 1) / shots.length * 100));
      await sleep(200);
    }
    state.batch = [];
    emit(EVT.BATCH_DETECT, { stats });
    if (byId('logDrawer')?.classList.contains('open')) renderLog();
    toast(`批量检测完成：合格 ${stats.ok} / 缺陷 ${stats.defect}（焊穿${stats.burn} 未焊透${stats.lack} 咬边${stats.bite}）${stats.missed ? ` · 漏检 ${stats.missed}` : ''}`, 'success');
  } finally {
    detecting = false;
    setProgress(null);
    updateControls();
  }
}

// ========== 缺陷日志抽屉 ==========
function renderLog() {
  const list = byId('drawerList');
  if (!list) return;
  const kw = (byId('logSearch')?.value || '').trim().toLowerCase();
  let items = [...state.defects].reverse();
  if (logFilter !== 'all') items = items.filter(d => d.type === logFilter);
  if (kw) {
    items = items.filter((d) => {
      const seq = String(d.workpieceId);
      const padded = `#W${seq.padStart(4, '0')}`;
      const hay = `${seq} ${padded} ${d.cn || ''} ${d.type || ''} ${d.time || ''}`.toLowerCase();
      return hay.includes(kw);
    });
  }
  const countEl = byId('drawerCount');
  if (countEl) countEl.textContent = `${items.length} 条`;
  const footEl = byId('drawerFoot');
  if (footEl) footEl.textContent = `共 ${items.length} 条记录 · 数据来自实时检测判定`;

  if (items.length === 0) {
    list.innerHTML = '<div class="log-empty">暂无匹配记录</div>';
    return;
  }
  list.innerHTML = items.map((d) => {
    const isDefect = !!d.type;
    const color = isDefect ? d.color : '#4ade80';
    return `<div class="log-item ${isDefect ? 'ng' : 'ok'}">
      <div class="log-item-top">
        <span class="log-wp">#W${String(d.workpieceId).padStart(4, '0')}</span>
        <span class="log-type" style="color:${color}">${isDefect ? d.cn : '合格'}</span>
        <span class="log-time">${d.time || '--:--:--'}</span>
      </div>
      <div class="log-item-meta">
        <span>置信度 <b>${(d.conf ?? 0).toFixed(2)}</b></span>
        <span>${isDefect ? '已剔除 · 已存证' : '正常流转'}</span>
      </div>
    </div>`;
  }).join('');
}

function openLog() {
  renderLog();
  byId('logDrawer')?.classList.add('open');
  byId('drawerMask')?.classList.add('show');
  emit(EVT.LOG_CHANGED, { open: true });
}

function closeLog() {
  byId('logDrawer')?.classList.remove('open');
  byId('drawerMask')?.classList.remove('show');
}

// ========== 事件绑定 ==========
function bindControls() {
  byId('btnBelt')?.addEventListener('click', toggleBelt);
  byId('btnPhoto')?.addEventListener('click', takePhoto);
  byId('btnView')?.addEventListener('click', toggleView);
  byId('btnBatch10')?.addEventListener('click', runBatchCapture);
  byId('btnLoadModel')?.addEventListener('click', loadModel);
  byId('btnDetect')?.addEventListener('click', detectFrame);
  byId('btnBatchDetect')?.addEventListener('click', runBatchDetect);
  byId('btnLog')?.addEventListener('click', openLog);

  byId('drawerClose')?.addEventListener('click', closeLog);
  byId('drawerMask')?.addEventListener('click', closeLog);
  byId('logSearch')?.addEventListener('input', renderLog);
  byId('logFilterTabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    logFilter = btn.dataset.filter;
    byId('logFilterTabs').querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    renderLog();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLog();
  });

  // 缺陷入库后，若日志抽屉打开则实时刷新
  emit(EVT.LOG_CHANGED, { open: false });
}

/**
 * 初始化交互控制中心
 */
export function initControlCenter() {
  bindControls();
  updateControls();
  toast('交互控制台就绪：请先加载模型', 'info');
}
