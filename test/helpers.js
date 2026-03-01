import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

export function createMockEnv() {
    const store = new Map();

    return {
        FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/your-webhook-key',
        NOTICES_KV: {
            async get(key) {
                return store.has(key) ? store.get(key) : null;
            },
            async put(key, value) {
                store.set(key, value);
            },
            async list() {
                return {
                    keys: Array.from(store.keys()).map(name => ({ name }))
                };
            }
        }
    };
}

export function withMockedFetch(mockFetch, run) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    return Promise.resolve()
        .then(run)
        .finally(() => {
            globalThis.fetch = originalFetch;
        });
}

export function htmlResponse(html) {
    return {
        ok: true,
        status: 200,
        async text() {
            return html;
        },
        async json() {
            return {};
        }
    };
}

export function loadLiveFixtures() {
    const listHtml = readFileSync('test/fixtures/live/list.html', 'utf8');
    const detailHtml = readFileSync('test/fixtures/live/detail.html', 'utf8');
    const detailUrl = readFileSync('test/fixtures/live/detail.url', 'utf8').trim();
    return { listHtml, detailHtml, detailUrl };
}

export function buildSingleNoticeListHtml(listHtml) {
    const { document } = parseHTML(listHtml);
    const newsList = document.querySelector('ul.news_list.list2');
    if (!newsList) {
        return listHtml;
    }
    const first = newsList.querySelector('li.news');
    newsList.innerHTML = first ? first.outerHTML : '';
    return document.toString();
}
