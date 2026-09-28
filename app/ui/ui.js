const widget = document.querySelector('#widget');
let loadingTimer;
let dragPoint = null;

function draw(key, value) {
  const root = document.querySelector(`[data-key="${key}"]`);
  const ring = root.querySelector('.ring');
  const raw = value?.remaining;
  const remaining = Number.isFinite(raw) ? raw : null;
  const label = remaining === null ? raw : String(remaining);
  const progress = Number(value?.progress);
  const ringValue = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : remaining;
  ring.querySelector('strong').textContent = label === null || label === undefined ? '--' : String(label);
  ring.style.setProperty('--value', ringValue === null ? (label ? '100%' : '0%') : `${ringValue}%`);
  ring.style.setProperty('--color', value?.color || '#9aa3af');
  root.querySelector('.reset').textContent = value?.reset || '时间未知';
}

function measure() {
  const box = widget.getBoundingClientRect();
  window.quotaWidget.resize({width: box.width, height: box.height});
}

function stopLoadingSoon() {
  clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => widget.classList.remove('refreshing'), 220);
}

function startManualRefresh() {
  clearTimeout(loadingTimer);
  widget.classList.add('refreshing');
  window.quotaWidget.refresh();
  loadingTimer = setTimeout(() => widget.classList.remove('refreshing'), 8000);
}

window.quotaWidget.onUpdate((state) => {
  draw('fiveHour', state.fiveHour);
  draw('weekly', state.weekly);
  const deepseekSection = document.querySelector('[data-key="deepseek"]');
  if (state.deepseek) {
    deepseekSection.hidden = false;
    draw('deepseek', state.deepseek);
  } else {
    deepseekSection.hidden = true;
  }
  document.querySelector('#resets').textContent = `· 重置 ${Number(state.resets) || 0}`;
  if (widget.classList.contains('refreshing')) stopLoadingSoon();
  requestAnimationFrame(measure);
});

document.addEventListener('dblclick', (event) => {
  event.preventDefault();
  startManualRefresh();
});

document.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  dragPoint = {x: event.screenX, y: event.screenY};
});

document.addEventListener('mousemove', (event) => {
  if (!dragPoint || event.buttons !== 1) return;
  const dx = event.screenX - dragPoint.x;
  const dy = event.screenY - dragPoint.y;
  if (!dx && !dy) return;
  dragPoint = {x: event.screenX, y: event.screenY};
  window.quotaWidget.drag({dx, dy});
});

document.addEventListener('mouseup', () => {
  dragPoint = null;
});

document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.quotaWidget.openMenu();
});

new ResizeObserver(measure).observe(widget);
measure();
