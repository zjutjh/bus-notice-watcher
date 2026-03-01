/**
 * 配置常量
 */

export const CONFIG = {
    // 系统状态存储的 KEY
    STATUS_KEY: '_system_status_',
    
    // 失败阈值
    FAILURE_THRESHOLD: 3,

    // 正文抓取并发数
    DETAIL_FETCH_CONCURRENCY: 6,
    
    // 目标 URL
    TARGET_URL: 'https://www.zjut.edu.cn/xqbc/list.htm',
    
    // 基础 URL
    BASE_URL: 'https://www.zjut.edu.cn',

    // 列表接口需要排除的系统 key（含历史快照 key，避免污染输出）
    RESERVED_KEYS: ['_system_status_', '_global_notices_snapshot_', '_page1_notices_snapshot_']
};
