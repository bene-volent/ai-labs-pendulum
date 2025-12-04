/**
 * Tomato Plant Growth Experiment - Main Controller
 * Timeline-driven, deterministic plant visualization
 */

class TomatoExperiment {
    constructor() {
        this.mode = 'formula';
        this.simulationData = null;
        this.currentDay = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.animationInterval = null;
        this.p5Instance = null;
        this.chart = null;
        this.mlTrained = false;

        // Animation state
        this.animTime = 0;
        this.plant = null;
        this.windAngles = [];
        this.simulationRunning = false;

        this.params = {
            avgTempC: 24,
            soilMoisturePct: 60,
            sunlightHours: 9,
            soilN: 60,
            pestPressure: 1,
            days: 180
        };

        this.mlParams = {
            targetDay: 60,
            epochs: 40
        };
    }

    init() {
        console.log('🍅 Initializing Tomato Experiment...');
        this.setupModeButtons();
        this.setupInputControls();
        this.setupAnimationControls();
        this.setupAccordion();
        this.setupMLSection();
        this.initP5();
        this.initChart();
        this.loadSavedModel();
        console.log('✅ Tomato Experiment initialized');
    }

    setupModeButtons() {
        const formulaBtn = document.getElementById('formulaModeBtn');
        const mlBtn = document.getElementById('mlModeBtn');
        const modeHint = document.getElementById('modeHint');
        const mlSection = document.getElementById('mlSection');
        const runSimBtn = document.getElementById('runSimBtn');

        formulaBtn.addEventListener('click', () => {
            this.mode = 'formula';
            formulaBtn.classList.add('active');
            mlBtn.classList.remove('active');
            modeHint.textContent = 'Using physics-based GDD simulation';
            mlSection.style.display = 'none';
            runSimBtn.textContent = '🚀 Run Simulation';
        });

        mlBtn.addEventListener('click', () => {
            this.mode = 'ml';
            mlBtn.classList.add('active');
            formulaBtn.classList.remove('active');
            modeHint.textContent = 'Using machine learning predictions';
            mlSection.style.display = 'block';
            runSimBtn.textContent = '🤖 Run ML Prediction';
        });
    }

    setupInputControls() {
        const inputs = {
            avgTempC: { id: 'inputAvgTemp', valueId: 'valueAvgTemp', unit: '°C' },
            soilMoisturePct: { id: 'inputSoilMoisture', valueId: 'valueSoilMoisture', unit: '%' },
            sunlightHours: { id: 'inputSunlight', valueId: 'valueSunlight', unit: ' hrs' },
            soilN: { id: 'inputSoilN', valueId: 'valueSoilN', unit: '' },
            pestPressure: { id: 'inputPestPressure', valueId: 'valuePestPressure', unit: '' },
            days: { id: 'inputDays', valueId: 'valueDays', unit: '' }
        };

        Object.entries(inputs).forEach(([param, config]) => {
            const input = document.getElementById(config.id);
            const valueDisplay = document.getElementById(config.valueId);
            input.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.params[param] = value;
                valueDisplay.textContent = value + config.unit;
            });
        });

        document.getElementById('runSimBtn').addEventListener('click', () => {
            if (this.mode === 'formula') {
                this.runFormulaSimulation();
            } else {
                this.runMLPrediction();
            }
        });
    }

    setupAnimationControls() {
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');
        const speedSelect = document.getElementById('speedSelect');
        const dayScrubber = document.getElementById('dayScrubber');

        playBtn.addEventListener('click', () => this.play());
        pauseBtn.addEventListener('click', () => this.pause());
        resetBtn.addEventListener('click', () => this.reset());

        speedSelect.addEventListener('change', (e) => {
            this.playbackSpeed = parseFloat(e.target.value);
            if (this.isPlaying) {
                this.pause();
                this.play();
            }
        });

        dayScrubber.addEventListener('input', (e) => {
            this.pause();
            this.currentDay = parseInt(e.target.value);
            this.updateVisualization();
            this.regeneratePlantForDay(this.currentDay);
        });
    }

    play() {
        if (!this.simulationData) {
            alert('Run simulation first!');
            return;
        }

        this.isPlaying = true;
        console.log('▶️ Playing animation');

        const frameDelay = 100 / this.playbackSpeed;
        this.animationInterval = setInterval(() => {
            if (this.currentDay >= this.simulationData.length - 1) {
                this.pause();
                return;
            }

            this.currentDay++;
            this.updateVisualization();
            this.regeneratePlantForDay(this.currentDay);
        }, frameDelay);
    }

    pause() {
        this.isPlaying = false;
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        console.log('⏸️ Paused animation');
    }

    reset() {
        this.pause();
        this.currentDay = 0;
        this.updateVisualization();
        this.regeneratePlantForDay(0);
        console.log('↻ Reset to Day 0');
    }

    setupAccordion() {
        const accordionHeaders = document.querySelectorAll('.accordion-header');
        if (accordionHeaders.length > 0) {
            accordionHeaders[0].parentElement.classList.add('active');
        }
        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                const wasActive = item.classList.contains('active');
                document.querySelectorAll('.accordion-item').forEach(i => {
                    i.classList.remove('active');
                });
                if (!wasActive) {
                    item.classList.add('active');
                }
            });
        });
    }

    runFormulaSimulation() {
        console.log('🚀 Running Formula Simulation...');
        this.simulationData = window.mlTomato.simulateTomato(this.params);

        // DEBUG: Log fruit production
        const fruitsPerDay = this.simulationData.filter(d => d.fruitCount > 0);

        document.getElementById('dayScrubber').max = this.simulationData.length - 1;
        document.getElementById('totalDays').textContent = this.simulationData.length;

        this.simulationRunning = true;
        this.currentDay = 0;
        this.updateVisualization();
        this.regeneratePlantForDay(0);
        this.updateChart();
    }

    setupMLSection() {
        const targetDayInput = document.getElementById('inputTargetDay');
        const targetDayValue = document.getElementById('valueTargetDay');
        const epochsInput = document.getElementById('inputEpochs');
        const epochsValue = document.getElementById('valueEpochs');

        targetDayInput.addEventListener('input', (e) => {
            this.mlParams.targetDay = parseInt(e.target.value);
            targetDayValue.textContent = e.target.value;
        });

        epochsInput.addEventListener('input', (e) => {
            this.mlParams.epochs = parseInt(e.target.value);
            epochsValue.textContent = e.target.value;
        });

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

            const syntheticData = window.mlTomato.generateSyntheticTomatoDataset(
                { simDuration_s: this.mlParams.targetDay },
                1000,
                42
            );

            statusDiv.textContent = `🤖 Training model for ${this.mlParams.epochs} epochs...`;

            await window.mlTomato.trainTomatoModel(
                syntheticData,
                [],
                { epochs: this.mlParams.epochs, batchSize: 64 }
            );

            this.mlTrained = true;
            statusDiv.className = 'status-message show status-success';
            statusDiv.textContent = '✅ Model trained successfully!';

            modelStatusDiv.style.background = '#f0fdf4';
            modelStatusDiv.style.borderColor = '#4CAF50';
            modelStatusDiv.style.color = '#15803d';
            modelStatusDiv.textContent = `✓ Model trained (Target: Day ${this.mlParams.targetDay})`;

        } catch (error) {
            console.error('❌ Training error:', error);
            statusDiv.className = 'status-message show status-error';
            statusDiv.textContent = '❌ Training failed: ' + error.message;
        } finally {
            trainBtn.disabled = false;
        }
    }

    async runMLPrediction() {
        if (!this.mlTrained) {
            alert('Please train the ML model first!');
            return;
        }

        const statusDiv = document.getElementById('mlStatus');
        statusDiv.className = 'status-message show status-info';
        statusDiv.textContent = '🔄 Generating ML predictions...';

        try {
            const normalization = window.mlTomato.getNormalization();
            this.simulationData = [];

            for (let day = 1; day <= this.params.days; day++) {
                const input = [
                    this.params.avgTempC,
                    this.params.soilMoisturePct,
                    this.params.sunlightHours,
                    this.params.soilN,
                    this.params.pestPressure,
                    day
                ];

                const predictedHeight = await window.mlTomato.predictTomatoHeight(input, normalization);
                const heightCm = Math.max(0, predictedHeight);
                const biomass = heightCm / 150;
                const leafCount = Math.floor(40 * (1 - Math.exp(-3 * biomass)));
                const GDD_today = window.mlTomato.dailyGDD(this.params.avgTempC);
                const GDD_cum = GDD_today * day;
                const stage = window.mlTomato.stageFromGDD(GDD_cum, day > 5);

                this.simulationData.push({
                    day,
                    stage,
                    GDD_today: parseFloat(GDD_today.toFixed(2)),
                    GDD_cum: parseFloat(GDD_cum.toFixed(2)),
                    germinatedPct: day > 5 ? 100 : (day / 5) * 100,
                    heightCm: parseFloat(heightCm.toFixed(2)),
                    leafCount,
                    flowering: stage === 'flowering' || stage === 'fruit_set',
                    fruitCount: stage === 'ripening' ? Math.floor(biomass * 10) : 0,
                    healthIndex: 0.8
                });
            }

            statusDiv.className = 'status-message show status-success';
            statusDiv.textContent = '✅ ML prediction complete!';

            document.getElementById('dayScrubber').max = this.simulationData.length - 1;
            document.getElementById('totalDays').textContent = this.simulationData.length;

            this.simulationRunning = true;
            this.currentDay = 0;
            this.updateVisualization();
            this.regeneratePlantForDay(0);
            this.updateChart();

        } catch (error) {
            console.error('❌ Prediction error:', error);
            statusDiv.className = 'status-message show status-error';
            statusDiv.textContent = '❌ Prediction failed: ' + error.message;
        }
    }

    async loadSavedModel() {
        const model = await window.mlTomato.loadModelIndexedDB('tomato-ml-model');
        const norm = window.mlTomato.loadNormalizationIndexedDB('tomato-normalization');

        if (model && norm) {
            this.mlTrained = true;
            const modelStatusDiv = document.getElementById('modelStatus');
            modelStatusDiv.style.background = '#f0fdf4';
            modelStatusDiv.style.borderColor = '#4CAF50';
            modelStatusDiv.style.color = '#15803d';
            modelStatusDiv.textContent = '✓ Saved model loaded';
        }
    }

    updateVisualization() {
        if (!this.simulationData || this.currentDay >= this.simulationData.length) return;

        const state = this.simulationData[this.currentDay];

        document.getElementById('currentDay').textContent = state.day;
        const progress = (state.day / this.simulationData.length) * 100;
        document.getElementById('stageProgress').style.width = progress + '%';
        document.getElementById('dayScrubber').value = this.currentDay;

        document.getElementById('statGDDToday').textContent = state.GDD_today.toFixed(1) + '°C·d';
        document.getElementById('statGDDCum').textContent = state.GDD_cum.toFixed(1) + '°C·d';
        document.getElementById('statHeight').textContent = state.heightCm.toFixed(1) + ' cm';

        // Show branch count instead of leaf count (more accurate for procedural plant)
        const branchCount = this.plant ? this.plant.branches.length : 0;
        document.getElementById('statLeaves').textContent = branchCount + ' branches';

        // Update fruit count from actual plant structure
        const actualFruitCount = this.plant ? this.plant.getTotalFruits() : 0;
        document.getElementById('statFruits').textContent = actualFruitCount + ' 🍅';

        document.getElementById('statHealth').textContent = (state.healthIndex * 100).toFixed(0) + '%';
    }

    regeneratePlantForDay(day) {
        if (!this.simulationData || !this.p5Instance) return;

        const centerX = this.p5Instance.width / 2;
        const soilY = this.p5Instance.height * 0.7;

        // Only create plant once when simulation data changes
        if (!this.plant || this.plant.simulationData !== this.simulationData) {

            this.plant = new TomatoPlant(this.p5Instance, 0, 0, this.simulationData);
        }

        // Just update current display day
        this.plant.setCurrentDay(day);
    }

    initP5() {
        const container = document.getElementById('p5Container');

        const sketch = (p) => {
            p.setup = () => {
                const canvas = p.createCanvas(container.offsetWidth, 400);
                canvas.parent(container);
                console.log('🌱 P5.js canvas ready');
            };

            p.draw = () => {
                this.animTime += 1;
                this.drawBackground(p);

                if (this.plant && this.simulationRunning) {
                    const windSway = Math.sin(this.animTime * 0.05) * 0.01;
                    this.plant.draw(windSway);
                } else {
                    this.drawEmptyState(p);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.offsetWidth, 400);
                if (this.plant) {
                    this.regeneratePlantForDay(this.currentDay);
                }
            };
        };

        this.p5Instance = new p5(sketch);
    }

    drawBackground(p) {
        const sunIntensity = p.map(this.params.sunlightHours, 0, 14, 0.4, 1.0);
        for (let y = 0; y < p.height * 0.7; y++) {
            const inter = y / (p.height * 0.7);
            const skyTop = p.color(100 * sunIntensity, 150 * sunIntensity, 255);
            const skyBottom = p.color(180 * sunIntensity, 220 * sunIntensity, 255);
            const c = p.lerpColor(skyTop, skyBottom, inter);
            p.stroke(c);
            p.line(0, y, p.width, y);
        }

        if (this.params.sunlightHours > 0) {
            const sunX = p.width * 0.85;
            const sunY = p.height * 0.12;

            for (let r = 50; r > 0; r -= 8) {
                const alpha = p.map(r, 0, 50, 0, 40);
                p.fill(255, 255, 150, alpha);
                p.noStroke();
                p.circle(sunX, sunY, r);
            }

            p.stroke(255, 255, 200, 120);
            p.strokeWeight(2);
            for (let i = 0; i < 8; i++) {
                const angle = (i * 45 + this.animTime * 0.5) * (p.PI / 180);
                p.line(
                    sunX + p.cos(angle) * 25,
                    sunY + p.sin(angle) * 25,
                    sunX + p.cos(angle) * 45,
                    sunY + p.sin(angle) * 45
                );
            }

            p.fill(255, 255, 100);
            p.noStroke();
            p.circle(sunX, sunY, 35);
        }

        const soilY = p.height * 0.7;
        p.fill(101, 67, 33);
        p.noStroke();
        p.rect(0, soilY, p.width, p.height * 0.3);
        p.stroke(80, 50, 25);
        p.strokeWeight(2);
        p.line(0, soilY, p.width, soilY);

        if (this.params.soilMoisturePct > 60) {
            const moistAlpha = p.map(this.params.soilMoisturePct, 60, 100, 0, 70);
            p.fill(100, 150, 200, moistAlpha);
            p.noStroke();
            p.rect(0, soilY, p.width, p.height * 0.3);
        }
    }

    drawEmptyState(p) {
        p.fill(255);
        p.textSize(16);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('🌱 Run simulation to watch your tomato plant grow', p.width / 2, p.height / 2);
    }

    initChart() {
        const ctx = document.getElementById('growthChart').getContext('2d');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Height (cm)',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        yAxisID: 'y',
                        tension: 0.4
                    },
                    {
                        label: 'GDD Cumulative',
                        data: [],
                        borderColor: 'rgb(255, 159, 64)',
                        backgroundColor: 'rgba(255, 159, 64, 0.1)',
                        yAxisID: 'y1',
                        tension: 0.4
                    },
                    {
                        label: 'Health (%)',
                        data: [],
                        borderColor: 'rgb(102, 126, 234)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        yAxisID: 'y2',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: true, position: 'top' } },
                scales: {
                    x: { title: { display: true, text: 'Day' } },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Height (cm)' },
                        min: 0,
                        max: 160
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'GDD (°C·d)' },
                        grid: { drawOnChartArea: false },
                        min: 0
                    },
                    y2: {
                        type: 'linear',
                        display: false,
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    updateChart() {
        if (!this.chart || !this.simulationData) return;

        const labels = this.simulationData.map(d => d.day);
        const heights = this.simulationData.map(d => d.heightCm);
        const gdds = this.simulationData.map(d => d.GDD_cum);
        const healths = this.simulationData.map(d => d.healthIndex * 100);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = heights;
        this.chart.data.datasets[1].data = gdds;
        this.chart.data.datasets[2].data = healths;
        this.chart.update();
    }
}

// ============================================================================
// HIERARCHICAL DETERMINISTIC TOMATO PLANT
// Components are created once with proper parent-child relationships
// Timeline scrubbing just filters what to display by creation day
// ============================================================================

class TomatoPlant {
    constructor(p, x, y, simulationData) {
        this.p = p;
        this.baseX = x;
        this.baseY = y;
        this.simulationData = simulationData;

        // Hierarchical structure
        this.mainStem = new MainStem(this, x, y);
        this.branches = [];

        // Global counters for unique IDs
        this.nextBranchId = 0;
        this.nextLeafId = 0;
        this.nextFlowerId = 0;
        this.nextFruitId = 0;

        // Current display day
        this.currentDay = 0;

        // Camera zoom state
        this.targetZoom = 1.0;
        this.currentZoom = 1.0;
        this.targetOffsetY = 0;
        this.currentOffsetY = 0;

        // Generate entire plant structure for all days
        this.generateFullPlant();
    }

    generateFullPlant() {
        console.log('🌱 Generating full plant structure for all days...');

        if (!this.simulationData || this.simulationData.length === 0) {
            return;
        }

        // Grow plant day by day
        for (let day = 0; day < this.simulationData.length; day++) {
            const state = this.simulationData[day];
            this.growOneDay(day, state);
        }

        console.log(`✅ Plant generated: ${this.branches.length} branches, ${this.getTotalLeaves()} leaves, ${this.getTotalFruits()} fruits`);
    }

    growOneDay(day, state) {
        // Update main stem height
        this.mainStem.growTo(state.heightCm, day);

        // Skip growth for seed/germination stages
        if (state.stage === 'seed' || state.heightCm < 1) {
            return;
        }

        // Deterministically decide if we add a new primary branch today
        if (this.shouldAddBranch(day, state)) {
            const heightRatio = this.calculateBranchHeight(day, state);
            const branch = new PrimaryBranch(this, day, heightRatio, this.nextBranchId++);
            this.branches.push(branch);
        }

        // Grow existing branches (add leaves, flowers)
        this.branches.forEach(branch => {
            if (branch.createdDay <= day) {
                branch.growOneDay(day, state);
            }
        });

        // Handle fruit assignment - NEW LOGIC
        if (state.fruitCount > 0 && day > 0) {
            const prevState = this.simulationData[day - 1];
            const prevFruitCount = prevState ? prevState.fruitCount : 0;
            const newFruits = state.fruitCount - prevFruitCount;

            // Add new fruits when count increases
            if (newFruits > 0) {
                // Collect all existing flowers across all branches
                const allFlowers = [];
                this.branches.forEach(branch => {
                    branch.flowers.forEach(flower => {
                        if (!flower.convertedToFruit) {
                            allFlowers.push({ branch, flower });
                        }
                    });
                    branch.secondaryBranches.forEach(sec => {
                        sec.flowers.forEach(flower => {
                            if (!flower.convertedToFruit) {
                                allFlowers.push({ branch: sec, flower });
                            }
                        });
                    });
                });

                // Convert flowers to fruits, or add new fruits if not enough flowers
                let fruitsAdded = 0;

                // First: Convert existing flowers to fruits
                for (let i = 0; i < Math.min(newFruits, allFlowers.length); i++) {
                    const { branch, flower } = allFlowers[i];
                    const fruit = new Fruit(branch, day, flower.distRatio, this.nextFruitId++);
                    branch.fruits.push(fruit);
                    flower.convertedToFruit = true;
                    fruitsAdded++;
                }

                // Second: If we need more fruits than flowers, add to fruiting branches
                if (fruitsAdded < newFruits) {
                    const remainingFruits = newFruits - fruitsAdded;
                    const fruitingBranches = this.branches.filter(b =>
                        b.heightRatio > 0.5 &&
                        b.createdDay < day - 10
                    );

                    if (fruitingBranches.length > 0) {
                        for (let f = 0; f < remainingFruits; f++) {
                            const branchIdx = f % fruitingBranches.length;
                            const branch = fruitingBranches[branchIdx];
                            const distRatio = 0.5 + (branch.fruits.length * 0.1) % 0.4;
                            branch.addFruit(day, distRatio);
                        }
                    }
                }
            }
        }
    }

    shouldAddBranch(day, state) {
        // Deterministic branch creation logic
        if (state.stage === 'seedling' || state.stage === 'seed' || state.stage === 'germination') {
            return false;
        }

        // Add branches at specific intervals based on leaf count
        const branchInterval = state.stage === 'vegetative' ? 15 : 10;

        // First branch at day 20
        if (day === 20 && state.leafCount >= 8) return true;

        // Subsequent branches every branchInterval days
        if (day > 20 && (day - 20) % branchInterval === 0 && this.branches.length < 6) {
            return state.leafCount >= (this.branches.length + 1) * 5;
        }

        return false;
    }

    calculateBranchHeight(day, state) {
        const branchCount = this.branches.length;

        if (branchCount === 0) return 0.50; // First branch at 50%

        // Subsequent branches spread from 50% to 90%
        const spacing = 0.40 / 6; // Max 6 branches
        return Math.min(0.90, 0.50 + (branchCount * spacing));
    }

    setCurrentDay(day) {
        this.currentDay = day;

        // Calculate zoom based on plant height
        if (!this.simulationData || !this.simulationData[day]) return;

        const state = this.simulationData[day];
        const heightCm = state.heightCm;

        // Zoom levels with screen-space offsets
        if (state.stage === 'seed') {
            this.targetZoom = 8.0;
            this.targetOffsetY = 0; // Centered on ground
        } else if (heightCm < 5) {
            this.targetZoom = 6.0;
            this.targetOffsetY = 0; // Pan up slightly to see sprout
        } else if (heightCm < 20) {
            this.targetZoom = 3.0;
            this.targetOffsetY = 20; // Show more of young plant
        } else if (heightCm < 50) {
            this.targetZoom = 2.0;
            this.targetOffsetY = 10; // Show taller plant
        } else if (heightCm < 80) {
            this.targetZoom = 1.5;
            this.targetOffsetY = 5;
        } else {
            this.targetZoom = 1.0;
            this.targetOffsetY = 0; // Show full mature plant
        }
    }

    draw(windSway = 0) {
        const p = this.p;

        // Smooth zoom transition
        this.currentZoom = p.lerp(this.currentZoom, this.targetZoom, 0.05);
        this.currentOffsetY = p.lerp(this.currentOffsetY, this.targetOffsetY, 0.05);

        // Get current state
        const state = this.simulationData[this.currentDay];

        // Apply camera transformation
        p.push();

        // Translate to center of canvas
        p.translate(p.width / 2, p.height * 0.7);

        // Apply offset BEFORE scale (so offset is in screen space)
        p.translate(0, this.currentOffsetY);

        // Apply zoom
        p.scale(this.currentZoom);

        // Draw seed if in seed stage
        if (state && state.stage === 'seed') {
            this.drawSeed(p);
        }
        // Draw germinating seed
        else if (state && state.stage === 'germination' && state.heightCm < 2) {
            this.drawGerminatingSeed(p, state.germinatedPct);
        }
        // Draw plant
        else {
            // Draw main stem up to current day's height
            this.mainStem.draw(this.currentDay, windSway);

            // Draw branches that existed by current day
            this.branches.forEach(branch => {
                if (branch.createdDay <= this.currentDay) {
                    branch.draw(this.currentDay, windSway);
                }
            });
        }

        p.pop();
    }

    drawSeed(p) {
        // Draw a realistic tomato seed (oval, brownish)
        p.push();

        // Seed is slightly buried
        p.translate(0, 5);

        // Seed shadow
        p.fill(0, 0, 0, 30);
        p.noStroke();
        p.ellipse(0, 2, 10, 4);

        // Seed body
        p.fill(200, 180, 140);
        p.stroke(160, 140, 100);
        p.strokeWeight(1);
        p.ellipse(0, 0, 8, 10);

        // Seed texture/detail
        p.stroke(180, 160, 120);
        p.strokeWeight(0.5);
        p.line(-2, -3, -2, 3);
        p.line(0, -3, 0, 3);
        p.line(2, -3, 2, 3);

        // Highlight
        p.fill(220, 200, 160, 100);
        p.noStroke();
        p.ellipse(-1, -2, 3, 4);

        p.pop();
    }

    drawGerminatingSeed(p, germinatedPct) {
        p.push();

        // Seed position
        p.translate(0, 5);

        // Seed body (cracking open)
        const crackAmount = p.map(germinatedPct, 0, 100, 0, 3);

        p.fill(200, 180, 140);
        p.stroke(160, 140, 100);
        p.strokeWeight(1);

        // Left half of seed
        p.push();
        p.translate(-crackAmount / 2, 0);
        p.beginShape();
        p.vertex(-4, 0);
        p.bezierVertex(-4, -5, -2, -5, 0, -5);
        p.vertex(0, 5);
        p.bezierVertex(-2, 5, -4, 5, -4, 0);
        p.endShape(p.CLOSE);
        p.pop();

        // Right half of seed
        p.push();
        p.translate(crackAmount / 2, 0);
        p.beginShape();
        p.vertex(4, 0);
        p.bezierVertex(4, -5, 2, -5, 0, -5);
        p.vertex(0, 5);
        p.bezierVertex(2, 5, 4, 5, 4, 0);
        p.endShape(p.CLOSE);
        p.pop();

        // Emerging sprout (if germination is progressing)
        if (germinatedPct > 20) {
            const sproutLength = p.map(germinatedPct, 20, 100, 0, 15);

            // Root going down
            p.stroke(220, 200, 160);
            p.strokeWeight(1.5);
            p.line(0, 5, 0, 5 + sproutLength * 0.5);

            // Shoot going up
            p.stroke(100, 180, 100);
            p.strokeWeight(2);
            p.line(0, 0, 0, -sproutLength);

            // Tiny cotyledon leaves
            if (germinatedPct > 60) {
                const leafSize = p.map(germinatedPct, 60, 100, 0, 8);
                p.fill(120, 200, 120);
                p.stroke(80, 160, 80);
                p.strokeWeight(1);
                p.ellipse(-leafSize * 0.5, -sproutLength + 2, leafSize, leafSize * 0.6);
                p.ellipse(leafSize * 0.5, -sproutLength + 2, leafSize, leafSize * 0.6);
            }
        }

        p.pop();
    }

    // Utility methods
    getTotalLeaves() {
        return this.branches.reduce((sum, b) => sum + b.leaves.length + b.secondaryBranches.reduce((s, sb) => s + sb.leaves.length, 0), 0);
    }

    getTotalFruits() {
        return this.branches.reduce((sum, b) => sum + b.fruits.length + b.secondaryBranches.reduce((s, sb) => s + sb.fruits.length, 0), 0);
    }
}

// ============================================================================
// MAIN STEM
// ============================================================================
class MainStem {
    constructor(plant, x, y) {
        this.plant = plant;
        this.x = x;
        this.baseY = y;
        this.segments = []; // { day, heightCm, y, width }
    }

    growTo(heightCm, day) {
        // Store height for this day
        const heightPx = heightCm * 1.8;
        const segmentCount = Math.max(3, Math.floor(heightPx / 12));
        const segmentHeight = heightPx / segmentCount;

        this.segments.push({
            day: day,
            heightCm: heightCm,
            heightPx: heightPx,
            segmentCount: segmentCount,
            segmentHeight: segmentHeight
        });
    }

    getHeightAtDay(day) {
        // Find the last segment at or before this day
        const segment = this.segments.filter(s => s.day <= day).pop();
        return segment ? segment : { heightPx: 0, segmentCount: 0, segmentHeight: 0 };
    }

    getPositionAtRatio(day, heightRatio) {
        const { heightPx } = this.getHeightAtDay(day);
        const y = this.baseY - (heightPx * heightRatio);
        return { x: this.x, y: y };
    }

    draw(currentDay, windSway) {


        const { heightPx, segmentCount, segmentHeight } = this.getHeightAtDay(currentDay);

        if (segmentCount === 0) return;

        const p = this.plant.p;
        p.stroke(75, 100, 55);

        
        let currentY = this.baseY;
        for (let i = 0; i < segmentCount; i++) {
            const swayAmount = (i / segmentCount) * 2;
            const swayX = Math.sin(windSway + i * 0.2) * swayAmount;
            const width = Math.max(2, 10 - (i * 0.4));

            p.strokeWeight(width);
            p.line(
                this.x + swayX,
                currentY,
                this.x + swayX,
                currentY - segmentHeight
            );
            currentY -= segmentHeight;
        }
    }
}

// ============================================================================
// PRIMARY BRANCH
// ============================================================================
class PrimaryBranch {
    constructor(plant, createdDay, heightRatio, id) {
        this.plant = plant;
        this.createdDay = createdDay;
        this.heightRatio = heightRatio;
        this.id = id;

        // Branch geometry (calculated once)
        this.side = (id % 2 === 0) ? 1 : -1; // Even=right, Odd=left
        this.upwardAngle = 0.5 + (id * 0.02) % 0.25;
        this.angle = this.side === 1 ? -this.upwardAngle : -Math.PI + this.upwardAngle;
        this.baseLength = 60 + id * 3;
        this.lengthRatio = 1.3 - (heightRatio * 0.4);
        this.length = this.baseLength * this.lengthRatio;
        this.width = Math.max(2, 7 - id * 0.3);

        // Child components
        this.leaves = [];
        this.flowers = [];
        this.fruits = [];
        this.secondaryBranches = [];

        // Growth tracking
        this.lastLeafDay = createdDay;
        this.lastFlowerDay = createdDay;
        this.hasSecondary = false;
    }

    getPosition(currentDay) {
        return this.plant.mainStem.getPositionAtRatio(currentDay, this.heightRatio);
    }

    growOneDay(day, state) {
        const daysSinceCreation = day - this.createdDay;

        // Add leaves progressively (every 5-7 days, max 2 per branch)
        if (daysSinceCreation % 6 === 0 && this.leaves.length < 2) {
            const distRatio = 0.4 + (this.leaves.length * 0.4);
            const leaf = new Leaf(this, day, distRatio, this.plant.nextLeafId++, 'primary');
            this.leaves.push(leaf);
            this.lastLeafDay = day;
        }

        // Add secondary branch (only once, when mature)
        if (!this.hasSecondary && daysSinceCreation > 15 && this.id < 3 && state.stage !== 'seedling') {
            const secondary = new SecondaryBranch(this, day, 0.7, this.secondaryBranches.length);
            this.secondaryBranches.push(secondary);
            this.hasSecondary = true;
        }

        // Grow secondary branches
        this.secondaryBranches.forEach(sec => {
            if (sec.createdDay <= day) {
                sec.growOneDay(day, state);
            }
        });

        // Add flowers during flowering stage (for visual effect)
        if ((state.stage === 'flowering' || state.stage === 'fruit_set') &&
            state.flowering &&
            this.heightRatio > 0.4 &&
            this.flowers.length === 0 &&
            daysSinceCreation > 10) {

            // Add 1-2 flowers per branch
            const flowerCount = 1 + (this.id % 2);
            for (let f = 0; f < flowerCount; f++) {
                const distRatio = 0.7 + (f * 0.1);
                const flower = new Flower(this, day, distRatio, this.plant.nextFlowerId++);
                this.flowers.push(flower);
            }
            this.lastFlowerDay = day;
        }

        // Update fruit ripeness for existing fruits
        this.fruits.forEach(fruit => {
            fruit.updateRipeness(day, state);
        });
    }

    // NEW METHOD: Add a fruit to this branch
    addFruit(day, distRatio) {
        const fruit = new Fruit(this, day, distRatio, this.plant.nextFruitId++);
        this.fruits.push(fruit);
        return fruit;
    }

    draw(currentDay, windSway) {
        const pos = this.getPosition(currentDay);
        const p = this.plant.p;

        // Calculate current length (grows from 0 to full over first 10 days)
        const daysSinceCreation = currentDay - this.createdDay;
        const growthProgress = Math.min(1, daysSinceCreation / 10);
        const currentLength = this.length * growthProgress;

        // Draw branch
        const swayFactor = Math.sin(windSway * 1.2 + this.id * 0.3) * 0.02;
        const endX = pos.x + Math.cos(this.angle + swayFactor) * currentLength;
        const endY = pos.y + Math.sin(this.angle + swayFactor) * currentLength;

        p.stroke(80, 110, 60);
        p.strokeWeight(this.width);
        p.line(pos.x, pos.y, endX, endY);

        // Draw leaves that existed by currentDay
        this.leaves.forEach(leaf => {
            if (leaf.createdDay <= currentDay) {
                leaf.draw(currentDay, windSway, pos, this.angle, currentLength);
            }
        });

        // Draw flowers that existed
        this.flowers.forEach(flower => {
            if (flower.createdDay <= currentDay) {
                flower.draw(currentDay, windSway, pos, this.angle, currentLength);
            }
        });

        // Draw fruits that existed by currentDay
        this.fruits.forEach(fruit => {
            if (fruit.createdDay <= currentDay) {
                fruit.draw(currentDay, windSway, pos, this.angle, currentLength);
            }
        });

        // Draw secondary branches
        this.secondaryBranches.forEach(sec => {
            if (sec.createdDay <= currentDay) {
                sec.draw(currentDay, windSway, pos, this.angle, currentLength);
            }
        });
    }
}

// ============================================================================
// SECONDARY BRANCH
// ============================================================================
class SecondaryBranch {
    constructor(parentBranch, createdDay, distAlongParent, id) {
        this.parentBranch = parentBranch;
        this.plant = parentBranch.plant;
        this.createdDay = createdDay;
        this.distAlongParent = distAlongParent;
        this.id = id;

        // Geometry
        this.angleOffset = -Math.abs(parentBranch.side) * 0.2;
        this.lengthRatio = 0.45;
        this.width = Math.max(1.5, parentBranch.width * 0.7);

        // Child components
        this.leaves = [];
        this.flowers = [];
        this.fruits = [];
    }

    growOneDay(day, state) {
        const daysSinceCreation = day - this.createdDay;

        // Add 1 leaf after 5 days
        if (daysSinceCreation === 5 && this.leaves.length === 0) {
            const leaf = new Leaf(this, day, 0.7, this.plant.nextLeafId++, 'secondary');
            this.leaves.push(leaf);
        }

        // Add flowers during flowering (visual effect)
        if ((state.stage === 'fruit_set' || state.stage === 'fruit_development') &&
            state.flowering &&
            this.flowers.length === 0 &&
            daysSinceCreation > 10) {

            const flower = new Flower(this, day, 0.8, this.plant.nextFlowerId++);
            this.flowers.push(flower);
        }

        // Update fruit ripeness
        this.fruits.forEach(fruit => {
            fruit.updateRipeness(day, state);
        });
    }

    // NEW METHOD: Add a fruit to this branch
    addFruit(day, distRatio) {
        const fruit = new Fruit(this, day, distRatio, this.plant.nextFruitId++);
        this.fruits.push(fruit);
        return fruit;
    }

    draw(currentDay, windSway, parentPos, parentAngle, parentLength) {
        const p = this.plant.p;

        // Position along parent branch
        const startX = parentPos.x + Math.cos(parentAngle) * parentLength * this.distAlongParent;
        const startY = parentPos.y + Math.sin(parentAngle) * parentLength * this.distAlongParent;

        // Secondary branch geometry
        const angle = parentAngle + this.angleOffset;
        const length = parentLength * this.lengthRatio;

        const daysSinceCreation = currentDay - this.createdDay;
        const growthProgress = Math.min(1, daysSinceCreation / 8);
        const currentLength = length * growthProgress;

        const swayFactor = Math.sin(windSway * 1.5 + this.id * 0.4) * 0.015;
        const endX = startX + Math.cos(angle + swayFactor) * currentLength;
        const endY = startY + Math.sin(angle + swayFactor) * currentLength;

        p.stroke(90, 120, 70);
        p.strokeWeight(this.width);
        p.line(startX, startY, endX, endY);

        const pos = { x: startX, y: startY };

        // Draw children
        this.leaves.forEach(leaf => {
            if (leaf.createdDay <= currentDay) {
                leaf.draw(currentDay, windSway, pos, angle, currentLength);
            }
        });

        this.flowers.forEach(flower => {
            if (flower.createdDay <= currentDay) {
                flower.draw(currentDay, windSway, pos, this.angle, currentLength);
            }
        });

        this.fruits.forEach(fruit => {
            if (fruit.createdDay <= currentDay) {
                fruit.draw(currentDay, windSway, pos, angle, currentLength);
            }
        });
    }
}
// ============================================================================
// LEAF
// ============================================================================
class Leaf {
    constructor(parentBranch, createdDay, distRatio, id, type) {
        this.parentBranch = parentBranch;
        this.createdDay = createdDay;
        this.distRatio = distRatio;
        this.id = id;
        this.type = type; // 'primary' or 'secondary'

        // Geometry
        this.angleOffset = (id % 2 === 0) ? 0.6 : -0.6;
        this.baseSize = type === 'primary' ? 13 : 10;
    }

    draw(currentDay, windSway, branchPos, branchAngle, branchLength) {
        const p = this.parentBranch.plant.p;

        // Position along branch
        const dist = branchLength * this.distRatio;
        const x = branchPos.x + Math.cos(branchAngle) * dist;
        const y = branchPos.y + Math.sin(branchAngle) * dist;

        // Leaf size grows over first 7 days
        const age = currentDay - this.createdDay;
        const growthProgress = Math.min(1, age / 7);
        const size = this.baseSize * growthProgress;

        // Sway
        const swayX = Math.cos(windSway * 2.5 + y * 0.05) * 2.5;
        const swayY = Math.sin(windSway * 2.5 + y * 0.05) * 1.5;

        // Color based on age
        const greenValue = p.map(Math.min(age, 90), 0, 90, 200, 120);
        const leafColor = p.color(55, greenValue, 65);

        const leafAngle = branchAngle + this.angleOffset;

        // Draw compound leaf (7 leaflets)
        const leafletPositions = [
            { angle: -0.8, dist: 0.7 },
            { angle: -0.5, dist: 0.9 },
            { angle: -0.2, dist: 1.0 },
            { angle: 0, dist: 1.2 },
            { angle: 0.2, dist: 1.0 },
            { angle: 0.5, dist: 0.9 },
            { angle: 0.8, dist: 0.7 }
        ];

        leafletPositions.forEach((leaflet, lIdx) => {
            const leafletAngle = leafAngle + leaflet.angle;
            const leafletDist = size * leaflet.dist;

            const lx = x + swayX + Math.cos(leafletAngle) * leafletDist;
            const ly = y + swayY + Math.sin(leafletAngle) * leafletDist;

            p.fill(leafColor);
            p.stroke(45, greenValue - 40, 45);
            p.strokeWeight(1);

            p.push();
            p.translate(lx, ly);
            p.rotate(leafletAngle);
            p.ellipse(0, 0, size * 0.65, size * 1.0);
            p.pop();

            // Midvein on terminal leaflet
            if (lIdx === 3) {
                p.stroke(40, greenValue - 50, 35);
                p.strokeWeight(0.5);
                const veinEnd = size * 0.4;
                p.line(
                    lx - Math.cos(leafletAngle) * veinEnd,
                    ly - Math.sin(leafletAngle) * veinEnd,
                    lx + Math.cos(leafletAngle) * veinEnd,
                    ly + Math.sin(leafletAngle) * veinEnd
                );
            }
        });

        // Draw rachis
        p.stroke(60, greenValue - 30, 50);
        p.strokeWeight(1.5);
        const rachisStart = x + swayX - Math.cos(leafAngle) * size * 0.3;
        const rachisStartY = y + swayY - Math.sin(leafAngle) * size * 0.3;
        const rachisEnd = x + swayX + Math.cos(leafAngle) * size * 1.2;
        const rachisEndY = y + swayY + Math.sin(leafAngle) * size * 1.2;
        p.line(rachisStart, rachisStartY, rachisEnd, rachisEndY);
    }
}

// ============================================================================
// FLOWER
// ============================================================================
class Flower {
    constructor(parentBranch, createdDay, distRatio, id) {
        this.parentBranch = parentBranch;
        this.createdDay = createdDay;
        this.distRatio = distRatio;
        this.id = id;
        this.convertedToFruit = false; // Track if converted to fruit

        this.size = 6 + (id % 2);
    }

    draw(currentDay, windSway, branchPos, branchAngle, branchLength) {
        // Don't draw if converted to fruit
        if (this.convertedToFruit) return;

        const p = this.parentBranch.plant.p;

        const dist = branchLength * this.distRatio;
        const x = branchPos.x + Math.cos(branchAngle) * dist;
        const y = branchPos.y + Math.sin(branchAngle) * dist;

        // Draw 5 petals
        for (let i = 0; i < 5; i++) {
            const petalAngle = (i * 72 - 90) * (Math.PI / 180);
            const px = x + Math.cos(petalAngle) * this.size;
            const py = y + Math.sin(petalAngle) * this.size;

            p.fill(255, 245, 100);
            p.stroke(220, 200, 60);
            p.strokeWeight(1);
            p.ellipse(px, py, this.size * 0.7, this.size * 1.3);
        }

        // Center
        p.fill(255, 200, 0);
        p.noStroke();
        p.circle(x, y, this.size * 0.6);
    }
}

// ============================================================================
// FRUIT
// ============================================================================
class Fruit {
    constructor(parentBranch, createdDay, distRatio, id) {
        this.parentBranch = parentBranch;
        this.createdDay = createdDay;
        this.distRatio = distRatio;
        this.id = id;

        this.baseSize = 9 + (id % 4);
        this.ripeness = 0;

        // Hanging offset
        this.hangOffset = 8 + (id % 3) * 3;
        this.hangSide = (id % 2 === 0) ? 1 : -1;
    }

    updateRipeness(currentDay, state) {
        const age = currentDay - this.createdDay;

        // Ripeness progresses over 20-30 days
        if (state.stage === 'fruit_set') {
            this.ripeness = Math.min(0.3, age / 40);
        } else if (state.stage === 'fruit_development') {
            this.ripeness = 0.3 + Math.min(0.4, age / 30);
        } else if (state.stage === 'ripening') {
            this.ripeness = 0.7 + Math.min(0.3, age / 20);
        }

        this.ripeness = Math.min(1, this.ripeness);
    }

    draw(currentDay, windSway, branchPos, branchAngle, branchLength) {
        const p = this.parentBranch.plant.p;

        const dist = branchLength * this.distRatio;
        const baseX = branchPos.x + Math.cos(branchAngle) * dist;
        const baseY = branchPos.y + Math.sin(branchAngle) * dist;

        // Hanging position
        const x = baseX + this.hangSide * Math.cos(Math.PI / 2) * this.hangOffset;
        const y = baseY + Math.sin(Math.PI / 2) * this.hangOffset;

        // Size grows over first 10 days
        const age = currentDay - this.createdDay;
        const sizeProgress = Math.min(1, age / 10);
        const size = this.baseSize * sizeProgress;

        // Color based on ripeness
        let fruitColor;
        if (this.ripeness < 0.3) {
            fruitColor = p.lerpColor(p.color(85, 170, 75), p.color(180, 200, 80), this.ripeness / 0.3);
        } else if (this.ripeness < 0.7) {
            fruitColor = p.lerpColor(p.color(180, 200, 80), p.color(240, 140, 50), (this.ripeness - 0.3) / 0.4);
        } else {
            fruitColor = p.lerpColor(p.color(240, 140, 50), p.color(220, 45, 35), (this.ripeness - 0.7) / 0.3);
        }

        // Draw fruit
        p.fill(fruitColor);
        p.stroke(0, 50);
        p.strokeWeight(1);
        p.circle(x, y, size);

        // Highlight
        p.fill(255, 255, 255, 160);
        p.noStroke();
        p.circle(x - size * 0.2, y - size * 0.2, size * 0.3);

        // Calyx (if ripeness > 0.15)
        if (this.ripeness > 0.15) {
            p.fill(70, 130, 60);
            p.stroke(50, 100, 40);
            p.strokeWeight(0.8);

            for (let i = 0; i < 5; i++) {
                const calyxAngle = (i * 72 - 90) * (Math.PI / 180);
                const cx1 = x + Math.cos(calyxAngle) * size * 0.15;
                const cy1 = y - size * 0.45 + Math.sin(calyxAngle) * size * 0.15;
                const cx2 = x + Math.cos(calyxAngle) * size * 0.35;
                const cy2 = y - size * 0.55 + Math.sin(calyxAngle) * size * 0.35;

                p.line(cx1, cy1, cx2, cy2);
            }

            p.fill(60, 110, 50);
            p.noStroke();
            p.circle(x, y - size * 0.45, size * 0.2);
        }
    }
}
// ============================================================================
// INITIALIZE
// ============================================================================

window.tomatoExperiment = new TomatoExperiment();
window.addEventListener('DOMContentLoaded', () => {
    window.tomatoExperiment.init();
    window.tomatoExperiment.runFormulaSimulation()
});


function printMatrix() {
    const t = window.tomatoExperiment.p5Instance.drawingContext.getTransform()
    const { a, b, c, d, e, f } = t;

    // translation
    const translateX = e;
    const translateY = f;

    // scale (handles possible rotation; gives magnitude along axes)
    const scaleX = Math.hypot(a, b); // sqrt(a^2 + b^2)
    const scaleY = Math.hypot(c, d); // sqrt(c^2 + d^2)

    // rotation (radians). Use atan2(b, a) for canvas matrix layout.
    const rotation = Math.atan2(b, a); // in radians
    const rotationDeg = rotation * 180 / Math.PI;

    console.log({
        matrix: { a, b, c, d, e, f },
        translateX,
        translateY,
        scaleX,
        scaleY,
        rotation,       // radians
        rotationDeg     // degrees
    });
}

function p5Instance(){
    return window.tomatoExperiment.p5Instance;
}