const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("insaatErp", {
  platform: process.platform,
});
