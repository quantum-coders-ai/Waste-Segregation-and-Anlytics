let charts = {};
export const STATUS = {
    OFFLINE: { text: "Ready [Offline]", color: "bg-gray-400", pulse: false },
    ONLINE: { text: "Ready [Online]", color: "bg-green-500", pulse: false },
    RUNNING: { text: "Simulation Running", color: "bg-blue-500", pulse: true },
    STOPPED: { text: "Stopped", color: "bg-red-500", pulse: false }
};

export const elements = {
    // Status
    statusText: document.getElementById('status-text'),
    statusDot: document.getElementById('status-dot'),
    // Controls
    btnStart: document.getElementById('btn-start'),
    btnStop: document.getElementById('btn-stop'),
    btnClear: document.getElementById('btn-clear'),
    // Advanced Controls
    checkFault: document.getElementById('check-fault'),
    sliderSpeed: document.getElementById('slider-speed'),
    sliderFaultRate: document.getElementById('slider-fault-rate'),
    faultRateValue: document.getElementById('fault-rate-value'),
    // KPIs
    kpiTotal: document.getElementById('kpi-total'),
    kpiAccuracy: document.getElementById('kpi-accuracy'),
    kpiThroughput: document.getElementById('kpi-throughput'),
    // Simulation
    logContainer: document.getElementById('event-log'),
    sortingStation: document.getElementById('sorting-station'),
    scanner: document.getElementById('scanner'),
    // Modal
    modal: document.getElementById('item-modal'),
    modalDialog: document.getElementById('modal-dialog'),
    modalContent: document.getElementById('modal-content'),
    modalButtons: document.getElementById('modal-buttons'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    // Filters & Reports
    timeFilterControls: document.getElementById('time-filter-controls'),
    btnGenerateReport: document.getElementById('btn-generate-report'),
    // Theme
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    iconSun: document.getElementById('icon-sun'),
    iconMoon: document.getElementById('icon-moon'),
    // Placeholders
    placeholders: {
        trend: document.getElementById('trend-placeholder'),
        categories: document.getElementById('categories-placeholder'),
        recycle: document.getElementById('recycle-placeholder')
    }
};

export const WASTE_DECK_CONFIG = [
    { type: 'Plastic', recyclable: true, color: '#3B82F6', position: 'row-start-1 col-start-1' },
    { type: 'Paper', recyclable: true, color: '#F59E0B', position: 'row-start-1 col-start-2' },
    { type: 'Metal', recyclable: true, color: '#6B7280', position: 'row-start-1 col-start-3' },
    { type: 'Glass', recyclable: true, color: '#10B981', position: 'row-start-2 col-start-3' },
    { type: 'Organic', recyclable: false, color: '#F97316', position: 'row-start-3 col-start-3' },
    { type: 'E-Waste', recyclable: false, color: '#8B5CF6', position: 'row-start-3 col-start-2' },
    { type: 'Textiles', recyclable: false, color: '#DB2777', position: 'row-start-3 col-start-1' },
    { type: 'Cardboard', recyclable: true, color: '#A16207', position: 'row-start-2 col-start-1' },
    { type: 'Non-Recyclable', recyclable: false, color: '#EF4444', position: 'hidden' } // Not a bin
];

const CHART_EMPTY_MESSAGE = 'No data for this period. Start the simulation to see live analytics.';

/**
 * Initializes all UI elements, charts, and event listeners.
 * @param {object} callbacks - An object containing all callback functions from main.js
 */
export function initUI(callbacks) {
    // Create the bin elements dynamically from the config
    WASTE_DECK_CONFIG.forEach(config => {
        if(config.position === 'hidden') return;
        const bin = document.createElement('div');
        bin.id = `bin-${config.type}`;
        bin.className = `bin ${config.position} bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col items-center justify-center border-2 border-gray-300 dark:border-gray-600 transition-all duration-300`;
        bin.innerHTML = `<span class="font-bold text-sm text-gray-800 dark:text-gray-100">${config.type}</span>`;
        bin.style.setProperty('--glow-color', config.color + '80');
        elements.sortingStation.appendChild(bin);
    });

    // --- Chart.js Initialization ---
    // Define shared options for all charts
    const chartOptions = { 
        responsive: true, 
        maintainAspectRatio: false, 
        animation: { duration: 500 }
    };
    const doughnutChartOptions = { 
        ...chartOptions, 
        plugins: { 
            legend: { 
                position: 'bottom', 
                labels: { boxWidth: 12 } 
            } 
        }, 
        layout: { padding: 10 } 
    };

    // Create charts
    charts.categories = new Chart(document.getElementById('chart-categories').getContext('2d'), { type: 'doughnut', data: { labels: [], datasets: [{ data: [] }] }, options: doughnutChartOptions });
    charts.recycle = new Chart(document.getElementById('chart-recycle').getContext('2d'), { type: 'pie', data: { labels: ['Recycled', 'Dumped'], datasets: [{ data: [0,0], backgroundColor: ['#16A34A', '#DC2626'] }] }, options: doughnutChartOptions });
    charts.trend = new Chart(document.getElementById('chart-trend').getContext('2d'), { 
        type: 'line', 
        data: { 
            datasets: [{ 
                label: 'Items Processed', 
                data: [], 
                tension: 0.2, 
                pointRadius: 2, 
                fill: true, 
                backgroundColor: 'rgba(59, 130, 246, 0.2)', 
                borderColor: 'rgba(59, 130, 246, 1)' 
            }] 
        }, 
        options: { 
            ...chartOptions, 
            scales: { 
                x: { 
                    type: 'time', 
                    time: { unit: 'second', displayFormats: { second: 'h:mm:ss a'} }, 
                    ticks: { maxTicksLimit: 10 },
                    grid: { color: 'rgba(128, 128, 128, 0.1)' }
                }, 
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Count' },
                    grid: { color: 'rgba(128, 128, 128, 0.1)' }
                } 
            } 
        }
    });
    
    // --- Event Listeners ---
    // Check if callbacks are valid before assigning
    Object.values(callbacks).forEach(cb => {
        if (typeof cb !== 'function') console.error("Invalid callback provided to initUI");
    });

    // Modal listeners
    elements.btnCloseModal.onclick = () => hideModal();
    elements.modal.onclick = (e) => { if (e.target === elements.modal) hideModal(); };
    
    // Control listeners
    elements.btnStart.onclick = callbacks.onStart;
    elements.btnStop.onclick = callbacks.onStop;
    elements.btnClear.onclick = callbacks.onClear;
    elements.btnGenerateReport.onclick = callbacks.onGenerateReport;

    // Advanced control listeners
    elements.checkFault.onchange = callbacks.onFaultToggle;
    elements.sliderSpeed.oninput = callbacks.onSpeedChange;
    elements.sliderFaultRate.oninput = callbacks.onFaultRateChange;

    // Time filter button listeners
    elements.timeFilterControls.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.filter) {
            const filterValue = e.target.dataset.filter;
            callbacks.onFilterChange(filterValue);
            // Update active state
            elements.timeFilterControls.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active', 'bg-blue-600', 'text-white', 'dark:bg-blue-500');
                btn.classList.add('bg-gray-200', 'dark:bg-gray-700');
            });
            e.target.classList.add('active', 'bg-blue-600', 'text-white', 'dark:bg-blue-500');
            e.target.classList.remove('bg-gray-200', 'dark:bg-gray-700');
        }
    });

    // Theme toggle listener
    elements.btnThemeToggle.onclick = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.theme = isDark ? 'dark' : 'light';
        updateThemeIcon(isDark);
        updateChartTheme(isDark);
    };

    // Initialize theme
    initTheme();
    
    // Set initial status
    updateStatus(STATUS.OFFLINE);
}

/**
 * Updates all KPI cards and charts with new data.
 * @param {Array} data - The (potentially filtered) data to display.
 */
export function updateAnalytics(data) {
    const total = data.length;
    const placeholders = elements.placeholders;
    
    // --- Handle Empty State ---
    if(total === 0) {
         elements.kpiTotal.textContent = 0;
         elements.kpiAccuracy.textContent = '--%';
         elements.kpiThroughput.innerHTML = `0 <span class="text-xl font-medium">items/min</span>`;
         // Clear all charts
         Object.values(charts).forEach(chart => {
             chart.data.labels = [];
             chart.data.datasets.forEach(dataset => dataset.data = []);
             chart.update('none');
         });
         // Show "No data" placeholders
         Object.values(placeholders).forEach(p => {
             if (p) {
                 p.textContent = CHART_EMPTY_MESSAGE;
                 p.classList.remove('hidden');
             }
         });
         updateEventLog([], showModal); // Clear event log
         return;
    }
    
    // --- Handle Populated State ---
    // Hide placeholders
    Object.values(placeholders).forEach(p => p && p.classList.add('hidden'));

    let correct = 0;
    let throughputCount = 0;
    const now = Date.now();
    const categoryCounts = {};
    const recycleCounts = { recycled: 0, dumped: 0 };
    const trendAggregated = {};
    const interval = 5000; // 5-second intervals for trend chart

    // --- EFFICIENCY FIX ---
    // Calculate all stats in a single loop
    data.forEach(item => {
        // 1. Accuracy
        if (item.prediction === item.actual) {
            correct++;
        }
        
        // 2. Throughput (items in the last 60s)
        if ((now - item.timestamp) < 60000) {
            throughputCount++;
        }
        
        // 3. Category Counts
        categoryCounts[item.actual] = (categoryCounts[item.actual] || 0) + 1;
        
        // 4. Recycled vs. Dumped
        item.recyclable ? recycleCounts.recycled++ : recycleCounts.dumped++;
        
        // 5. Trend Data (aggregate by 5s intervals)
        const timeKey = Math.floor(item.timestamp / interval) * interval;
        trendAggregated[timeKey] = (trendAggregated[timeKey] || 0) + 1;
    });

    // --- Update KPIs ---
    const accuracy = (correct / total) * 100;
    elements.kpiTotal.textContent = total;
    elements.kpiAccuracy.textContent = `${accuracy.toFixed(1)}%`;
    elements.kpiAccuracy.style.color = accuracy < 85 ? '#DC2626' : '#16A34A'; // Red or Green
    elements.kpiThroughput.innerHTML = `${throughputCount} <span class="text-xl font-medium">items/min</span>`;

    // --- Update Charts ---
    
    // Categories Chart
    charts.categories.data.labels = Object.keys(categoryCounts);
    charts.categories.data.datasets[0].data = Object.values(categoryCounts);
    charts.categories.data.datasets[0].backgroundColor = Object.keys(categoryCounts).map(
        key => WASTE_DECK_CONFIG.find(c => c.type === key)?.color || '#9CA3AF'
    );
    charts.categories.update();

    // Recycle Chart
    charts.recycle.data.datasets[0].data = [recycleCounts.recycled, recycleCounts.dumped];
    charts.recycle.update();
    
    // Trend Chart
    const trendData = Object.keys(trendAggregated).map(key => ({ 
        x: parseInt(key), 
        y: trendAggregated[key] 
    })).sort((a,b) => a.x - b.x); // Must be sorted for line chart
    
    charts.trend.data.datasets[0].data = trendData;
    charts.trend.update('quiet'); // 'quiet' update to avoid jerky animation

    // --- Update Event Log ---
    updateEventLog(data, showModal);
}

/**
 * Updates the scrolling event log with the latest items.
 * @param {Array} data - The data to display in the log.
 * @param {Function} onLogClick - Callback for when a log item is clicked.
 */
function updateEventLog(data, onLogClick) {
    elements.logContainer.innerHTML = ''; // Clear the log
    // Show last 10 items, newest first
    data.slice(-10).reverse().forEach(item => {
        const isCorrect = item.prediction === item.actual;
        const logEntry = document.createElement('div');
        logEntry.className = `p-1.5 border-b text-sm ${isCorrect ? 'dark:text-gray-300' : 'bg-red-100 dark:bg-red-900/30'} cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors dark:border-gray-600`;
        logEntry.innerHTML = `<span class="font-mono text-xs">${new Date(item.timestamp).toLocaleTimeString()}</span>: Actual: <strong class"dark:text-white">${item.actual}</strong>, Predicted: ${item.prediction}`;
        logEntry.onclick = () => onLogClick(item);
        elements.logContainer.appendChild(logEntry);
    });
}

/**
 * Shows the modal with details for a specific item.
 * @param {object} item - The waste item to inspect.
 */
function showModal(item) {
    const isCorrect = item.prediction === item.actual;
    // Set the modal content
    elements.modalContent.innerHTML = `
        <p><strong>Item ID:</strong> <span class="font-mono text-sm">${item.id}</span></p>
        <p><strong>Timestamp:</strong> ${new Date(item.timestamp).toLocaleString()}</p>
        <hr class="my-3 dark:border-gray-600">
        <p><strong>Actual Material:</strong> <span class="font-semibold">${item.actual}</span></p>
        <p><strong>ML Prediction:</strong> <span class="font-semibold">${item.prediction}</span></p>
        <p><strong>Confidence Score:</strong> <span class="font-semibold">${(item.confidence * 100).toFixed(1)}%</span></p>
        <p class="mt-2"><strong>Result:</strong> <span class="font-bold text-lg ${isCorrect ? 'text-green-600' : 'text-red-600'}">${isCorrect ? '✓ Correctly Sorted' : '✗ Incorrectly Sorted'}</span></p>
    `;
    
    // Clear any dynamic buttons (from confirmation modal)
    elements.modalButtons.innerHTML = '';
    
    // Show the modal with animation
    elements.modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => { elements.modalDialog.classList.remove('opacity-0', 'scale-95'); }, 10);
}

/**
 * Hides the main modal.
 */
function hideModal() {
    elements.modalDialog.classList.add('opacity-0', 'scale-95');
    document.body.classList.remove('overflow-hidden');
    setTimeout(() => { elements.modal.classList.add('hidden'); }, 300); // Wait for animation
}

/**
 * Shows a confirmation modal for dangerous actions.
 * @param {string} title - The title for the modal.
 * @param {string} message - The confirmation message.
 * @param {Function} onConfirm - The callback to run if "Confirm" is clicked.
 */
export function showConfirmationModal(title, message, onConfirm) {
    // Set the title and message
    elements.modalContent.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">${title}</h2>
        <p class="mt-4 text-gray-600 dark:text-gray-300">${message}</p>
    `;
    
    // Add "Cancel" and "Confirm" buttons
    elements.modalButtons.innerHTML = `
        <button id="btn-modal-cancel" class="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-bold py-2 px-4 rounded-lg transition-colors">Cancel</button>
        <button id="btn-modal-confirm" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Confirm</button>
    `;
    
    // Attach listeners
    document.getElementById('btn-modal-cancel').onclick = () => hideModal();
    document.getElementById('btn-modal-confirm').onclick = () => {
        onConfirm();
        hideModal();
    };
    
    // Show the modal
    elements.modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => { elements.modalDialog.classList.remove('opacity-0', 'scale-95'); }, 10);
}

/**
 * Shows the modal with the generated insights report.
 * @param {object} report - The report object from main.js
 */
export function showInsightReport(report) {
    let reportHTML = '<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Insights Report</h2>';
    
    report.insights.forEach(insight => {
        reportHTML += `
            <div classclass="mb-4">
                <h3 class="font-semibold text-lg text-gray-800 dark:text-gray-100">${insight.title}</h3>
                <p class="text-gray-600 dark:text-gray-300 text-sm">${insight.text}</p>
            </div>
        `;
    });
    
    // Add specific HTML for Hazard Warnings
    if (report.hazardWarnings && report.hazardWarnings.length > 0) {
        reportHTML += `
            <div class="mb-4 mt-6 p-3 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-r-lg">
                <h3 class="font-semibold text-lg text-yellow-800 dark:text-yellow-200">High-Priority Hazard Warnings</h3>
                <div class="text-yellow-700 dark:text-yellow-300 text-sm space-y-2 mt-2">
                    ${report.hazardWarnings.map(warning => `<p>${warning}</p>`).join('')}
                </div>
            </div>
        `;
    }

    elements.modalContent.innerHTML = reportHTML;
    
    // Add a simple "Close" button
    elements.modalButtons.innerHTML = `
        <button id="btn-modal-close" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Close</button>
    `;
    document.getElementById('btn-modal-close').onclick = () => hideModal();
    
    // Show the modal
    elements.modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => { elements.modalDialog.classList.remove('opacity-0', 'scale-95'); }, 10);
}

/**
 * Updates the status text and dot.
 * @param {object} status - A status object from the STATUS const.
 */
export function updateStatus(status) {
    elements.statusText.textContent = status.text;
    elements.statusDot.className = `w-4 h-4 ${status.color} rounded-full transition-colors`;
    status.pulse ? elements.statusDot.classList.add('animate-pulse') : elements.statusDot.classList.remove('animate-pulse');
}

/**
 * Creates and animates a waste item element from the scanner to a bin.
 * @param {object} item - The item to animate.
 * @param {string} sortedTo - The 'type' of the bin it was sorted to.
 */
export function updateSortingAnimation(item, sortedTo) {
    // Remove the previous item, if any
    document.getElementById('current-item')?.remove();
    
    if (item) {
        const itemEl = document.createElement('div');
        itemEl.id = 'current-item';
        const config = WASTE_DECK_CONFIG.find(c => c.type === item.type);
        
        // Style the item element
        itemEl.className = `w-20 h-20 text-white flex flex-col items-center justify-center rounded-lg shadow-lg border-2 border-white/20 absolute z-10`;
        itemEl.style.backgroundColor = config.color;
        itemEl.innerHTML = `<span class="font-bold text-lg">${item.type}</span><span class="text-xs font-mono">${item.id}</span>`;
        
        // Add to body to be able to position it absolutely on the screen
        document.body.appendChild(itemEl);
        
        // Position it over the scanner
        const scannerRect = elements.scanner.getBoundingClientRect();
        itemEl.style.left = `${scannerRect.left + window.scrollX + (scannerRect.width / 2) - 40}px`;
        itemEl.style.top = `${scannerRect.top + window.scrollY + (scannerRect.height / 2) - 40}px`;
        itemEl.style.transition = 'all 0.8s ease-in-out';
        
        // If it has a destination (i.e., it's been sorted)
        if (sortedTo) {
            const binEl = document.getElementById(`bin-${sortedTo}`);
            if (!binEl) {
                console.warn(`No bin found for type: ${sortedTo}. Hiding item.`);
                itemEl.remove();
                return;
            }
            const binRect = binEl.getBoundingClientRect();
            
            // Wait for the item to "appear" over the scanner, then animate it
            setTimeout(() => {
                itemEl.style.left = `${binRect.left + window.scrollX + (binRect.width / 2) - 20}px`;
                itemEl.style.top = `${binRect.top + window.scrollY + (binRect.height / 2) - 20}px`;
                itemEl.style.transform = 'scale(0.3)';
                itemEl.style.opacity = '0';
                
                // Add a "glow" effect to the bin
                binEl.classList.add('sorted');
                setTimeout(() => binEl.classList.remove('sorted'), 500);
            }, 200);
            
            // Clean up the element after the animation
            setTimeout(() => itemEl.remove(), 1200);
        }
    }
}


// --- Dark Mode Theme ---

/**
 * Sets the initial theme on page load.
 */
function initTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    updateThemeIcon(isDark);
    updateChartTheme(isDark);
}

/**
 * Updates the Sun/Moon icon in the toggle button.
 * @param {boolean} isDark - True if dark mode is active.
 */
function updateThemeIcon(isDark) {
    if (isDark) {
        elements.iconMoon.classList.remove('hidden');
        elements.iconSun.classList.add('hidden');
    } else {
        elements.iconSun.classList.remove('hidden');
        elements.iconMoon.classList.add('hidden');
    }
}

/**
 * Updates the colors for all charts to match the theme.
 * @param {boolean} isDark - True if dark mode is active.
 */
function updateChartTheme(isDark) {
    const textColor = isDark ? '#E5E7EB' : '#1F2937'; // gray-200 or gray-800
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const trendBorder = isDark ? '#60A5FA' : '#2563EB'; // blue-400 or blue-600
    const trendBg = isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.2)';

    // Update all charts
    if (charts.trend) {
        charts.trend.options.scales.x.ticks.color = textColor;
        charts.trend.options.scales.x.grid.color = gridColor;
        charts.trend.options.scales.y.ticks.color = textColor;
        charts.trend.options.scales.y.grid.color = gridColor;
        charts.trend.options.scales.y.title.color = textColor;
        charts.trend.options.plugins.legend.labels.color = textColor;
        charts.trend.data.datasets[0].borderColor = trendBorder;
        charts.trend.data.datasets[0].backgroundColor = trendBg;
        charts.trend.update('none');
    }
    if (charts.categories) {
        charts.categories.options.plugins.legend.labels.color = textColor;
        charts.categories.update('none');
    }
    if (charts.recycle) {
        charts.recycle.options.plugins.legend.labels.color = textColor;
        charts.recycle.update('none');
    }
}
