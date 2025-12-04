/**
 * Experiment Panel Controller
 * Handles panel toggle, resize, and state management
 */

class ExperimentController {
    constructor() {
        this.toggle = document.getElementById('experimentToggle');
        this.panel = document.getElementById('experimentPanel');
        this.theoryPanel = document.getElementById('theoryPanel');
        this.resizeHandle = document.getElementById('resizeHandle');
        
        this.customPanelWidth = null;
        this.isResizing = false;
        
        this.init();
    }
    
    init() {
        this.setupToggle();
        this.setupResize();
    }
    
    setupToggle() {
        // By default open
        this.openPanel();

        this.toggle.addEventListener('click', () => {
            const isOpen = this.panel.classList.contains('open');
            
            if (isOpen) {
                this.closePanel();
            } else {
                this.openPanel();
            }
        });
    }
    
    openPanel() {
        this.panel.classList.add('open');
        this.theoryPanel.classList.add('experiment-open');
        
        if (this.customPanelWidth) {
            this.panel.style.width = `${this.customPanelWidth}px`;
            this.theoryPanel.style.marginRight = `${this.customPanelWidth}px`;
        }
        
        this.toggle.textContent = 'Close Experiment';
        this.toggle.classList.add('active');
    }
    
    closePanel() {
        const currentWidth = this.panel.offsetWidth;
        this.customPanelWidth = currentWidth;
        
        this.panel.classList.remove('open');
        this.theoryPanel.classList.remove('experiment-open');
        
        this.panel.style.width = '';
        this.theoryPanel.style.marginRight = '';
        
        this.toggle.textContent = 'Open Experiment';
        this.toggle.classList.remove('active');
    }
    
    setupResize() {
        this.resizeHandle.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            document.body.style.cursor = 'ew-resize';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;
            
            const newWidth = window.innerWidth - e.clientX;
            const minWidth = window.innerWidth * 0.2667;
            const maxWidth = window.innerWidth * 0.5;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                this.panel.style.width = `${newWidth}px`;
                this.customPanelWidth = newWidth;
                
                if (this.panel.classList.contains('open')) {
                    this.theoryPanel.style.marginRight = `${newWidth}px`;
                }
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.isResizing = false;
            document.body.style.cursor = 'default';
        });
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.experimentController = new ExperimentController();
    });
} else {
    window.experimentController = new ExperimentController();
}