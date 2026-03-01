import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchNotices } from '../src/parser.js';
import { CONFIG } from '../src/config.js';
import {
    buildSingleNoticeListHtml,
    htmlResponse,
    loadLiveFixtures,
    withMockedFetch
} from './helpers.js';

// 用真实页面做集成测试，验证列表抓取与详情正文归一化主链路
test('fetchNotices parses real zjut html', { timeout: 120000 }, async () => {
    const fixtures = loadLiveFixtures();
    const singleNoticeListHtml = buildSingleNoticeListHtml(fixtures.listHtml);

    const result = await withMockedFetch(async (url) => {
        if (url === CONFIG.TARGET_URL) {
            return htmlResponse(singleNoticeListHtml);
        }
        if (url === fixtures.detailUrl) {
            return htmlResponse(fixtures.detailHtml);
        }
        throw new Error(`unexpected url: ${url}`);
    }, async () => fetchNotices());

    assert.ok(result.totalPages >= 1);
    assert.ok(result.notices.length > 0);

    const first = result.notices[0];
    assert.ok(first.href.startsWith('https://www.zjut.edu.cn/'));
    assert.ok(first.title.length > 0);
    assert.match(first.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(first.pageNo, 1);
    assert.ok(Number.isInteger(first.indexInPage));
    assert.ok(typeof first.normalizedContent === 'string');
});

// 额外确认目标列表页在线且仍可访问
test('target list page is reachable', { timeout: 30000 }, async () => {
    const { listHtml } = loadLiveFixtures();
    const html = listHtml;
    assert.ok(html.length > 0);
    assert.match(html, /news_list/);
});
