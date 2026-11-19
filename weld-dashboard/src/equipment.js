/**
 * equipment.js — 设备状态区
 *
 * 更新 PLC 运行时长（#plcUptime）和机械臂关节角度（#jointAngles）。
 */

import { $, randInt } from './utils.js';

// ========== 模块状态 ==========
let plcMinutes = 263; // 4h 23min

/**
 * 更新 PLC 运行时长显示
 */
function updatePlcUptime() {
  plcMinutes++;
  const h = Math.floor(plcMinutes / 60);
  const m = plcMinutes % 60;
  $('plcUptime').textContent = `${h}h ${m}min`;
}

/**
 * 更新机械臂关节角度
 */
function updateJointAngles() {
  const j1 = 40 + randInt(0, 10);
  const j2 = 70 + randInt(0, 15);
  const j3 = 120 + randInt(0, 10);
  $('jointAngles').textContent = `J1:${j1}° J2:${j2}° J3:${j3}°`;
}

/**
 * 初始化设备状态模块
 */
export function initEquipment() {
  setInterval(updatePlcUptime, 60000);
  setInterval(updateJointAngles, 2000);
}
