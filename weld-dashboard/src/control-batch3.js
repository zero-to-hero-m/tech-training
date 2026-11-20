/**
 * control-batch3.js — 交互控制第三批（多模态进阶）
 *
 * 覆盖清单 34/35/36/37/38，定位为「演示级模拟」：
 *   - 34 语音查询：Web Speech API 识别语音；不支持/无权限时降级为预设语句模拟
 *   - 35 文本跨模态检索：关键词过滤缺陷记录，文字 + 缩略图 + 日志同时带出
 *   - 36 四模态联动：以图为入口，联动语音描述 / 文本记录 / 统计 / 检测数据
 *   - 37 看板 DIY 布局：拖拽交换面板位置 + 尺寸预设 + localStorage 保存/重置
 *   - 38 双屏联动：BroadcastChannel 多窗口同步 + ?role=screen 大屏模式
 *
 * 设计原则同前两批：不改动现有外观与图表展示层，只做「触发 + 呈现 + 状态」；
 * 检索与联动的数据源统一来自 event-bus 的 state.defects（真实检测留痕）。
 */

import { $ } from './utils.js';
import { state, emit, on, EVT } from './event-bus.js';
import { DEFECT_TYPES, DIAGNOSIS } from './config.js';

const byId = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fmt = (seq) => `#W${String(seq).padStart(4, '0')}`;

// ========== toast（复用事件总线解耦） ==========
function toast(msg, type = 'info') {
  const stack = byId('toastStack');
  if (stack) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2400);
  }
  emit(EVT.TOAST, { msg, type });
}

// ========================================================================
// 多模态中心（主弹窗 + Tab 切换）
// ========================================================================
let mmMask, mmModal;

function openMultiModal(tab = 'voice') {
  mmMask = byId('mmModalMask');
  mmModal = byId('mmModal');
  mmMask?.classList.add('show');
  mmModal?.classList.add('show');
  switchTab(tab);
  if (tab === 'image') renderImageWall();
  if (tab === 'layout') syncLayoutToolbar();
  if (tab === 'sync') refreshSyncPanel();
  emit(EVT.MULTIMODAL, { tab });
}
function closeMultiModal() {
  mmMask?.classList.remove('show');
  mmModal?.classList.remove('show');
  stopVoice();
}
function switchTab(tab) {
  document.querySelectorAll('.mm-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.mm-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
  if (tab === 'image') renderImageWall();
  if (tab === 'layout') syncLayoutToolbar();
  if (tab === 'sync') refreshSyncPanel();
}

// ========================================================================
// 34. 语音查询
// ========================================================================
const VOICE_PRESETS = [
  '查一下焊穿缺陷',
  '查找最近的不焊透记录',
  '显示咬边缺陷',
  '查工件 W1338 的检测结果',
  '看今天的缺陷统计',
];
let recognition = null;
let voiceListening = false;

function voiceStatus(text, cls = '') {
  const el = byId('voiceStatus');
  if (el) { el.textContent = text; el.className = `voice-status ${cls}`; }
}

function stopVoice() {
  voiceListening = false;
  const btn = byId('btnVoice');
  if (btn) { btn.classList.remove('listening'); btn.textContent = '🎤 开始说话'; }
  try { recognition?.stop?.(); } catch (_) {}
}

/** 从自然语言里提取检索关键词（"查一下焊穿缺陷" → "焊穿"） */
function extractKeyword(text) {
  const s = String(text);
  const typeWords = ['焊穿', '未焊透', '咬边', 'burn', 'lack', 'bite'];
  for (const w of typeWords) if (s.includes(w)) return w;
  const wp = s.match(/W?(\d{4})/i);
  if (wp) return wp[1];
  if (/统计|多少|全部|所有/.test(s)) return '';
  return s.trim();
}

/** 把识别到的文字送入文本检索并执行，实现语音→检索的跨模态落点 */
function runVoiceQuery(text) {
  const kw = extractKeyword(text);
  voiceStatus(`识别结果：「${text}」 → 检索「${kw || '全部'}」`, 'ok');
  const input = byId('mmSearchInput');
  if (input) input.value = kw;
  runTextSearch();
  // 语音查询默认跳到检索结果标签
  setTimeout(() => switchTab('text'), 650);
}

/** 降级模拟：模拟一段"识别中"过程后吐出预设语句 */
async function simulateVoice() {
  voiceStatus('正在聆听…（模拟识别）', 'listening');
  await sleep(900);
  voiceStatus('语音识别中…', 'listening');
  await sleep(700);
  const text = VOICE_PRESETS[Math.floor(Math.random() * VOICE_PRESETS.length)];
  runVoiceQuery(text);
}

function initVoiceRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;
  try {
    recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      runVoiceQuery(text);
    };
    recognition.onerror = () => {
      stopVoice();
      voiceStatus('语音识别不可用，已切换为模拟演示', 'warn');
      simulateVoice();
    };
    recognition.onend = () => {
      if (voiceListening) stopVoice();
    };
    return true;
  } catch (_) {
    return false;
  }
}

function toggleVoice() {
  if (voiceListening) { stopVoice(); voiceStatus('已停止录音'); return; }
  const btn = byId('btnVoice');
  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    try {
      recognition?.start();
      voiceListening = true;
      btn?.classList.add('listening');
      if (btn) btn.textContent = '⏹ 停止录音';
      voiceStatus('正在聆听，请说话…', 'listening');
      // 8 秒无结果自动降级
      setTimeout(() => { if (voiceListening) { stopVoice(); simulateVoice(); } }, 8000);
      return;
    } catch (_) { /* 落到模拟 */ }
  }
  btn?.classList.add('listening');
  if (btn) btn.textContent = '⏹ 停止中…';
  simulateVoice();
}

// ========================================================================
// 35. 文本跨模态检索
// ========================================================================
/** 关键词归一化：中文名 / 英文 type / 工件编号 / 时间片段都能命中 */
function matchDefect(d, kw) {
  if (!kw) return true;
  const q = kw.toLowerCase().replace(/[#＃\s]/g, '');
  const type = DEFECT_TYPES[d.type];
  const num = String(d.workpieceId);
  const fields = [
    d.cn, type?.cn, type?.label, d.type,
    num, fmt(d.workpieceId), `w${num.padStart(4, '0')}`,
    d.time, d.conf?.toFixed(2),
    `置信度${(d.conf ?? 0).toFixed(2)}`,
  ].filter(Boolean).map(s => String(s).toLowerCase().replace(/[#＃\s]/g, ''));
  return fields.some(f => f.includes(q));
}

function runTextSearch() {
  const kw = (byId('mmSearchInput')?.value || '').trim();
  const items = [...state.defects].reverse().filter(d => matchDefect(d, kw));
  const hint = byId('mmSearchHint');
  if (hint) {
    hint.innerHTML = kw
      ? `关键词「<b>${escapeHtml(kw)}</b>」命中 <b style="color:var(--accent)">${items.length}</b> 条缺陷记录`
      : `当前共 <b style="color:var(--accent)">${items.length}</b> 条缺陷记录（输入关键词检索）`;
  }
  const list = byId('mmResultList');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div class="mm-empty">没有匹配的缺陷记录，换个关键词试试</div>';
    return;
  }
  list.innerHTML = items.slice(0, 24).map((d) => {
    const c = d.color || DEFECT_TYPES[d.type]?.color || '#38bdf8';
    return `<div class="mm-result-item" data-wp="${d.workpieceId}">
      <img class="mm-result-thumb" src="${makeThumb(d)}" alt="${d.cn}">
      <div class="mm-result-info">
        <div class="mm-result-top"><b>${fmt(d.workpieceId)}</b><span style="color:${c}">${d.cn}</span></div>
        <div class="mm-result-meta">conf ${(d.conf ?? 0).toFixed(2)} · ${d.time || '--:--:--'}</div>
      </div>
      <button class="mm-result-go" data-wp="${d.workpieceId}" title="查看四模态联动">联动 ›</button>
    </div>`;
  }).join('');
  // 绑定：点记录进入四模态联动
  list.querySelectorAll('.mm-result-go, .mm-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const wp = Number(el.dataset.wp);
      const d = state.defects.find(x => x.workpieceId === wp);
      if (d) { selectDefect(d); switchTab('image'); }
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ========================================================================
// 缺陷缩略图（与样本库同源的离屏绘制，供检索/联动复用）
// ========================================================================
function makeThumb(d, w = 128, h = 80) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const theme = DEFECT_TYPES[d.type] || { color: '#38bdf8', cn: d.cn };
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2a3340'); bg.addColorStop(0.5, '#1b2330'); bg.addColorStop(1, '#111823');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  for (let y = 5; y < h; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const wy = h * 0.52;
  ctx.strokeStyle = 'rgba(190,210,235,0.35)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(6, wy); ctx.lineTo(w - 6, wy); ctx.stroke();
  const seed = d.workpieceId || 1;
  const dx = w * 0.4 + (seed * 37) % (w * 0.3);
  ctx.strokeStyle = theme.color; ctx.lineWidth = 2;
  ctx.strokeRect(dx - 20, wy - 15, 40, 30);
  ctx.fillStyle = theme.color; ctx.fillRect(dx - 20, wy - 25, 52, 11);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 8px "Microsoft YaHei", sans-serif';
  ctx.fillText(`${d.cn} ${(d.conf ?? 0).toFixed(2)}`, dx - 18, wy - 17);
  return c.toDataURL('image/png');
}

// ========================================================================
// 36. 四模态联动
// ========================================================================
function renderImageWall() {
  const wall = byId('mmImageWall');
  if (!wall) return;
  const items = [...state.defects].slice(-12).reverse();
  if (!items.length) { wall.innerHTML = '<div class="mm-empty">暂无缺陷图像，先去检测几件工件吧</div>'; return; }
  wall.innerHTML = items.map(d => `<button class="mm-wall-cell ${state.selectedDefect?.workpieceId === d.workpieceId ? 'selected' : ''}" data-wp="${d.workpieceId}" title="${fmt(d.workpieceId)} · ${d.cn}">
    <img src="${makeThumb(d, 132, 84)}" alt="${d.cn}">
    <span style="color:${d.color || DEFECT_TYPES[d.type]?.color}">${d.cn}</span>
    <em>${fmt(d.workpieceId)}</em>
  </button>`).join('');
  wall.querySelectorAll('.mm-wall-cell').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = state.defects.find(x => x.workpieceId === Number(btn.dataset.wp));
      if (d) selectDefect(d);
    });
  });
}

function selectDefect(d) {
  state.selectedDefect = d;
  emit(EVT.SELECT_DEFECT, d);
  // 广播给联动大屏
  syncBroadcast('selectDefect', { workpieceId: d.workpieceId, type: d.type, cn: d.cn, conf: d.conf, time: d.time, color: d.color });
  renderFourModal(d);
  document.querySelectorAll('.mm-wall-cell').forEach(c => c.classList.toggle('selected', Number(c.dataset.wp) === d.workpieceId));
  speakDescribe(d, false);
}

/** 生成语音描述文本（供 TTS 与文字展示共用） */
function describeText(d) {
  const advice = DIAGNOSIS[d.type]?.advice || '建议复核工艺参数';
  return `工件 ${fmt(d.workpieceId)}，于 ${d.time || '最近'} 检出${d.cn}缺陷，置信度 ${(d.conf ?? 0).toFixed(2)}。诊断建议：${advice}。`;
}

/** 语音播报：speechSynthesis；无能力时降级为文字逐字高亮 */
function speakDescribe(d, auto = true) {
  const desc = describeText(d);
  const textEl = byId('mmVoiceText');
  if (textEl) textEl.textContent = desc;
  const btn = byId('btnSpeak');
  if (!('speechSynthesis' in window)) {
    if (btn) btn.textContent = '🔇 语音不可用（已显示文字）';
    return;
  }
  if (auto) doSpeak(desc, btn);
}
function doSpeak(text, btn) {
  if (!('speechSynthesis' in window)) { toast('当前环境不支持语音播报', 'warn'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; u.rate = 1.05;
  if (btn) btn.textContent = '🔊 播报中…';
  u.onend = () => { if (btn) btn.textContent = '🔊 重新播报'; };
  u.onerror = () => { if (btn) btn.textContent = '🔊 重试播报'; };
  speechSynthesis.speak(u);
}

function renderFourModal(d) {
  if (!d) return;
  // ① 图像模态
  const img = byId('mmFuseImage');
  if (img) img.src = makeThumb(d, 320, 200);
  const imgMeta = byId('mmFuseImageMeta');
  if (imgMeta) imgMeta.textContent = `${fmt(d.workpieceId)} · ${d.cn}`;
  // ② 文本模态（结构化记录）
  const textRec = byId('mmFuseText');
  if (textRec) {
    const c = d.color || DEFECT_TYPES[d.type]?.color;
    textRec.innerHTML = `
      <div class="mm-kv"><span>工件编号</span><b>${fmt(d.workpieceId)}</b></div>
      <div class="mm-kv"><span>缺陷类型</span><b style="color:${c}">${d.cn}</b></div>
      <div class="mm-kv"><span>发生时间</span><b>${d.time || '--:--:--'}</b></div>
      <div class="mm-kv"><span>处置状态</span><b style="color:var(--green2)">已剔除 · 已存证</b></div>`;
  }
  // ③ 数据模态（检测数据 + 该类型统计）
  const dataBox = byId('mmFuseData');
  if (dataBox) {
    const sameType = state.defects.filter(x => x.type === d.type).length;
    const pct = state.defects.length ? Math.round(sameType / state.defects.length * 100) : 0;
    const confPct = Math.round((d.conf ?? 0) * 100);
    dataBox.innerHTML = `
      <div class="mm-gauge"><div class="mm-gauge-val" style="color:${d.color || '#f87171'}">${confPct}%</div><div class="mm-gauge-label">检测置信度</div></div>
      <div class="mm-gauge"><div class="mm-gauge-val" style="color:var(--accent)">${sameType}</div><div class="mm-gauge-label">同类缺陷数</div></div>
      <div class="mm-gauge"><div class="mm-gauge-val" style="color:var(--purple)">${pct}%</div><div class="mm-gauge-label">类型占比</div></div>
      <div class="mm-data-note">模型 YOLOv8 · 阈值 ${state.confThreshold.toFixed(2)} · 数据来自实时检测留痕</div>`;
  }
  // ④ 语音模态
  speakDescribe(d, false);
}

// ========================================================================
// 37. 看板 DIY 布局
// ========================================================================
const LAYOUT_KEY = 'weld_dashboard_layout_v1';
let dragPanel = null;

/** 采集所有可布局面板的默认 grid 区域（来自 CSS 类），作为重置基准 */
function panelDefaultArea(panel) {
  const map = {
    'p-capture': '1 / 5|1 / 3', 'p-detect': '5 / 12|1 / 2', 'p-yield': '12 / 21|1 / 2',
    'p-sort': '5 / 13|2 / 3', 'p-equip': '13 / 21|2 / 3',
    'p-sample': '1 / 5|1 / 3', 'p-quality': '5 / 12|1 / 2', 'p-dist': '12 / 21|1 / 2',
    'p-diagnosis': '5 / 13|2 / 3', 'p-param': '13 / 21|2 / 3',
  };
  const cls = [...panel.classList].find(c => c.startsWith('p-'));
  return map[cls] || null;
}
function allPanels() {
  return [...document.querySelectorAll('.band-grid .panel')];
}
function panelKey(p) { return [...p.classList].find(c => c.startsWith('p-')); }

function saveLayout() {
  const layout = {};
  allPanels().forEach(p => {
    const k = panelKey(p);
    if (k) layout[k] = { col: p.style.gridColumn || '', row: p.style.gridRow || '', size: p.dataset.size || 'normal' };
  });
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); toast('自定义布局已保存', 'success'); }
  catch (_) { toast('保存失败：浏览器禁用了本地存储', 'warn'); }
}
function resetLayout() {
  try { localStorage.removeItem(LAYOUT_KEY); } catch (_) {}
  allPanels().forEach(p => { p.style.gridColumn = ''; p.style.gridRow = ''; p.dataset.size = ''; });
  toast('已恢复默认布局', 'info');
}
function applySavedLayout() {
  let layout;
  try { layout = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); } catch (_) { return; }
  if (!layout) return;
  allPanels().forEach(p => {
    const cfg = layout[panelKey(p)];
    if (!cfg) return;
    if (cfg.col) p.style.gridColumn = cfg.col;
    if (cfg.row) p.style.gridRow = cfg.row;
    if (cfg.size) applySize(p, cfg.size, false);
  });
}
function applySize(panel, size, notify = true) {
  const def = panelDefaultArea(panel);
  if (!def) return;
  const [defCol, defRow] = def.split('|');
  panel.dataset.size = size;
  if (size === 'large') { panel.style.gridColumn = defCol; panel.style.gridRow = '1 / 3'; }
  else if (size === 'wide') { panel.style.gridColumn = defCol; panel.style.gridRow = defRow; }
  else { panel.style.gridColumn = ''; panel.style.gridRow = ''; delete panel.dataset.size; }
  if (notify) toast(size === 'large' ? '面板已放大（占满两行）' : size === 'wide' ? '面板已设为标准尺寸' : '面板尺寸已复位', 'info');
}

function setLayoutEditing(on) {
  state.layoutEditing = on;
  document.body.classList.toggle('layout-editing', on);
  byId('layoutToolbar')?.classList.toggle('show', on);
  syncLayoutToolbar();
  allPanels().forEach(p => {
    if (on) {
      p.setAttribute('draggable', 'true');
      if (!p.querySelector('.drag-handle')) {
        const h = document.createElement('div');
        h.className = 'drag-handle';
        h.innerHTML = '<span>✥</span>';
        const sizeBar = document.createElement('div');
        sizeBar.className = 'panel-size-bar';
        sizeBar.innerHTML = '<button data-size="large" title="放大（两行）">大</button><button data-size="wide" title="标准">中</button><button data-size="normal" title="复位">小</button>';
        p.appendChild(h); p.appendChild(sizeBar);
        sizeBar.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-size]');
          if (b) { e.stopPropagation(); applySize(p, b.dataset.size); }
        });
      }
    } else {
      p.removeAttribute('draggable');
      p.querySelector('.drag-handle')?.remove();
      p.querySelector('.panel-size-bar')?.remove();
    }
  });
  if (on) { closeMultiModal(); toast('布局编辑：拖拽面板可交换位置，或用面板上的 大/中/小 调整尺寸', 'info'); }
}

function bindLayoutDrag() {
  document.addEventListener('dragstart', (e) => {
    const p = e.target.closest?.('.band-grid .panel');
    if (!state.layoutEditing || !p) return;
    dragPanel = p;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', panelKey(p) || ''); } catch (_) {}
    p.classList.add('dragging');
  });
  document.addEventListener('dragover', (e) => {
    if (!state.layoutEditing || !dragPanel) return;
    const target = e.target.closest?.('.band-grid .panel');
    if (target && target !== dragPanel) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; target.classList.add('drop-target'); }
  });
  document.addEventListener('dragleave', (e) => {
    e.target.closest?.('.band-grid .panel')?.classList.remove('drop-target');
  });
  document.addEventListener('drop', (e) => {
    const target = e.target.closest?.('.band-grid .panel');
    if (!state.layoutEditing || !dragPanel || !target || target === dragPanel) return;
    e.preventDefault();
    // 交换两个面板的 grid 区域
    const ac = dragPanel.style.gridColumn, ar = dragPanel.style.gridRow;
    const bc = target.style.gridColumn, br = target.style.gridRow;
    dragPanel.style.gridColumn = bc; dragPanel.style.gridRow = br;
    target.style.gridColumn = ac; target.style.gridRow = ar;
    target.classList.remove('drop-target');
    dragPanel.classList.remove('dragging');
    dragPanel = null;
    toast('面板位置已交换，记得点击「保存布局」', 'success');
  });
  document.addEventListener('dragend', () => {
    if (dragPanel) dragPanel.classList.remove('dragging');
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    dragPanel = null;
  });
}

function syncLayoutToolbar() {
  const btn = byId('btnLayoutMode');
  if (btn) { btn.textContent = state.layoutEditing ? '✓ 完成布局' : '✥ 布局编辑'; btn.classList.toggle('is-on', state.layoutEditing); }
  const btn2 = byId('btnLayoutMode2');
  if (btn2) { btn2.textContent = state.layoutEditing ? '✓ 完成布局' : '✥ 进入布局编辑'; btn2.classList.toggle('is-on', state.layoutEditing); }
}

// ========================================================================
// 38. 双屏联动（BroadcastChannel + ?role=screen 大屏模式）
// ========================================================================
let bc = null;
let bcId = null;          // 自有通道 ID（BroadcastChannel.name 是只读的，不能用它存自定义 ID）
let syncPeers = new Map();
let heartbeat = null;

function isScreenMode() {
  return new URLSearchParams(location.search).get('role') === 'screen';
}

function initSyncRole() {
  if (!isScreenMode()) return;
  state.syncRole = 'screen';
  document.body.classList.add('screen-mode');
  // 大屏模式：隐藏控制条，顶部标注联动状态
  const dock = byId('ctrlDock');
  if (dock) dock.style.display = 'none';
  const tag = byId('screenModeTag');
  if (tag) tag.classList.add('show');
  toast('已进入联动大屏模式，等待主控端同步…', 'info');
}

function syncBroadcast(key, value) {
  if (!bc || state.syncRole !== 'main') return;
  try { bc.postMessage({ type: 'state', key, value, from: bcId, t: Date.now() }); } catch (_) {}
}
function syncBroadcastAll() {
  // 主控端把关键状态一次性推给大屏
  syncBroadcast('selectDefect', state.selectedDefect);
  syncBroadcast('viewMode', state.viewMode);
  syncBroadcast('alarm', { active: state.alarmActive, reason: state.alarmReason });
  syncBroadcast('counts', { ok: state.okCount, ng: state.ngCount, sample: state.sampleTotal });
}

function applyRemoteState(key, value) {
  const tag = byId('screenSyncFlash');
  const flash = () => { if (tag) { tag.classList.remove('flash'); void tag.offsetWidth; tag.classList.add('flash'); } };
  if (key === 'selectDefect' && value) {
    state.selectedDefect = value;
    renderFourModal(value);
    const wall = byId('mmImageWall');
    if (wall) renderImageWall();
    // 联动大屏自动弹出四模态视图并切到图像标签，让同步肉眼可见
    if (state.syncRole === 'screen') {
      openMultiModal('image');
    }
    flash();
  } else if (key === 'viewMode') {
    state.viewMode = value;
    document.querySelector('.cam-container')?.classList.toggle('view-depth', value === 'depth');
    flash();
  } else if (key === 'alarm') {
    const bar = byId('alarmBar');
    const reason = byId('alarmReason');
    if (value?.active) { if (reason) reason.textContent = value.reason || '主控端触发报警'; bar?.classList.add('show'); }
    else bar?.classList.remove('show');
    flash();
  } else if (key === 'counts') {
    if (value?.ok != null && byId('okCount')) byId('okCount').textContent = value.ok.toLocaleString();
    if (value?.ng != null && byId('sortNgCount')) byId('sortNgCount').textContent = value.ng.toLocaleString();
    if (value?.sample != null && byId('sampleTotal')) byId('sampleTotal').textContent = value.sample.toLocaleString();
    flash();
  } else if (key === 'toast' && value) {
    toast(`[主控] ${value.msg}`, value.type);
  }
}

function refreshSyncPanel() {
  const status = byId('syncStatus');
  if (status) {
    const connected = syncPeers.size > 0;
    status.className = `sync-status ${connected ? 'connected' : ''}`;
    status.innerHTML = connected
      ? `<span class="sync-dot"></span> 已连接 ${syncPeers.size} 块联动屏幕`
      : '<span class="sync-dot"></span> 等待联动屏幕接入…';
  }
  const btn = byId('btnOpenScreen');
  if (btn) btn.textContent = '🖥 打开联动大屏';
}

function openScreen() {
  const url = location.href.split('?')[0] + '?role=screen';
  const w = window.open(url, 'weld-screen-' + Date.now(), 'width=1400,height=820');
  if (!w) { toast('弹窗被拦截，请允许本页打开新窗口后重试', 'warn'); return; }
  toast('已打开联动大屏，主控操作将实时同步', 'success');
  setTimeout(() => { syncBroadcastAll(); refreshSyncPanel(); }, 1200);
}

function initSync() {
  if (!('BroadcastChannel' in window)) {
    const el = byId('syncUnsupported');
    if (el) el.style.display = 'block';
    return;
  }
  const role = state.syncRole;
  bc = new BroadcastChannel('weld-dashboard-sync');
  bcId = role + '-' + Math.random().toString(36).slice(2, 7);
  bc.onmessage = (e) => {
    const msg = e.data;
    if (!msg || msg.from === bcId) return;
    if (msg.type === 'ping') {
      syncPeers.set(msg.from, Date.now());
      if (role === 'main') bc.postMessage({ type: 'pong', from: bcId });
      refreshSyncPanel();
    } else if (msg.type === 'pong') {
      syncPeers.set(msg.from, Date.now());
      refreshSyncPanel();
    } else if (msg.type === 'hello') {
      syncPeers.set(msg.from, Date.now());
      if (role === 'main') setTimeout(syncBroadcastAll, 300);
      refreshSyncPanel();
    } else if (msg.type === 'state' && role === 'screen') {
      applyRemoteState(msg.key, msg.value);
    }
  };
  // 上线广播 hello
  bc.postMessage({ type: 'hello', from: bcId, role });
  heartbeat = setInterval(() => {
    try { bc.postMessage({ type: 'ping', from: bcId, role }); } catch (_) {}
    // 清理 8 秒无响应的对端
    const now = Date.now();
    let changed = false;
    for (const [k, t] of syncPeers) if (now - t > 8000) { syncPeers.delete(k); changed = true; }
    if (changed) refreshSyncPanel();
  }, 2500);
}

// ========================================================================
// 事件绑定 + 初始化
// ========================================================================
function bindBatch3() {
  // 打开多模态中心
  byId('btnMultiModal')?.addEventListener('click', () => openMultiModal('voice'));
  byId('mmModalMask')?.addEventListener('click', closeMultiModal);
  byId('mmClose')?.addEventListener('click', closeMultiModal);

  // Tab 切换
  document.querySelectorAll('.mm-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // 语音
  byId('btnVoice')?.addEventListener('click', toggleVoice);
  byId('btnVoiceExample')?.addEventListener('click', () => runVoiceQuery(VOICE_PRESETS[0]));

  // 文本检索
  byId('btnMmSearch')?.addEventListener('click', runTextSearch);
  byId('mmSearchInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTextSearch(); });
  ['焊穿', '未焊透', '咬边'].forEach((kw, i) => {
    byId('mmQuick' + i)?.addEventListener('click', () => {
      const input = byId('mmSearchInput'); if (input) input.value = kw; runTextSearch();
    });
  });

  // 四模态播报
  byId('btnSpeak')?.addEventListener('click', () => {
    if (state.selectedDefect) doSpeak(describeText(state.selectedDefect), byId('btnSpeak'));
    else toast('请先点选一张缺陷图像', 'warn');
  });

  // DIY 布局
  byId('btnLayoutMode')?.addEventListener('click', () => setLayoutEditing(!state.layoutEditing));
  byId('btnLayoutMode2')?.addEventListener('click', () => setLayoutEditing(!state.layoutEditing));
  byId('btnLayoutSave')?.addEventListener('click', saveLayout);
  byId('btnLayoutReset')?.addEventListener('click', resetLayout);
  byId('btnLayoutExit')?.addEventListener('click', () => setLayoutEditing(false));

  // 双屏联动
  byId('btnOpenScreen')?.addEventListener('click', openScreen);
  byId('btnSyncNow')?.addEventListener('click', () => { syncBroadcastAll(); toast('已向联动屏幕推送当前状态', 'success'); });

  // ESC 关闭多模态中心 / 退出布局编辑
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.layoutEditing) { setLayoutEditing(false); return; }
    if (mmModal?.classList.contains('show')) closeMultiModal();
  });

  // 外部事件：其他模块/大屏请求打开某标签或选中某缺陷
  on(EVT.MULTIMODAL, ({ tab } = {}) => { if (tab) switchTab(tab); });
  on(EVT.SELECT_DEFECT, (d) => { if (d) renderFourModal(d); });
}

export function initControlBatch3() {
  initSyncRole();
  // 大屏模式也需要绑定（用于接收后的渲染），但控制类按钮大多隐藏
  bindBatch3();
  initVoiceRecognition();
  applySavedLayout();
  bindLayoutDrag();
  initSync();

  // 主控端：检测/视图切换/报警时主动广播给联动大屏
  on(EVT.DEFECT, (d) => syncBroadcast('toast', { msg: `检出${d.cn} · ${fmt(d.workpieceId)}`, type: 'danger' }));
  on(EVT.VIEW, ({ mode } = {}) => syncBroadcast('viewMode', mode));
  on(EVT.ALARM, ({ active, reason } = {}) => syncBroadcast('alarm', { active, reason }));
}
