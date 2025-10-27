/**
 * Cloudflare Workers - 浙工大班车通知监控
 * 监控 https://www.zjut.edu.cn/xqbc/list.htm 的通知更新
 */

import { parseHTML } from 'linkedom';

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
            const keys = list.keys.map(k => k.name);
            return new Response(JSON.stringify(keys, null, 2), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Bus Notice Watcher is running!', { status: 200 });
    }
};

/**
 * 检查通知更新
 */
async function checkNotices(env) {
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

    } catch (error) {
        console.error('检查通知时出错:', error);
        result.error = error.message;
        // 发送错误通知
        await sendFeishuError(env, error.message);
    }

    return result;
}

/**
 * 抓取通知页面
 */
async function fetchNotices() {
    const url = 'https://www.zjut.edu.cn/xqbc/list.htm';

    // 模拟浏览器请求
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    // 解析 HTML 获取通知列表
    return parseNotices(html);
}

/**
 * 解析 HTML 提取通知信息
 */
function parseNotices(html) {
    const notices = [];

    try {
        // 使用 linkedom 解析 HTML
        const { document } = parseHTML(html);

        // 查找 <ul class="news_list list2">
        const newsList = document.querySelector('ul.news_list.list2');

        if (!newsList) {
            console.log('未找到通知列表');
            return notices;
        }

        // 获取所有 li 元素
        const listItems = newsList.querySelectorAll('li');

        for (const li of listItems) {
            // 在 li 中查找 span 内的 a 标签
            const link = li.querySelector('span a[href][title]');

            if (link) {
                let href = link.getAttribute('href');
                const title = link.getAttribute('title');

                // 处理相对路径
                if (href) {
                    if (href.startsWith('/')) {
                        href = 'https://www.zjut.edu.cn' + href;
                    } else if (href.startsWith('../')) {
                        href = 'https://www.zjut.edu.cn/xqbc/' + href.replace(/^\.\.\//, '');
                    } else if (!href.startsWith('http')) {
                        href = 'https://www.zjut.edu.cn/xqbc/' + href;
                    }

                    notices.push({ href, title: title || '' });
                }
            }
        }
    } catch (error) {
        console.error('解析 HTML 失败:', error);
    }

    return notices;
}

/**
 * 发送飞书通知
 */
async function sendFeishuNotification(env, notices) {
    const webhookUrl = env.FEISHU_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl.includes('your-webhook-key')) {
        console.log('飞书 Webhook URL 未配置');
        return;
    }

    // 构建通知内容
    let content = '🚌 **浙工大班车通知更新**\n\n';
    content += `发现 ${notices.length} 条新通知：\n\n`;

    for (const notice of notices) {
        content += `📌 [${notice.title}](${notice.href})\n\n`;
    }

    content += `\n⏰ 检查时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    const payload = {
        msg_type: 'text',
        content: {
            text: content
        }
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('飞书通知发送结果:', result);
    } catch (error) {
        console.error('发送飞书通知失败:', error);
    }
}

/**
 * 发送错误通知
 */
async function sendFeishuError(env, errorMessage) {
    const webhookUrl = env.FEISHU_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl.includes('your-webhook-key')) {
        return;
    }

    const payload = {
        msg_type: 'text',
        content: {
            text: `⚠️ 班车通知监控出错\n\n错误信息：${errorMessage}\n\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
        }
    };

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('发送错误通知失败:', error);
    }
}
