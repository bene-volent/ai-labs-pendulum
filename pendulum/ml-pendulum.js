// ml-pendulum.js
// TensorFlow.js, Simulation, and Data Generation Logic (Converted from ai.ts, sim.ts, helpers.ts, types.ts)

// NOTE: This file relies on 'tf' and 'tfvis' being loaded globally via CDN in index.html

// --- GLOBAL STATE & CONSTANTS ---
let pendulumModel = null;
let normalization = null;
const MODEL_NAME = "pendulum-ml-model";
const NORMALIZATION_NAME = "pendulum-normalization";
const FEATURE_KEYS = ["length_m", "initialAngle_deg", "damping", "airDensity", "bobMass_kg", "gravity"];
const TARGET_KEY = "estimatedPeriod_s";

// --- PHYSICS UTILITIES (RK4 Integration, Period Estimation, Helpers) ---

/** Deterministic RNG (Mulberry32) - for consistent synthetic data */
function mulberry32(seed) {
    let t = seed >>> 0;
    return function() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/** Convert degrees to radians and vice-versa */
const deg2rad = (d) => (d * Math.PI) / 180;
const rad2deg = (r) => (r * 180) / Math.PI;

/** Mechanical energy calculation */
function computeEnergy(theta, omega, p) {
    const L = p.length_m;
    const m = p.bobMass_kg;
    const g = p.gravity;
    const v = L * omega;
    const kinetic = 0.5 * m * v * v;
    const potential = m * g * L * (1 - Math.cos(theta));
    return kinetic + potential;
}

/** Core nonlinear dynamics derivatives (d(theta)/dt and d(omega)/dt) */
function pendulumDerivatives(theta, omega, p) {
    const L = p.length_m;
    const m = p.bobMass_kg;
    const g = p.gravity;
    const c = p.damping; 
    const Cd = p.dragCoefficient; 
    const rho = p.airDensity; 
    const A = Math.PI * (0.014 * 0.014); // Bob cross-sectional area (approximated, assuming 2.8cm diameter)
    
    const dtheta = omega; 
    
    // Non-linear, damped, and drag-affected equation of motion:
    // Torque = -m*g*L*sin(theta) - c*omega*L^2 - 0.5*rho*|v|*v*A*Cd*L
    const gravityTerm = -m * g * L * Math.sin(theta);
    const dampingTerm = -c * omega * L * L; // Assuming linear damping is proportional to velocity
    
    const v = L * omega;
    const dragForce = 0.5 * rho * Math.abs(v) * v * A * Cd;
    const dragTerm = -dragForce * L;
    
    const momentOfInertia = m * L * L;
    
    // Angular acceleration (alpha)
    const domega = (gravityTerm + dampingTerm + dragTerm) / momentOfInertia; 
    
    return { dtheta, domega };
}

/** Fourth-order Runge-Kutta integrator for the next step */
function rk4Step(theta, omega, dt, p) {
    const k1 = pendulumDerivatives(theta, omega, p);

    const k2_theta = theta + (k1.dtheta * dt) / 2;
    const k2_omega = omega + (k1.domega * dt) / 2;
    const k2 = pendulumDerivatives(k2_theta, k2_omega, p);

    const k3_theta = theta + (k2.dtheta * dt) / 2;
    const k3_omega = omega + (k2.domega * dt) / 2;
    const k3 = pendulumDerivatives(k3_theta, k3_omega, p);

    const k4_theta = theta + k3.dtheta * dt;
    const k4_omega = omega + k3.domega * dt;
    const k4 = pendulumDerivatives(k4_theta, k4_omega, p);

    const nextTheta = theta + (dt / 6) * (k1.dtheta + 2 * k2.dtheta + 2 * k3.dtheta + k4.dtheta);
    const nextOmega = omega + (dt / 6) * (k1.domega + 2 * k2.domega + 2 * k3.domega + k4.domega);

    return { nextTheta, nextOmega };
}

/** Estimate period from angle time series by finding peaks */
function estimatePeriodFromSeries(states, minSwings = 3) {
    const angles = states.map(s => s.theta);
    const times = states.map(s => s.t);
    const peaks = [];
    for (let i = 1; i < angles.length - 1; i++) {
        if (angles[i] > angles[i - 1] && angles[i] > angles[i + 1]) {
            peaks.push(times[i]);
        }
    }
    
    if (peaks.length < minSwings) {
        return { meanPeriod: NaN, std: NaN, nSwings: peaks.length };
    }
    
    const diffs = [];
    for (let i = 1; i < peaks.length; i++) {
        diffs.push(peaks[i] - peaks[i - 1]);
    }
    
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length);

    return { meanPeriod: mean, std: sd, nSwings: diffs.length };
}

/** Small-angle theoretical period (T = 2π sqrt(L/g)) */
function theoreticalSmallAnglePeriod(L_m, g = 9.81) {
    return 2 * Math.PI * Math.sqrt(L_m / g);
}

// --- SIMULATION & DATA GENERATION ---

/** Simulate pendulum motion over time (for generating physicsData) */
function simulatePendulum(params) {
    const p = {
        ...params,
        timeStep: params.timeStep ?? 0.01,
        totalTime: params.totalTime ?? 20, // Default 20s from config.json
        noiseSigma: params.noiseSigma ?? 0.0,
    };

    let theta = deg2rad(p.initialAngle_deg);
    let omega = 0; 
    const dt = p.timeStep;
    const total = p.totalTime;
    const states = [];
    const L = p.length_m;

    for (let t = 0; t <= total + 1e-9; t += dt) {
        // We only simulate up to the total time for performance
        if (t < total) {
            const next = rk4Step(theta, omega, dt, p);
            theta = next.nextTheta;
            omega = next.nextOmega;
        }

        const energy = computeEnergy(theta, omega, p);
        const d_state = pendulumDerivatives(theta, omega, p);
        const alpha = d_state.domega; 
        const x = L * Math.sin(theta);
        const y = -L * Math.cos(theta);


        states.push({
            t: t, theta: theta, omega: omega, alpha: alpha, x: x, y: y, energy: energy,
        });
    }
    return states;
}

/** Generates synthetic training data (800 rows required) */
function generateSyntheticPendulumDataset(spec) {
    const rows = [];
    const n = spec.n || 800;
    const simDuration_s = spec.simDuration_s || 20;
    
    // Fixed seed for deterministic data generation
    const rng = mulberry32(42); 

    const ranges = {
        length_m: { min: 0.1, max: 2.0 },
        initialAngle_deg: { min: 5, max: 60 },
        damping: { min: 0.0, max: 0.2 },
        airDensity: { min: 0.8, max: 1.3 },
        bobMass_kg: { min: 0.05, max: 0.5 },
        gravity: { min: 5.0, max: 15.0 },
        dragCoefficient: { min: 0.1, max: 1.0 },
        timeStep: { min: 0.01, max: 0.01 } // Keep fixed for training data
    };

    const getRand = (min, max) => min + rng() * (max - min);

    for (let i = 0; i < n; i++) {
        const simParams = {
            length_m: getRand(ranges.length_m.min, ranges.length_m.max),
            initialAngle_deg: getRand(ranges.initialAngle_deg.min, ranges.initialAngle_deg.max),
            damping: getRand(ranges.damping.min, ranges.damping.max),
            airDensity: getRand(ranges.airDensity.min, ranges.airDensity.max),
            bobMass_kg: getRand(ranges.bobMass_kg.min, ranges.bobMass_kg.max),
            gravity: getRand(ranges.gravity.min, ranges.gravity.max),
            dragCoefficient: getRand(ranges.dragCoefficient.min, ranges.dragCoefficient.max),
            totalTime: simDuration_s,
            timeStep: ranges.timeStep.min,
            randomSeed: Math.floor(rng() * 1e9 + i),
        };

        const series = simulatePendulum(simParams);
        const est = estimatePeriodFromSeries(series, 3);
        
        // Fallback to small-angle theoretical period if period estimation fails
        const meanPeriod = isNaN(est.meanPeriod) ? theoreticalSmallAnglePeriod(simParams.length_m, simParams.gravity) : est.meanPeriod;

        rows.push({
            runId: `synth_${i}`,
            ...simParams,
            estimatedPeriod_s: Math.round(meanPeriod * 1000) / 1000,
        });
    }
    return rows;
}

// --- TF.JS MODEL & UTILITIES ---

/** Compute mean/std for standardization */
function computeMeanStd(rows) {
    const mean = {};
    const std = {};
    for (const key of FEATURE_KEYS) {
        const values = rows.map(r => r[key]);
        const sum = values.reduce((a, b) => a + b, 0);
        mean[key] = sum / values.length;
        const squaredDiffs = values.map(v => (v - mean[key]) ** 2);
        const sumSqDiffs = squaredDiffs.reduce((a, b) => a + b, 0);
        std[key] = Math.sqrt(sumSqDiffs / values.length) + 1e-7; 
    }
    return { mean, std };
}

/** Normalize data rows using computed mean/std */
function normalizeRows(rows, meanStd) {
    return rows.map(r => {
        const normalizedRow = {};
        for (const key of FEATURE_KEYS) {
            normalizedRow[key] = (r[key] - meanStd.mean[key]) / meanStd.std[key];
        }
        normalizedRow[TARGET_KEY] = r[TARGET_KEY];
        return normalizedRow;
    });
}

/** Format dataset into xs (features) and ys (targets) for TF.js training */
function formatPendulumRowsForTraining(rows) {
    const xs = rows.map(r => [
        r.length_m, r.initialAngle_deg, r.damping, r.airDensity, r.bobMass_kg, r.gravity
    ]);
    const ys = rows.map(r => [r.estimatedPeriod_s]);
    return { xs, ys };
}

/** Creates the Neural Network model */
function createPendulumModel(inputDim = 6) {
    if (pendulumModel) pendulumModel.dispose(); 
    
    pendulumModel = tf.sequential();
    
    // Model architecture: Dense(24, relu) -> Dense(16, relu) -> Dense(8, relu) -> Dense(1)
    pendulumModel.add(tf.layers.dense({ units: 24, activation: "relu", inputShape: [inputDim] }));
    pendulumModel.add(tf.layers.dense({ units: 16, activation: "relu" }));
    pendulumModel.add(tf.layers.dense({ units: 8, activation: "relu" }));
    pendulumModel.add(tf.layers.dense({ units: 1 })); // Single output: Period

    pendulumModel.compile({
        optimizer: tf.train.adam(0.01),
        loss: "meanSquaredError",
        metrics: ["mse", "mae"], // Metrics: loss, mse, mae for tfjs-vis
    });
    return pendulumModel;
}

// --- PERSISTENCE ---

async function saveModelIndexedDB(model) {
  await model.save(`localstorage://${MODEL_NAME}`);
}
async function loadModelIndexedDB() {
  try {
    const loadedModel = await tf.loadLayersModel(`localstorage://${MODEL_NAME}/model.json`);
    pendulumModel = loadedModel;
    return loadedModel;
  } catch (e) {
    return null;
  }
}
async function saveNormalizationIndexedDB(norm) {
  localStorage.setItem(NORMALIZATION_NAME, JSON.stringify(norm));
}
async function loadNormalizationIndexedDB() {
  const normString = localStorage.getItem(NORMALIZATION_NAME);
  if (normString) {
    normalization = JSON.parse(normString);
    return normalization;
  }
  return null;
}

// --- MAIN FUNCTIONS ---

/** Trains the model and shows tfjs-vis charts */
async function trainPendulumModel(teacherRows, options = {}) {
    if (!tf) throw new Error("TensorFlow.js not loaded.");
    if (!tfvis) throw new Error("TensorFlow.js Vis not loaded.");

    // Open the Visor to display the loss/metrics charts
    tfvis.visor().open(); 

    const allRows = [...teacherRows]; 
    
    // 1. Normalize Data: Calculate mean/std and normalize features
    normalization = computeMeanStd(allRows);
    const normalizedRows = normalizeRows(allRows, normalization);
    const { xs: rawX, ys: rawY } = formatPendulumRowsForTraining(normalizedRows);

    // 2. Create Tensors
    const xTensor = tf.tensor2d(rawX);
    const yTensor = tf.tensor2d(rawY);
    
    // 3. Create Model
    const model = createPendulumModel(rawX[0].length);
    
    // 4. Training Options (Default 100 epochs)
    const trainOptions = { 
        epochs: options.epochs || 100,
        batchSize: options.batchSize || 32,
        shuffle: true,
        callbacks: [
            // Display Loss, MSE, and MAE charts
            tfvis.show.fitCallbacks(
                { name: 'Training Performance (Loss/MSE/MAE)' },
                ['loss', 'mse', 'mae'], 
                { callbacks: ['onEpochEnd'] }
            )
        ]
    };

    // 5. Train
    await model.fit(xTensor, yTensor, trainOptions);
    
    // 6. Cleanup Tensors and Save
    xTensor.dispose(); 
    yTensor.dispose();
    await saveNormalizationIndexedDB(normalization);
    await saveModelIndexedDB(model);
    
    return { status: 'Training complete', model, normalization };
}

/** Predicts period using a trained model and normalization object. */
function predictPendulumPeriod(input) {
    if (!pendulumModel || !normalization) {
        throw new Error("ML Model is not loaded or trained.");
    }

    // 1. Normalize the 6 input features
    const normalizedInput = [
        (input.length_m - normalization.mean.length_m) / normalization.std.length_m,
        (input.initialAngle_deg - normalization.mean.initialAngle_deg) / normalization.std.initialAngle_deg,
        (input.damping - normalization.mean.damping) / normalization.std.damping,
        (input.airDensity - normalization.mean.airDensity) / normalization.std.airDensity,
        (input.bobMass_kg - normalization.mean.bobMass_kg) / normalization.std.bobMass_kg,
        (input.gravity - normalization.mean.gravity) / normalization.std.gravity,
    ];

    // 2. Create tensor, predict
    const x = tf.tensor2d([normalizedInput]);
    const pred = pendulumModel.predict(x);
    
    const value = Array.isArray(pred) ? pred[0].dataSync()[0] : pred.dataSync()[0];
    
    // 3. Cleanup
    x.dispose(); 
    if (Array.isArray(pred)) { pred.forEach(t => t.dispose()); } else { pred.dispose(); }
    
    return value;
}


// --- GLOBAL EXPOSURE (for pendulum.js) ---
window.mlPendulum = {
    simulatePendulum, 
    estimatePeriodFromSeries, 
    generateSyntheticPendulumDataset,
    trainPendulumModel,
    predictPendulumPeriod,
    theoreticalSmallAnglePeriod,
    loadModelIndexedDB,
    loadNormalizationIndexedDB,
    rad2deg,
    deg2rad,
    get isModelLoaded() { return !!pendulumModel; }
};