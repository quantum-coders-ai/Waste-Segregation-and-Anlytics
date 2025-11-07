import { initFirebase, saveWasteData } from './firebase.js';
// Import 'showConfirmationModal' from ui.js
import { initUI, updateAnalytics, updateStatus, updateSortingAnimation, elements, STATUS, showConfirmationModal } from './ui.js';
import { createSimulation } from './simulation.js';

const OFFLINE_STORAGE_KEY = 'wasteSortingData_offline';

const appState = {
    isOnline: false,
    isRunning: false,
    allData: [],
    simulation: null,
    timeFilter: 'all',
    hasUnsavedChanges: false, // EFFICIENCY: Flag for offline saving
    triggerAnalyticsUpdate: () => {
        // BUG FIX: Was Date.Gethours(), corrected to Date.now()
        const now = Date.now();
        const filteredData = (appState.timeFilter === 'all')
            ? appState.allData
            : appState.allData.filter(item => (now - item.timestamp) < parseInt(appState.timeFilter, 10));
        updateAnalytics(filteredData);
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
        }
    });

    appState.isOnline = await initFirebase(appState);
    updateStatus(appState.isOnline ? STATUS.ONLINE : STATUS.OFFLINE);
    elements.btnClear.disabled = appState.isOnline; // Disable clear if online
    
    if (!appState.isOnline) {
        appState.triggerAnalyticsUpdate(); 
    }
    
    // EFFICIENCY: Add a listener to save offline data before the user leaves.
    window.addEventListener('beforeunload', saveOfflineData);

    console.log(`App running in ${appState.isOnline ? 'ONLINE' : 'OFFLINE'} mode.`);
    appState.simulation = createSimulation(handleSimulationUpdate);
    elements.btnStart.disabled = false;
}

function startApp() {
    if (appState.isRunning) return;
    appState.isRunning = true;
    appState.simulation.start();
    updateStatus(STATUS.RUNNING);
    // Disable all controls during simulation
    [elements.btnStart, elements.btnClear, elements.checkFault, elements.sliderSpeed, elements.sliderFaultRate]
        .forEach(el => el.disabled = true);
    elements.btnStop.disabled = false;
}

function stopApp() {
    if (!appState.isRunning) return;
    appState.isRunning = false;
    appState.simulation.stop();
    updateStatus(appState.isOnline ? STATUS.ONLINE : STATUS.STOPPED);

    // EFFICIENCY: Save offline data only when the simulation stops.
    saveOfflineData();

    // Re-enable controls
    [elements.btnStart, elements.btnClear, elements.checkFault, elements.sliderSpeed]
        .forEach(el => el.disabled = false);
    elements.sliderFaultRate.disabled = !elements.checkFault.checked;
    elements.btnStop.disabled = true;
    elements.btnClear.disabled = appState.isOnline; // Keep clear disabled if online
    document.getElementById('current-item')?.remove();
}

/**
 * EFFICIENCY: Saves offline data to localStorage.
 * Only writes if there are unsaved changes.
 */
function saveOfflineData() {
    if (appState.isOnline || !appState.hasUnsavedChanges) return;

    try {
        localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(appState.allData));
        appState.hasUnsavedChanges = false; // Reset flag
        console.log("Offline data saved to localStorage.");
    } catch (error) {
        console.error("Failed to save offline data to localStorage:", error);
    }
}


function clearData() {
    if(appState.isOnline || appState.isRunning) return;


    showConfirmationModal(
        "Clear Local Data",
        "Are you sure you want to clear all locally saved data? This action cannot be undone.",
        () => {
            // This code runs only if the user clicks "Confirm"
            appState.allData = [];
            appState.hasUnsavedChanges = true; // Mark for saving (clearing)
            saveOfflineData(); // This will save the empty array
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
            

            appState.hasUnsavedChanges = true;
            
            // We still trigger analytics update to keep the UI live
            appState.triggerAnalyticsUpdate();
        }
    }
}

document.addEventListener('DOMContentLoaded', main);
