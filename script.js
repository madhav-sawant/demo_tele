document.addEventListener('DOMContentLoaded', function() {
    // Define home coordinates (consistent across the application)
    const HOME_COORDINATES = { lat: 16.9902, lng: 73.3120 };
    
    // Mission settings
    let missionSettings = {
        returnToHome: true,     // Return to home or land at last waypoint
        maxSpeed: 20.0,         // Max speed in km/h (range: 10-25 km/h)
        maxAltitude: 50         // Max altitude in meters
    };
    
    // Initialize the map
    const map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
        maxZoom: 22
    }).setView([HOME_COORDINATES.lat, HOME_COORDINATES.lng], 15);
    
    // Waypoints array to store mission points
    let waypoints = [];
    
    // Variable to store flight path analysis data from Python backend
    let flightPathAnalysisData = null;
    
    // Track cursor position for coordinate display
    let cursorPosition = { lat: HOME_COORDINATES.lat, lng: HOME_COORDINATES.lng };
    
    // System log functionality
    const systemLog = document.getElementById('system-log');
    const logFilter = document.getElementById('logFilter');
    const clearLogBtn = document.getElementById('clearLog');
    
    // Log levels
    const LOG_LEVEL = {
        INFO: 'info',
        WARNING: 'warning',
        ERROR: 'error'
    };
    
    // Add log entry with level
    function addLogEntry(message, level = LOG_LEVEL.INFO) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = timestamp;
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = message;
        
        logEntry.appendChild(timeSpan);
        logEntry.appendChild(messageSpan);
        
        systemLog.appendChild(logEntry);
        
        // Auto-scroll to the bottom
        systemLog.scrollTop = systemLog.scrollHeight;
        
        // If there are more than 100 entries, remove the oldest
        if (systemLog.children.length > 100) {
            systemLog.removeChild(systemLog.children[0]);
        }
    }
    
    // Filter logs by level
    if (logFilter) {
        logFilter.addEventListener('change', function() {
            const selectedLevel = this.value;
            const logEntries = systemLog.querySelectorAll('.log-entry');
            
            logEntries.forEach(entry => {
                if (selectedLevel === 'all') {
                    entry.style.display = 'flex';
                } else {
                    entry.style.display = entry.classList.contains(`log-${selectedLevel}`) ? 'flex' : 'none';
                }
            });
        });
    }
    
    // Clear log button
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', function() {
            // Keep only the first entry (system initialized)
            while (systemLog.children.length > 1) {
                systemLog.removeChild(systemLog.lastChild);
            }
            addLogEntry('Log cleared', LOG_LEVEL.INFO);
        });
    }
    
    // Add log entry for map initialization
    addLogEntry(`Map initialized. Coordinates: ${HOME_COORDINATES.lat.toFixed(4)}, ${HOME_COORDINATES.lng.toFixed(4)}`);
    
    // Flight Time Analysis Modal functionality
    const flightTimeModal = document.getElementById('flightTimeModal');
    const flightTimeAnalysisContent = document.getElementById('flightTimeAnalysisContent');
    const calculateFlightTimeBtn = document.getElementById('calculateFlightTime');
    const flightTimeCloseBtn = document.querySelector('.close-btn');
    
    // Show the modal when the Calculate Flight Time button is clicked
    calculateFlightTimeBtn.addEventListener('click', async function() {
        if (waypoints.length === 0) {
            addLogEntry('Cannot calculate flight time: No waypoints added');
            
            // Show the modal with no waypoints message even if there's no data
            flightTimeAnalysisContent.innerHTML = '<div class="no-waypoints">No waypoints have been added yet. Add waypoints to see flight path analysis.</div>';
            flightTimeModal.style.display = 'flex';
            return;
        }
        
        // Update button to show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
        
        try {
            // Update the ETA display using local calculation (more reliable)
            const eta = await calculateETA();
            document.querySelector('.eta-value').innerHTML = eta;
            
            // Use local calculation for flight path analysis
            try {
                // Calculate flight path data with current speed
                addLogEntry(`Calculating flight time with speed: ${missionSettings.maxSpeed.toFixed(1)} km/h`);
                
                // Generate data using reliable local calculation
                flightPathAnalysisData = calculateETALocally(waypoints, missionSettings.maxSpeed, missionSettings.returnToHome);
                
                addLogEntry('Flight time calculated successfully');
            } catch (error) {
                // If calculation fails, use simple fallback
                addLogEntry(`Error in flight time calculation: ${error.message}`);
                flightPathAnalysisData = createSimpleFallbackData(waypoints);
            }
            
            // Generate the flight path analysis and add it to the modal
            flightTimeAnalysisContent.innerHTML = formatFlightPathAnalysis();
            
            // Show the modal
            flightTimeModal.style.display = 'flex';
            
            addLogEntry('Flight time analysis calculated and displayed');
        } catch (error) {
            // Even if there's an error, still show the modal with some default content
            flightTimeAnalysisContent.innerHTML = `<div class="error-message">Error calculating flight time: ${error.message}</div><div class="retry-message">Please try again or check server connection.</div>`;
            flightTimeModal.style.display = 'flex';
            
            addLogEntry(`Error calculating flight time: ${error.message}`);
        } finally {
            // Restore button state
            this.innerHTML = '<i class="fas fa-clock"></i> Calculate Flight Time';
        }
    });
    
    // Close the modal when the close button is clicked
    flightTimeCloseBtn.addEventListener('click', function() {
        flightTimeModal.style.display = 'none';
    });
    
    // Close the modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === flightTimeModal) {
            flightTimeModal.style.display = 'none';
        }
    });
    
    // Initial log entries are already in HTML
    
    // JavaScript distance calculation functions are now handled by Python backend
    
    // Calculate estimated time of arrival using Python backend
    async function calculateETA() {
        if (waypoints.length === 0) return '--:--:--';
        
        try {
            // IMPORTANT: Get the CURRENT speed setting right before calculation
            // This ensures we're always using the latest value from the slider
            const currentSpeed = document.getElementById('maxSpeed')?.value || missionSettings.maxSpeed;
            
            // Update the mission settings with the latest speed
            missionSettings.maxSpeed = parseFloat(currentSpeed);
            
            // Use JavaScript calculation directly to avoid backend errors
            const etaData = calculateETALocally(waypoints, missionSettings.maxSpeed, missionSettings.returnToHome);
            
            // Store the analysis data for display in the modal
            flightPathAnalysisData = etaData;
            
            return etaData.eta;
        } catch (error) {
            console.error('Error calculating ETA:', error);
            addLogEntry(`ETA calculation error: ${error.message}`);
            
            // Provide fallback ETA even if there's an error
            return calculateFallbackETA();
        }
    }
    
    // Calculate ETA locally to avoid backend issues
    function calculateETALocally(waypoints, speedKmh, returnToHome) {
        // Speed is already in km/h, convert to m/s for calculations
        const speed = speedKmh / 3.6;
        // Create segments for each waypoint
        const segments = [];
        let totalDistance = 0;
        let totalTimeSeconds = 0;
        
        // Calculate home to first waypoint
        if (waypoints.length > 0) {
            const distanceFromHome = calculateDistance(
                HOME_COORDINATES.lat, HOME_COORDINATES.lng,
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
            const distance = calculateDistance(
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
            const distanceToHome = calculateDistance(
                lastWp.lat, lastWp.lng,
                HOME_COORDINATES.lat, HOME_COORDINATES.lng
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
        
        // Format ETA and return data
        return {
            segments: segments,
            totalDistance: totalDistance,
            totalTimeSeconds: totalTimeSeconds,
            eta: formatTime(totalTimeSeconds)
        };
    }
    
    // Provide a fallback ETA even when calculation fails
    function calculateFallbackETA() {
        if (waypoints.length === 0) return '--:--:--';
        
        // Use a very simple approximation based on number of waypoints
        const estimatedTime = waypoints.length * 60; // 1 minute per waypoint as fallback
        return formatTime(estimatedTime);
    }
    
    // Format flight path analysis for display - This is a duplicate function, will be replaced by the later implementation
    
    // Add Satellite layer - Using multiple providers for reliability
    // Primary: Google Satellite
    const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google',
        maxZoom: 22,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    // Log tile errors
    satelliteLayer.on('tileerror', function(error) {
        console.error('Tile error:', error);
        addLogEntry('Map tile loading error. Retrying...', LOG_LEVEL.WARNING);
    });
    
    // Log when tiles load successfully
    satelliteLayer.on('load', function() {
        addLogEntry('Satellite imagery loaded successfully', LOG_LEVEL.INFO);
    });
    
    // Add event handler for map load completion
    map.on('load', function() {
        addLogEntry('Map fully loaded with all tiles.');
    });
    
    // Force a map refresh to ensure proper rendering
    setTimeout(function() {
        map.invalidateSize();
        addLogEntry('Map display refreshed');
    }, 500);
    
    // Map info overlay update functions
    function updateMapInfoOverlay() {
        updateScaleBar();
        updateCameraDistance();
        updateMapCoordinates();
        updateMapAltitude();
    }
    
    // Update scale bar based on zoom level
    function updateScaleBar() {
        const scaleBarText = document.getElementById('scaleBarText');
        if (!scaleBarText) return;
        
        const zoom = map.getZoom();
        const center = map.getCenter();
        
        // Calculate meters per pixel at current zoom level
        const metersPerPixel = 40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8);
        
        // Scale bar is 60px wide
        const scaleBarMeters = metersPerPixel * 60;
        
        // Format the distance
        let displayDistance;
        if (scaleBarMeters < 1000) {
            displayDistance = Math.round(scaleBarMeters) + ' m';
        } else {
            displayDistance = (scaleBarMeters / 1000).toFixed(1) + ' km';
        }
        
        scaleBarText.textContent = displayDistance;
    }
    
    // Update camera distance (altitude from ground)
    function updateCameraDistance() {
        const cameraDistance = document.getElementById('cameraDistance');
        if (!cameraDistance) return;
        
        const zoom = map.getZoom();
        const center = map.getCenter();
        
        // Approximate camera altitude based on zoom level
        // This is a rough estimation
        const altitude = Math.round(40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8) * 500);
        
        let displayAltitude;
        if (altitude < 1000) {
            displayAltitude = altitude + ' m';
        } else {
            displayAltitude = (altitude / 1000).toFixed(1) + ' km';
        }
        
        cameraDistance.textContent = 'Camera: ' + displayAltitude;
    }
    
    // Update cursor coordinates in DMS format
    function updateMapCoordinates() {
        const mapCoordinates = document.getElementById('mapCoordinates');
        if (!mapCoordinates) return;
        
        const lat = cursorPosition.lat;
        const lng = cursorPosition.lng;
        
        // Convert to degrees, minutes, seconds
        function toDMS(coordinate, isLat) {
            const absolute = Math.abs(coordinate);
            const degrees = Math.floor(absolute);
            const minutesNotTruncated = (absolute - degrees) * 60;
            const minutes = Math.floor(minutesNotTruncated);
            const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
            
            const direction = isLat 
                ? (coordinate >= 0 ? 'N' : 'S')
                : (coordinate >= 0 ? 'E' : 'W');
            
            return `${degrees}°${minutes}'${seconds}"${direction}`;
        }
        
        const latDMS = toDMS(lat, true);
        const lngDMS = toDMS(lng, false);
        
        mapCoordinates.textContent = `${latDMS} ${lngDMS}`;
    }
    
    // Update map altitude display (based on zoom)
    function updateMapAltitude() {
        const mapAltitude = document.getElementById('mapAltitude');
        if (!mapAltitude) return;
        
        const zoom = map.getZoom();
        const center = map.getCenter();
        
        // Calculate approximate viewing altitude
        const altitude = Math.round(40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8) * 500);
        
        let displayAltitude;
        if (altitude < 1000) {
            displayAltitude = altitude + ' m';
        } else {
            displayAltitude = (altitude / 1000).toFixed(1) + ' km';
        }
        
        mapAltitude.textContent = displayAltitude;
    }
    
    // Update overlay on map move and zoom
    map.on('move', updateMapInfoOverlay);
    map.on('zoom', updateMapInfoOverlay);
    
    // Track mouse movement to update cursor coordinates
    map.on('mousemove', function(e) {
        cursorPosition = { lat: e.latlng.lat, lng: e.latlng.lng };
        updateMapCoordinates();
    });
    
    // Initial update
    updateMapInfoOverlay();
    
const droneIcon = L.divIcon({
    html: '<div style="font-size: 36px; color: #FF5722; text-shadow: 0 0 25px rgba(255, 87, 34, 0.9);">➤</div>',
    className: 'drone-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});
    
    const droneMarker = L.marker([HOME_COORDINATES.lat, HOME_COORDINATES.lng], {icon: droneIcon, zIndexOffset: 1000}).addTo(map);
    
    // Add home marker with high-visibility color
    const homeIcon = L.divIcon({
        html: '<i class="fas fa-home" style="font-size: 20px; color: #FFEB3B; text-shadow: 0 0 8px rgba(0, 0, 0, 0.5);"></i>',
        className: 'home-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    // L.marker([HOME_COORDINATES.lat, HOME_COORDINATES.lng], {icon: homeIcon, title: 'Home Position'}).addTo(map).bindPopup('Home Position');
    
    // Center map button functionality
    const centerMapBtn = document.getElementById('centerMap');
    if (centerMapBtn) {
        centerMapBtn.addEventListener('click', function() {
            map.setView([HOME_COORDINATES.lat, HOME_COORDINATES.lng], 15);
            addLogEntry('Map centered to home position');
        });
    }
    
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    
    themeToggle.addEventListener('change', function() {
        document.body.classList.toggle('light-theme');
        // Save preference to localStorage
        if (document.body.classList.contains('light-theme')) {
            localStorage.setItem('theme', 'light');
        } else {
            localStorage.setItem('theme', 'dark');
        }
    });
    
    // Check for saved theme preference and apply with animation
    if (localStorage.getItem('theme') === 'light') {
        setTimeout(() => {
            document.body.classList.add('light-theme');
            themeToggle.checked = true;
        }, 300); // Small delay for smooth initial transition
    }
    
    // Simulate drone hover at home position (completely stable)
    function simulateDroneMovement() {
        if (!window.droneSimulationActive) return;
        
        // IMPORTANT: Keep drone completely stable at home position
        // No random movement at all to prevent any drifting
        droneMarker.setLatLng([HOME_COORDINATES.lat, HOME_COORDINATES.lng]);
        updateTelemetry(HOME_COORDINATES.lat, HOME_COORDINATES.lng, false);
        
        // Schedule next check
        setTimeout(simulateDroneMovement, 2000);
    }
    
    // Update telemetry data
    function updateTelemetry(lat, lng, isActiveMovement = false) {
        // Update latitude and longitude displays
        const latElement = document.querySelector('.telemetry-grid .telemetry-item:nth-child(1) span:last-child');
        const lngElement = document.querySelector('.telemetry-grid .telemetry-item:nth-child(2) span:last-child');
        
        if (latElement) {
            latElement.textContent = lat.toFixed(6) + '° ' + (lat >= 0 ? 'N' : 'S');
        }
        
        if (lngElement) {
            lngElement.textContent = lng.toFixed(6) + '° ' + (lng >= 0 ? 'E' : 'W');
        }
        
        // Only update speed and altitude during active movement
        if (isActiveMovement) {
            // Update heading based on parameters
            const headingElement = document.querySelector('.telemetry-grid .telemetry-item:nth-child(3) span:last-child');
            if (headingElement) {
                const heading = Math.floor(Math.random() * 360);
                headingElement.innerHTML = heading + '°';
            }
            
            // Update altitude during active movement
            const altElement = document.querySelector('.status-item:nth-child(2) .value');
            if (altElement) {
                const altitude = Math.floor(30 + Math.random() * 90);
                altElement.innerHTML = `${altitude} <small>m</small>`;
            }
            
            // Update speed during active movement - showing km/h
            const speedElement = document.querySelector('.status-item:nth-child(3) .value');
            if (speedElement) {
                // Get current speed from slider or fallback to missionSettings
                const speedSlider = document.getElementById('maxSpeed');
                let speedKmh = speedSlider ? parseFloat(speedSlider.value) : missionSettings.maxSpeed;
                
                // Ensure speed is within 10-25 km/h range
                speedKmh = Math.max(10, Math.min(25, speedKmh));
                
                // Update display with the speed in km/h
                speedElement.innerHTML = `${speedKmh.toFixed(1)} <small>km/h</small>`;
                
                // Update mission settings if needed
                if (speedSlider) {
                    missionSettings.maxSpeed = speedKmh;
                }
            }
        }
    }
    
    // Initialize displays with placeholder values
    resetTelemetryDisplays();
    
    // Initialize drone simulation
    window.droneSimulationActive = true;
    simulateDroneMovement();
    
    // Function to reset telemetry displays to placeholder values when drone is not moving
    function resetTelemetryDisplays() {
        // Set altitude to placeholder
        const altElement = document.querySelector('.status-item:nth-child(2) .value');
        if (altElement) {
            altElement.innerHTML = `-- <small>m</small>`;
        }
        
        // Set speed to placeholder
        const speedElement = document.querySelector('.status-item:nth-child(3) .value');
        if (speedElement) {
            speedElement.innerHTML = `-- <small>km/h</small>`;
        }
    }
    
    function formatFlightPathAnalysis() {
        // Check if we have flight path analysis data
        if (!flightPathAnalysisData || !flightPathAnalysisData.segments || flightPathAnalysisData.segments.length === 0) {
            // If we have waypoints but no analysis data, show a different message
            if (waypoints.length > 0) {
                return '<div class="waiting-data">Flight path data is being calculated...</div>';
            }
            return '<div class="no-waypoints">No waypoints have been added yet. Add waypoints to see flight path analysis.</div>';
        }
        
        let formattedOutput = '<div class="flight-analysis">';
        
        // Add header
        formattedOutput += '<h3>Flight Path Analysis</h3>';
        
        // Add segments
        formattedOutput += '<div class="segments-container">';
        flightPathAnalysisData.segments.forEach((segment, index) => {
            const minutes = Math.floor(segment.timeSeconds / 60);
            const seconds = Math.floor(segment.timeSeconds % 60);
            
            formattedOutput += `
                <div class="segment">
                    <div class="segment-header">Segment ${index + 1}: ${segment.fromName} to ${segment.toName}</div>
                    <div class="segment-details">
                        <div>Distance: ${(segment.distance / 1000).toFixed(2)} km</div>
                        <div>Time: ${minutes}m ${seconds}s (${segment.timeSeconds.toFixed(0)}s)</div>
                    </div>
                </div>
            `;
        });
        formattedOutput += '</div>';
        
        // Add total
        const totalHours = Math.floor(flightPathAnalysisData.totalTimeSeconds / 3600);
        const totalMinutes = Math.floor((flightPathAnalysisData.totalTimeSeconds % 3600) / 60);
        const totalSeconds = Math.floor(flightPathAnalysisData.totalTimeSeconds % 60);
        
        formattedOutput += '<div class="analysis-summary">';
        formattedOutput += `<div class="total-distance">Total Distance: ${(flightPathAnalysisData.totalDistance / 1000).toFixed(2)} km</div>`;
        formattedOutput += '<div class="total-time">Total Time: ';
        
        if (totalHours > 0) {
            formattedOutput += `${totalHours}h `;
        }
        formattedOutput += `${totalMinutes}m ${totalSeconds}s (${flightPathAnalysisData.totalTimeSeconds.toFixed(0)}s)</div>`;
        formattedOutput += '</div>';
        
        formattedOutput += '</div>';
        return formattedOutput;
    }
    
    // Calculate flight path analysis
    function calculateFlightPathAnalysis() {
        if (!flightPathAnalysisData) {
            return {
                segments: [],
                totalDistance: 0,
                totalTimeSeconds: 0
            };
        }
        return flightPathAnalysisData;
    }
    
    // Create simple fallback data when all else fails
    function createSimpleFallbackData(waypoints) {
        const speedSlider = document.getElementById('maxSpeed');
        if (speedSlider) {
            missionSettings.maxSpeed = parseFloat(speedSlider.value);
        }
        const speed = missionSettings.maxSpeed;
        
        // Log the fallback calculation
        addLogEntry(`Using simplified ETA calculation`);
        
        const segments = [];
        let totalDistance = 0;
        let totalTimeSeconds = 0;
        
        // Create segments between waypoints
        for (let i = 0; i < waypoints.length; i++) {
            const fromWp = i === 0 ? { lat: HOME_COORDINATES.lat, lng: HOME_COORDINATES.lng, name: 'Home' } : waypoints[i-1];
            const toWp = waypoints[i];
            
            // Calculate distance between points (simplified)
            const latDiff = fromWp.lat - toWp.lat;
            const lngDiff = fromWp.lng - toWp.lng;
            // Simple Euclidean distance (not accurate for Earth, but ok for simulation)
            // Multiply by 111000 to convert degrees to meters (approximate)
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
            
            // Calculate time based on distance and speed (convert km/h to m/s)
            const timeSeconds = distance / (speed / 3.6);
            
            segments.push({
                fromName: fromWp.name || `Waypoint ${i}`,
                toName: toWp.name || `Waypoint ${i+1}`,
                distance: distance,
                timeSeconds: timeSeconds
            });
            
            totalDistance += distance;
            totalTimeSeconds += timeSeconds;
        }
        
        // Add return to home segment if required
        if (missionSettings.returnToHome && waypoints.length > 0) {
            const lastWp = waypoints[waypoints.length - 1];
            
            // Calculate distance from last waypoint to home
            const latDiff = lastWp.lat - HOME_COORDINATES.lat;
            const lngDiff = lastWp.lng - HOME_COORDINATES.lng;
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
            
            // Calculate time (convert km/h to m/s)
            const timeSeconds = distance / (speed / 3.6);
            
            segments.push({
                fromName: lastWp.name || `Waypoint ${waypoints.length}`,
                toName: 'Home',
                distance: distance,
                timeSeconds: timeSeconds
            });
            
            totalDistance += distance;
            totalTimeSeconds += timeSeconds;
        }
        
        return {
            segments: segments,
            totalDistance: totalDistance,
            totalTimeSeconds: totalTimeSeconds,
            eta: formatTime(totalTimeSeconds)
        };
    }
    
    // Format seconds to hh:mm:ss
    function formatTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    // Update real-time ETA during flight progress
    function updateRemainingETA() {
        if (!missionInProgress || currentWaypointIndex < 0 || currentWaypointIndex >= waypoints.length) {
            return; // Not in active mission or invalid waypoint index
        }
        
        // Calculate remaining time
        let remainingTimeSeconds = 0;
        
        // Add time for current waypoint to completion
        const currentWaypoint = waypoints[currentWaypointIndex];
        const currentPos = droneMarker.getLatLng();
        const distanceToCurrentTarget = calculateDistance(
            currentPos.lat, currentPos.lng,
            currentWaypoint.lat, currentWaypoint.lng
        );
        remainingTimeSeconds += distanceToCurrentTarget / missionSettings.maxSpeed;
        
        // Add time for remaining waypoints
        for (let i = currentWaypointIndex + 1; i < waypoints.length; i++) {
            const fromWp = i === currentWaypointIndex + 1 ? currentWaypoint : waypoints[i-1];
            const toWp = waypoints[i];
            const distance = calculateDistance(
                fromWp.lat, fromWp.lng,
                toWp.lat, toWp.lng
            );
            remainingTimeSeconds += distance / missionSettings.maxSpeed;
            
            // Add 2 seconds pause at each waypoint
            remainingTimeSeconds += 2;
        }
        
        // Add return to home time if enabled
        if (missionSettings.returnToHome && waypoints.length > 0) {
            const lastWp = waypoints[waypoints.length - 1];
            const distanceToHome = calculateDistance(
                lastWp.lat, lastWp.lng,
                HOME_COORDINATES.lat, HOME_COORDINATES.lng
            );
            remainingTimeSeconds += distanceToHome / missionSettings.maxSpeed;
        }
        
        // Update ETA display
        const etaElement = document.querySelector('.eta-value');
        if (etaElement) {
            etaElement.innerHTML = formatTime(remainingTimeSeconds);
        }
    }
    
    // Get reference to the waypoints panel
    const waypointsPanel = document.querySelector('.waypoints-panel');
    
    // Update ETA display
    function updateETA() {
        if (waypoints.length > 0) {
            calculateETA().then(eta => {
                const etaElement = document.querySelector('.eta-value');
                if (etaElement) {
                    etaElement.innerHTML = eta;
                }
            }).catch(error => {
                console.error('Error updating ETA:', error);
                addLogEntry(`Failed to update ETA: ${error.message}`);
                
                // Set a fallback ETA even when there's an error
                const etaElement = document.querySelector('.eta-value');
                if (etaElement) {
                    etaElement.innerHTML = calculateFallbackETA();
                }
            });
        } else {
            // Reset ETA display when no waypoints
            const etaElement = document.querySelector('.eta-value');
            if (etaElement) {
                etaElement.innerHTML = '--:--:--';
            }
        }
    }
    
    // Add waypoint functionality - clicking on map
    map.on('click', function(e) {
        // Create a new waypoint
        const waypointNumber = waypoints.length + 1;
        const newWaypoint = {
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            alt: missionSettings.maxAltitude, // Default altitude
            name: `Waypoint ${waypointNumber}`
        };
        
        // Create a marker for this waypoint with high-visibility color
        const waypointIcon = L.divIcon({
            html: `<div class="waypoint-number" style="background-color: #8BC34A; color: #000; border: 2px solid #fff; box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);">${waypointNumber}</div>`,
            className: 'waypoint-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const marker = L.marker([e.latlng.lat, e.latlng.lng], {
            icon: waypointIcon,
            draggable: true,
            title: `Waypoint ${waypointNumber}`
        }).addTo(map);
        
        // Add popup to marker
        marker.bindPopup(`<b>Waypoint ${waypointNumber}</b><br>Lat: ${e.latlng.lat.toFixed(6)}<br>Lng: ${e.latlng.lng.toFixed(6)}<br>Alt: ${newWaypoint.alt}m`);
        
        // Store the marker with the waypoint data
        newWaypoint.marker = marker;
        
        // Add to waypoints array
        waypoints.push(newWaypoint);
        
        // Add to waypoints list in UI
        updateWaypointsList();
        
        // Update the ETA
        updateETA();
        
        // Update waypoints on server
        updateWaypointsOnServer();
        
        addLogEntry(`Added Waypoint ${waypointNumber} at ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
    });
    
    // Add function to send waypoint updates to the server
    // Note: Waypoints are NOT stored until "Start Mission" is clicked
    // This function is kept for future extensions
    function updateWaypointsOnServer() {
        // Waypoints are now only sent to PHP when "Start Mission" is clicked
        // No need to continuously sync - direct transfer on mission start
        // This function does nothing but is kept for compatibility
    }
    
    // Update waypoints list in UI
    function updateWaypointsList() {
        const waypointsList = document.querySelector('.waypoints-list');
        if (!waypointsList) return;
        
        waypointsList.innerHTML = '';
        
        if (waypoints.length === 0) {
            waypointsList.innerHTML = '<div class="empty-waypoints">No waypoints added yet</div>';
            return;
        }
        
        waypoints.forEach((waypoint, index) => {
            const waypointItem = document.createElement('div');
            waypointItem.className = 'waypoint-item';
            waypointItem.innerHTML = `
                <div class="waypoint-info">
                    <div class="waypoint-name">${waypoint.name}</div>
                    <div class="waypoint-coords">${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)}</div>
                </div>
                <div class="waypoint-actions">
                    <button class="btn-remove-waypoint" data-index="${index}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            waypointsList.appendChild(waypointItem);
            
            // Add event listener for remove button
            const removeBtn = waypointItem.querySelector('.btn-remove-waypoint');
            removeBtn.addEventListener('click', function() {
                const wpIndex = parseInt(this.getAttribute('data-index'));
                removeWaypoint(wpIndex);
            });
        });
    }
    
    // Remove a waypoint
    function removeWaypoint(index) {
        if (index < 0 || index >= waypoints.length) return;
        
        // Remove marker from map
        if (waypoints[index].marker) {
            map.removeLayer(waypoints[index].marker);
        }
        
        // Remove from array
        const removedWaypoint = waypoints.splice(index, 1)[0];
        
        // Update the UI
        updateWaypointsList();
        
        // Update the ETA
        updateETA();
        
        // Update waypoints on server
        updateWaypointsOnServer();
        
        addLogEntry(`Removed ${removedWaypoint.name}`);
    }
    
    // Add waypoint button functionality
    const addWaypointBtn = document.querySelector('.btn-add-waypoint');
    if (addWaypointBtn) {
        addWaypointBtn.addEventListener('click', () => {
            addLogEntry('Click on the map to add a waypoint');
        });
    }
    
    // Clear waypoints button functionality
    const clearWaypointsBtn = document.querySelector('.btn-clear-waypoints');
    if (clearWaypointsBtn) {
        clearWaypointsBtn.addEventListener('click', () => {
            // Remove all markers from map
            waypoints.forEach(waypoint => {
                if (waypoint.marker) {
                    map.removeLayer(waypoint.marker);
                }
            });
            
            // Clear array
            waypoints = [];
            
            // Update UI
            updateWaypointsList();
            
            // Update ETA display
            document.querySelector('.eta-value').textContent = '--:--';
            
            // Update waypoints on server
            updateWaypointsOnServer();
            
            addLogEntry('All waypoints cleared');
        });
    }
    
    // Mission settings events
    const missionEndRadios = document.querySelectorAll('input[name="missionEnd"]');
    missionEndRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            missionSettings.returnToHome = this.value === 'returnHome';
            addLogEntry(`Mission end action set to: ${missionSettings.returnToHome ? 'Return to Home' : 'Land at Last Waypoint'}`);
            // Update ETA if we have waypoints
            if (waypoints.length > 0) {
                updateETA();
            }
            
            // Update waypoints on server
            updateWaypointsOnServer();
        });
    });
    
    // Max speed slider - now showing km/h as primary unit (range: 10-25 km/h)
    const maxSpeedSlider = document.getElementById('maxSpeed');
    const maxSpeedValue = document.getElementById('maxSpeedValue');
    if (maxSpeedSlider && maxSpeedValue) {
        // Ensure slider is within bounds
        maxSpeedSlider.min = 10;
        maxSpeedSlider.max = 25;
        maxSpeedSlider.value = Math.max(10, Math.min(25, parseFloat(maxSpeedSlider.value) || 20));
        
        maxSpeedSlider.addEventListener('input', function() {
            // Ensure value stays within bounds
            const speed = Math.max(10, Math.min(25, parseFloat(this.value)));
            this.value = speed; // Update the slider value in case it was out of bounds
            missionSettings.maxSpeed = speed;
            // Display speed in km/h instead of m/s
            const speedKmh = speed * 3.6;
            maxSpeedValue.textContent = speedKmh.toFixed(1);
            // Update ETA if we have waypoints
            if (waypoints.length > 0) {
                // Force immediate ETA update when speed changes
                updateETA();
            }
            
            // Update waypoints on server
            updateWaypointsOnServer();
        });
        
        // Convert initial display to km/h
        const initialSpeedKmh = parseFloat(maxSpeedSlider.value) * 3.6;
        maxSpeedValue.textContent = initialSpeedKmh.toFixed(1);
    }
    
    // Max altitude slider
    const maxAltitudeSlider = document.getElementById('maxAltitude');
    const maxAltitudeValue = document.getElementById('maxAltitudeValue');
    if (maxAltitudeSlider && maxAltitudeValue) {
        maxAltitudeSlider.addEventListener('input', function() {
            const altitude = parseFloat(this.value);
            missionSettings.maxAltitude = altitude;
            maxAltitudeValue.textContent = altitude.toFixed(0);
            
            // Update waypoints on server
            updateWaypointsOnServer();
        });
    }
    
    // Start Mission button functionality
    const startMissionBtn = document.querySelector('.btn-primary');
    const returnHomeBtn = document.querySelector('.btn-warning');
    const emergencyStopBtn = document.querySelector('.btn-danger');
    
    // Mission state variables
    let missionInProgress = false;
    let currentWaypointIndex = -1;
    let missionDrone = null;
    
    // Helper function to get current mission settings
    function getMissionSettings() {
        return {
            maxSpeed: missionSettings.maxSpeed,
            maxAltitude: missionSettings.maxAltitude,
            returnToHome: missionSettings.returnToHome
        };
    }
    
    // Start mission function
    function startMission() {
        if (waypoints.length === 0) {
            addLogEntry('Cannot start mission: No waypoints added', LOG_LEVEL.WARNING);
            return;
        }
        
        if (missionInProgress) {
            addLogEntry('Mission already in progress', LOG_LEVEL.WARNING);
            return;
        }
        
        // Prepare mission data for ESP32
        const missionData = {
            action: 'start_mission',
            waypoints: waypoints,
            maxSpeed: parseFloat(missionSettings.maxSpeed),
            maxAltitude: parseFloat(missionSettings.maxAltitude),
            returnToHome: missionSettings.returnToHome
        };
        
        addLogEntry('Sending mission data to PHP (shared file for ESP32)...', LOG_LEVEL.INFO);
        
        // Send mission data to PHP session for direct ESP32 retrieval
        fetch('mission_data.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(missionData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                addLogEntry(`✓ ${data.waypoint_count} waypoints stored in shared file`, LOG_LEVEL.INFO);
                addLogEntry('ESP32 will retrieve data on next poll', LOG_LEVEL.INFO);
            } else {
                addLogEntry(`Failed to prepare mission: ${data.message}`, LOG_LEVEL.ERROR);
                return;
            }
        })
        .catch(error => {
            console.error('Error starting mission:', error);
            addLogEntry(`Error starting mission: ${error.message}`, LOG_LEVEL.ERROR);
            return;
        });
        
        // Disable simulation mode
        window.droneSimulationActive = false;
        
        // Update UI
        startMissionBtn.disabled = true;
        startMissionBtn.classList.add('disabled');
        returnHomeBtn.disabled = false;
        returnHomeBtn.classList.remove('disabled');
        emergencyStopBtn.disabled = false;
        emergencyStopBtn.classList.remove('disabled');
        
        // Set mission state
        missionInProgress = true;
        currentWaypointIndex = -1;
        
        // Reset drone position to home
        droneMarker.setLatLng([HOME_COORDINATES.lat, HOME_COORDINATES.lng]);
        
        // Create full mission path including RTH if enabled
        const missionWaypoints = [...waypoints];
        
        // Only add RTH if requested
        if (missionSettings.returnToHome) {
            addLogEntry('Mission configured with Return to Home');
        } else {
            addLogEntry('Mission configured to land at last waypoint');
        }
        
        // Update telemetry with home position (showing values now since mission is starting)
        updateTelemetry(HOME_COORDINATES.lat, HOME_COORDINATES.lng, true);
        
        // Start the mission
        addLogEntry('Mission started');
        flyToNextWaypoint();
    }
    
    // Fly to next waypoint
    function flyToNextWaypoint() {
        // Move to next waypoint
        currentWaypointIndex++;
        
        // Check if we've reached the end of the mission
        if (currentWaypointIndex >= waypoints.length) {
            if (missionSettings.returnToHome) {
                // Return to home
                addLogEntry('All waypoints reached. Returning to home...');
                flyToHome();
            } else {
                // End mission at last waypoint
                addLogEntry('Mission completed. Landed at the last waypoint.');
                endMission();
            }
            return;
        }
        
        const targetWaypoint = waypoints[currentWaypointIndex];
        addLogEntry(`Flying to ${targetWaypoint.name}...`);
        
        // Update drone position instantly to the waypoint
        droneMarker.setLatLng([targetWaypoint.lat, targetWaypoint.lng]);
        
        // Update telemetry
        updateTelemetry(targetWaypoint.lat, targetWaypoint.lng, true);
        
        // Update UI with current waypoint info
        document.querySelector('.telemetry-grid .telemetry-item:nth-child(3) span:last-child').innerHTML = 
            `${calculateBearing(HOME_COORDINATES.lat, HOME_COORDINATES.lng, targetWaypoint.lat, targetWaypoint.lng).toFixed(0)}°`;
        
        // Display speed in km/h
        const speedElement = document.querySelector('.status-item:nth-child(3) .value');
        if (speedElement) {
            const speedKmh = missionSettings.maxSpeed * 3.6;
            speedElement.innerHTML = `${speedKmh.toFixed(1)} <small>km/h</small> (${missionSettings.maxSpeed.toFixed(1)} <small>m/s</small>)`;
        }
        
        // Log reaching the waypoint
        addLogEntry(`Reached ${targetWaypoint.name}`);
        
        // Update ETA
        updateRemainingETA();
        
        // Move to next waypoint after a short delay
        setTimeout(() => {
            flyToNextWaypoint();
        }, 1000);
    }
    
    // Fly back to home
    function flyToHome() {
        // Update drone position instantly to home
        droneMarker.setLatLng([HOME_COORDINATES.lat, HOME_COORDINATES.lng]);
        
        // Update telemetry
        updateTelemetry(HOME_COORDINATES.lat, HOME_COORDINATES.lng);
        
        // Update heading
        document.querySelector('.telemetry-grid .telemetry-item:nth-child(3) span:last-child').innerHTML = '0°';
        
        // Update altitude to 0
        const altElement = document.querySelector('.status-item:nth-child(2) .value');
        if (altElement) {
            altElement.innerHTML = '0 <small>m</small>';
        }
        
        // Log reaching home
        addLogEntry('Reached Home. Mission completed.');
        
        // End mission
        endMission();
    }
    
    // End mission and reset UI
    function endMission() {
        missionInProgress = false;
        currentWaypointIndex = -1;
        
        // Cancel any ongoing animations
        if (missionDrone) {
            cancelAnimationFrame(missionDrone);
            missionDrone = null;
        }
        
        // Reset UI
        startMissionBtn.disabled = false;
        startMissionBtn.classList.remove('disabled');
        returnHomeBtn.disabled = true;
        returnHomeBtn.classList.add('disabled');
        emergencyStopBtn.disabled = true;
        emergencyStopBtn.classList.add('disabled');
        
        // Reset displays to placeholders
        resetTelemetryDisplays();
        
        // Restart normal simulation
        window.droneSimulationActive = true;
        simulateDroneMovement();
        
        addLogEntry('Mission ended');
    }
    
    // Calculate distance between two coordinates in meters
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in meters
    }
    
    // Calculate bearing between two points
    function calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                  Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360; // Normalize to 0-360
        return bearing;
    }
    
    // Event listeners for mission control buttons
    if (startMissionBtn) {
        startMissionBtn.addEventListener('click', startMission);
    }
    
    if (returnHomeBtn) {
        returnHomeBtn.disabled = true;
        returnHomeBtn.classList.add('disabled');
        returnHomeBtn.addEventListener('click', function() {
            if (!missionInProgress) return;
            
            addLogEntry('Return to home commanded');
            // Skip remaining waypoints
            currentWaypointIndex = waypoints.length;
            // Cancel current animation
            if (missionDrone) {
                cancelAnimationFrame(missionDrone);
                missionDrone = null;
            }
            // Start RTH
            flyToHome();
        });
    }
    
    if (emergencyStopBtn) {
        emergencyStopBtn.disabled = true;
        emergencyStopBtn.classList.add('disabled');
        emergencyStopBtn.addEventListener('click', function() {
            if (!missionInProgress) return;
            
            addLogEntry('EMERGENCY STOP initiated');
            endMission();
        });
    }
});
