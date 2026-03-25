// PAGE INJECTS
function injectLogout() {
    let profileButton = document.querySelector("._profileContainer_6urq0_233 button:nth-of-type(2)");
    if (!profileButton || profileButton.dataset.injected === "true") return;
    profileButton.onclick = () => {
        setTimeout(() => {
            let logoutButton = document.querySelector("._menuItems_1wy0x_170 button:nth-of-type(2)");
            if (!logoutButton) return;
            logoutButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                window.electronAPI.logout();
            };
        }, 20);
    };
    
    profileButton.dataset.injected = "true";
}
injectLogout();
const observer2 = new MutationObserver(injectLogout);
observer2.observe(document.body, { childList: true });

// TITLEBAR

async function createTitlebar() {
    if (document.getElementById('custom-titlebar')) return;

    let title = (await window.electronAPI.fetchConfig("config")).window.title;
    
    const titlebar = document.createElement('div');
    titlebar.id = 'custom-titlebar';
    titlebar.innerHTML = `
        <div id="titlebar-label"><img id="titlebar-icon" src="rythmforlinux://build/icon.png">${title}</div>
        <div class="window-controls">
            <div class="control-btn" id="min-btn">─</div>
            <div class="control-btn" id="max-btn">▢</div>
            <div class="control-btn close-btn" id="close-btn">✕</div>
        </div>
    `;

    document.body.prepend(titlebar);

    document.getElementById('min-btn').onclick = () => window.electronAPI.controlWindow('minimize');
    document.getElementById('max-btn').onclick = () => window.electronAPI.controlWindow('maximize');
    document.getElementById('close-btn').onclick = () => window.electronAPI.controlWindow('close');
}

createTitlebar();
const observer = new MutationObserver(createTitlebar);
observer.observe(document.body, { childList: true });

// BOOTSCREEN

function hideBootscreen() {
    const splash = document.getElementById('bootscreen');
    if (!splash) return;
    splash.style.opacity = '1';
    splash.style.animation = 'unset';

    const slowLoadTimeout = setTimeout(() => {
        const msg = document.createElement('div');
        msg.id = 'bootscreen-slow-msg';
        msg.innerHTML = 'Rythm for Linux is taking a bit too long to load...<br>Are you connected to the internet?';
        msg.style.cssText = 'position:absolute;bottom:-2em;left:0;right:0;text-align:center;transition:bottom 1s ease;color:#ffffffa0;font-family:"freesans"';
        splash.appendChild(msg);
        requestAnimationFrame(() => requestAnimationFrame(() => msg.style.bottom = '2em'));
    }, 5000);

    const checkExist = setInterval(() => {
        const appLoaded = document.querySelector('#root');

        if (appLoaded) {
            clearInterval(checkExist);
            clearTimeout(slowLoadTimeout);
            setTimeout(() => {
                splash.style.opacity = '0';
                setTimeout(() => splash.remove(), 1000);
            }, 1500);
        }
    }, 100);
}

hideBootscreen();