/**
 * HTML 解析服务
 */

import { parseHTML } from 'linkedom';
import { CONFIG } from './config.js';

const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
};

/**
 * 仅抓取第一页通知，并补齐正文归一化信息
 */
export async function fetchNotices() {
    const firstPageHtml = await fetchHtml(CONFIG.TARGET_URL);
    const firstPageData = parseNoticeList(firstPageHtml, 1);
    const totalPages = firstPageData.totalPages;
    const firstPageNotices = [...firstPageData.notices];

    if (firstPageNotices.length === 0) {
        throw new Error('未解析到任何通知，可能是页面结构已变化');
    }

    const noticesWithContent = await mapWithConcurrency(
        firstPageNotices,
        CONFIG.DETAIL_FETCH_CONCURRENCY,
        async notice => {
            const detailHtml = await fetchHtml(notice.href);
            const normalizedContent = normalizeNoticeContent(detailHtml);
            return {
                ...notice,
                normalizedContent
            };
        }
    );

    return {
        totalPages,
        notices: noticesWithContent
    };
}

/**
 * 拉取页面 HTML
 */
async function fetchHtml(url) {
    const response = await fetch(url, { headers: REQUEST_HEADERS });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, url: ${url}`);
    }
    return response.text();
}

/**
 * 解析列表页
 */
function parseNoticeList(html, pageNo) {
    const notices = [];
    let totalPages = 1;

    try {
        const { document } = parseHTML(html);
        totalPages = getTotalPages(document);

        const newsList = document.querySelector('ul.news_list.list2');

        if (!newsList) {
            console.log('未找到通知列表');
            return { notices, totalPages };
        }

        const listItems = newsList.querySelectorAll('li.news');

        let indexInPage = 0;
        for (const li of listItems) {
            const link = li.querySelector('span.news_title a[href]') || li.querySelector('a[href]');
            const metaDate = li.querySelector('span.news_meta');

            if (link) {
                const href = normalizeUrl(link.getAttribute('href') || '');
                const title = normalizeInlineText(link.getAttribute('title') || link.textContent || '');
                const date = normalizeInlineText(metaDate?.textContent || '');

                if (href) {
                    notices.push({
                        href,
                        title,
                        date,
                        pageNo,
                        indexInPage
                    });
                    indexInPage += 1;
                }
            }
        }
    } catch (error) {
        console.error('解析 HTML 失败:', error);
    }

    return { notices, totalPages };
}

/**
 * 解析总页数
 */
function getTotalPages(document) {
    const pageNode = document.querySelector('#wp_paging_w6 .page_jump .all_pages');
    if (!pageNode) {
        return 1;
    }
    const pageValue = parseInt((pageNode.textContent || '').trim(), 10);
    return Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
}

/**
 * 标准化正文
 */
function normalizeNoticeContent(detailHtml) {
    try {
        const { document } = parseHTML(detailHtml);
        const contentRoot = document.querySelector('.wp_articlecontent')
            || document.querySelector('.entry .read')
            || document.querySelector('.entry');

        if (!contentRoot) {
            return '';
        }

        const removableNodes = contentRoot.querySelectorAll('script, style, noscript, iframe');
        removableNodes.forEach(node => node.remove());

        const anchors = contentRoot.querySelectorAll('a[name]');
        anchors.forEach(anchor => anchor.removeAttribute('name'));

        const rawText = contentRoot.innerText || contentRoot.textContent || '';
        const normalizedText = normalizeMultilineText(rawText);

        const attachmentLines = Array.from(contentRoot.querySelectorAll('a[href]'))
            .map(a => {
                const rawHref = a.getAttribute('href') || '';
                const href = normalizeUrl(rawHref);
                if (!href || href.startsWith('mailto:') || href.startsWith('javascript:')) {
                    return null;
                }
                const name = normalizeInlineText(a.textContent || a.getAttribute('title') || '');
                if (!name) {
                    return null;
                }
                return `${name} ${href}`;
            })
            .filter(Boolean);

        const uniqAttachmentLines = [...new Set(attachmentLines)].sort();
        if (uniqAttachmentLines.length === 0) {
            return normalizedText;
        }

        if (!normalizedText) {
            return uniqAttachmentLines.join('\n');
        }

        return `${normalizedText}\n${uniqAttachmentLines.join('\n')}`;
    } catch (error) {
        console.error('解析正文失败:', error);
        return '';
    }
}

/**
 * URL 归一化
 */
function normalizeUrl(rawUrl) {
    const trimmed = normalizeInlineText(rawUrl);
    if (!trimmed) {
        return '';
    }

    try {
        const url = new URL(trimmed, `${CONFIG.BASE_URL}/`);
        url.hash = '';
        return url.toString();
    } catch {
        return '';
    }
}

/**
 * 单行文本归一化
 */
function normalizeInlineText(value) {
    return (value || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\u3000/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 多行文本归一化
 */
function normalizeMultilineText(value) {
    return (value || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\u3000/g, ' ')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

/**
 * 并发控制
 */
async function mapWithConcurrency(items, concurrency, mapper) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const limit = Math.max(1, Math.floor(concurrency || 1));
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const current = nextIndex;
            nextIndex += 1;
            results[current] = await mapper(items[current], current);
        }
    }

    const workers = [];
    const workerCount = Math.min(limit, items.length);
    for (let i = 0; i < workerCount; i += 1) {
        workers.push(worker());
    }

    await Promise.all(workers);
    return results;
}
