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
        totalPages: 0,
        page1Changes: {
            added: [],
            updated: []
        },
        error: null
    };

    try {
        // 1. 抓取第一页通知和正文归一化内容
        const fetchResult = await fetchNotices();
        const notices = fetchResult.notices;
        const totalPages = fetchResult.totalPages;
        console.log(`抓取到第 1 页 ${notices.length} 条通知，列表总页数 ${totalPages}`);
        result.totalNotices = notices.length;
        result.totalPages = totalPages;

        // 2. 每条通知一个 KV key（href），对比新增/更新
        const page1Changes = {
            added: [],
            updated: []
        };

        for (const notice of notices) {
            const currentItem = {
                href: notice.href,
                title: notice.title,
                date: notice.date,
                pageNo: notice.pageNo,
                indexInPage: notice.indexInPage,
                normalizedContent: notice.normalizedContent || '',
                updatedAt: new Date().toISOString()
            };

            const previousItem = await loadNoticeByKey(env, notice.href);
            if (!previousItem) {
                page1Changes.added.push(currentItem);
                await saveNoticeByKey(env, notice.href, currentItem);
                continue;
            }

            const changedFields = [];
            if ((previousItem.title || '') !== currentItem.title) {
                changedFields.push('title');
            }
            if ((previousItem.date || '') !== currentItem.date) {
                changedFields.push('date');
            }
            if ((previousItem.normalizedContent || '') !== currentItem.normalizedContent) {
                changedFields.push('content');
            }

            if (changedFields.length > 0) {
                page1Changes.updated.push({
                    href: currentItem.href,
                    changedFields,
                    before: previousItem,
                    after: currentItem
                });
            }

            await saveNoticeByKey(env, notice.href, currentItem);
        }

        result.page1Changes = page1Changes;

        const hasChanges = page1Changes.added.length > 0
            || page1Changes.updated.length > 0;

        if (hasChanges) {
            console.log(
                `第一页有变更: +${page1Changes.added.length} ~${page1Changes.updated.length}`
            );
            await sendFeishuNotification(env, page1Changes);
        } else {
            console.log('第一页无变更');
        }

        result.success = true;

        // 3. 成功后重置失败状态
        await handleSuccess(env);

    } catch (error) {
        console.error('检查通知时出错:', error);
        result.error = error.message;
        // 处理失败状态
        await handleFailure(env, error.message);
    }

    return result;
}

/**
 * 按通知 key 读取数据
 */
async function loadNoticeByKey(env, key) {
    const text = await env.NOTICES_KV.get(key);
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * 按通知 key 保存数据
 */
async function saveNoticeByKey(env, key, value) {
    await env.NOTICES_KV.put(key, JSON.stringify(value));
}
