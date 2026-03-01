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
            const list = await env.NOTICES_KV.list();
            const keys = list.keys
                .map(k => k.name)
                .filter(name => !CONFIG.RESERVED_KEYS.includes(name));

            const results = await Promise.all(keys.map(key => env.NOTICES_KV.get(key)));
            const parsed = results.map((value, index) => {
                const key = keys[index];
                if (!value) {
                    return { key, value: null };
                }

                try {
                    return { key, value: JSON.parse(value) };
                } catch {
                    return { key, value };
                }
            });

            return new Response(JSON.stringify(parsed, null, 2), {
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
