/**
 * 通知检查服务
 */

import { fetchNotices } from './parser.js';
import { sendFeishuNotification } from './feishu.js';
import { handleSuccess, handleFailure } from './status.js';

/**
 * 检查通知更新
 */
export async function checkNotices(env) {
    const result = {
        success: false,
        timestamp: new Date().toISOString(),
        totalNotices: 0,
        newNotices: [],
        error: null
    };

    try {
        // 1. 抓取页面内容
        const notices = await fetchNotices();
        console.log(`抓取到 ${notices.length} 条通知`);
        result.totalNotices = notices.length;

        // 2. 检查新通知
        const newNotices = [];
        for (const notice of notices) {
            const exists = await env.NOTICES_KV.get(notice.href);
            if (!exists) {
                newNotices.push(notice);
                // 存储到 KV
                await env.NOTICES_KV.put(notice.href, JSON.stringify({
                    title: notice.title,
                    href: notice.href,
                    timestamp: new Date().toISOString()
                }));
            }
        }

        result.newNotices = newNotices;
        result.success = true;

        // 3. 如果有新通知,发送飞书通知
        if (newNotices.length > 0) {
            console.log(`发现 ${newNotices.length} 条新通知`);
            await sendFeishuNotification(env, newNotices);
        } else {
            console.log('没有新通知');
        }

        // 4. 成功后重置失败状态
        await handleSuccess(env);

    } catch (error) {
        console.error('检查通知时出错:', error);
        result.error = error.message;
        // 处理失败状态
        await handleFailure(env, error.message);
    }

    return result;
}
