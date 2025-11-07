/**
 * 系统状态管理
 */

import { CONFIG } from './config.js';
import { sendFeishuError, sendFeishuRecovery } from './feishu.js';

/**
 * 处理成功状态
 */
export async function handleSuccess(env) {
    const statusData = await env.NOTICES_KV.get(CONFIG.STATUS_KEY);
    
    if (statusData) {
        const status = JSON.parse(statusData);
        // 如果之前是失败状态，发送恢复通知
        if (status.state === 'failed') {
            console.log('服务已恢复，发送恢复通知');
            await sendFeishuRecovery(env);
        }
    }
    
    // 重置为成功状态
    await env.NOTICES_KV.put(CONFIG.STATUS_KEY, JSON.stringify({
        state: 'success',
        failureCount: 0,
        lastSuccessTime: new Date().toISOString()
    }));
}

/**
 * 处理失败状态
 */
export async function handleFailure(env, errorMessage) {
    const statusData = await env.NOTICES_KV.get(CONFIG.STATUS_KEY);
    
    let status = {
        state: 'success',
        failureCount: 0,
        lastFailureTime: null
    };
    
    if (statusData) {
        status = JSON.parse(statusData);
    }
    
    // 增加失败次数
    status.failureCount += 1;
    status.lastFailureTime = new Date().toISOString();
    
    console.log(`失败次数: ${status.failureCount}`);
    
    // 达到失败阈值且当前不是失败状态，发送失败通知并进入失败状态
    if (status.failureCount >= CONFIG.FAILURE_THRESHOLD && status.state !== 'failed') {
        console.log(`达到 ${CONFIG.FAILURE_THRESHOLD} 次失败，发送失败通知`);
        status.state = 'failed';
        await sendFeishuError(env, errorMessage, status.failureCount);
    }
    
    // 保存状态
    await env.NOTICES_KV.put(CONFIG.STATUS_KEY, JSON.stringify(status));
}

/**
 * 获取当前状态
 */
export async function getStatus(env) {
    const statusData = await env.NOTICES_KV.get(CONFIG.STATUS_KEY);
    
    if (!statusData) {
        return {
            state: 'success',
            failureCount: 0,
            lastSuccessTime: null,
            lastFailureTime: null
        };
    }
    
    return JSON.parse(statusData);
}
