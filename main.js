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
    WASTE_DECK_CONFIG
} from './ui.js';
import { createSimulation } from './simulation.js';

const OFFLINE_STORAGE_KEY = 'wasteSortingData_offline';

const appState = {
    isOnline: false,
    isRunning: false,
    allData: [],
    filteredData: [],
    simulation: null,
    timeFilter: 'all',
    triggerAnalyticsUpdate: () => {
        const now = Date.now();
        appState.filteredData = (appState.timeFilter === 'all')
            ? appState.allData
            : appState.allData.filter(item => (now - item.timestamp) < parseInt(appState.timeFilter, 10));
        
        updateAnalytics(appState.filteredData);
    }
};

async function main() {
    console.log("Application initializing...");
    
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
            appState.triggerAnalyticsUpdate();
        },
        onGenerateReport: () => {
            const insights = generateReport(appState.filteredData);
            showInsightReport(insights);
        }
    });

    appState.isOnline = await initFirebase(appState);
    updateStatus(appState.isOnline ? STATUS.ONLINE : STATUS.OFFLINE);
    
    if (appState.isOnline) {
        elements.btnClear.classList.add('hidden');
    }
    
    if (!appState.isOnline) {
        appState.triggerAnalyticsUpdate(); 
    }
    
    console.log(`App running in ${appState.isOnline ? 'ONLINE' : 'OFFLINE'} mode.`);
    
    appState.simulation = createSimulation(handleSimulationUpdate);
    
    elements.btnStart.disabled = false;
    elements.btnGenerateReport.disabled = false;
}

function startApp() {
    if (appState.isRunning) return;
    appState.isRunning = true;
    appState.simulation.start();
    updateStatus(STATUS.RUNNING);
    
    [elements.btnStart, elements.btnClear, elements.checkFault, elements.sliderSpeed, elements.sliderFaultRate, elements.btnGenerateReport]
        .forEach(el => el.disabled = true);
    
    elements.btnClear.classList.add('hidden');
    elements.btnStop.disabled = false;
}

function stopApp() {
    if (!appState.isRunning) return;
    appState.isRunning = false;
    appState.simulation.stop();
    updateStatus(appState.isOnline ? STATUS.ONLINE : STATUS.STOPPED);
    
    [elements.btnStart, elements.checkFault, elements.sliderSpeed, elements.btnGenerateReport]
        .forEach(el => el.disabled = false);
    
    elements.sliderFaultRate.disabled = !elements.checkFault.checked;
    elements.btnStop.disabled = true;
    
    if (!appState.isOnline) {
        elements.btnClear.classList.remove('hidden');
        elements.btnClear.disabled = false;
    }

    saveOfflineData();
    
    document.getElementById('current-item')?.remove();
}

function clearData() {
    if(appState.isOnline || appState.isRunning) return;
    
    showConfirmationModal(
        "Clear Local Data",
        "Are you sure you want to clear all locally saved simulation data? This action cannot be undone.",
        () => {
            appState.allData = [];
            appState.filteredData = [];
            localStorage.removeItem(OFFLINE_STORAGE_KEY);
            appState.simulation.reset();
            appState.triggerAnalyticsUpdate();
            console.log("Offline data cleared.");
        }
    );
}

function handleSimulationUpdate(item, sortedTo, processedItem) {
    updateSortingAnimation(item, sortedTo);
    
    if (processedItem) {
        if (appState.isOnline) {
            saveWasteData(processedItem);
        } else {
            appState.allData.push(processedItem);
            appState.triggerAnalyticsUpdate();
        }
    }
}

function saveOfflineData() {
    if (appState.isOnline) return;
    try {
        localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(appState.allData));
    } catch (error) {
        console.error("Failed to save offline data to localStorage:", error);
    }
}

window.addEventListener('beforeunload', saveOfflineData);

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

    const hazardConfig = {
        'Organic': { threshold: 0.20, insight: "<strong>High Organic Waste:</strong> High levels of organic material detected. This is a time-sensitive contamination risk. Prioritize processing and separation to prevent degradation and spoilage of recyclable batches." },
        'Glass': { threshold: 0.25, insight: "<strong>High Glass Volume:</strong> Significant glass volume detected. This poses a safety hazard to personnel and can cause premature wear or damage to sorting machinery. Ensure all safety protocols are active." },
        'E-Waste': { threshold: 0.15, insight: "<strong>High E-Waste Volume:</strong> High levels of E-Waste (batteries, electronics) detected. This is a critical fire and hazardous material risk. Divert this stream to specialized handling immediately." }
    };

    const recyclableMap = WASTE_DECK_CONFIG.reduce((acc, item) => {
        acc[item.type] = item.recyclable;
        return acc;
    }, {});


    data.forEach(item => {
        if (item.prediction === item.actual) {
            correct++;
            if (item.confidence < 0.75) {
                lowConfidenceItems.push(item);
            }
        } else {
            const actualIsRecyclable = recyclableMap[item.actual];
            const predictedIsRecyclable = recyclableMap[item.prediction];

            if (!actualIsRecyclable && predictedIsRecyclable) {
                criticalContamination.push(item);
            }
        }
        
        categoryCounts[item.actual] = (categoryCounts[item.actual] || 0) + 1;
    });


    const accuracy = (correct / total) * 100;
    insights.push({
        title: 'Overall Performance',
        text: `Processed ${total} items with an accuracy of <strong>${accuracy.toFixed(1)}%</strong>. (${correct} correct, ${total - correct} incorrect).`
    });

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

    const firstItemTime = data[0]?.timestamp;
    const lastItemTime = data[data.length - 1]?.timestamp;
    if (lastItemTime && firstItemTime) {
        const durationMin = (lastItemTime - firstItemTime) / 60000;
        if (durationMin > 0.1) {
            const throughput = total / durationMin;
            insights.push({
                title: 'Average Throughput',
                text: `The average throughput for this period was <strong>${throughput.toFixed(0)} items/min</strong>.`
            });
        }
    }

    return { insights };
}

document.addEventListener('DOMContentLoaded', main);
