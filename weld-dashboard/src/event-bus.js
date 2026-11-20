/**
 * event-bus.js — 跨模块事件总线 + 全局共享状态
 *
 * 这是整个看板"闭环"的神经中枢。
 * 检测端（defect-detect）每识别一个工件，就广播一次结果事件；
 * 处置端（样本库、机械臂）、分析端（诊断、工艺参数、优化建议）订阅事件，
 * 从而实现 检测 → 处置 → 分析 → 反馈 的完整链路，而不是各模块各自播动画。
 *
 * 设计原则：
 *  - 无第三方依赖，纯 ES Module；
 *  - 单一事件出口 emit()，订阅方通过 on() 注册；
 *  - 单一数据源 state，工件编号、样本数、缺陷历史集中管理。
 */

// ========== 全局共享状态（单一数据源） ==========
export const state = {
  workpieceSeq: 1342,   // 当前工件流水号（与初始日志 #W1342 对齐）
  sampleTotal: 1284,    // 缺陷样本库累计样本数
  okCount: 1247,        // 今日良品数
  ngCount: 89,          // 今日剔除数
  defects: [],          // 缺陷事件历史（含工件编号、类型、置信度、时间）
  lastDefect: null,     // 最近一次缺陷事件

  // ===== 交互控制状态（第一批：可操作仿真控制台） =====
  beltRunning: false,   // 传送带是否运行：停止时工件驻留，可检测当前帧
  modelLoaded: false,   // YOLO 模型是否已加载：未加载时检测类操作不可用
  viewMode: 'color',    // 采集区主视图：'color' 彩色 / 'depth' 深度
  photos: [],           // 抓拍记录 [{workpieceId, dataUrl, time}]
  batch: [],            // 待检批次（连续采集产生），供批量检测消费

  // ===== 交互控制状态（第二批：增强与实验） =====
  exposure: 1.0,        // 相机曝光（0.4~1.8），影响 RGB 画面明暗
  gain: 1.0,            // 相机增益（0.5~2.0），影响 RGB 画面噪点
  confThreshold: 0.5,   // 置信度阈值（0.3~0.9），低于阈值的缺陷判为漏检（合格放行）
  monitorRunning: true, // 良品率实时监控开关：false 时曲线停止采样
  alarmActive: false,   // 设备报警态：异常时置位，需确认复位
  alarmReason: '',      // 报警原因
  stackCount: 0,        // 演示码垛次数（独立于良品计数）

  // ===== 交互控制状态（第三批：多模态进阶） =====
  selectedDefect: null,   // 四模态联动当前选中的缺陷记录
  layoutEditing: false,  // DIY 布局编辑模式开关
  syncRole: 'main',      // 双屏联动角色：'main' 主控 / 'screen' 联动大屏
  syncPeers: 0,          // 已连接的联动屏幕数
};

// ========== 订阅表 ==========
const handlers = new Map();

/**
 * 订阅事件
 * @param {string} event 事件名
 * @param {Function} fn 处理函数
 * @returns {Function} 取消订阅函数
 */
export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  return () => handlers.get(event)?.delete(fn);
}

/**
 * 广播事件
 * @param {string} event 事件名
 * @param {*} payload 载荷
 */
export function emit(event, payload) {
  const set = handlers.get(event);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[event-bus] handler error on "${event}":`, err);
    }
  }
}

// ========== 事件名常量（避免拼写错误） ==========
export const EVT = {
  DEFECT: 'defect:detected',   // 检测到缺陷：payload = {workpieceId, type, cn, color, label, conf, time}
  OK:     'workpiece:ok',      // 工件合格：payload = {workpieceId, conf, time}

  // ===== 交互控制事件（第一批） =====
  BELT:         'control:belt',         // 传送带启停：payload = {running}
  MODEL:        'control:model',        // 模型加载完成：payload = {loaded}
  PHOTO:        'control:photo',        // 拍照完成：payload = {workpieceId, dataUrl, time}
  BATCH_CAPTURE:'control:batchCapture', // 连续采集完成：payload = {count}
  DETECT:       'control:detect',       // 手动检测完成：payload = {result}
  BATCH_DETECT: 'control:batchDetect',  // 批量检测完成：payload = {stats}
  LOG_CHANGED:  'control:logChanged',   // 缺陷日志变更（供抽屉刷新）
  TOAST:        'ui:toast',             // 状态提示：payload = {msg, type}

  // ===== 交互控制事件（第二批：增强与实验） =====
  CAMERA_PARAM: 'control:cameraParam',  // 曝光/增益变化：payload = {exposure, gain}
  THRESHOLD:    'control:threshold',    // 置信度阈值变化：payload = {value}
  MONITOR:      'control:monitor',      // 良品率监控启停：payload = {running}
  ALARM:        'control:alarm',        // 报警触发/复位：payload = {active, reason}
  STACK:        'control:stack',        // 机械臂码垛演示：payload = {workpieceId}
  CYLINDER:     'control:cylinder',     // 气缸剔除演示：payload = {workpieceId, cn, color}

  // ===== 交互控制事件（第三批：多模态进阶） =====
  MULTIMODAL:   'mm:open',              // 打开多模态中心指定标签：payload = {tab}
  SELECT_DEFECT:'mm:selectDefect',      // 选中缺陷（四模态联动）：payload = defect
  SYNC_STATE:   'mm:syncState',         // 双屏联动状态同步：payload = {key, value}
  VIEW:         'control:view',         // 视图切换：payload = {mode}
};
