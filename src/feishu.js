/**
 * 飞书通知服务
 */

/**
 * 发送飞书通知
 */
export async function sendFeishuNotification(env, changes) {
    const webhookUrl = env.FEISHU_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl.includes('your-webhook-key')) {
        console.log('飞书 Webhook URL 未配置');
        return;
    }

    const added = changes?.added || [];
    const updated = changes?.updated || [];
    const changeCount = added.length + updated.length;

    let content = '🚌 班车通知第一页发生变更\n\n';
    content += `变更总数：${changeCount}\n`;
    content += `新增：${added.length}，更新：${updated.length}\n\n`;

    const maxDetails = 8;
    const lines = [];

    for (const item of added.slice(0, maxDetails)) {
        lines.push(`+ ${item.title} (${item.date || '未知日期'})`);
        lines.push(item.href);
    }

    for (const item of updated.slice(0, maxDetails)) {
        const fieldText = item.changedFields.join(', ');
        lines.push(`~ ${item.after.title} [${fieldText}]`);
        lines.push(item.href);
    }

    if (lines.length > 0) {
        content += `${lines.join('\n')}\n\n`;
    }

    content += `检查时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

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
export async function sendFeishuError(env, errorMessage, failureCount) {
    const webhookUrl = env.FEISHU_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl.includes('your-webhook-key')) {
        return;
    }

    const payload = {
        msg_type: 'text',
        content: {
            text: `⚠️ 班车通知监控出错\n\n连续失败次数：${failureCount}\n\n错误信息：${errorMessage}\n\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
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

/**
 * 发送恢复通知
 */
export async function sendFeishuRecovery(env) {
    const webhookUrl = env.FEISHU_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl.includes('your-webhook-key')) {
        return;
    }

    const payload = {
        msg_type: 'text',
        content: {
            text: `✅ 班车通知监控已恢复\n\n服务已恢复正常运行\n\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
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
        console.error('发送恢复通知失败:', error);
    }
}
