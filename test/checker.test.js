import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNotices } from '../src/checker.js';
import { getStatus } from '../src/status.js';
import { CONFIG } from '../src/config.js';
import {
    buildSingleNoticeListHtml,
    createMockEnv,
    htmlResponse,
    loadLiveFixtures,
    withMockedFetch
} from './helpers.js';

// 用真实页面做两次连续检查：首次应全部新增，第二次应无新增/更新
test('checkNotices detects added then stable notices with real html', { timeout: 180000 }, async () => {
    const env = createMockEnv();
    const fixtures = loadLiveFixtures();
    const singleNoticeListHtml = buildSingleNoticeListHtml(fixtures.listHtml);

    await withMockedFetch(async (url) => {
        if (url === CONFIG.TARGET_URL) {
            return htmlResponse(singleNoticeListHtml);
        }
        if (url === fixtures.detailUrl) {
            return htmlResponse(fixtures.detailHtml);
        }
        throw new Error(`unexpected url: ${url}`);
    }, async () => {
        const first = await checkNotices(env);
        assert.equal(first.success, true);
        assert.ok(first.totalNotices > 0);
        assert.equal(first.page1Changes.added.length, first.totalNotices);
        assert.equal(first.page1Changes.updated.length, 0);

        const second = await checkNotices(env);
        assert.equal(second.success, true);
        assert.equal(second.page1Changes.added.length, 0);
        assert.equal(second.page1Changes.updated.length, 0);
    });
});

// 手动污染 KV 中某条正文，下一次真实抓取应识别 content 更新
test('checkNotices detects content updates with real html', { timeout: 180000 }, async () => {
    const env = createMockEnv();
    const fixtures = loadLiveFixtures();
    const singleNoticeListHtml = buildSingleNoticeListHtml(fixtures.listHtml);

    await withMockedFetch(async (url) => {
        if (url === CONFIG.TARGET_URL) {
            return htmlResponse(singleNoticeListHtml);
        }
        if (url === fixtures.detailUrl) {
            return htmlResponse(fixtures.detailHtml);
        }
        throw new Error(`unexpected url: ${url}`);
    }, async () => {
        const first = await checkNotices(env);
        assert.equal(first.success, true);
        assert.ok(first.page1Changes.added.length > 0);

        const target = first.page1Changes.added[0];
        const staleItem = {
            ...target,
            normalizedContent: '__stale_content__'
        };
        await env.NOTICES_KV.put(target.href, JSON.stringify(staleItem));

        const second = await checkNotices(env);
        assert.equal(second.success, true);
        assert.equal(second.page1Changes.added.length, 0);
        assert.ok(second.page1Changes.updated.length >= 1);

        const targetUpdate = second.page1Changes.updated.find(item => item.href === target.href);
        assert.ok(targetUpdate);
        assert.ok(targetUpdate.changedFields.includes('content'));
    });
});

// 抓取失败时 should return success=false 并累计失败次数
test('checkNotices marks failure status when fetch fails', async () => {
    const env = createMockEnv();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: false,
        status: 500,
        async text() {
            return '';
        }
    });
    try {
        const result = await checkNotices(env);
        assert.equal(result.success, false);
        assert.match(result.error, /HTTP error/);
    } finally {
        globalThis.fetch = originalFetch;
    }

    const status = await getStatus(env);
    assert.equal(status.state, 'success');
    assert.equal(status.failureCount, 1);
});
