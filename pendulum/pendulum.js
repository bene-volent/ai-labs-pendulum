/**
 * Simple Pendulum Experiment - Dual Mode
 * Formula-Based vs Machine Learning Prediction
 */

class PendulumExperiment {
    constructor() {
        // Prediction data
        this.mlModelData = null;
        this.physicsData = [];

        // Animation state
        this.currentFrame = 0;
        this.isAnimating = false;
        this.elapsedTime = 0;
        this.oscillationCount = 0;
        this.lastAngle = 0;
        this.crossedZero = false;
        this.startTime = 0;

        // Visualization mode: 'formula' or 'ml'
        this.currentMode = 'formula';

        // ML Model State
        this.trainModelBtn = null;
        this.modelStatusEl = null;
        this.mlTrainingPanel = null;
        this.isModelTrained = false;
        this.teacherData = null;

        // P5.js Interaction State
        this.isBobDragging = false;
        this.isLengthChanging = false;
        this.maxL_vis = 0;
        this.originY = 0;

        // Charts
        this.chart = null;
        this.sketch = null;

        // Auto-run debounce
        this.debounceTimer = null;
        this.hasRunOnce = false;

        // The list of all input controls based on inputs.json
        this.inputIds = [
            'length-m', 'initialAngle-deg', 'damping', 'airDensity',
            'bobMass-kg', 'dragCoefficient', 'gravity', 'totalTime', 'timeStep'
        ];

        this.init();
    }

    init() {
        this.setupControls();
        this.setupButtons();
        this.setupML();
        this.setupAccordion(); // Initializing accordion here
        this.initP5Sketch();
        this.runSimulation(); // Initial run
    }

    /** Helper to get value from input by ID, replacing '-' with '_' to match JS keys */
    getInputValue(id) {
        const el = document.getElementById(id);
        return parseFloat(el.value);
    }

    /** Helper to get all required parameters for simulation/ML */
    getSimParameters() {
        const params = {};
        this.inputIds.forEach(id => {
            // Converts 'length-m' to 'length_m'
            const key = id.replace(/-/g, '_');
            params[key] = this.getInputValue(id);
        });
        return params;
    }

    updateStatus(message, type) {
        const statusEl = document.getElementById('mlTrainStatus');
        statusEl.textContent = message;
        statusEl.className = `status-message status-${type}`;
        statusEl.style.display = 'block';
    }

    /** Sets up all 9 input controls. */
    setupControls() {
        this.inputIds.forEach(id => {
            const input = document.getElementById(id);
            const valueSpan = document.getElementById(`${id}Value`);

            if (input && valueSpan) {
                input.addEventListener('input', () => {
                    let unit = '';
                    if (id === 'length-m') unit = ' m';
                    if (id === 'initialAngle-deg') unit = '°';
                    if (id === 'airDensity') unit = ' kg/m³';
                    if (id === 'bobMass-kg') unit = ' kg';
                    if (id === 'gravity') unit = ' m/s²';
                    if (id === 'totalTime' || id === 'timeStep') unit = ' s';

                    // Round display values for cleaner look, but keep input value full precision if needed
                    let displayValue = input.value;
                    if (id === 'timeStep' || id === 'damping') {
                        displayValue = parseFloat(input.value).toFixed(3);
                    } else if (id === 'length-m' || id === 'bobMass-kg' || id === 'airDensity' || id === 'gravity') {
                        displayValue = parseFloat(input.value).toFixed(2);
                    }

                    valueSpan.textContent = displayValue + unit;
                    this.debounceRunSimulation();
                });

                // Initial update
                input.dispatchEvent(new Event('input'));
            }
        });
    }

    setupAccordion() {
        const headers = document.querySelectorAll('.accordion-header');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;

                // Toggle visibility classes
                if (content.classList.contains('open')) {
                    content.classList.remove('open');
                    header.classList.remove('active');
                } else {
                    // Optional: Close other open sections for a single-open accordion feel
                    // document.querySelectorAll('.accordion-content.open').forEach(c => c.classList.remove('open'));
                    // document.querySelectorAll('.accordion-header.active').forEach(h => h.classList.remove('active'));

                    content.classList.add('open');
                    header.classList.add('active');
                }
            });
        });
    }

    setupButtons() {
        document.getElementById('runSimulationBtn').addEventListener('click', (e) => this.runSimulation(e));

        const formulaBtn = document.getElementById('formulaBtn');
        const mlBtn = document.getElementById('mlBtn');
        this.mlTrainingPanel = document.getElementById('ml-training-panel');

        // Initial state: ensure training panel is hidden
        this.mlTrainingPanel.style.display = 'none';

        formulaBtn.addEventListener('click', () => {
            this.currentMode = 'formula';
            formulaBtn.classList.add('active');
            mlBtn.classList.remove('active');
            this.mlTrainingPanel.style.display = 'none'; // FIX: Use display property
            this.debounceRunSimulation();
        });

        mlBtn.addEventListener('click', () => {
            this.currentMode = 'ml';
            mlBtn.classList.add('active');
            formulaBtn.classList.remove('active');
            this.mlTrainingPanel.style.display = 'block'; // FIX: Use display property
            if (!this.isModelTrained) {
                this.updateStatus('ML Model not trained yet! Click "Train New Model" first.', 'error');
            }
            this.debounceRunSimulation();
        });
    }

    /** Sets up the ML section, loads persistence, and generates data. */
    setupML() {
        this.trainModelBtn = document.getElementById('trainModelBtn');
        this.modelStatusEl = document.getElementById('modelStatus');
        this.mlTrainingPanel = document.getElementById('ml-training-panel');

        // Initial state: ensure training panel is hidden
        if (this.currentMode !== 'ml') {
            this.mlTrainingPanel.style.display = 'none';
        }

        this.loadModelAndData();

        this.trainModelBtn.addEventListener('click', () => {
            this.startTraining();
        });
    }

    // NOTE: loadModelAndData, startTraining, fetchPrediction assumed to be correct based on previous context
    async loadModelAndData() {
        // Placeholder for ML logic
        this.isModelTrained = false;
        this.modelStatusEl.textContent = 'Model: Data Ready. Click "Train New Model".';
        this.updateStatus('Model training is required to use the ML Prediction mode.', 'info');
        if (window.mlPendulum && window.mlPendulum.generateSyntheticPendulumDataset) {
            this.updateStatus('', 'info');
            this.modelStatusEl.textContent = 'Model: Generating synthetic training data...';
            this.teacherData = window.mlPendulum.generateSyntheticPendulumDataset({ n: 800, simDuration_s: 20 });
            // ... Actual loading logic removed for brevity but assumed to exist
        } else {
            this.modelStatusEl.textContent = 'Model: Module not loaded.';
        }
    }

    async startTraining() {
        this.trainModelBtn.disabled = true;
        this.modelStatusEl.textContent = 'Model: Training in progress... (check Visor window for charts)';
        this.updateStatus('Training started. Monitoring Loss, MSE, and MAE in the TensorFlow.js Visor.', 'info');

        try {
            if (!this.teacherData) { await this.loadModelAndData(); }

            // Starts training, visualization (tfjs-vis), and saves the model
            await window.mlPendulum.trainPendulumModel(this.teacherData, { epochs: 100 });

            this.isModelTrained = true;
            this.modelStatusEl.textContent = 'Model: Successfully Trained and Saved!';
            this.updateStatus('Training complete. Model is now ready for predictions.', 'success');
        } catch (error) {
            this.modelStatusEl.textContent = 'Model: Training Failed! (See console)';
            this.updateStatus(`Training Error: ${error.message}`, 'error');
            console.error('ML Training Error:', error);
            if (window.tfvis) window.tfvis.visor().close();
        } finally {
            this.trainModelBtn.disabled = false;
        }
    }

    async fetchPrediction(inputs) {
        if (this.currentMode === 'ml') {
            if (!this.isModelTrained) {
                this.updateStats({ predictionPeriod: 'N/A (Untrained ML)' });
                this.updateStatus('Cannot predict: ML Model is not trained.', 'error');
                return null;
            }

            try {
                // Assuming mlPendulum is correctly exposing prediction methods
                const predictedPeriod = window.mlPendulum.predictPendulumPeriod(inputs);
                return { period: predictedPeriod, source: 'ml' };
            } catch (error) {
                this.updateStatus(`ML Prediction Error: ${error.message}`, 'error');
                return null;
            }
        }

        // This helper function must be exposed by the ml-pendulum.js module
        const theoreticalPeriod = window.mlPendulum.theoreticalSmallAnglePeriod(inputs.length_m, inputs.gravity);
        return { period: theoreticalPeriod, source: 'formula' };
    }

    debounceRunSimulation() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            // Only auto-run if the interaction is done OR if it has run once before
            if (!this.isBobDragging && !this.isLengthChanging && this.hasRunOnce) {
                this.runSimulation();
            }
        }, 300);
    }

    /** Runs the simulation and displays results. */
    async runSimulation(e) {
        if (e) e.preventDefault();
        this.stopAnimation();
        this.currentFrame = 0;

        const simParams = this.getSimParameters();

        // 1. Get the predicted period T
        const prediction = await this.fetchPrediction(simParams);
        if (!prediction) {
            this.stopAnimation();
            return;
        }

        const predictedPeriod = prediction.period;

        // 2. Run the full physics simulation (for visualization and comparison)
        this.physicsData = window.mlPendulum.simulatePendulum(simParams);

        // 3. Estimate period from the simulation (objective comparison)
        const simEst = window.mlPendulum.estimatePeriodFromSeries(this.physicsData, 3);

        // 4. Update UI
        const predictionSource = prediction.source === 'ml' ? 'ML' : 'Formula';
        const simPeriodText = simEst.meanPeriod ? simEst.meanPeriod.toFixed(3) + ' s' : 'N/A';

        this.updateStats({
            predictionPeriod: `${predictionSource}: ${predictedPeriod.toFixed(3)} s (Sim Est: ${simPeriodText})`,
            currentAngle: `${simParams.initialAngle_deg}°`,
            oscillationCount: 0,
            elapsedTime: 0,
        });

        this.initChart(simParams.length_m);
        this.startAnimation();
        this.hasRunOnce = true;
    }

    initChart(inputLengthMeters) {
        // Use the exposed rad2deg helper to convert for charting
        // FIX: Ensure mlPendulum exposes rad2deg
        const rad2deg = window.mlPendulum.rad2deg;
        const timeSeriesAngles = this.physicsData.map(s => rad2deg(s.theta));

        // Chart totalTime seconds
        const chartDataLength = Math.min(this.physicsData.length, Math.floor(this.getInputValue('totalTime') / this.getInputValue('timeStep')));
        const chartData = timeSeriesAngles.slice(0, chartDataLength);

        if (this.chart) this.chart.destroy();

        this.chart = ChartUtils.createTimeSeriesChart('angleChart', chartData, {
            totalTime: this.getInputValue('totalTime'),
            label: 'Angle (Deg)',
            xLabel: 'Time (s)',
            yLabel: 'Angle (Degrees)',
            title: `Pendulum Angle vs Time (L=${inputLengthMeters}m)`,
            color: this.currentMode === 'ml' ? '#667eea' : '#4CAF50'
        });
    }

    updateStats(stats) {
        if (stats.predictionPeriod !== undefined) document.getElementById('predictionPeriod').textContent = stats.predictionPeriod;
        if (stats.currentAngle !== undefined) document.getElementById('currentAngle').textContent = stats.currentAngle;
        if (stats.oscillationCount !== undefined) document.getElementById('oscillations').textContent = stats.oscillationCount;
        if (stats.elapsedTime !== undefined) document.getElementById('elapsedTime').textContent = stats.elapsedTime;
    }

    startAnimation() {
        this.isAnimating = true;
        this.currentFrame = 0;
        this.oscillationCount = 0;
        this.lastAngle = 0;
        this.crossedZero = false;
        this.startTime = this.sketch.millis();
        this.sketch.loop();
    }

    stopAnimation() {
        this.isAnimating = false;
        this.sketch.noLoop();
    }

    // P5.js setup for visualization
    initP5Sketch() {
        const sketch = (p) => {
            const container = document.getElementById('p5Sketch');
            let canvasWidth = container.clientWidth;
            let canvasHeight = 300;
            const simTimeStep = this.getInputValue('timeStep');

            // FIX: Pre-fetch helper functions here to avoid repeated window lookups
            console.log(window.mlPendulum);
            const deg2rad = window.mlPendulum.deg2rad;
            const rad2deg = window.mlPendulum.rad2deg;


            p.setup = () => {
                p.createCanvas(canvasWidth, canvasHeight).parent('p5Sketch');
                p.angleMode(p.RADIANS);
                p.frameRate(60);
                p.noLoop();

                // Set up visual constants for the sketch
                this.originY = 20;
                this.maxL_vis = canvasHeight - 50;
            };

            p.windowResized = () => {
                canvasWidth = container.clientWidth;
                p.resizeCanvas(canvasWidth, canvasHeight);
                this.maxL_vis = canvasHeight - 50;
                // Re-calculate the current state to redraw instantly
                this.runSimulation();
            };

            // --- NEW: Interactive Controls ---

            p.mousePressed = () => {
                // Only allow manipulation when simulation is stopped or at frame 0
                if (this.isAnimating && this.currentFrame > 0) return;

                const originX = p.width / 2;
                const inputLengthMeters = this.getInputValue('length-m');

                // FIX: Use the fetched deg2rad function
                const theta = deg2rad(this.getInputValue('initialAngle-deg'));

                const L_vis = (inputLengthMeters / 2.0) * this.maxL_vis;

                const bobX = originX + L_vis * Math.sin(theta);
                const bobY = this.originY + L_vis * Math.cos(theta);

                const distanceToBob = p.dist(p.mouseX, p.mouseY, bobX, bobY);

                if (distanceToBob < 28) { // Bob has a diameter of 28
                    // Check for length change key (SHIFT or CONTROL)
                    if (p.keyIsDown(p.SHIFT) || p.keyIsDown(p.CONTROL)) {
                        this.isLengthChanging = true;
                        this.isBobDragging = false;
                    } else {
                        this.isBobDragging = true;
                        this.isLengthChanging = false;
                    }
                    this.stopAnimation(); // Pause animation while dragging
                    p.loop(); // Start the loop to redraw the static drag state
                }
            }

            p.mouseDragged = () => {
                if (this.isLengthChanging) {
                    // --- Change Length (L) ---
                    const newLengthY = p.mouseY - this.originY;

                    // Map visual length back to real length (m)
                    const newL_vis = p.max(50, newLengthY);
                    const newLengthMeters = (newL_vis / this.maxL_vis) * 2.0;

                    // Clamp and update control
                    const L_input = document.getElementById('length-m');
                    const clampedLength = p.constrain(newLengthMeters, parseFloat(L_input.min), parseFloat(L_input.max));
                    L_input.value = clampedLength.toFixed(2);
                    L_input.dispatchEvent(new Event('input')); // Trigger UI update and debounce

                } else if (this.isBobDragging) {
                    // --- Change Angle (θ₀) ---
                    const originX = p.width / 2;
                    const dx = p.mouseX - originX;
                    const dy = p.mouseY - this.originY;

                    // Calculate the new angle from mouse position (atan2(dx, dy) measures from vertical)
                    let newAngleRad = p.atan2(dx, dy);

                    // Constrain the angle to max angle (60 degrees)
                    const maxAngleRad = deg2rad(60);
                    newAngleRad = p.constrain(newAngleRad, -maxAngleRad, maxAngleRad);

                    // FIX: Use the fetched rad2deg function
                    const newAngleDeg = Math.abs(rad2deg(newAngleRad));

                    // Update control
                    const angle_input = document.getElementById('initialAngle-deg');
                    angle_input.value = newAngleDeg.toFixed(0);
                    angle_input.dispatchEvent(new Event('input')); // Trigger UI update and debounce
                }
            }

            p.mouseReleased = () => {
                if (this.isBobDragging || this.isLengthChanging) {
                    this.isBobDragging = false;
                    this.isLengthChanging = false;

                    // Force a re-run of the simulation with the new parameters
                    this.runSimulation();
                }
            }

            // --- End Interactive Controls ---

            p.draw = () => {
                p.background(255);

                const simParams = this.getSimParameters();
                const inputLengthMeters = simParams.length_m;

                if (!this.physicsData.length) {
                    p.fill(150);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(16);
                    p.text("Click 'Run Simulation' to start motion", canvasWidth / 2, canvasHeight / 2);
                    return;
                }

                let theta;
                let dataPoint;

                if (this.isBobDragging || this.isLengthChanging) {
                    // If dragging, use the current slider values for a static redraw
                    theta = deg2rad(simParams.initialAngle_deg);
                    dataPoint = { t: 0, theta: theta, omega: 0 };
                    this.physicsData[0] = dataPoint; // Temporarily update first state for visualization
                } else {
                    // If animating, proceed with simulation playback
                    const elapsedWallTime = (p.millis() - this.startTime) / 1000;
                    const simIndex = Math.floor(elapsedWallTime / simTimeStep);

                    this.currentFrame = simIndex;

                    if (this.currentFrame >= this.physicsData.length) {
                        this.currentFrame = this.physicsData.length - 1;
                        this.stopAnimation();
                    }
                    dataPoint = this.physicsData[this.currentFrame];
                    theta = dataPoint.theta;
                    this.elapsedTime = dataPoint.t;
                }

                const originX = p.width / 2;

                // Scale visualization length
                const L_vis = (inputLengthMeters / 2.0) * this.maxL_vis;

                const bobX = originX + L_vis * Math.sin(theta);
                const bobY = this.originY + L_vis * Math.cos(theta);

                // --- Oscillation Counting/Stats Update (Only if NOT dragging) ---
                if (!this.isBobDragging && !this.isLengthChanging) {
                    const currentAngleDeg = rad2deg(theta);
                    if (this.lastAngle < 0 && currentAngleDeg >= 0) {
                        this.crossedZero = true;
                    }
                    if (this.crossedZero && this.lastAngle > 0 && currentAngleDeg <= 0) {
                        this.oscillationCount += 0.5;
                        this.crossedZero = false;
                    }
                    this.lastAngle = currentAngleDeg;

                    // Update stats UI
                    this.updateStats({
                        currentAngle: `${currentAngleDeg.toFixed(1)}°`,
                        oscillationCount: Math.floor(this.oscillationCount),
                        elapsedTime: this.elapsedTime.toFixed(2) + ' s'
                    });
                }

                // --- Drawing ---
                // Pivot point
                p.fill(50);
                p.noStroke();
                p.circle(originX, this.originY, 8);

                // String
                p.stroke(150);
                p.strokeWeight(1.5);
                p.line(originX, this.originY, bobX, bobY);

                // Bob color gradient (Visual indicator of progress)
                const progress = this.physicsData.length ? (this.currentFrame / this.physicsData.length) : 0;
                let bobR, bobG, bobB;
                const baseColor = this.currentMode === 'formula' ? [76, 175, 80] : [102, 126, 234];

                bobR = p.lerp(baseColor[0], 255, progress);
                bobG = p.lerp(baseColor[1], 255, progress);
                bobB = p.lerp(baseColor[2], 255, progress);

                p.fill(bobR, bobG, bobB);
                p.stroke(80);
                p.strokeWeight(2);
                p.circle(bobX, bobY, 28);

                // Visual cue for length change mode
                if (this.isLengthChanging) {
                    p.fill(255, 0, 0, 100);
                    p.circle(bobX, bobY, 40);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.fill(255, 0, 0);
                    p.textSize(10);
                    p.text("Length Mode (Shift/Ctrl)", originX, this.originY + L_vis + 30);
                }

                // Labels
                p.fill(100);
                p.noStroke();
                p.textSize(11);
                p.textAlign(p.CENTER);

                const modeText = this.currentMode === 'formula' ? 'Formula-Based' : 'ML Model';
                p.text(`${modeText} | Length: ${inputLengthMeters} m`, originX, p.height - 10);
            };

            this.sketch = p;
        };

        new p5(sketch, 'p5Sketch');
    }
}

// Global initialization
window.pendulumExperiment = new PendulumExperiment();