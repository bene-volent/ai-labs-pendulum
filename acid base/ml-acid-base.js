/**
 * Acid-Base pH Indicator Simulation - ML & Physics Logic
 * Converted from TypeScript (sim.ts, helpers.ts, ai.ts, types.ts)
 * 
 * Core Features:
 * - pH-based color calculation for litmus and universal indicators
 * - Henderson-Hasselbalch equation for litmus (pKa = 7.0)
 * - RGB interpolation for universal indicator color gradient
 * - TensorFlow.js model training for color prediction
 */

// NOTE: This file relies on 'tf' and 'tfvis' being loaded globally via CDN in index.html

// ============================================================================
// GLOBAL STATE & CONSTANTS
// ============================================================================

let acidBaseModel = null;
let normalization = null;
const MODEL_NAME = "acid-base-model";
const NORMALIZATION_NAME = "acid-base-normalization";

// Configuration (from config.json)
const CONFIG = {
    indicators: {
        litmus: {
            pKa: 7.0,
            acid_color: [255, 0, 0],   // Red
            base_color: [0, 0, 255]    // Blue
        },
        universal: {
            color_map: [
                { pH: 1, rgb: [255, 0, 0] },      // Red
                { pH: 4, rgb: [255, 128, 0] },    // Orange
                { pH: 7, rgb: [0, 255, 0] },      // Green
                { pH: 10, rgb: [0, 0, 255] },     // Blue
                { pH: 14, rgb: [128, 0, 128] }    // Purple
            ]
        }
    },
    default_path_length_cm: 1.0,
    noise_sigma: 0.01
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Interpolate between two RGB colors
 * @param {Array<number>} a - First RGB color [r, g, b]
 * @param {Array<number>} b - Second RGB color [r, g, b]
 * @param {number} t - Interpolation factor (0-1)
 * @returns {Array<number>} Interpolated RGB color
 */
function interpolateRGB(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}

/**
 * Calculate acid/base ratio using Henderson-Hasselbalch equation
 * @param {number} pH - Solution pH
 * @param {number} pKa - Indicator pKa value
 * @returns {Object} { acid: number, base: number } ratios (0-1)
 */
function litmusAcidBaseRatio(pH, pKa) {
    const ratio = Math.pow(10, pH - pKa);
    const acid = 1 / (1 + ratio);
    const base = ratio / (1 + ratio);
    return { acid, base };
}

/**
 * Find two nearest pH nodes in universal indicator table and interpolate
 * @param {number} pH - Solution pH
 * @returns {Array<number>} RGB color [r, g, b]
 */
function interpolateUniversalColor(pH) {
    const map = CONFIG.indicators.universal.color_map;
    
    let low = map[0];
    let high = map[map.length - 1];
    
    // Find surrounding pH points
    for (let i = 0; i < map.length - 1; i++) {
        if (pH >= map[i].pH && pH <= map[i + 1].pH) {
            low = map[i];
            high = map[i + 1];
            break;
        }
    }
    
    // Interpolate between the two points
    const t = (pH - low.pH) / (high.pH - low.pH);
    return interpolateRGB(low.rgb, high.rgb, t);
}

/**
 * Convert RGB array to CSS color string
 * @param {Array<number>} rgb - RGB values [r, g, b]
 * @returns {string} CSS rgb() string
 */
function rgbToString(rgb) {
    return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
}

// ============================================================================
// SIMULATION LOGIC
// ============================================================================

/**
 * Run physics-based simulation to calculate indicator color
 * @param {Object} inputs - Simulation inputs
 * @param {string} inputs.runId - Unique run identifier
 * @param {string} inputs.indicator - 'litmus' or 'universal'
 * @param {number} inputs.pH - Solution pH (0-14)
 * @param {number} inputs.pathLengthCm - Optical path length in cm
 * @returns {Object} { r, g, b, runId, indicator, pH, pathLengthCm }
 */
function runSimulation(inputs) {
    const { runId, indicator, pH, pathLengthCm } = inputs;
    
    let rgb;
    
    if (indicator === 'litmus') {
        // Litmus: Red in acid, blue in base
        const { acid, base } = litmusAcidBaseRatio(pH, CONFIG.indicators.litmus.pKa);
        rgb = interpolateRGB(
            CONFIG.indicators.litmus.acid_color,
            CONFIG.indicators.litmus.base_color,
            base
        );
    } else {
        // Universal indicator: Full color gradient
        rgb = interpolateUniversalColor(pH);
    }
    
    // Add small noise for realism
    const ns = CONFIG.noise_sigma;
    rgb = rgb.map(v => {
        const noise = (Math.random() * ns - ns / 2) * 255;
        return Math.min(255, Math.max(0, v + noise));
    });
    
    return {
        r: rgb[0],
        g: rgb[1],
        b: rgb[2],
        runId,
        indicator,
        pH,
        pathLengthCm
    };
}

/**
 * Generate synthetic training dataset for ML
 * @param {number} n - Number of samples to generate
 * @param {number} seed - Random seed
 * @returns {Array<Object>} Training samples
 */
function generateSyntheticDataset(n = 1000, seed = 42) {
    const rng = mulberry32(seed);
    const dataset = [];
    
    console.log(`Generating ${n} synthetic pH indicator samples...`);
    
    for (let i = 0; i < n; i++) {
        // Randomize inputs
        const indicator = rng() > 0.5 ? 'litmus' : 'universal';
        const pH = rng() * 14; // 0-14
        const pathLengthCm = 0.5 + rng() * 1.5; // 0.5-2.0 cm
        
        // Run simulation
        const result = runSimulation({
            runId: `synth_${i}`,
            indicator,
            pH,
            pathLengthCm
        });
        
        dataset.push({
            pH: parseFloat(pH.toFixed(2)),
            pathLengthCm: parseFloat(pathLengthCm.toFixed(2)),
            indicator: indicator === 'litmus' ? 0 : 1, // Encode as number
            r: result.r,
            g: result.g,
            b: result.b
        });
        
        if ((i + 1) % 100 === 0) {
            console.log(`  Generated ${i + 1}/${n} samples...`);
        }
    }
    
    console.log(`✓ Dataset generation complete: ${dataset.length} records`);
    return dataset;
}

/**
 * Mulberry32 pseudo-random number generator
 */
function mulberry32(seed) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ============================================================================
// MACHINE LEARNING
// ============================================================================

/**
 * Create neural network model for RGB prediction
 * @param {number} inputDim - Number of input features (3: pH, pathLength, indicator)
 * @returns {tf.Sequential} Compiled model
 */
function createAcidBaseModel(inputDim = 3) {
    const model = tf.sequential({
        layers: [
            tf.layers.dense({ inputShape: [inputDim], units: 32, activation: 'relu' }),
            tf.layers.dense({ units: 32, activation: 'relu' }),
            tf.layers.dense({ units: 16, activation: 'relu' }),
            tf.layers.dense({ units: 3, activation: 'sigmoid' }) // Output: r, g, b (normalized 0-1)
        ]
    });
    
    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
        metrics: ['mse', 'mae']
    });
    
    console.log('✓ Acid-Base ML model created');
    model.summary();
    return model;
}

/**
 * Compute normalization parameters for dataset
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
 * Normalize tensor using precomputed mean/std
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
 * Train ML model to predict RGB from pH and indicator type
 * @param {Array<Object>} dataset - Training data
 * @param {Object} options - Training options
 * @returns {Promise<Object>} { model, normalization, history }
 */
async function trainAcidBaseModel(dataset, options = {}) {
    const { epochs = 50, batchSize = 32 } = options;
    
    console.log('🚀 Starting acid-base model training...');
    console.log(`  Dataset size: ${dataset.length}`);
    
    // Prepare inputs and outputs
    const inputs = dataset.map(d => [d.pH, d.pathLengthCm, d.indicator]);
    const outputs = dataset.map(d => [d.r / 255, d.g / 255, d.b / 255]); // Normalize to 0-1
    
    // Compute normalization for inputs
    normalization = computeNormalization(inputs);
    console.log('✓ Normalization computed:', normalization);
    
    // Convert to tensors
    const xTensor = tf.tensor2d(inputs);
    const yTensor = tf.tensor2d(outputs);
    
    // Normalize inputs
    const xNorm = normalizeData(xTensor, normalization);
    
    // Create model
    acidBaseModel = createAcidBaseModel(3);
    
    // Setup TFVis visualization
    const surface = { name: 'Training Performance', tab: 'Visor' };
    const callbacks = tfvis.show.fitCallbacks(surface, ['loss', 'mse', 'mae'], {
        callbacks: ['onEpochEnd']
    });
    
    // Train
    console.log(`🔄 Training for ${epochs} epochs...`);
    const history = await acidBaseModel.fit(xNorm, yTensor, {
        epochs,
        batchSize,
        validationSplit: 0.15,
        shuffle: true,
        callbacks
    });
    
    // Cleanup
    xTensor.dispose();
    yTensor.dispose();
    xNorm.dispose();
    
    // Save to IndexedDB
    await saveModelIndexedDB(MODEL_NAME);
    await saveNormalizationIndexedDB(NORMALIZATION_NAME, normalization);
    
    console.log('✅ Training complete!');
    console.log('  Final loss:', history.history.loss[history.history.loss.length - 1].toFixed(4));
    console.log('  Final MAE:', history.history.mae[history.history.mae.length - 1].toFixed(4));
    
    return { model: acidBaseModel, normalization, history: history.history };
}

/**
 * Predict RGB color using trained model
 * @param {number} pH - Solution pH
 * @param {number} pathLengthCm - Path length
 * @param {string} indicator - 'litmus' or 'universal'
 * @param {Object} norm - Normalization parameters
 * @returns {Promise<Object>} { r, g, b }
 */
async function predictColor(pH, pathLengthCm, indicator, norm) {
    if (!acidBaseModel) {
        throw new Error('Model not trained. Please train model first.');
    }
    
    const indicatorNum = indicator === 'litmus' ? 0 : 1;
    const input = [pH, pathLengthCm, indicatorNum];
    
    const inputTensor = tf.tensor2d([input]);
    const inputNorm = normalizeData(inputTensor, norm);
    const prediction = acidBaseModel.predict(inputNorm);
    
    const [r, g, b] = (await prediction.data());
    
    inputTensor.dispose();
    inputNorm.dispose();
    prediction.dispose();
    
    return {
        r: r * 255,
        g: g * 255,
        b: b * 255
    };
}

// ============================================================================
// PERSISTENCE
// ============================================================================

async function saveModelIndexedDB(name) {
    if (!acidBaseModel) {
        console.warn('No model to save');
        return;
    }
    await acidBaseModel.save(`indexeddb://${name}`);
    console.log(`✓ Model saved to IndexedDB: ${name}`);
}

async function loadModelIndexedDB(name) {
    try {
        acidBaseModel = await tf.loadLayersModel(`indexeddb://${name}`);
        console.log(`✓ Model loaded from IndexedDB: ${name}`);
        return acidBaseModel;
    } catch (error) {
        console.log(`No saved model found: ${name}`);
        return null;
    }
}

async function saveNormalizationIndexedDB(name, norm) {
    localStorage.setItem(name, JSON.stringify(norm));
    console.log(`✓ Normalization saved: ${name}`);
}

function loadNormalizationIndexedDB(name) {
    const stored = localStorage.getItem(name);
    if (stored) {
        normalization = JSON.parse(stored);
        console.log(`✓ Normalization loaded: ${name}`);
        return normalization;
    }
    return null;
}

// ============================================================================
// GLOBAL EXPOSURE
// ============================================================================

window.mlAcidBase = {
    // Simulation
    runSimulation,
    generateSyntheticDataset,
    
    // ML
    createAcidBaseModel,
    trainAcidBaseModel,
    predictColor,
    
    // Persistence
    saveModelIndexedDB,
    loadModelIndexedDB,
    loadNormalizationIndexedDB,
    
    // Utilities
    interpolateRGB,
    rgbToString,
    interpolateUniversalColor,
    litmusAcidBaseRatio,
    
    // State access
    getModel: () => acidBaseModel,
    getNormalization: () => normalization,
    CONFIG
};

console.log('✓ ml-acid-base.js loaded successfully');