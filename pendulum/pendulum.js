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

    pauseAnimation() {
        if (this.isAnimating) {
            this.isAnimating = false;
            this.pausedTime = this.sketch.millis();
            this.sketch.noLoop();
        }
    }

    resumeAnimation() {
        if (!this.isAnimating && this.physicsData.length > 0) {
            this.isAnimating = true;
            // Adjust startTime to account for pause duration
            const pauseDuration = this.sketch.millis() - this.pausedTime;
            this.startTime += pauseDuration;
            this.sketch.loop();
        }
    }


    setupButtons() {
        document.getElementById('runSimulationBtn').addEventListener('click', (e) => this.runSimulation(e));

        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.addEventListener('click', () => {
            if (this.isAnimating) {
                this.pauseAnimation();
                pauseBtn.textContent = 'Resume';
                pauseBtn.classList.add('paused');
            } else {
                this.resumeAnimation();
                pauseBtn.textContent = 'Pause';
                pauseBtn.classList.remove('paused');
            }
        });

        // NEW: Reset button
        const resetBtn = document.getElementById('resetBtn');
        resetBtn.addEventListener('click', () => {
            this.resetSimulation();
        });

        const formulaBtn = document.getElementById('formulaBtn');
        const mlBtn = document.getElementById('mlBtn');
        this.mlTrainingPanel = document.getElementById('ml-training-panel');

        // Initial state: ensure training panel is hidden
        this.mlTrainingPanel.style.display = 'none';

        formulaBtn.addEventListener('click', () => {
            this.currentMode = 'formula';
            formulaBtn.classList.add('active');
            mlBtn.classList.remove('active');
            this.mlTrainingPanel.style.display = 'none';
            this.debounceRunSimulation();
        });

        mlBtn.addEventListener('click', () => {
            this.currentMode = 'ml';
            mlBtn.classList.add('active');
            formulaBtn.classList.remove('active');
            this.mlTrainingPanel.style.display = 'block';
            if (!this.isModelTrained) {
                this.updateStatus('ML Model not trained yet! Click "Train New Model" first.', 'error');
            }
            this.debounceRunSimulation();
        });
    }


    resetSimulation() {
        // Stop the animation
        // this.stopAnimation();

        // Reset all input parameters to initial/default values
        document.getElementById('initialAngle-deg').value = 0;
        document.getElementById('initialAngle-degValue').textContent = '0°';

        // Clear physics data
        this.physicsData = [];
        this.currentFrame = 0;
        this.oscillationCount = 0;
        this.lastAngle = 0;
        this.crossedZero = false;
        this.elapsedTime = 0;

        // Reset hasRunOnce so it doesn't auto-run on parameter changes
        this.hasRunOnce = false;
        this.isBobDragging = true; // Prevent auto-run during reset redraw

        // Reset pause button state
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.textContent = 'Pause';
        pauseBtn.classList.remove('paused');

        // Clear chart
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        // Reset stats display
        this.updateStats({
            predictionPeriod: 'N/A',
            currentAngle: '0°',
            oscillationCount: 0,
            elapsedTime: '0 s'
        });

        // Redraw canvas to show pendulum at rest at 0°
        this.sketch.redraw();
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
        if (window.mlPendulum && window.mlPendulum.generateSyntheticPendulumDataset) {
            this.updateStatus('Generating training dataset (800 samples)...', 'info');

            // Show progress
            const startTime = Date.now();
            this.teacherData = window.mlPendulum.generateSyntheticPendulumDataset({
                n: 800,
                simDuration_s: 20
            });
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            this.modelStatusEl.textContent = `✅ Dataset Ready (${this.teacherData.length} samples, ${duration}s)`;
            this.updateStatus(`Dataset generated successfully in ${duration} seconds!`, 'success');
        } else {
            this.modelStatusEl.textContent = '❌ ML Module not loaded';
            this.updateStatus('Error: ML module not available', 'error');
        }
    }

    async startTraining() {
        this.trainModelBtn.disabled = true;
        this.trainModelBtn.textContent = '⏳ Preparing...';
        this.trainModelBtn.style.opacity = '0.7';

        // Clear previous status
        this.updateStatus('Initializing training process...', 'info');

        try {
            // Step 1: Load/Generate data
            if (!this.teacherData) {
                this.trainModelBtn.textContent = '📊 Generating Data...';
                this.updateStatus('Generating 800 synthetic training examples...', 'info');
                await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update
                await this.loadModelAndData();
            }

            // Step 2: Show visor
            this.trainModelBtn.textContent = '🧠 Building Model...';
            this.updateStatus('Building neural network architecture...', 'info');
            await new Promise(resolve => setTimeout(resolve, 500));

            if (window.tfvis) {
                tfvis.visor().open();
            }

            // Step 3: Start training
            this.trainModelBtn.textContent = '🔄 Training...';
            this.updateStatus('Training in progress. Watch the charts for real-time metrics!', 'info');

            // Training with progress feedback
            await window.mlPendulum.trainPendulumModel(this.teacherData, {
                epochs: 100,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        if (epoch % 10 === 0) {
                            this.updateStatus(
                                `Training: Epoch ${epoch}/100 | Loss: ${logs.loss.toFixed(4)}`,
                                'info'
                            );
                        }
                    }
                }
            });

            // Step 4: Success
            this.isModelTrained = true;
            this.trainModelBtn.textContent = '✅ Training Complete!';
            this.modelStatusEl.textContent = 'Model: Successfully Trained and Saved!';
            this.updateStatus('Training complete! Model ready for predictions.', 'success');

            // Reset button text after 3 seconds
            setTimeout(() => {
                this.trainModelBtn.textContent = '🔄 Retrain Model';
                this.trainModelBtn.style.opacity = '1';
            }, 3000);

        } catch (error) {
            this.modelStatusEl.textContent = '❌ Training Failed!';
            this.trainModelBtn.textContent = '🔄 Train New Model';
            this.trainModelBtn.style.opacity = '1';
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

        // Reset pause button state when simulation runs
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.textContent = 'Pause';
        pauseBtn.classList.remove('paused');
    }

    initChart(inputLengthMeters) {

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

    debounceRunSimulation() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            // Only auto-run if the interaction is done AND if it has run once before
            // Don't run during drag operations
            if (!this.isBobDragging && !this.isLengthChanging && this.hasRunOnce) {
                this.runSimulation();
            }
        }, 300);
    }

    // P5.js setup for visualization
    initP5Sketch() {
        const sketch = (p) => {
            const container = document.getElementById('p5Sketch');
            let canvasWidth = container.clientWidth;
            let canvasHeight = 300;
            const simTimeStep = this.getInputValue('timeStep');

            const deg2rad = window.mlPendulum.deg2rad;
            const rad2deg = window.mlPendulum.rad2deg;

            p.setup = () => {
                p.createCanvas(canvasWidth, canvasHeight).parent('p5Sketch');
                p.angleMode(p.RADIANS);
                p.frameRate(60);
                p.noLoop();

                this.originY = 20;
                this.maxL_vis = canvasHeight - 50;
            };

            p.windowResized = () => {
                canvasWidth = container.clientWidth;
                p.resizeCanvas(canvasWidth, canvasHeight);
                this.maxL_vis = canvasHeight - 50;
                this.runSimulation();
            };

            // Update the p.mousePressed function:
            // Replace the p.mousePressed function (around line 458-481)

            p.mousePressed = () => {
                const originX = p.width / 2;
                const inputLengthMeters = this.getInputValue('length-m');
                const theta = deg2rad(this.getInputValue('initialAngle-deg'));
                const L_vis = (inputLengthMeters / 2.0) * this.maxL_vis;

                const bobX = originX + L_vis * Math.sin(theta);
                const bobY = this.originY + L_vis * Math.cos(theta);

                const distanceToBob = p.dist(p.mouseX, p.mouseY, bobX, bobY);

                // Only start dragging if clicking near the bob (within 28px)
                if (distanceToBob < 28) {
                    // Check if modifier key is pressed for length change mode
                    if (p.keyIsDown(p.SHIFT) || p.keyIsDown(p.CONTROL)) {
                        this.isLengthChanging = true;
                        this.isBobDragging = false;
                    } else {
                        this.isBobDragging = true;
                        this.isLengthChanging = false;
                    }

                    // Pause animation during drag
                    this.wasAnimatingBeforeDrag = this.isAnimating;
                    if (this.isAnimating) {
                        this.pauseAnimation();
                    }

                    p.loop();
                }
            }

            // Update the p.mouseDragged function:
            p.mouseDragged = () => {
                if (this.isBobDragging) {
                    const originX = p.width / 2;

                    // Calculate angle from mouse position
                    const dx = p.mouseX - originX;
                    const dy = p.mouseY - this.originY;

                    let newAngleRad = p.atan2(dx, dy);
                    const maxAngleRad = deg2rad(60);
                    newAngleRad = p.constrain(newAngleRad, -maxAngleRad, maxAngleRad);
                    const newAngleDeg = Math.abs(rad2deg(newAngleRad));

                    // Update angle
                    const angle_input = document.getElementById('initialAngle-deg');
                    angle_input.value = newAngleDeg.toFixed(0);
                    angle_input.dispatchEvent(new Event('input'));

                    // Calculate and update length from mouse distance to origin
                    const distanceFromOrigin = p.dist(p.mouseX, p.mouseY, originX, this.originY);
                    const newL_vis = p.max(50, p.min(distanceFromOrigin, this.maxL_vis));
                    const newLengthMeters = (newL_vis / this.maxL_vis) * 2.0;

                    const L_input = document.getElementById('length-m');
                    const clampedLength = p.constrain(newLengthMeters, parseFloat(L_input.min), parseFloat(L_input.max));
                    L_input.value = clampedLength.toFixed(2);
                    L_input.dispatchEvent(new Event('input'));
                }
            }

            // Update the p.mouseReleased function:
            p.mouseReleased = () => {
                if (this.isBobDragging) {
                    this.isBobDragging = false;

                    // Re-run simulation with new parameters
                    // If it was paused before drag, keep it paused after
                    this.runSimulation().then(() => {
                        if (!this.wasAnimatingBeforeDrag) {
                            // Was paused before, so pause again immediately
                            setTimeout(() => {
                                this.pauseAnimation();
                                const pauseBtn = document.getElementById('pauseBtn');
                                pauseBtn.textContent = 'Resume';
                                pauseBtn.classList.add('paused');
                            }, 50);
                        }
                        // Otherwise, it will auto-play from runSimulation
                    });
                }
            }



            // Update the p.draw function to show dragging visual feedback:
            p.draw = () => {
                p.background(255);

                const simParams = this.getSimParameters();
                const inputLengthMeters = simParams.length_m;

                if (!this.physicsData.length && !this.isBobDragging) {
                    p.fill(150);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(16);
                    p.text("Click 'Run Simulation' to start motion", canvasWidth / 2, canvasHeight / 2);
                    return;
                }

                let theta;
                let dataPoint;

                if (this.isBobDragging) {
                    theta = deg2rad(simParams.initialAngle_deg);
                    dataPoint = { t: 0, theta: theta, omega: 0 };
                    if (this.physicsData.length > 0) {
                        this.physicsData[0] = dataPoint;
                    }
                } else if (this.physicsData.length > 0) {
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
                } else {
                    theta = deg2rad(simParams.initialAngle_deg);
                    dataPoint = { t: 0, theta: theta, omega: 0 };
                }

                const originX = p.width / 2;
                const L_vis = (inputLengthMeters / 2.0) * this.maxL_vis;

                const bobX = originX + L_vis * Math.sin(theta);
                const bobY = this.originY + L_vis * Math.cos(theta);

                if (!this.isBobDragging && this.physicsData.length > 0) {
                    const currentAngleDeg = rad2deg(theta);
                    if (this.lastAngle < 0 && currentAngleDeg >= 0) {
                        this.crossedZero = true;
                    }
                    if (this.crossedZero && this.lastAngle > 0 && currentAngleDeg <= 0) {
                        this.oscillationCount += 0.5;
                        this.crossedZero = false;
                    }
                    this.lastAngle = currentAngleDeg;

                    this.updateStats({
                        currentAngle: `${currentAngleDeg.toFixed(1)}°`,
                        oscillationCount: Math.floor(this.oscillationCount),
                        elapsedTime: this.elapsedTime.toFixed(2) + ' s'
                    });
                }

                // Pivot point
                p.fill(50);
                p.noStroke();
                p.circle(originX, this.originY, 8);

                // String
                p.stroke(150);
                p.strokeWeight(1.5);
                p.line(originX, this.originY, bobX, bobY);

                // Bob
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

                // Visual cue when dragging
                if (this.isBobDragging) {
                    p.fill(102, 126, 234, 100);
                    p.noStroke();
                    p.circle(bobX, bobY, 40);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.fill(102, 126, 234);
                    p.textSize(12);
                    // Show "Drag to Adjust" at 40px from bob, along the current angle
                    const dragLabelRadius = 40;
                    const labelX = bobX + dragLabelRadius * Math.sin(theta);
                    const labelY = bobY + dragLabelRadius * Math.cos(theta);
                    p.text("Drag to Adjust", labelX, labelY);
                }

                // Labels
                p.fill(100);
                p.noStroke();
                p.textSize(11);
                p.textAlign(p.CENTER);

                const modeText = this.currentMode === 'formula' ? 'Formula-Based' : 'ML Model';
                const statusText = this.isAnimating ? 'Playing' : 'Paused';
                p.text(`${modeText} | ${statusText} | Length: ${inputLengthMeters.toFixed(2)} m | Angle: ${simParams.initialAngle_deg.toFixed(0)}°`, originX, p.height - 10);
            };

            this.sketch = p;
        };

        new p5(sketch, 'p5Sketch');
    }
}

// Global initialization
window.pendulumExperiment = new PendulumExperiment();