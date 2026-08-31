const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('quotaWidget', {
  onUpdate(callback) {
    ipcRenderer.on('quota:update', (_event, value) => callback(value));
  },
  resize(value) {
    ipcRenderer.send('widget:resize', value);
  },
  refresh() {
    ipcRenderer.send('widget:refresh');
  },
  openMenu() {
    ipcRenderer.send('widget:menu');
  }
});
