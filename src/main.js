import { app, BrowserWindow, shell, session, ipcMain, protocol, net } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'rythmforlinux',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            bypassCSP: true
        }
    }
]);

import fs from "fs";
import { watch } from "fs";

// TODO: Clarify this
// I genuinely forgot what this did
if (started) {
    app.quit();
}

let RYTHM_URL = "https://rythm.fm";

function isExternal(url) {
    const externalLinks = [
        'discord.com',
        'discord.gg',
        'discord://',
        'twitter.com',
        'facebook.com',
        'instagram.com'
    ];
    return externalLinks.some(link => url.includes(link));
}

const createWindow = () => {
    let configs = {};

    {
        const rootPath = app.getAppPath().endsWith("/app.asar") ? path.resolve(path.join(app.getAppPath(), "..")) : app.getAppPath();
        let dir = fs.readdirSync(path.join(rootPath, "config"));
        dir.forEach(item => {
            let itemPath = path.join(rootPath, "config", item);
            if (fs.lstatSync(itemPath).isFile() && path.extname(itemPath) == ".json") {
                let configData = fs.readFileSync(itemPath);
                let configObject = null;
                try {
                    configObject = JSON.parse(configData.toString());
                } catch (e) {
                    console.error(`Failed to load ${item} config:`, e);
                }
                if (!configObject) return;
                configs[item.slice(0, item.length-path.extname(itemPath).length)] = configObject;
            }
        })
    }

    const mainWindow = new BrowserWindow({
        width: configs.config.window.size.width,
        height: configs.config.window.size.height,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: "#000000",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
        },
    });
    
    const PACKAGE_INFO = JSON.parse(fs.readFileSync(path.join(app.getAppPath().endsWith("/app.asar") ? path.resolve(path.join(app.getAppPath(), "..")) : app.getAppPath(), "package.json")));
    
    ipcMain.handle('package-info', (_event) => {
        return PACKAGE_INFO;
    });

    ipcMain.handle('fetch-config', (_event, configName) => {
        const config = configs[configName];
        if (config) {
            return config;
        } else {
            console.error(`Config '${configName}' not found.`);
            return null;
        }
    });

    ipcMain.on('window-controls', (event, action) => {
        if (action === 'minimize') mainWindow.minimize();
        if (action === 'maximize') {
            mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
        }
        if (action === 'close') mainWindow.close();
    });

    // ========================
    // Discord sign-in handling
    // ========================

    session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        const url = details.url.toLowerCase();

        // Block deep links
        if (url.startsWith('discord://')) {
            console.log("Blocked Protocol:", url);
            return callback({ cancel: true });
        }

        // Block localhost such that apps like Discord cannot link up with anything
        if (url.includes('127.0.0.1')) {
            console.log("Blocked Local Discovery:", url);
            return callback({ cancel: true });
        }

        callback({ cancel: false });
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('discord.com')) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                    webPreferences: {
                        session: session.defaultSession,
                    }
                }
            };
        }

        shell.openExternal(url);
        return { action: 'deny' };
    });
    app.on('web-contents-created', (event, contents) => {
        contents.on('will-navigate', (event, navigationUrl) => {
            if (navigationUrl.startsWith('discord://')) {
                event.preventDefault();
            }
        });
    });
    ipcMain.on('logout-clear', async () => {
        const ses = session.defaultSession;

        await ses.clearStorageData({
            storages: ['cookies', 'localstorage', 'indexdb', 'cache', 'serviceworkers']
        });

        console.log("Session cleared. Reloading...");

        if (mainWindow) mainWindow.loadURL(RYTHM_URL);
    });

    // Inject hooks
    ipcMain.on('inject', async (_event, scriptName) => {
        const rootPath = app.getAppPath().endsWith("/app.asar") ? path.resolve(path.join(app.getAppPath(), "..")) : app.getAppPath();
        const jsInjectPath = path.join(rootPath, "injects", scriptName);
        if (fs.existsSync(jsInjectPath)) {
            const jsData = fs.readFileSync(jsInjectPath, "utf8");
            mainWindow.webContents.executeJavaScript(jsData)
                .then(() => console.log(`JSInject ${scriptName} Injected successfully`))
                .catch(err => console.error(`JSInject ${scriptName} Injection failed:`, err));
        } else {
            console.error(`JSInject ${scriptName} file not found!`);
        }
    });
    ipcMain.on('conditional-injects', async (_event, url) => {
        Object.keys(configs.injects).forEach(inject_url => {
            if (url === RYTHM_URL + "/" + inject_url) {
                configs.injects[inject_url].forEach(scriptName => {
                    const rootPath = app.getAppPath().endsWith("/app.asar") ? path.resolve(path.join(app.getAppPath(), "..")) : app.getAppPath();
                    const jsInjectPath = path.join(rootPath, "injects", scriptName + ".js");
                    if (fs.existsSync(jsInjectPath)) {
                        const jsData = fs.readFileSync(jsInjectPath, "utf8");
                        mainWindow.webContents.executeJavaScript(jsData)
                            .then(() => console.log(`JSInject ${scriptName} Injected successfully`))
                            .catch(err => console.error(`JSInject ${scriptName} Injection failed:`, err));
                    } else {
                        console.error(`JSInject ${scriptName} file not found!`);
                    }
                })
            }
        });
    });

    mainWindow.webContents.on("dom-ready", () => {
        const rootPath = app.getAppPath().endsWith("/app.asar") ? path.resolve(path.join(app.getAppPath(), "..")) : app.getAppPath();
        const cssPath = path.join(rootPath, "modules", "index.css");
        const jsPath = path.join(rootPath, "modules", "index.js");
        const jsInjectPath = path.join(rootPath, "modules", "inject.js");
        const cssPatchesPath = path.join(rootPath, "css", "patches");

        console.log("Looking for CSS at:", cssPath);
        console.log("Looking for JS at:", jsPath);
        console.log("Looking for JSInject at:", jsInjectPath);
        console.log("Looking for CSS patches at:", cssPatchesPath);

        // Inject CSS
        if (fs.existsSync(cssPath)) {
            const cssData = fs.readFileSync(cssPath, "utf8");
            mainWindow.webContents.insertCSS(cssData);
            console.log("CSS Injected successfully");
        } else {
            console.error("CSS file not found!");
        }

        // Inject CSS patches from css/patches directory
        if (fs.existsSync(cssPatchesPath)) {
            const patchFiles = fs.readdirSync(cssPatchesPath);
            patchFiles.forEach(file => {
                if (path.extname(file) === ".css") {
                    const patchPath = path.join(cssPatchesPath, file);
                    try {
                        const cssData = fs.readFileSync(patchPath, "utf8");
                        mainWindow.webContents.insertCSS(cssData);
                        console.log(`CSS patch '${file}' injected successfully`);
                    } catch (err) {
                        console.error(`Failed to inject CSS patch '${file}':`, err);
                    }
                }
            });
        } else {
            console.warn("CSS patches directory not found!");
        }

        // Inject JavaScript
        if (fs.existsSync(jsPath)) {
            const jsData = fs.readFileSync(jsPath, "utf8");
            mainWindow.webContents.executeJavaScript(jsData)
                .then(() => console.log("JS Injected successfully"))
                .catch(err => console.error("JS Injection failed:", err));
        } else {
            console.error("JS file not found!");
        }

        // Inject JavaScript Inject
        if (fs.existsSync(jsInjectPath)) {
            const jsData = fs.readFileSync(jsInjectPath, "utf8");
            mainWindow.webContents.executeJavaScript(jsData)
                .then(() => console.log("JSInject Injected successfully"))
                .catch(err => console.error("JSInject Injection failed:", err));
        } else {
            console.error("JSInject file not found!");
        }
    });

    mainWindow.loadURL(RYTHM_URL);

    mainWindow.setAutoHideMenuBar(true);
    mainWindow.menuBarVisible = false;

    // Watch for custom CSS changes
    const rootPath = app.getAppPath().endsWith("/app.asar") ? path.resolve(path.join(app.getAppPath(), "..")) : app.getAppPath();
    const customCSSPath = path.join(rootPath, "css", "custom.css");
    let customCSSWatcher = null;
    let customCSSInjectionId = "rythm-custom-css-style";

    const injectCustomCSS = () => {
        if (configs.config.customCSS && fs.existsSync(customCSSPath)) {
            try {
                const cssData = fs.readFileSync(customCSSPath, "utf8");
                // Inject CSS via style tag for easy removal and updates
                const script = `
                    (function() {
                        let style = document.getElementById('${customCSSInjectionId}');
                        if (!style) {
                            style = document.createElement('style');
                            style.id = '${customCSSInjectionId}';
                            document.head.appendChild(style);
                        }
                        style.textContent = \`${cssData.replace(/`/g, '\\`')}\`;
                    })();
                `;
                mainWindow.webContents.executeJavaScript(script)
                    .then(() => console.log("Custom CSS injected successfully"))
                    .catch(err => console.error("Failed to inject custom CSS:", err));
            } catch (err) {
                console.error("Failed to inject custom CSS:", err);
            }
        }
    };

    const removeCustomCSS = () => {
        const script = `
            (function() {
                let style = document.getElementById('${customCSSInjectionId}');
                if (style) {
                    style.remove();
                }
            })();
        `;
        mainWindow.webContents.executeJavaScript(script)
            .then(() => console.log("Custom CSS removed successfully"))
            .catch(err => console.error("Failed to remove custom CSS:", err));
    };

    const setupCustomCSSWatcher = () => {
        // Clear existing watcher if any
        if (customCSSWatcher) {
            customCSSWatcher.close();
            customCSSWatcher = null;
        }

        // Setup new watcher if custom CSS is enabled
        if (configs.config.customCSS) {
            customCSSWatcher = watch(customCSSPath, (eventType, filename) => {
                if (eventType === 'change') {
                    console.log("Custom CSS file changed, reloading...");
                    injectCustomCSS();
                }
            });
            console.log("Custom CSS watcher started");
        } else {
            console.log("Custom CSS watcher stopped");
        }
    };

    // Inject custom CSS on startup if enabled
    setTimeout(() => {
        injectCustomCSS();
        setupCustomCSSWatcher();
    }, 100);

    // Setup update-config handler to manage CSS watcher
    ipcMain.handle('update-config', (_event, configName, updates) => {
        const rootPath = app.getAppPath().endsWith("/app.asar") ? path.resolve(path.join(app.getAppPath(), "..")) : app.getAppPath();
        const configPath = path.join(rootPath, "config", configName + ".json");

        if (configs[configName]) {
            // Update in-memory config
            Object.assign(configs[configName], updates);

            // Write to file
            try {
                fs.writeFileSync(configPath, JSON.stringify(configs[configName], null, 4), "utf8");
                console.log(`Config '${configName}' updated successfully`);

                // If customCSS config was updated, reconfigure the watcher
                if (configName === 'config' && 'customCSS' in updates) {
                    setupCustomCSSWatcher();
                    if (updates.customCSS) {
                        injectCustomCSS();
                    } else {
                        removeCustomCSS();
                    }
                }

                return { success: true, config: configs[configName] };
            } catch (err) {
                console.error(`Failed to update config '${configName}':`, err);
                return { success: false, error: err.message };
            }
        } else {
            console.error(`Config '${configName}' not found.`);
            return { success: false, error: `Config '${configName}' not found` };
        }
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    protocol.handle('rythmforlinux', (request) => {
        if (!request.url.startsWith("rythmforlinux://")) return new Response(null, {
            status: 400
        });
        const filePath = request.url.slice('rythmforlinux://'.length, request.url.length);
        const rootPath = app.getAppPath().endsWith("/app.asar") ? path.resolve(path.join(app.getAppPath(), "..")) : app.getAppPath();
        const absolutePath = path.join(rootPath, filePath);

        if (!absolutePath.startsWith(rootPath)) return new Response(null, {
            status: 403
        });

        return net.fetch(`file://${absolutePath}`, {
            bypassCustomProtocolHandlers: true
        }).then(response => {
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: {
                    ...Object.fromEntries(response.headers.entries()),
                    'Access-Control-Allow-Origin': '*',
                }
            });
        });
    });

    createWindow();

    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
