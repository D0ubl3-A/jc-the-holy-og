const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("node:path");

const isDevelopment = !app.isPackaged;

function createGameWindow() {
  const window = new BrowserWindow({
    title: "JC The Holy OG",
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: "#05070a",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
    if (isDevelopment && process.env.JC_ELECTRON_DEVTOOLS === "1") {
      window.webContents.openDevTools({ mode: "detach" });
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  window.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createGameWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createGameWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
