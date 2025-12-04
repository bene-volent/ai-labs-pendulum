/**
 * Tomato Plant Growth Simulation - ML & Physics Logic
 * Converted from TypeScript (sim.ts, helpers.ts, ai.ts, types.ts)
 * 
 * Core Features:
 * - GDD-based phenology simulation (90 days)
 * - Environmental factor modeling (temp, moisture, light, nutrients, pests)
 * - TensorFlow.js model training for height prediction
 * - Synthetic dataset generation for ML training
 */

// NOTE: This file relies on 'tf' and 'tfvis' being loaded globally via CDN in index.html

// ============================================================================
// GLOBAL STATE & CONSTANTS
// ============================================================================

let tomatoModel = null;
let normalization = null;
const MODEL_NAME = "tomato-ml-model";
const NORMALIZATION_NAME = "tomato-normalization";

// Base temperature for tomato growth (°C)
const T_BASE = 10.0;

// ============================================================================
// HELPER FUNCTIONS (from helpers.ts)
// ============================================================================

/**
 * Mulberry32 pseudo-random number generator (seeded RNG)
 * @param {number} seed - Integer seed
 * @returns {function(): number} - Random number generator (0-1)
 */
function mulberry32(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/**
 * Calculate daily Growing Degree Days (GDD)
 * GDD = max(0, T_avg - T_base)
 * @param {number} Tavg - Average daily temperature (°C)
 * @param {number} Tbase - Base temperature for growth (default 10°C)
 * @returns {number} Daily GDD value
 */
function dailyGDD(Tavg, Tbase = T_BASE) {
    return Math.max(0, Tavg - Tbase);
}

/**
 * Soil moisture effect multiplier (optimal ~60%)
 * @param {number} m - Soil moisture percentage (0-100)
 * @returns {number} Growth multiplier (0.5 to 1.5)
 */
function moistureMultiplier(m) {
    // Parabolic curve: peaks at 60%, drops to 0.5 at extremes
    const optimal = 60;
    const range = 50;
    const deviation = Math.abs(m - optimal) / range;
    return 1.5 - deviation;
}

/**
 * Sunlight effect multiplier (optimal 10-12 hrs/day)
 * @param {number} hours - Sunlight hours per day (0-14)
 * @returns {number} Growth multiplier (0.4 to 1.4)
 */
function lightMultiplier(hours) {
    // Linear up to 12 hours, then plateaus
    if (hours <= 0) return 0.4;
    if (hours >= 12) return 1.4;
    return 0.4 + (hours / 12) * 1.0;
}

/**
 * Soil nutrient effect multiplier (optimal ~60-80)
 * @param {number} n - Nutrient index (0-100)
 * @returns {number} Growth multiplier (0.6 to 1.4)
 */
function nutrientMultiplier(n) {
    // Linear relationship
    return 0.6 + (n / 100) * 0.8;
}

/**
 * Pest pressure effect multiplier (negative impact)
 * @param {number} p - Pest pressure (0-10)
 * @returns {number} Growth multiplier (0.7 to 1.0)
 */
function pestMultiplier(p) {
    // Linear decrease: 0 pests = 1.0, 10 pests = 0.7
    return 1.0 - (p / 10) * 0.3;
}

/**
 * Convert biomass to plant height using logistic growth curve
 * @param {number} biomass - Accumulated biomass (0-1)
 * @returns {number} Height in centimeters (0-150cm)
 */
function biomassToHeightCm(biomass) {
    const maxHeight = 150; // cm
    const k = 4; // Growth rate
    return maxHeight * (1 - Math.exp(-k * biomass));
}

/**
 * Convert biomass to leaf count using logistic growth curve
 * @param {number} biomass - Accumulated biomass (0-1)
 * @returns {number} Number of leaves (0-40)
 */
function biomassToLeafCount(biomass) {
    const maxLeaves = 40;
    const k = 3; // Growth rate
    return Math.floor(maxLeaves * (1 - Math.exp(-k * biomass)));
}

/**
 * Determine phenology stage based on cumulative GDD
 * @param {number} GDDcum - Cumulative growing degree days
 * @param {boolean} germinated - Whether seed has germinated
 * @returns {string} Phenology stage
 */
function stageFromGDD(GDDcum, germinated) {
    if (!germinated) return "seed";
    if (GDDcum < 50) return "germination";
    if (GDDcum < 200) return "seedling";
    if (GDDcum < 400) return "vegetative";
    if (GDDcum < 700) return "flowering";
    if (GDDcum < 1000) return "fruit_set";
    if (GDDcum < 1300) return "fruit_development";
    return "ripening";
}

// ============================================================================
// SIMULATION LOGIC (from sim.ts)
// ============================================================================

/**
 * Simulate tomato plant growth over specified days
 * @param {Object} params - Simulation parameters
 * @param {number} params.avgTempC - Average daily temperature (°C)
 * @param {number} params.soilMoisturePct - Soil moisture percentage
 * @param {number} params.sunlightHours - Sunlight hours per day
 * @param {number} params.soilN - Soil nutrient index (0-100)
 * @param {number} params.pestPressure - Pest pressure (0-10)
 * @param {number} params.days - Number of days to simulate
 * @returns {Array<Object>} Array of daily plant states
 */
function simulateTomato(params) {
    const {
        avgTempC,
        soilMoisturePct,
        sunlightHours,
        soilN,
        pestPressure,
        days
    } = params;

    // Initialize state variables
    let GDD_cum = 0;
    let biomass = 0;
    let germinatedPct = 0;
    let fruitCount = 0;
    let flowering = false;

    const results = [];
    const growthRate = 0.05; // Base growth rate for logistic equation

    for (let day = 1; day <= days; day++) {
        // 1. Calculate daily GDD
        const GDD_today = dailyGDD(avgTempC);
        GDD_cum += GDD_today;

        // 2. Germination progress (warm temp + moisture needed)
        if (germinatedPct < 100) {
            // Optimal germination: ~22°C temp, ~55% moisture
            const tempFactor = Math.max(0, 1 - Math.abs(avgTempC - 22) / 15);
            const moistFactor = Math.max(0, 1 - Math.abs(soilMoisturePct - 55) / 45);
            const germinationRate = 15 * tempFactor * moistFactor; // ~15% per day optimal
            germinatedPct = Math.min(100, germinatedPct + germinationRate);
        }

        // Consider germinated once process begins (5%) rather than completes (100%)
        const germinated = germinatedPct >= 5;

        // 3. Calculate environmental multipliers
        const moisture_mult = moistureMultiplier(soilMoisturePct);
        const light_mult = lightMultiplier(sunlightHours);
        const nutrient_mult = nutrientMultiplier(soilN);
        const pest_mult = pestMultiplier(pestPressure);

        // 4. Effective GDD (modified by environmental factors)
        const effectiveGDD = GDD_today * moisture_mult * light_mult * nutrient_mult * pest_mult;

        // 5. Biomass accumulation (logistic growth)
        if (germinated && effectiveGDD > 0) {
            // Logistic equation: dB/dt = r * B * (1 - B) * GDD_eff
            const deltaB = growthRate * biomass * (1 - biomass) * effectiveGDD * 0.01;
            biomass = Math.min(1, biomass + deltaB + 0.001); // Small base growth
        }

        // 6. Determine phenology stage
        const stage = stageFromGDD(GDD_cum, germinated);

        // 7. Flowering trigger
        if (stage === "flowering" || stage === "fruit_set" ||
            stage === "fruit_development" || stage === "ripening") {
            flowering = true;
        }

        // 8. Fruit production - FIXED: Reasonable fruit counts with better progression
        if (stage === "fruit_set" && flowering) {
            // Start fruit production more aggressively
            const fruitPotential = biomass * effectiveGDD * 0.5; // Increased from 0.15
            const newFruits = Math.floor(fruitPotential);
            fruitCount = Math.min(30, fruitCount + newFruits); // Cap at 30 fruits
        }

        // 9. Fruit development continues with better rates
        if (stage === "fruit_development" && flowering) {
            const additionalFruits = Math.floor(biomass * effectiveGDD * 0.3); // Increased from 0.08
            fruitCount = Math.min(30, fruitCount + additionalFruits);
        }

        // 9.5. Ripening stage also produces final fruits
        if (stage === "ripening" && flowering && fruitCount < 20) {
            const ripeFruits = Math.floor(biomass * effectiveGDD * 0.2);
            fruitCount = Math.min(30, fruitCount + ripeFruits);
        }

        // 9.6. Pest damage on fruits (late stage)
        if ((stage === "fruit_development" || stage === "ripening") && pestPressure > 3) {
            fruitCount = Math.max(0, Math.floor(fruitCount * (1 - pestPressure * 0.02)));
        }
        // 10. Convert biomass to observable metrics
        const heightCm = biomassToHeightCm(biomass);
        const leafCount = biomassToLeafCount(biomass);

        // 11. Calculate health index (0-1)
        const health_moisture = Math.min(1, soilMoisturePct / 100);
        const health_light = Math.min(1, sunlightHours / 12);
        const health_nutrients = Math.min(1, soilN / 100);
        const health_pests = Math.max(0, 1 - pestPressure / 10);
        const healthIndex = 0.55 * health_moisture + 0.2 * health_light +
            0.25 * health_nutrients - 0.03 * (10 - health_pests * 10);

        // 12. Store daily state
        results.push({
            day,
            stage,
            GDD_today: parseFloat(GDD_today.toFixed(2)),
            GDD_cum: parseFloat(GDD_cum.toFixed(2)),
            germinatedPct: parseFloat(germinatedPct.toFixed(1)),
            heightCm: parseFloat(heightCm.toFixed(2)),
            leafCount,
            flowering,
            fruitCount: Math.max(0, Math.min(30, fruitCount)), // Clamp 0-30
            healthIndex: parseFloat(Math.max(0, Math.min(1, healthIndex)).toFixed(3))
        });
    }

    return results;
}

/**
 * Generate synthetic dataset for ML training
 * @param {Object} spec - Generation specifications
 * @param {number} spec.simDuration_s - Days to simulate (default 90)
 * @param {number} n - Number of samples to generate (default 1000)
 * @param {number} seed - Random seed (default 42)
 * @returns {Array<Object>} Synthetic training samples
 */
function generateSyntheticTomatoDataset(spec = {}, n = 1000, seed = 42) {
    const { simDuration_s = 90 } = spec;
    const rng = mulberry32(seed);
    const dataset = [];

    console.log(`Generating ${n} synthetic tomato growth samples...`);

    for (let i = 0; i < n; i++) {
        // Randomize input parameters
        const avgTempC = 8 + rng() * 28; // 8-36°C
        const soilMoisturePct = 10 + rng() * 90; // 10-100%
        const sunlightHours = rng() * 14; // 0-14 hours
        const soilN = rng() * 100; // 0-100
        const pestPressure = rng() * 10; // 0-10

        // Run simulation
        const results = simulateTomato({
            avgTempC,
            soilMoisturePct,
            sunlightHours,
            soilN,
            pestPressure,
            days: simDuration_s
        });

        // Store input-output pairs for each day
        results.forEach(dayState => {
            dataset.push({
                // Inputs
                avgTempC: parseFloat(avgTempC.toFixed(2)),
                soilMoisturePct: parseFloat(soilMoisturePct.toFixed(1)),
                sunlightHours: parseFloat(sunlightHours.toFixed(1)),
                soilN: parseFloat(soilN.toFixed(1)),
                pestPressure: parseFloat(pestPressure.toFixed(1)),
                targetDay: dayState.day,

                // Outputs
                heightCm: dayState.heightCm,
                stage: dayState.stage,
                fruitCount: dayState.fruitCount,
                healthIndex: dayState.healthIndex
            });
        });

        // Progress logging
        if ((i + 1) % 100 === 0) {
            console.log(`  Generated ${i + 1}/${n} samples...`);
        }
    }

    console.log(`✓ Dataset generation complete: ${dataset.length} total records`);
    return dataset;
}

/**
 * Convert synthetic rows to TensorFlow.js training format
 * @param {Array<Object>} rows - Synthetic dataset rows
 * @returns {Object} Training samples with inputs and outputs
 */
function toTrainSamples(rows) {
    const inputs = [];
    const outputs = [];

    rows.forEach(row => {
        inputs.push([
            row.avgTempC,
            row.soilMoisturePct,
            row.sunlightHours,
            row.soilN,
            row.pestPressure,
            row.targetDay
        ]);
        outputs.push([row.heightCm]);
    });

    return { inputs, outputs };
}

// ============================================================================
// MACHINE LEARNING (from ai.ts)
// ============================================================================

/**
 * Create TensorFlow.js model for tomato height prediction
 * @param {number} inputDim - Number of input features (default 6)
 * @returns {tf.Sequential} Compiled TensorFlow.js model
 */
function createTomatoModel(inputDim = 6) {
    const model = tf.sequential({
        layers: [
            tf.layers.dense({ inputShape: [inputDim], units: 32, activation: 'relu' }),
            tf.layers.dense({ units: 24, activation: 'relu' }),
            tf.layers.dense({ units: 12, activation: 'relu' }),
            tf.layers.dense({ units: 1 }) // Output: heightCm
        ]
    });

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mse', 'mae']
    });

    console.log('✓ Tomato ML model created');
    model.summary();
    return model;
}

/**
 * Compute normalization parameters (mean, std) for dataset
 * @param {Array<Array<number>>} data - 2D array of values
 * @returns {Object} Normalization parameters
 */
function computeNormalization(data) {
    const tensor = tf.tensor2d(data);
    const mean = tensor.mean(0);
    const std = tensor.sub(mean).square().mean(0).sqrt();

    const meanArray = Array.from(mean.dataSync());
    const stdArray = Array.from(std.dataSync());

    mean.dispose();
    std.dispose();
    tensor.dispose();

    return { mean: meanArray, std: stdArray };
}

/**
 * Normalize data using precomputed mean/std
 * @param {tf.Tensor} tensor - Input tensor
 * @param {Object} norm - Normalization parameters
 * @returns {tf.Tensor} Normalized tensor
 */
function normalizeData(tensor, norm) {
    const meanTensor = tf.tensor1d(norm.mean);
    const stdTensor = tf.tensor1d(norm.std);
    const normalized = tensor.sub(meanTensor).div(stdTensor.add(1e-7));
    meanTensor.dispose();
    stdTensor.dispose();
    return normalized;
}

/**
 * Train tomato height prediction model
 * @param {Array<Object>} teacherRows - Synthetic training data
 * @param {Array<Object>} userRows - User-generated experimental data (optional)
 * @param {Object} options - Training options
 * @returns {Promise<Object>} Training result with model and metrics
 */
async function trainTomatoModel(teacherRows, userRows = [], options = {}) {
    const { epochs = 40, batchSize = 64 } = options;

    console.log('🚀 Starting tomato model training...');
    console.log(`  Teacher samples: ${teacherRows.length}`);
    console.log(`  User samples: ${userRows.length}`);

    // Combine datasets
    const allRows = [...teacherRows, ...userRows];
    const { inputs, outputs } = toTrainSamples(allRows);

    // Compute normalization
    normalization = computeNormalization(inputs);
    console.log('✓ Normalization computed:', normalization);

    // Convert to tensors
    const xTensor = tf.tensor2d(inputs);
    const yTensor = tf.tensor2d(outputs);

    // Normalize inputs
    const xNorm = normalizeData(xTensor, normalization);

    // Create model
    tomatoModel = createTomatoModel(6);

    // Setup TFVis visualization
    const surface = { name: 'Training Performance (Loss/MSE/MAE)', tab: 'Visor' };
    const callbacks = tfvis.show.fitCallbacks(surface, ['loss', 'mse', 'mae'], {
        callbacks: ['onEpochEnd']
    });

    // Train model
    console.log(`🔄 Training for ${epochs} epochs...`);
    const history = await tomatoModel.fit(xNorm, yTensor, {
        epochs,
        batchSize,
        validationSplit: 0.15,
        shuffle: true,
        callbacks
    });

    // Cleanup tensors
    xTensor.dispose();
    yTensor.dispose();
    xNorm.dispose();

    // Save model to IndexedDB
    await saveModelIndexedDB(MODEL_NAME);
    await saveNormalizationIndexedDB(NORMALIZATION_NAME, normalization);

    console.log('✅ Training complete!');
    console.log('  Final loss:', history.history.loss[history.history.loss.length - 1].toFixed(4));
    console.log('  Final MAE:', history.history.mae[history.history.mae.length - 1].toFixed(4));

    return {
        model: tomatoModel,
        normalization,
        history: history.history
    };
}

/**
 * Predict tomato height using trained model
 * @param {Array<number>} input - [avgTempC, soilMoisturePct, sunlightHours, soilN, pestPressure, targetDay]
 * @param {Object} norm - Normalization parameters
 * @returns {Promise<number>} Predicted height in cm
 */
async function predictTomatoHeight(input, norm) {
    if (!tomatoModel) {
        throw new Error('Model not trained. Please train model first.');
    }

    const inputTensor = tf.tensor2d([input]);
    const inputNorm = normalizeData(inputTensor, norm);
    const prediction = tomatoModel.predict(inputNorm);
    const heightCm = (await prediction.data())[0];

    inputTensor.dispose();
    inputNorm.dispose();
    prediction.dispose();

    return heightCm;
}

/**
 * Save model to IndexedDB
 * @param {string} name - Model name
 */
async function saveModelIndexedDB(name) {
    if (!tomatoModel) {
        console.warn('No model to save');
        return;
    }
    await tomatoModel.save(`indexeddb://${name}`);
    console.log(`✓ Model saved to IndexedDB: ${name}`);
}

/**
 * Load model from IndexedDB
 * @param {string} name - Model name
 * @returns {Promise<tf.Sequential|null>} Loaded model or null
 */
async function loadModelIndexedDB(name) {
    try {
        tomatoModel = await tf.loadLayersModel(`indexeddb://${name}`);
        console.log(`✓ Model loaded from IndexedDB: ${name}`);
        return tomatoModel;
    } catch (error) {
        console.log(`No saved model found: ${name}`);
        return null;
    }
}

/**
 * Save normalization parameters to localStorage
 * @param {string} name - Storage key
 * @param {Object} norm - Normalization parameters
 */
async function saveNormalizationIndexedDB(name, norm) {
    localStorage.setItem(name, JSON.stringify(norm));
    console.log(`✓ Normalization saved: ${name}`);
}

/**
 * Load normalization parameters from localStorage
 * @param {string} name - Storage key
 * @returns {Object|null} Normalization parameters or null
 */
function loadNormalizationIndexedDB(name) {
    const stored = localStorage.getItem(name);
    if (stored) {
        normalization = JSON.parse(stored);
        console.log(`✓ Normalization loaded: ${name}`);
        return normalization;
    }
    return null;
}

/**
 * Compute RMSE between predictions and true values
 * @param {Array<number>} yTrue - True values
 * @param {Array<number>} yPred - Predicted values
 * @returns {number} RMSE value
 */
function computeRMSE(yTrue, yPred) {
    let sumSquaredError = 0;
    for (let i = 0; i < yTrue.length; i++) {
        const error = yTrue[i] - yPred[i];
        sumSquaredError += error * error;
    }
    return Math.sqrt(sumSquaredError / yTrue.length);
}

// ============================================================================
// GLOBAL EXPOSURE
// ============================================================================

window.mlTomato = {
    // Simulation
    simulateTomato,
    generateSyntheticTomatoDataset,
    toTrainSamples,

    // ML
    createTomatoModel,
    trainTomatoModel,
    predictTomatoHeight,

    // Persistence
    saveModelIndexedDB,
    loadModelIndexedDB,
    loadNormalizationIndexedDB,

    // Utilities
    dailyGDD,
    stageFromGDD,
    computeRMSE,

    // State access
    getModel: () => tomatoModel,
    getNormalization: () => normalization
};

console.log('✓ ml-tomato.js loaded successfully');