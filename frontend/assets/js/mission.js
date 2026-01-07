/**
 * mission.js - Mission and Waypoint Management
 * 
 * Handles:
 * - Waypoint list display and updates
 * - Mission start/stop logic
 * - Return to home (RTH) functionality
 * - Flight time calculation and ETA
 * - Mission end actions
 * - Flight path analysis modal
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeWaypointsList();
    initializeWaypointButtons();
    initializeFlightTimeModal();
});

// ================== WAYPOINT LIST MANAGEMENT ==================

function initializeWaypointsList() {
    updateWaypointsList();
    
    // Event delegation for waypoint delete buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.waypoint-delete')) {
            e.preventDefault();
            e.stopPropagation();
            const deleteBtn = e.target.closest('.waypoint-delete');
            const index = parseInt(deleteBtn.getAttribute('data-waypoint-index'));
            if (!isNaN(index) && window.removeWaypoint) {
                window.removeWaypoint(index);
            }
            return;
        }
        
        if (e.target.closest('.btn-clear-waypoints')) {
            e.preventDefault();
            e.stopPropagation();
            if (window.clearAllWaypoints) {
                window.clearAllWaypoints();
            }
            return;
        }
    });
}

function updateWaypointsList() {
    const waypointsList = document.querySelector('.waypoints-list');
    if (!waypointsList) return;
    
    if (!window.waypoints || window.waypoints.length === 0) {
        waypointsList.innerHTML = '<div style="color: var(--color-text-secondary); font-size: 0.9rem; padding: 1rem; text-align: center;">No waypoints added. Click on the map to add waypoints.</div>';
        return;
    }
    
    waypointsList.innerHTML = '';
    
    window.waypoints.forEach((wp, index) => {
        const waypointItem = document.createElement('div');
        waypointItem.className = 'waypoint-item';
        
        const waypointNumber = document.createElement('div');
        waypointNumber.className = 'waypoint-number';
        waypointNumber.textContent = index + 1;
        
        const waypointCoords = document.createElement('div');
        waypointCoords.className = 'waypoint-coords';
        waypointCoords.textContent = `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`;
        
        const waypointAlt = document.createElement('div');
        waypointAlt.className = 'waypoint-alt';
        waypointAlt.textContent = `${wp.alt.toFixed(1)}m`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'waypoint-delete';
        deleteBtn.setAttribute('data-waypoint-index', index);
        deleteBtn.setAttribute('title', 'Remove waypoint');
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const idx = parseInt(this.getAttribute('data-waypoint-index'));
            if (!isNaN(idx) && window.removeWaypoint) {
                window.removeWaypoint(idx);
            }
        });
        
        waypointItem.appendChild(waypointNumber);
        waypointItem.appendChild(waypointCoords);
        waypointItem.appendChild(waypointAlt);
        waypointItem.appendChild(deleteBtn);
        
        waypointsList.appendChild(waypointItem);
    });
}

window.updateWaypointsList = updateWaypointsList;

// ================== WAYPOINT BUTTONS ==================

function initializeWaypointButtons() {
    const clearWaypointsBtn = document.querySelector('.btn-clear-waypoints');
    if (clearWaypointsBtn) {
        clearWaypointsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (window.clearAllWaypoints) {
                window.clearAllWaypoints();
            }
        });
    }
    
    const addWaypointBtn = document.querySelector('.btn-add-waypoint');
    if (addWaypointBtn) {
        addWaypointBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (window.addLogEntry) {
                window.addLogEntry('Click on the map to add a waypoint', window.LOG_LEVEL.INFO);
            }
        });
    }
}

// ================== FLIGHT TIME CALCULATION ==================

async function calculateETA() {
    if (!window.waypoints || window.waypoints.length === 0) return '--:--:--';
    
    try {
        const currentSpeed = document.getElementById('maxSpeed')?.value || window.missionSettings.maxSpeed;
        window.missionSettings.maxSpeed = parseFloat(currentSpeed);
        
        const etaData = calculateETALocally(window.waypoints, window.missionSettings.maxSpeed, window.missionSettings.returnToHome);
        window.flightPathAnalysisData = etaData;
        
        return etaData.eta;
    } catch (error) {
        console.error('Error calculating ETA:', error);
        if (window.addLogEntry) {
            window.addLogEntry(`ETA calculation error: ${error.message}`);
        }
        return calculateFallbackETA();
    }
}

window.calculateETA = calculateETA;

function calculateETALocally(waypoints, speedKmh, returnToHome) {
    const speed = speedKmh / 3.6; // Convert to m/s
    const segments = [];
    let totalDistance = 0;
    let totalTimeSeconds = 0;
    
    // Calculate home to first waypoint
    if (waypoints.length > 0) {
        const distanceFromHome = window.calculateDistance(
            window.HOME_COORDINATES.lat, window.HOME_COORDINATES.lng,
            waypoints[0].lat, waypoints[0].lng
        );
        const timeSeconds = distanceFromHome / speed;
        segments.push({
            fromName: 'Home',
            toName: waypoints[0].name,
            distance: distanceFromHome,
            timeSeconds: timeSeconds
        });
        totalDistance += distanceFromHome;
        totalTimeSeconds += timeSeconds;
    }
    
    // Calculate between waypoints
    for (let i = 1; i < waypoints.length; i++) {
        const fromWp = waypoints[i-1];
        const toWp = waypoints[i];
        const distance = window.calculateDistance(
            fromWp.lat, fromWp.lng,
            toWp.lat, toWp.lng
        );
        const timeSeconds = distance / speed;
        segments.push({
            fromName: fromWp.name,
            toName: toWp.name,
            distance: distance,
            timeSeconds: timeSeconds
        });
        totalDistance += distance;
        totalTimeSeconds += timeSeconds;
    }
    
    // Calculate return to home if needed
    if (returnToHome && waypoints.length > 0) {
        const lastWp = waypoints[waypoints.length - 1];
        const distanceToHome = window.calculateDistance(
            lastWp.lat, lastWp.lng,
            window.HOME_COORDINATES.lat, window.HOME_COORDINATES.lng
        );
        const timeSeconds = distanceToHome / speed;
        segments.push({
            fromName: lastWp.name,
            toName: 'Home',
            distance: distanceToHome,
            timeSeconds: timeSeconds
        });
        totalDistance += distanceToHome;
        totalTimeSeconds += timeSeconds;
    }
    
    return {
        segments: segments,
        totalDistance: totalDistance,
        totalTimeSeconds: totalTimeSeconds,
        eta: formatTime(totalTimeSeconds)
    };
}

function calculateFallbackETA() {
    if (!window.waypoints || window.waypoints.length === 0) return '--:--:--';
    const estimatedTime = window.waypoints.length * 60;
    return formatTime(estimatedTime);
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// ================== FLIGHT TIME MODAL ==================

function initializeFlightTimeModal() {
    const flightTimeModal = document.getElementById('flightTimeModal');
    const flightTimeAnalysisContent = document.getElementById('flightTimeAnalysisContent');
    const calculateFlightTimeBtn = document.getElementById('calculateFlightTime');
    const flightTimeCloseBtn = document.querySelector('.close-btn');
    
    if (calculateFlightTimeBtn) {
        calculateFlightTimeBtn.addEventListener('click', async function() {
            if (!window.waypoints || window.waypoints.length === 0) {
                if (window.addLogEntry) {
                    window.addLogEntry('Cannot calculate flight time: No waypoints added');
                }
                flightTimeAnalysisContent.innerHTML = '<div class="no-waypoints">No waypoints have been added yet. Add waypoints to see flight path analysis.</div>';
                flightTimeModal.style.display = 'flex';
                return;
            }
            
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
            
            try {
                const eta = await calculateETA();
                const etaElement = document.querySelector('.eta-value');
                if (etaElement) {
                    etaElement.innerHTML = eta;
                }
                
                window.flightPathAnalysisData = calculateETALocally(window.waypoints, window.missionSettings.maxSpeed, window.missionSettings.returnToHome);
                flightTimeAnalysisContent.innerHTML = formatFlightPathAnalysis();
                flightTimeModal.style.display = 'flex';
                
                if (window.addLogEntry) {
                    window.addLogEntry('Flight time analysis calculated and displayed');
                }
            } catch (error) {
                flightTimeAnalysisContent.innerHTML = `<div class="error-message">Error calculating flight time: ${error.message}</div>`;
                flightTimeModal.style.display = 'flex';
                if (window.addLogEntry) {
                    window.addLogEntry(`Error calculating flight time: ${error.message}`);
                }
            } finally {
                this.innerHTML = '<i class="fas fa-clock"></i> Calculate Flight Time';
            }
        });
    }
    
    if (flightTimeCloseBtn) {
        flightTimeCloseBtn.addEventListener('click', function() {
            flightTimeModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', function(event) {
        if (event.target === flightTimeModal) {
            flightTimeModal.style.display = 'none';
        }
    });
}

function formatFlightPathAnalysis() {
    if (!window.flightPathAnalysisData || !window.flightPathAnalysisData.segments || window.flightPathAnalysisData.segments.length === 0) {
        if (window.waypoints && window.waypoints.length > 0) {
            return '<div class="waiting-data">Flight path data is being calculated...</div>';
        }
        return '<div class="no-waypoints">No waypoints have been added yet. Add waypoints to see flight path analysis.</div>';
    }
    
    let formattedOutput = '<div class="flight-analysis">';
    formattedOutput += '<h3>Flight Path Analysis</h3>';
    formattedOutput += '<div class="segments-container">';
    
    window.flightPathAnalysisData.segments.forEach((segment, index) => {
        const minutes = Math.floor(segment.timeSeconds / 60);
        const seconds = Math.floor(segment.timeSeconds % 60);
        
        formattedOutput += `
            <div class="segment">
                <div class="segment-header">Segment ${index + 1}: ${segment.fromName} to ${segment.toName}</div>
                <div class="segment-details">
                    <div>Distance: ${(segment.distance / 1000).toFixed(2)} km</div>
                    <div>Time: ${minutes}m ${seconds}s</div>
                </div>
            </div>
        `;
    });
    
    formattedOutput += '</div>';
    
    const totalHours = Math.floor(window.flightPathAnalysisData.totalTimeSeconds / 3600);
    const totalMinutes = Math.floor((window.flightPathAnalysisData.totalTimeSeconds % 3600) / 60);
    const totalSeconds = Math.floor(window.flightPathAnalysisData.totalTimeSeconds % 60);
    
    formattedOutput += '<div class="analysis-summary">';
    formattedOutput += `<div class="total-distance">Total Distance: ${(window.flightPathAnalysisData.totalDistance / 1000).toFixed(2)} km</div>`;
    formattedOutput += '<div class="total-time">Total Time: ';
    
    if (totalHours > 0) {
        formattedOutput += `${totalHours}h `;
    }
    formattedOutput += `${totalMinutes}m ${totalSeconds}s</div>`;
    formattedOutput += '</div>';
    formattedOutput += '</div>';
    
    return formattedOutput;
}
