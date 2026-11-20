/**
 * config.js — 全局配置常量与状态
 *
 * 所有跨模块共享的配置项集中在此，
 * 其他模块通过 import 引用，杜绝暗依赖。
 */

// ========== CSS 变量色值（供 JS Canvas 绘制使用） ==========
export const COLORS = {
  bg:        '#060b14',
  panel:     '#0c1320',
  panel2:    '#0f172a',
  border:    '#1e293b',
  border2:   '#334155',
  text:      '#e2e8f0',
  muted:     '#94a3b8',
  accent:    '#38bdf8',
  accent2:   '#0ea5e9',
  green:     '#22c55e',
  green2:    '#4ade80',
  red:       '#ef4444',
  red2:      '#f87171',
  yellow:    '#f59e0b',
  orange:    '#fb923c',
  purple:    '#a855f7',
};

// ========== 缺陷类型定义 ==========
export const DEFECT_TYPES = {
  burn: { color: '#f87171', label: 'burn-through', cn: '焊穿' },
  lack: { color: '#fb923c', label: 'incomplete',   cn: '未焊透' },
  bite: { color: '#38bdf8', label: 'undercut',     cn: '咬边' },
};

// ========== 流水线方块参数（RGB 采集区） ==========
export const RGB_CONFIG = {
  BLOCK_W:       24,
  BLOCK_H:       24,
  BLOCK_GAP:     100,
  BLOCK_SPEED:   0.8,
  MAX_VISIBLE:   3,
  DEFECT_RATE:   0.15,
};

// ========== 流水线方块参数（YOLO 检测区） ==========
export const DET_CONFIG = {
  BLOCK_W:       28,
  BLOCK_H:       28,
  BLOCK_GAP:     110,
  BLOCK_SPEED:   0.8,
  MAX_VISIBLE:   3,
  DEFECT_RATE:   0.25,
};

// ========== 看板画布尺寸 ==========
export const DASHBOARD = {
  WIDTH:  1920,
  HEIGHT: 1080,
};

// ========== 初始计数 ==========
export const INITIAL_COUNTS = {
  burn:  37,
  lack:  29,
  bite:  23,
  ok:    1247,
  ng:    89,
};

// ========== 工件编号起始值（缺陷追溯用） ==========
export const WORKPIECE_START = 1342;

// ========== 缺陷成因诊断知识库（分析端） ==========
// 每种缺陷对应的形成原因、工艺参数异常与优化建议
export const DIAGNOSIS = {
  burn: {
    causes: ['焊接电流过大', '焊接速度过慢', '热输入过高'],
    param: '电流',
    advice: '电流下调 8~12%，或提高焊接速度 10%',
  },
  lack: {
    causes: ['焊接电流偏小', '坡口清理不净', '焊接速度过快'],
    param: '电流',
    advice: '电流上调 6~10%，降低焊接速度并清理坡口',
  },
  bite: {
    causes: ['电弧偏吹', '焊枪角度不当', '焊接电流过大'],
    param: '电压',
    advice: '校正焊枪角度至 60~75°，匹配弧长电压',
  },
};

// ========== 工艺参数基准与波动范围（分析端） ==========
export const PROCESS_PARAMS = {
  current: { label: '焊接电流', unit: 'A',  base: 185, min: 165, max: 210, warn: 200 },
  voltage: { label: '电弧电压', unit: 'V',  base: 22,  min: 19,  max: 26,  warn: 24.5 },
  speed:   { label: '焊接速度', unit: 'mm/s', base: 8.5, min: 6.5, max: 10.5, warn: 9.6 },
};

// ========== 缺陷样本库 ==========
export const SAMPLE_CONFIG = {
  MAX_THUMBS: 6,        // 看板展示的缩略图数量
  INITIAL_TOTAL: 1284,  // 初始样本总量
};

