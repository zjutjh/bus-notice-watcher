/**
 * HTML 解析服务
 */

import { parseHTML } from 'linkedom';
import { CONFIG } from './config.js';

/**
 * 抓取通知页面
 */
export async function fetchNotices() {
    // 模拟浏览器请求
    const response = await fetch(CONFIG.TARGET_URL, {
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
                        href = CONFIG.BASE_URL + href;
                    } else if (href.startsWith('../')) {
                        href = CONFIG.BASE_URL + '/xqbc/' + href.replace(/^\.\.\//, '');
                    } else if (!href.startsWith('http')) {
                        href = CONFIG.BASE_URL + '/xqbc/' + href;
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
