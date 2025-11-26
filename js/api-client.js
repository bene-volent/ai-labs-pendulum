/**
 * API Client for AI Labs
 * Handles all communication with the backend inference API
 */

class APIClient {
    constructor(baseURL = 'http://localhost:8000') {
        this.baseURL = baseURL;
    }
    
    /**
     * Fetch prediction from ML model
     * @param {string} experimentName - Name of experiment (e.g., 'class6_pendulum')
     * @param {Array<number>} inputs - Input parameters as array
     * @returns {Promise<Object>} Prediction data
     */
    async predict(experimentName, inputs) {
        try {
            const response = await fetch(`${this.baseURL}/api/infer/${experimentName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: { X: inputs } })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(`Failed to fetch prediction: ${error.message}`);
        }
    }
    
    /**
     * Get list of available experiments
     * @returns {Promise<Array<string>>} List of experiment names
     */
    async getAvailableExperiments() {
        try {
            const response = await fetch(`${this.baseURL}/api/available`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data.trained_experiments || [];
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(`Failed to fetch experiments: ${error.message}`);
        }
    }
}

// Create global instance
window.apiClient = new APIClient();