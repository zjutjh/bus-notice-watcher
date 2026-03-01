import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { getStatus, handleFailure, handleSuccess } from '../src/status.js';
import { createMockEnv } from './helpers.js';

// STATUS_KEY 内容损坏时，状态逻辑应自动回落到默认值并继续计数
test('handleFailure tolerates malformed status json', async () => {
    const env = createMockEnv();
    await env.NOTICES_KV.put(CONFIG.STATUS_KEY, '{broken-json');

    await handleFailure(env, 'network error');
    const status = await getStatus(env);

    assert.equal(status.state, 'success');
    assert.equal(status.failureCount, 1);
    assert.ok(status.lastFailureTime);
});

// 连续失败达到阈值后应进入 failed 状态
test('handleFailure enters failed state on threshold', async () => {
    const env = createMockEnv();

    await handleFailure(env, 'error 1');
    await handleFailure(env, 'error 2');
    await handleFailure(env, 'error 3');

    const status = await getStatus(env);
    assert.equal(status.state, 'failed');
    assert.equal(status.failureCount, 3);
});

// 从 failed 恢复成功后应清零失败计数并写入 lastSuccessTime
test('handleSuccess resets failed state and counters', async () => {
    const env = createMockEnv();
    await env.NOTICES_KV.put(CONFIG.STATUS_KEY, JSON.stringify({
        state: 'failed',
        failureCount: 5,
        lastFailureTime: '2026-03-01T00:00:00.000Z'
    }));

    await handleSuccess(env);
    const status = await getStatus(env);

    assert.equal(status.state, 'success');
    assert.equal(status.failureCount, 0);
    assert.ok(status.lastSuccessTime);
});
