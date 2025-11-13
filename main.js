import { initFirebase, saveWasteData } from './firebase.js';
import { 
    initUI, 
    updateAnalytics, 
    updateStatus, 
    updateSortingAnimation, 
    elements, 
    STATUS, 
    showConfirmationModal,
    showInsightReport,
    WASTE_DECK_CONFIG // Import config for report logic
} from './ui.js';
import { createSimulation } from './simulation.js';

const OFFLINE_STORAGE_KEY = 'wasteSortingData_offline';

const appState = {
    isOnline: false,
    isRunning: false,
    allData: [],
    filteredData: [], // Store the currently filtered data
    simulation: null,
    timeFilter: 'all',
    // Main data processing and UI update trigger
    triggerAnalyticsUpdate: () => {
        const now = Date.now();
        // Update the filteredData array based on the timeFilter
        appState.filteredData = (appState.timeFilter === 'all')
            ? appState.allData
            : appState.allData.filter(item => (now - item.timestamp) < parseInt(appState.timeFilter, 10));
        
        // Pass the *filtered* data to the UI
        updateAnalytics(appState.filteredData);
    }
};

/**
 * Main application entry point
 */
async function main() {
    console.log("Application initializing...");
    
    // Attempt to load offline data first
    try {
        const savedData = localStorage.getItem(OFFLINE_STORAGE_KEY);
        if (savedData) {
            appState.allData = JSON.parse(savedData);
            console.log(`Loaded ${appState.allData.length} items from local storage.`);
        }
    } catch (error) {
        console.error("Failed to load offline data, clearing it.", error);
        localStorage.removeItem(OFFLINE_STORAGE_KEY);
    }

    // Initialize all UI elements and attach event listeners
    initUI({
        onStart: startApp,
        onStop: stopApp,
        onClear: clearData,
        onFaultToggle: (e) => {
            const enabled = e.target.checked;
            appState.simulation.toggleFaults(enabled);
            elements.sliderFaultRate.disabled = !enabled;
        },
        onSpeedChange: (e) => appState.simulation.setSpeed(e.target.value),
        onFaultRateChange: (e) => {
            const rate = parseFloat(e.target.value);
            appState.simulation.setFaultRate(rate);
            elements.faultRateValue.textContent = `${(rate * 100).toFixed(0)}%`;
        },
        onFilterChange: (filterValue) => {
            appState.timeFilter = filterValue;
            appState.triggerAnalyticsUpdate(); // Re-filter and update UI
        },
        onGenerateReport: () => {
            const insights = generateReport(appState.filteredData);
            showInsightReport(insights);
        }
    });

    // Attempt to connect to Firebase
    appState.isOnline = await initFirebase(appState);
    updateStatus(appState.isOnline ? STATUS.ONLINE : STATUS.OFFLINE);
    
    // Hide 'Clear Data' button if online, as it's for local data
    if (appState.isOnline) {
        elements.btnClear.classList.add('hidden');
    }
    
    // If offline, trigger an initial update with any loaded local data
    if (!appState.isOnline) {
        appState.triggerAnalyticsUpdate(); 
    }
    
    console.log(`App running in ${appState.isOnline ? 'ONLINE' : 'OFFLINE'} mode.`);
    
    // Create the simulation instance
    appState.simulation = createSimulation(handleSimulationUpdate);
    
    // Enable the start button now that everything is ready
    elements.btnStart.disabled = false;
    elements.btnGenerateReport.disabled = false;
}

/**
 * Starts the simulation
 */
function startApp() {
    if (appState.isRunning) return;
    appState.isRunning = true;
    appState.simulation.start();
    updateStatus(STATUS.RUNNING);
    
    // Disable all controls during simulation
    [elements.btnStart, elements.btnClear, elements.checkFault, elements.sliderSpeed, elements.sliderFaultRate, elements.btnGenerateReport]
        .forEach(el => el.disabled = true);
    
    // Hide clear button if it wasn't already (e.g., if started offline)
    elements.btnClear.classList.add('hidden');
    elements.btnStop.disabled = false;
}

/**
 * Stops the simulation
 */
function stopApp() {
    if (!appState.isRunning) return;
    appState.isRunning = false;
    appState.simulation.stop();
    updateStatus(appState.isOnline ? STATUS.ONLINE : STATUS.STOPPED);
    
    // Re-enable controls
    [elements.btnStart, elements.checkFault, elements.sliderSpeed, elements.btnGenerateReport]
        .forEach(el => el.disabled = false);
    
    elements.sliderFaultRate.disabled = !elements.checkFault.checked;
    elements.btnStop.disabled = true;
    
    // Only show the clear button if we are offline
    if (!appState.isOnline) {
        elements.btnClear.classList.remove('hidden');
        elements.btnClear.disabled = false;
    }

    // Save all data to local storage (only relevant if offline)
    saveOfflineData();
    
    // Remove any lingering item animation
    document.getElementById('current-item')?.remove();
}

/**
 * Shows a confirmation modal and clears local data if confirmed.
 */
function clearData() {
    // This function should only be callable when offline and stopped
    if(appState.isOnline || appState.isRunning) return;
    
    showConfirmationModal(
        "Clear Local Data",
        "Are you sure you want to clear all locally saved simulation data? This action cannot be undone.",
        () => {
            appState.allData = [];
            appState.filteredData = [];
            localStorage.removeItem(OFFLINE_STORAGE_KEY);
            appState.simulation.reset();
            appState.triggerAnalyticsUpdate(); // Update UI to show '0'
            console.log("Offline data cleared.");
        }
    );
}

/**
 * Callback function for the simulation.
 * Handles animation and data saving for each item.
 */
function handleSimulationUpdate(item, sortedTo, processedItem) {
    // This part just triggers the animation
    updateSortingAnimation(item, sortedTo);
    
    // This part handles the data logging
    if (processedItem) {
        if (appState.isOnline) {
            // In ONLINE mode, save to Firestore.
            // The onSnapshot listener in firebase.js will handle the UI update.
            saveWasteData(processedItem);
        } else {
            // In OFFLINE mode, save to the local array.
            appState.allData.push(processedItem);
            // Manually trigger a UI update.
            appState.triggerAnalyticsUpdate();
        }
    }
}

/**
 * Saves the current appState.allData to localStorage.
 * This is "debounced" and only called when stopping or leaving.
 */
function saveOfflineData() {
    if (appState.isOnline) return; // Don't save to local if we're online
    try {
        localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(appState.allData));
    } catch (error) {
        console.error("Failed to save offline data to localStorage:", error);
        // Do not use alert() as it's blocked in sandboxed environments
        // A custom modal for this error could be implemented in ui.js
    }
}

// Add a listener to save offline data if the user closes the tab
window.addEventListener('beforeunload', saveOfflineData);

/**
 * Analyzes the current dataset and generates an insights report.
 */
function generateReport(data) {
    const total = data.length;
    if (total === 0) {
        return { insights: [{ title: 'No Data', text: 'Run the simulation to generate data for the report.' }] };
    }

    const insights = [];
    let correct = 0;
    const categoryCounts = {};
    const lowConfidenceItems = [];
    const criticalContamination = [];

    // Lookup table for hazard analysis
    const hazardConfig = {
        'Organic': { threshold: 0.20, insight: "<strong>High Organic Waste:</strong> High levels of organic material detected. This is a time-sensitive contamination risk. Prioritize processing and separation to prevent degradation and spoilage of recyclable batches." },
        'Glass': { threshold: 0.25, insight: "<strong>High Glass Volume:</strong> Significant glass volume detected. This poses a safety hazard to personnel and can cause premature wear or damage to sorting machinery. Ensure all safety protocols are active." },
        'E-Waste': { threshold: 0.15, insight: "<strong>High E-Waste Volume:</strong> High levels of E-Waste (batteries, electronics) detected. This is a critical fire and hazardous material risk. Divert this stream to specialized handling immediately." }
    };

    // Get a map of { type: isRecyclable } for contamination checks
    const recyclableMap = WASTE_DECK_CONFIG.reduce((acc, item) => {
        acc[item.type] = item.recyclable;
        return acc;
    }, {});


    // --- SINGLE PASS ANALYSIS ---
    data.forEach(item => {
        // 1. Overall Accuracy
        if (item.prediction === item.actual) {
            correct++;
            // 2. Low Confidence on Correct Sorts
            if (item.confidence < 0.75) { // 75% threshold
                lowConfidenceItems.push(item);
            }
        } else {
            // 3. Critical Contamination
            const actualIsRecyclable = recyclableMap[item.actual];
            const predictedIsRecyclable = recyclableMap[item.prediction];

            // Check if a NON-RECYCLABLE item was put in a RECYCLABLE bin
            if (!actualIsRecyclable && predictedIsRecyclable) {
                criticalContamination.push(item);
            }
        }
        
        // 4. Category Totals (for Hazard Analysis)
        categoryCounts[item.actual] = (categoryCounts[item.actual] || 0) + 1;
    });

    // --- GENERATE INSIGHTS ---

    // 1. Overall Performance Insight
    const accuracy = (correct / total) * 100;
    insights.push({
        title: 'Overall Performance',
        text: `Processed ${total} items with an accuracy of <strong>${accuracy.toFixed(1)}%</strong>. (${correct} correct, ${total - correct} incorrect).`
    });

    // 2. High-Volume & Hazard Analysis
    const hazardWarnings = [];
    for (const type in categoryCounts) {
        const percent = categoryCounts[type] / total;
        if (hazardConfig[type] && percent > hazardConfig[type].threshold) {
            hazardWarnings.push(hazardConfig[type].insight);
        }
    }
    if(hazardWarnings.length > 0) {
        insights.push({
            title: 'High-Priority Hazard Warnings',
            text: hazardWarnings.join('<br><br>')
        });
    }

    // 3. Critical Contamination Insight
    if (criticalContamination.length > 0) {
        const examples = criticalContamination
            .slice(0, 3)
            .map(item => `(e.g., '${item.actual}' was sorted as '${item.prediction}')`)
            .join(', ');
        insights.push({
            title: 'Critical Contamination Alert',
            text: `Detected <strong>${criticalContamination.length} instances</strong> where non-recyclable material was sorted into a recyclable bin. This can spoil entire batches. ${examples}`
        });
    }

    // 4. Low Confidence Insight
    if (lowConfidenceItems.length > 0) {
        const lowConfidenceTypes = lowConfidenceItems.reduce((acc, item) => {
            acc[item.actual] = (acc[item.actual] || 0) + 1;
            return acc;
        }, {});
        const mostCommon = Object.keys(lowConfidenceTypes).sort((a,b) => lowConfidenceTypes[b] - lowConfidenceTypes[a])[0];
        
        insights.push({
            title: 'Predictive Warning: Low Confidence',
            text: `The model was <strong>correct but not confident</strong> on <strong>${lowConfidenceItems.length} items</strong>. These are "lucky guesses" and indicate a high risk of future errors. The most common low-confidence item was <strong>'${mostCommon}'</strong>. Consider retraining the model on more images of this item.`
        });
    }

    // 5. Throughput Insight
    const firstItemTime = data[0]?.timestamp;
    const lastItemTime = data[data.length - 1]?.timestamp;
    if (lastItemTime && firstItemTime) {
        const durationMin = (lastItemTime - firstItemTime) / 60000;
        if (durationMin > 0.1) { // Only calculate if over ~6 seconds
            const throughput = total / durationMin;
            insights.push({
                title: 'Average Throughput',
                text: `The average throughput for this period was <strong>${throughput.toFixed(0)} items/min</strong>.`
            });
        }
    }

    return { insights };
}


// Start the application once the DOM is loaded
document.addEventListener('DOMContentLoaded', main);
