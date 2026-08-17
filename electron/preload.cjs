const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("jcDesktop", {
  platform: process.platform,
  packaged: true,
});
