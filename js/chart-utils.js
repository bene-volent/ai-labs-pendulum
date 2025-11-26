/**
 * Chart Utilities
 * Helper functions for creating and updating Chart.js charts
 */

class ChartUtils {
    /**
     * Create a time series line chart
     * @param {string} canvasId - Canvas element ID
     * @param {Array<number>} data - Y-axis data points
     * @param {Object} options - Chart options
     * @returns {Chart} Chart.js instance
     */
    static createTimeSeriesChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        const defaultOptions = {
            totalTime: 10, // seconds
            label: 'Value',
            xLabel: 'Time (seconds)',
            yLabel: 'Value',
            color: '#667eea',
            title: 'Time Series Data'
        };
        
        const config = { ...defaultOptions, ...options };
        
        const timeSteps = data.map((_, i) => 
            (i / data.length * config.totalTime).toFixed(2)
        );
        
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeSteps,
                datasets: [{
                    label: config.label,
                    data: data,
                    borderColor: config.color,
                    backgroundColor: this.hexToRgba(config.color, 0.1),
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: config.title,
                        font: { size: 14 }
                    }
                },
                scales: {
                    x: { 
                        title: { display: true, text: config.xLabel },
                        grid: { color: '#f0f0f0' }
                    },
                    y: { 
                        title: { display: true, text: config.yLabel },
                        grid: { color: '#f0f0f0' }
                    }
                }
            }
        });
    }
    
    /**
     * Update existing chart with new data
     * @param {Chart} chart - Chart.js instance
     * @param {Array<number>} newData - New data points
     */
    static updateChart(chart, newData) {
        chart.data.datasets[0].data = newData;
        chart.update('none'); // Skip animation for better performance
    }
    
    /**
     * Convert hex color to rgba
     * @param {string} hex - Hex color code
     * @param {number} alpha - Alpha value (0-1)
     * @returns {string} RGBA color string
     */
    static hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}

// Global exposure
window.ChartUtils = ChartUtils;