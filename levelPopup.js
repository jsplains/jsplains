/**
 * levelPopup.js
 * A self-contained module to preview levels in a modal overlay.
 */
const LevelPopup = {
    isOpen: false,
    renderer: null,
    animationId: null,
    camera: { x: 0, y: 0 },
    zoom: 1.0,
    levelData: null,
    keys: {},
    mouseDragging: false,
    mouseX: 0,
    mouseY: 0,
    _boundHandleKey: null,

    async show(levelCode) {
        if (this.isOpen) return;
        
        // 1. Parse Data first
        const data = LevelRenderer.getDataFromCode(levelCode);
        if (!data) {
            alert('Invalid level code');
            return;
        }

        this.levelData = data;
        this.isOpen = true;
        this.camera = { x: 0, y: 0 };
        this.zoom = 1.0;

        // 2. Setup UI
        this._injectStyles();
        this._createElements();

        // 3. Init Renderer
        this.renderer = new LevelRenderer(this.canvas);
        await this.renderer.loadAssets();

        // 4. Start Logic
        this._addEventListeners();
        this._animate();
    },

    close() {
        this.isOpen = false;
        cancelAnimationFrame(this.animationId);
        
        // Clean up listeners
        window.removeEventListener('keydown', this._boundHandleKey);
        window.removeEventListener('keyup', this._boundHandleKey);
        
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.keys = {};
    },

    _createElements() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'lp-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'lp-modal';
        
        const header = document.createElement('div');
        header.className = 'lp-header';
        header.innerHTML = `
            <div style="color:white; font-weight:bold;">Level Preview</div>
            <button class="lp-close-btn" id="lp-close-trigger">&times;</button>
        `;

        const subheader = document.createElement('div');
        subheader.style = "color:#888; font-size:11px; margin-bottom:10px; text-align:center;";
        subheader.innerText = "WASD/Arrows: Pan | Scroll: Zoom | Mouse: Drag";

        this.canvas = document.createElement('canvas');
        this.canvas.width = Math.min(window.innerWidth - 40, 1000);
        this.canvas.height = Math.min(window.innerHeight - 150, 700);
        this.canvas.className = 'lp-canvas';

        const footer = document.createElement('div');
        footer.style = "margin-top: 10px; display: flex; justify-content: center;";
        
        const screenBtn = document.createElement('button');
        screenBtn.className = 'lp-btn-green';
        screenBtn.textContent = 'Download HD Screenshot';
        screenBtn.onclick = () => this._takeScreenshot();

        footer.appendChild(screenBtn);
        modal.appendChild(header);
        modal.appendChild(subheader);
        modal.appendChild(this.canvas);
        modal.appendChild(footer);
        this.overlay.appendChild(modal);
        document.body.appendChild(this.overlay);

        // Standard button close
        document.getElementById('lp-close-trigger').onclick = () => this.close();

        // NEW: Improved background click logic
        let clickStartedOnOverlay = false;
        this.overlay.onmousedown = (e) => {
            clickStartedOnOverlay = (e.target === this.overlay);
        };
        this.overlay.onmouseup = (e) => {
            if (clickStartedOnOverlay && e.target === this.overlay) {
                this.close();
            }
            clickStartedOnOverlay = false;
        };
    },

    _injectStyles() {
        if (document.getElementById('lp-styles')) return;
        const style = document.createElement('style');
        style.id = 'lp-styles';
        style.textContent = `
            .lp-overlay { 
                position: fixed; top:0; left:0; width:100vw; height:100vh; 
                background: rgba(0,0,0,0.9); display: flex; align-items: center; 
                justify-content: center; z-index: 100000; font-family: sans-serif;
                backdrop-filter: blur(4px);
            }
            .lp-modal { 
                background: #1a1a1a; padding: 15px; border-radius: 12px; 
                border: 1px solid #333; box-shadow: 0 20px 50px rgba(0,0,0,1);
            }
            .lp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
            .lp-canvas { background: #ccc; border-radius: 4px; display: block; cursor: move; }
            .lp-close-btn { 
                background: #444; border: none; color: white; width: 30px; height: 30px;
                border-radius: 50%; cursor: pointer; font-size: 20px; line-height: 30px;
            }
            .lp-close-btn:hover { background: #ff4444; }
            .lp-btn-green { 
                background: #2e7d32; color: white; border: none; padding: 10px 20px; 
                border-radius: 6px; cursor: pointer; font-weight: bold;
            }
            .lp-btn-green:hover { background: #388e3c; }
        `;
        document.head.appendChild(style);
    },

    _addEventListeners() {
        this._boundHandleKey = (e) => { this.keys[e.key.toLowerCase()] = (e.type === 'keydown'); };
        window.addEventListener('keydown', this._boundHandleKey);
        window.addEventListener('keyup', this._boundHandleKey);

        this.canvas.onmousedown = (e) => {
            this.mouseDragging = true;
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            e.stopPropagation(); // Prevents the overlay from seeing this mousedown
        };

        window.onmousemove = (e) => {
            if (this.mouseDragging && this.isOpen) {
                const deltaX = e.clientX - this.mouseX;
                const deltaY = e.clientY - this.mouseY;
                this.camera.x -= deltaX / this.zoom;
                this.camera.y += deltaY / this.zoom;
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
            }
        };

        window.onmouseup = () => { 
            this.mouseDragging = false; 
        };

        this.canvas.onwheel = (e) => {
            e.preventDefault();

            // 1. Get mouse position relative to the canvas
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 2. Calculate the "World" position under the mouse before zooming
            // We adjust for the fact that camera.x/y is the center of the screen
            const worldMouseX = this.camera.x + (mouseX - this.canvas.width / 2) / this.zoom;
            const worldMouseY = this.camera.y - (mouseY - this.canvas.height / 2) / this.zoom;

            // 3. Update the zoom level
            const zoomSpeed = 0.15;
            this.zoom = Math.max(0.1, Math.min(2, this.zoom + (e.deltaY < 0 ? zoomSpeed : -zoomSpeed)));
            
            // 4. Adjust camera so the world position stays under the mouse
            // Formula: NewCam = WorldPoint - (MouseOffset / NewZoom)
            this.camera.x = worldMouseX - (mouseX - this.canvas.width / 2) / this.zoom;
            this.camera.y = worldMouseY + (mouseY - this.canvas.height / 2) / this.zoom;
        };
    },

    _animate() {
        if (!this.isOpen) return;

        const panSpeed = 12 / this.zoom;
        if (this.keys['arrowup'] || this.keys['w']) this.camera.y += panSpeed;
        if (this.keys['arrowdown'] || this.keys['s']) this.camera.y -= panSpeed;
        if (this.keys['arrowleft'] || this.keys['a']) this.camera.x -= panSpeed;
        if (this.keys['arrowright'] || this.keys['d']) this.camera.x += panSpeed;

        const ctx = this.canvas.getContext('2d');
        ctx.fillStyle = '#ccc';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.levelData && this.renderer.assetsLoaded) {
            this.renderer.render(this.levelData, this.camera, this.zoom);
        }

        this.animationId = requestAnimationFrame(() => this._animate());
    },

    _takeScreenshot() {
        if (!this.levelData) return;
        const scale = 8;
        const hiRes = document.createElement('canvas');
        hiRes.width = this.canvas.width * scale;
        hiRes.height = this.canvas.height * scale;
        const r = new LevelRenderer(hiRes);
        Object.assign(r, this.renderer);
        r.canvas = hiRes;
        r.ctx = hiRes.getContext('2d');
        r.render(this.levelData, this.camera, this.zoom * scale);
        const link = document.createElement('a');
        link.download = `preview_${Date.now()}.png`;
        link.href = hiRes.toDataURL();
        link.click();
    }
};