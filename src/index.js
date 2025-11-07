/**
 * Cloudflare Workers - 浙工大班车通知监控
 * 监控 https://www.zjut.edu.cn/xqbc/list.htm 的通知更新
 */

import { checkNotices } from './checker.js';
import { getStatus } from './status.js';
import { CONFIG } from './config.js';

export default {
    async scheduled(event, env, ctx) {
        // 定时任务触发
        console.log('定时任务触发，开始检查通知更新');
        await checkNotices(env);
    },

    async fetch(request, env, ctx) {
        // 手动触发接口
        const url = new URL(request.url);

        if (url.pathname === '/check') {
            const result = await checkNotices(env);
            return new Response(JSON.stringify(result, null, 2), {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        if (url.pathname === '/list') {
            // 查看已存储的通知列表
            const list = await env.NOTICES_KV.list();
            const keys = list.keys
                .filter(k => k.name !== CONFIG.STATUS_KEY)
                .map(k => k.name);
            return new Response(JSON.stringify(keys, null, 2), {
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        if (url.pathname === '/status') {
            // 查看系统状态
            const status = await getStatus(env);
            return new Response(JSON.stringify(status, null, 2), {
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        return new Response('Bus Notice Watcher is running!', { status: 200 });
    }
};
