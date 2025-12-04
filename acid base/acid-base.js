/**
 * Acid-Base pH Indicator Experiment - Main Controller
 * Visualizes color changes in test tubes with litmus and universal indicators
 */

class AcidBaseExperiment {
    constructor() {
        this.mode = 'formula'; // 'formula' or 'ml'
        this.indicator = 'universal'; // 'litmus' or 'universal'
        this.pH = 7.0;
        this.pathLengthCm = 1.0;
        
        this.p5Instance = null;
        this.mlTrained = false;
        
        // Current color result
        this.currentColor = { r: 0, g: 255, b: 0 }; // Start with green (neutral)
        this.targetColor = { r: 0, g: 255, b: 0 };
        
        // Animation state
        this.bubbles = [];
        
        this.init();
    }
    
    init() {
        console.log('🧪 Initializing Acid-Base Experiment...');
        this.setupModeButtons();
        this.setupControls();
        this.setupPresets();
        this.setupMLSection();
        this.initP5();
        this.loadSavedModel();
        this.updateColor();
        console.log('✅ Acid-Base Experiment initialized');
    }
    
    setupModeButtons() {
        const formulaBtn = document.getElementById('formulaModeBtn');
        const mlBtn = document.getElementById('mlModeBtn');
        const modeHint = document.getElementById('modeHint');
        const mlSection = document.getElementById('mlSection');
        
        formulaBtn.addEventListener('click', () => {
            this.mode = 'formula';
            formulaBtn.classList.add('active');
            mlBtn.classList.remove('active');
            modeHint.textContent = 'Using Henderson-Hasselbalch equation for litmus, RGB interpolation for universal';
            mlSection.style.display = 'none';
            this.updateColor();
        });
        
        mlBtn.addEventListener('click', () => {
            this.mode = 'ml';
            mlBtn.classList.add('active');
            formulaBtn.classList.remove('active');
            modeHint.textContent = 'Using trained neural network to predict RGB values';
            mlSection.style.display = 'block';
            
            if (!this.mlTrained) {
                const statusDiv = document.getElementById('mlStatus');
                statusDiv.className = 'status-message show status-warning';
                statusDiv.textContent = '⚠️ Please train the model first to use ML predictions';
            }
            
            this.updateColor();
        });
    }
    
    setupControls() {
        // pH slider
        const pHInput = document.getElementById('inputPH');
        const pHValue = document.getElementById('valuePH');
        pHInput.addEventListener('input', (e) => {
            this.pH = parseFloat(e.target.value);
            pHValue.textContent = this.pH.toFixed(1);
            this.updateColor();
            this.createBubbles();
        });
        
        // Path length slider
        const pathInput = document.getElementById('inputPathLength');
        const pathValue = document.getElementById('valuePathLength');
        pathInput.addEventListener('input', (e) => {
            this.pathLengthCm = parseFloat(e.target.value);
            pathValue.textContent = this.pathLengthCm.toFixed(1) + ' cm';
            this.updateColor();
        });
        
        // Indicator radio buttons
        document.querySelectorAll('input[name="indicator"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.indicator = e.target.value;
                this.updateColor();
                this.createBubbles();
            });
        });
        
        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
    }
    
    setupPresets() {
        // Common solution pH presets
        const presets = {
            'battery-acid': 1.0,
            'lemon-juice': 2.0,
            'vinegar': 2.4,
            'orange-juice': 3.5,
            'coffee': 5.0,
            'milk': 6.5,
            'pure-water': 7.0,
            'sea-water': 8.0,
            'baking-soda': 9.0,
            'milk-of-magnesia': 10.5,
            'ammonia': 11.5,
            'bleach': 12.5,
            'drain-cleaner': 14.0
        };
        
        Object.keys(presets).forEach(key => {
            const btn = document.getElementById(key);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.pH = presets[key];
                    document.getElementById('inputPH').value = this.pH;
                    document.getElementById('valuePH').textContent = this.pH.toFixed(1);
                    this.updateColor();
                    this.createBubbles();
                });
            }
        });
    }
    
    reset() {
        this.pH = 7.0;
        this.pathLengthCm = 1.0;
        this.indicator = 'universal';
        
        document.getElementById('inputPH').value = 7.0;
        document.getElementById('valuePH').textContent = '7.0';
        document.getElementById('inputPathLength').value = 1.0;
        document.getElementById('valuePathLength').textContent = '1.0 cm';
        document.getElementById('indicator-universal').checked = true;
        
        this.updateColor();
        this.bubbles = [];
    }
    
    setupMLSection() {
        document.getElementById('trainModelBtn').addEventListener('click', () => {
            this.trainMLModel();
        });
    }
    
    async trainMLModel() {
        const statusDiv = document.getElementById('mlStatus');
        const modelStatusDiv = document.getElementById('modelStatus');
        const trainBtn = document.getElementById('trainModelBtn');
        
        try {
            trainBtn.disabled = true;
            statusDiv.className = 'status-message show status-info';
            statusDiv.textContent = '🔄 Generating synthetic training data...';
            
            const dataset = window.mlAcidBase.generateSyntheticDataset(1000, 42);
            
            statusDiv.textContent = '🤖 Training model (50 epochs)...';
            
            await window.mlAcidBase.trainAcidBaseModel(dataset, {
                epochs: 50,
                batchSize: 32
            });
            
            this.mlTrained = true;
            statusDiv.className = 'status-message show status-success';
            statusDiv.textContent = '✅ Model trained successfully!';
            
            modelStatusDiv.style.background = '#f0fdf4';
            modelStatusDiv.style.borderColor = '#4CAF50';
            modelStatusDiv.style.color = '#15803d';
            modelStatusDiv.textContent = '✓ Model trained and ready';
            
            // Update visualization if in ML mode
            if (this.mode === 'ml') {
                this.updateColor();
            }
            
        } catch (error) {
            console.error('❌ Training error:', error);
            statusDiv.className = 'status-message show status-error';
            statusDiv.textContent = '❌ Training failed: ' + error.message;
        } finally {
            trainBtn.disabled = false;
        }
    }
    
    async loadSavedModel() {
        const model = await window.mlAcidBase.loadModelIndexedDB('acid-base-model');
        const norm = window.mlAcidBase.loadNormalizationIndexedDB('acid-base-normalization');
        
        if (model && norm) {
            this.mlTrained = true;
            const modelStatusDiv = document.getElementById('modelStatus');
            modelStatusDiv.style.background = '#f0fdf4';
            modelStatusDiv.style.borderColor = '#4CAF50';
            modelStatusDiv.style.color = '#15803d';
            modelStatusDiv.textContent = '✓ Saved model loaded';
        }
    }
    
    async updateColor() {
        let colorResult;
        
        if (this.mode === 'formula') {
            // Use physics-based simulation
            colorResult = window.mlAcidBase.runSimulation({
                runId: 'interactive',
                indicator: this.indicator,
                pH: this.pH,
                pathLengthCm: this.pathLengthCm
            });
        } else {
            // Use ML model
            if (!this.mlTrained) {
                // Show placeholder color
                this.targetColor = { r: 150, g: 150, b: 150 };
                this.updateStats();
                return;
            }
            const norm = window.mlAcidBase.getNormalization();
            colorResult = await window.mlAcidBase.predictColor(
                this.pH,
                this.pathLengthCm,
                this.indicator,
                norm
            );
        }
        
        this.targetColor = colorResult;
        this.updateStats();
    }
    
    updateStats() {
        document.getElementById('statPH').textContent = this.pH.toFixed(2);
        document.getElementById('statIndicator').textContent = 
            this.indicator === 'litmus' ? 'Litmus' : 'Universal';
        document.getElementById('statRGB').textContent = 
            `R:${Math.round(this.targetColor.r)} G:${Math.round(this.targetColor.g)} B:${Math.round(this.targetColor.b)}`;
        
        // Determine acidity/basicity
        let nature = 'Neutral';
        if (this.pH < 6.5) nature = 'Acidic';
        else if (this.pH > 7.5) nature = 'Basic';
        document.getElementById('statNature').textContent = nature;
    }
    
    createBubbles() {
        // Create bubbles when pH changes significantly (visual feedback)
        for (let i = 0; i < 3; i++) {
            this.bubbles.push({
                x: (this.p5Instance.width / 2) + (Math.random() - 0.5) * 60,
                y: this.p5Instance.height * 0.5 + Math.random() * 100,
                size: 5 + Math.random() * 10,
                speed: 1 + Math.random() * 2,
                life: 1.0
            });
        }
    }
    
    initP5() {
        const container = document.getElementById('p5Container');
        
        const sketch = (p) => {
            p.setup = () => {
                const canvas = p.createCanvas(container.offsetWidth, 500);
                canvas.parent(container);
                console.log('🧪 P5.js canvas ready');
            };
            
            p.draw = () => {
                this.drawVisualization(p);
            };
            
            p.windowResized = () => {
                p.resizeCanvas(container.offsetWidth, 500);
            };
        };
        
        this.p5Instance = new p5(sketch);
    }
    
    drawVisualization(p) {
        // Background
        p.background(245);
        
        // Smooth color transition
        this.currentColor.r = p.lerp(this.currentColor.r, this.targetColor.r, 0.1);
        this.currentColor.g = p.lerp(this.currentColor.g, this.targetColor.g, 0.1);
        this.currentColor.b = p.lerp(this.currentColor.b, this.targetColor.b, 0.1);
        
        const liquidColor = p.color(
            this.currentColor.r,
            this.currentColor.g,
            this.currentColor.b
        );
        
        // Draw test tube
        const tubeX = p.width / 2;
        const tubeY = p.height * 0.15;
        const tubeWidth = 120;
        const tubeHeight = 280;
        
        // Test tube glass (with transparency)
        p.fill(255, 255, 255, 150);
        p.stroke(120, 120, 120);
        p.strokeWeight(4);
        p.rect(tubeX - tubeWidth/2, tubeY, tubeWidth, tubeHeight, 0, 0, 20, 20);
        
        // Liquid fill
        const fillHeight = tubeHeight * 0.7;
        const fillY = tubeY + tubeHeight - fillHeight;
        
        p.fill(liquidColor);
        p.noStroke();
        p.rect(tubeX - tubeWidth/2 + 4, fillY, tubeWidth - 8, fillHeight, 0, 0, 16, 16);
        
        // Draw bubbles
        this.bubbles = this.bubbles.filter(bubble => {
            bubble.y -= bubble.speed;
            bubble.life -= 0.01;
            
            if (bubble.life > 0 && bubble.y > fillY) {
                p.fill(255, 255, 255, bubble.life * 150);
                p.noStroke();
                p.circle(bubble.x, bubble.y, bubble.size);
                return true;
            }
            return false;
        });
        
        // Shine effect (glass reflection)
        p.fill(255, 255, 255, 120);
        p.noStroke();
        p.ellipse(tubeX - tubeWidth/4, fillY + 40, tubeWidth/3, fillHeight * 0.4);
        
        // Top rim highlight
        p.stroke(180);
        p.strokeWeight(2);
        p.noFill();
        p.arc(tubeX, tubeY, tubeWidth - 8, 20, 0, p.PI);
        
        // pH label below tube
        p.fill(60);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(36);
        p.textStyle(p.BOLD);
        p.text(`pH ${this.pH.toFixed(1)}`, tubeX, tubeY + tubeHeight + 45);
        
        // Indicator label
        p.textSize(18);
        p.textStyle(p.NORMAL);
        p.fill(100);
        p.text(`${this.indicator === 'litmus' ? 'Litmus' : 'Universal'} Indicator`, 
                tubeX, tubeY + tubeHeight + 75);
        
        // Draw pH scale reference
        this.drawPHScale(p);
    }
    
    drawPHScale(p) {
        const scaleX = p.width * 0.1;
        const scaleY = p.height - 90;
        const scaleWidth = p.width * 0.8;
        const scaleHeight = 35;
        
        // Title
        p.fill(60);
        p.noStroke();
        p.textAlign(p.CENTER, p.BOTTOM);
        p.textSize(14);
        p.textStyle(p.BOLD);
        p.text('pH Scale', p.width / 2, scaleY - 10);
        
        // Draw gradient scale
        for (let i = 0; i < scaleWidth; i++) {
            const pH = (i / scaleWidth) * 14;
            let rgb;
            
            if (this.indicator === 'litmus') {
                const { acid, base } = window.mlAcidBase.litmusAcidBaseRatio(pH, 7.0);
                rgb = window.mlAcidBase.interpolateRGB([255, 0, 0], [0, 0, 255], base);
            } else {
                rgb = window.mlAcidBase.interpolateUniversalColor(pH);
            }
            
            p.stroke(rgb[0], rgb[1], rgb[2]);
            p.strokeWeight(1);
            p.line(scaleX + i, scaleY, scaleX + i, scaleY + scaleHeight);
        }
        
        // Border
        p.noFill();
        p.stroke(80);
        p.strokeWeight(2);
        p.rect(scaleX, scaleY, scaleWidth, scaleHeight);
        
        // pH labels
        p.fill(60);
        p.noStroke();
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(12);
        p.textStyle(p.NORMAL);
        for (let pH = 0; pH <= 14; pH += 2) {
            const x = scaleX + (pH / 14) * scaleWidth;
            p.text(pH, x, scaleY + scaleHeight + 5);
        }
        
        // Current pH indicator (arrow)
        const currentX = scaleX + (this.pH / 14) * scaleWidth;
        p.fill(0);
        p.noStroke();
        p.triangle(currentX - 8, scaleY - 12, currentX + 8, scaleY - 12, currentX, scaleY - 3);
        
        // Vertical line
        p.stroke(0);
        p.strokeWeight(2);
        p.line(currentX, scaleY, currentX, scaleY + scaleHeight);
    }
}

// ============================================================================
// INITIALIZE
// ============================================================================

window.acidBaseExperiment = new AcidBaseExperiment();