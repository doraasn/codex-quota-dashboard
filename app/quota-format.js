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

export function emptyWidgetState() {
  return {
    fiveHour: {name: '5 小时', remaining: null, color: quotaColor(null), reset: '时间未知'},
    weekly: {name: '周', remaining: null, color: quotaColor(null), reset: '时间未知'},
    resets: 0
  };
}
