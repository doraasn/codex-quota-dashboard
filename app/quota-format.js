const bounded = (value) => Math.max(0, Math.min(100, Number(value)));

export function remainingPercent(usedPercent) {
  const used = Number(usedPercent);
  return Number.isFinite(used) ? Math.round(100 - bounded(used)) : null;
}

export function quotaColor(remaining) {
  if (remaining === null) return '#9aa3af';
  if (remaining >= 80) return '#43c982';
  if (remaining < 10) return '#ff6262';
  return '#efb83f';
}

export function resetLabel(unixSeconds, now = new Date()) {
  const seconds = Number(unixSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return '时间未知';
  const target = new Date(seconds * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayOffset = Math.round((startOfTarget - startOfToday) / 86400000);
  const day = dayOffset === 0 ? '今天' : dayOffset === 1 ? '明天' : `${target.getMonth() + 1}月${target.getDate()}日`;
  const time = new Intl.DateTimeFormat('zh-CN', {hour: '2-digit', minute: '2-digit', hour12: false}).format(target);
  return `${day} ${time}`;
}

export function toWidgetState(result, now = new Date()) {
  const keyed = result?.rateLimitsByLimitId;
  const firstKeyed = keyed && typeof keyed === 'object' ? Object.values(keyed)[0] : null;
  const limits = result?.rateLimits ?? firstKeyed;
  const buildWindow = (name, source) => {
    const remaining = remainingPercent(source?.usedPercent);
    return {
      name,
      remaining,
      color: quotaColor(remaining),
      reset: resetLabel(source?.resetsAt, now)
    };
  };
  return {
    fiveHour: buildWindow('5 小时', limits?.primary),
    weekly: buildWindow('周', limits?.secondary),
    resets: Math.max(0, Math.trunc(Number(result?.rateLimitResetCredits?.availableCount) || 0))
  };
}

function compactAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  if (Math.abs(amount) >= 1000) return `${Math.round(amount / 100) / 10}k`;
  if (Math.abs(amount) >= 100) return String(Math.round(amount));
  if (Math.abs(amount) >= 10) return amount.toFixed(1).replace(/\.0$/, '');
  return amount.toFixed(2).replace(/\.?0+$/, '');
}

export function formatSpent(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  if (Math.abs(amount) >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (Math.abs(amount) >= 1) return amount.toFixed(2).replace(/\.?0+$/, '');
  if (amount === 0) return '0';
  return amount.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

const deepSeekMissing = (reset) => ({name: 'DeepSeek', remaining: null, color: quotaColor(null), reset, todaySpent: null});

export function toDeepSeekWidgetState(result, options = {}) {
  if (options.missingKey) {
    return deepSeekMissing('未配置');
  }
  if (options.error) {
    return {...deepSeekMissing('请求失败'), color: '#ff6262'};
  }

  const balances = Array.isArray(result?.balance_infos) ? result.balance_infos : [];
  const preferred = balances.find((item) => item?.currency === 'CNY') || balances.find((item) => item?.currency === 'USD') || balances[0];
  const amount = Number(preferred?.total_balance);
  if (!preferred || !Number.isFinite(amount)) {
    return deepSeekMissing('余额未知');
  }

  const spent = options.todaySpent === null || options.todaySpent === undefined ? NaN : Number(options.todaySpent);
  const usageConfigured = Boolean(options.usageConfigured);
  let reset = preferred.currency || '余额';
  if (usageConfigured) {
    reset = Number.isFinite(spent) ? `今日 ¥${formatSpent(spent)}` : '今日 --';
  }
  return {
    name: 'DeepSeek',
    remaining: compactAmount(amount),
    color: result?.is_available && amount > 0 ? '#43c982' : '#ff6262',
    reset,
    todaySpent: Number.isFinite(spent) ? spent : null
  };
}

export function emptyWidgetState() {
  return {
    fiveHour: {name: '5 小时', remaining: null, color: quotaColor(null), reset: '时间未知'},
    weekly: {name: '周', remaining: null, color: quotaColor(null), reset: '时间未知'},
    deepseek: {name: 'DeepSeek', remaining: null, color: quotaColor(null), reset: '未配置', todaySpent: null},
    resets: 0
  };
}
