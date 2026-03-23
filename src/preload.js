const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    RYTHM_URL: "https://rythm.fm",
    controlWindow: (action) => ipcRenderer.send("window-controls", action),
    logout: () => ipcRenderer.send("logout-clear"),
    inject: (scriptName) => ipcRenderer.send("inject", scriptName),
    fetchConfig: (configName) => ipcRenderer.invoke('fetch-config', configName),
    updateConfig: (configName, updates) => ipcRenderer.invoke('update-config', configName, updates),
    conditionalInjects: (url) => ipcRenderer.send("conditional-injects", url)
});

window.addEventListener("DOMContentLoaded", () => {
    if (window.location.href.startsWith('https://discord.com')) {
        return; 
    }
    
    const splash = document.createElement("div");
    splash.id = "bootscreen";
    Object.assign(splash.style, {
        position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
        background: "#000",
        opacity: "0",
        zIndex: "9999999", transition: "opacity 0.25s ease-in-out",
        userSelect: "none", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center",
        willChange: "transform, opacity",
        transform: "translateZ(0)"
    });

    splash.innerHTML = `
        <canvas id="fluid-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity: 0; transition: opacity 0.8s ease; will-change: opacity; transform: translateZ(0);"></canvas>
        
        <div id="splash-close" style="
            position: absolute; 
            top: 0px; 
            right: 0px; 
            width: 45px; 
            height: 32px; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            color: white; 
            font-family: sans-serif; 
            font-size: 16px; 
            cursor: pointer; 
            z-index: 10000000; 
            opacity: 0.4; 
            transition: all 0.2s ease;
            -webkit-app-region: no-drag; 
            border-radius: 0px;
        ">✕</div>

        <div style="position:relative; z-index: 2; text-align: center; color: white; font-family: 'freesans'; pointer-events: none;">
            <h1 style="letter-spacing: -2px; font-size: 84px; font-weight: normal; margin: 0; filter: drop-shadow(0 0 15px rgba(0,0,0,0.5));">rythm</h1>
            <p style="margin-top: -10px; letter-spacing: 5px; opacity: 1.0; color: #ffffff; font-size: 14px; text-transform: uppercase; padding-left: 30px;">for Linux</p>
        </div>
    `;
    document.documentElement.appendChild(splash);

    const splashClose = document.getElementById('splash-close');
    splashClose.onclick = () => ipcRenderer.send("window-controls", "close");
    splashClose.onmouseenter = () => {
        splashClose.style.opacity = "1";
        splashClose.style.background = "rgba(255,255,255,0.1)";
    };
    splashClose.onmouseleave = () => {
        splashClose.style.opacity = "0.4";
        splashClose.style.background = "transparent";
    };

    const workerCode = `
        let gl, program, tLoc, rLoc, canvas;

        self.onmessage = function(e) {
            if (e.data.type === 'init') {
                canvas = e.data.canvas;
                gl = canvas.getContext('webgl', { 
                    alpha: false, depth: false, antialias: false, 
                    stencil: false, preserveDrawingBuffer: false,
                    powerPreference: "high-performance" 
                });
                
                const vert = \`attribute vec2 p; void main() { gl_Position = vec4(p, 0, 1); }\`;
                const frag = \`
                    precision mediump float;
                    uniform float t;
                    uniform vec2 r;
                    void main() {
                        vec2 uv = gl_FragCoord.xy / r.xy;
                        vec2 p = -1.0 + 2.0 * uv;
                        p.x *= r.x / r.y;
                        for(float i = 1.0; i < 8.0; i++){
                            p.x += 0.3 / i * sin(i * 2.0 * p.y + t);
                            p.y += 0.3 / i * cos(i * 2.0 * p.x + t);
                        }
                        vec3 color = vec3(0.08, 0.08, 0.2) + 0.15 * cos(t + p.xyx + vec3(0,2,4));
                        color = clamp(color + 0.3, 0.0, 1.0);
                        gl_FragColor = vec4(color, 1.0);
                    }
                \`;

                const s = (type, src) => {
                    const shader = gl.createShader(type);
                    gl.shaderSource(shader, src);
                    gl.compileShader(shader);
                    return shader;
                };

                program = gl.createProgram();
                gl.attachShader(program, s(gl.VERTEX_SHADER, vert));
                gl.attachShader(program, s(gl.FRAGMENT_SHADER, frag));
                gl.linkProgram(program);
                gl.useProgram(program);

                gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,-1,-1,1,1,1,-1]), gl.STATIC_DRAW);
                const pLoc = gl.getAttribLocation(program, "p");
                gl.enableVertexAttribArray(pLoc);
                gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

                tLoc = gl.getUniformLocation(program, "t");
                rLoc = gl.getUniformLocation(program, "r");

                self.postMessage({ type: 'ready' });
                requestAnimationFrame(render);
            } 
            
            if (e.data.type === 'resize') {
                if (canvas) {
                    canvas.width = e.data.width;
                    canvas.height = e.data.height;
                    gl.viewport(0, 0, canvas.width, canvas.height);
                }
            }
        };

        function render(time) {
            if (!gl || !canvas) return;
            gl.uniform1f(tLoc, time * 0.0006);
            gl.uniform2f(rLoc, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            requestAnimationFrame(render);
        }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    const canvasEl = document.getElementById("fluid-canvas");
    const offscreen = canvasEl.transferControlToOffscreen();

    worker.onmessage = (e) => {
        if (e.data.type === 'ready') {
            setTimeout(() => { 
                canvasEl.style.opacity = "1";
                splash.style.opacity = "1";
            }, 50);
        }
    };

    worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);

    const handleResize = () => {
        worker.postMessage({ type: 'resize', width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    window.addEventListener('hide-bootscreen', () => {
        splash.style.opacity = "0";
        setTimeout(() => {
            splash.remove();
            worker.terminate();
        }, 300);
    });
});