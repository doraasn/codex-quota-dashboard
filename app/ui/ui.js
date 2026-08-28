const widget = document.querySelector('#widget');

function draw(key, value) {
  const root = document.querySelector(`[data-key="${key}"]`);
  const ring = root.querySelector('.ring');
  const remaining = Number.isFinite(value?.remaining) ? value.remaining : null;
  ring.querySelector('strong').textContent = remaining === null ? '--' : String(remaining);
  ring.style.setProperty('--value', remaining === null ? '0%' : `${remaining}%`);
  ring.style.setProperty('--color', value?.color || '#9aa3af');
  root.querySelector('.reset').textContent = value?.reset || '时间未知';
}

function measure() {
  const box = widget.getBoundingClientRect();
  window.quotaWidget.resize({width: box.width, height: box.height});
}

window.quotaWidget.onUpdate((state) => {
  draw('fiveHour', state.fiveHour);
  draw('weekly', state.weekly);
  document.querySelector('#resets').textContent = `· 重置 ${Number(state.resets) || 0}`;
  requestAnimationFrame(measure);
});

document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.quotaWidget.openMenu();
});

new ResizeObserver(measure).observe(widget);
measure();
