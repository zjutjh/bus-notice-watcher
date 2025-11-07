/**
 * 飞书通知服务
 */

/**
 * 发送飞书通知
 */
export async function sendFeishuNotification(env, notices) {
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
