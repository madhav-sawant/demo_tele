/**
 * map.js - Leaflet Map Management
 * 
 * Handles:
 * - Leaflet map initialization and configuration
 * - Adding/removing waypoints on map
 * - Drawing flight path between waypoints
 * - Map controls (center, zoom)
 * - Map info overlay (scale, coordinates, altitude, camera distance)
 * - Drone marker positioning and updates
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    window.map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
        maxZoom: 22
    }).setView([window.HOME_COORDINATES.lat, window.HOME_COORDINATES.lng], 15);
    
    // Waypoints array
    window.waypoints = [];
    
    // Track cursor position
    window.cursorPosition = { lat: window.HOME_COORDINATES.lat, lng: window.HOME_COORDINATES.lng };
    
    // Initialize map components
    initializeMapLayers();
    initializeMapControls();
    initializeMapInfoOverlay();
    initializeDroneMarker();
    initializeMapEvents();
});

// ================== MAP LAYERS ==================

function initializeMapLayers() {
    const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google',
        maxZoom: 22,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(window.map);

    satelliteLayer.on('tileerror', function(error) {
        console.error('Tile error:', error);
        if (window.addLogEntry) {
            window.addLogEntry('Map tile loading error. Retrying...', window.LOG_LEVEL.WARNING);
        }
    });
    
    satelliteLayer.on('load', function() {
        if (window.addLogEntry) {
            window.addLogEntry('Satellite imagery loaded successfully', window.LOG_LEVEL.INFO);
        }
    });
    
    window.map.on('load', function() {
        if (window.addLogEntry) {
            window.addLogEntry('Map fully loaded with all tiles.');
        }
    });
    
    setTimeout(function() {
        window.map.invalidateSize();
        if (window.addLogEntry) {
            window.addLogEntry('Map display refreshed');
        }
    }, 500);
}

// ================== MAP CONTROLS ==================

function initializeMapControls() {
    const centerMapBtn = document.getElementById('centerMap');
    if (centerMapBtn) {
        centerMapBtn.addEventListener('click', function() {
            window.map.setView([window.HOME_COORDINATES.lat, window.HOME_COORDINATES.lng], 15);
            if (window.addLogEntry) {
                window.addLogEntry('Map centered to home position');
            }
        });
    }
}

// ================== MAP INFO OVERLAY ==================

function initializeMapInfoOverlay() {
    updateMapInfoOverlay();
    
    let mapUpdateTimeout;
    function throttledMapUpdate() {
        clearTimeout(mapUpdateTimeout);
        mapUpdateTimeout = setTimeout(updateMapInfoOverlay, 100);
    }
    
    window.map.on('move', throttledMapUpdate);
    window.map.on('zoom', throttledMapUpdate);
    
    let mouseUpdateTimeout;
    window.map.on('mousemove', function(e) {
        window.cursorPosition = { lat: e.latlng.lat, lng: e.latlng.lng };
        clearTimeout(mouseUpdateTimeout);
        mouseUpdateTimeout = setTimeout(updateMapCoordinates, 50);
    });
}


function updateMapInfoOverlay() {
    updateScaleBar();
    updateCameraDistance();
    updateMapCoordinates();
}

function updateScaleBar() {
    const scaleBarText = document.getElementById('scaleBarText');
    if (!scaleBarText) return;
    
    const zoom = window.map.getZoom();
    const center = window.map.getCenter();
    const metersPerPixel = 40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8);
    const scaleBarMeters = metersPerPixel * 60;
    
    let displayDistance;
    if (scaleBarMeters < 1000) {
        displayDistance = Math.round(scaleBarMeters) + ' m';
    } else {
        displayDistance = (scaleBarMeters / 1000).toFixed(1) + ' km';
    }
    
    scaleBarText.textContent = displayDistance;
}

function updateCameraDistance() {
    const cameraDistance = document.getElementById('cameraDistance');
    if (!cameraDistance) return;
    
    const zoom = window.map.getZoom();
    const center = window.map.getCenter();
    const altitude = Math.round(40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8) * 500);
    
    let displayAltitude;
    if (altitude < 1000) {
        displayAltitude = altitude + ' m';
    } else {
        displayAltitude = (altitude / 1000).toFixed(1) + ' km';
    }
    
    cameraDistance.textContent = 'Camera: ' + displayAltitude;
}

function updateMapCoordinates() {
    const mapCoordinates = document.getElementById('mapCoordinates');
    if (!mapCoordinates) return;
    
    const lat = window.cursorPosition.lat;
    const lng = window.cursorPosition.lng;
    
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

// ================== DRONE MARKER ==================

function initializeDroneMarker() {
    window.gpsLocationSet = false;
    
    const droneIcon = L.divIcon({
        html: '<div style="font-size: 36px; color: #FF5722; text-shadow: 0 0 25px rgba(255, 87, 34, 0.9);">➤</div>',
        className: 'drone-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    
    window.droneMarker = L.marker([window.HOME_COORDINATES.lat, window.HOME_COORDINATES.lng], {
        icon: droneIcon, 
        zIndexOffset: 1000
    }).addTo(window.map);
}

function updateDronePosition(lat, lng) {
    if (window.droneMarker) {
        window.droneMarker.setLatLng([lat, lng]);
        
        if (!window.gpsLocationSet) {
            window.map.setView([lat, lng], 18);
            if (window.addLogEntry) {
                window.addLogEntry(`GPS lock acquired! Centered map on live location`, window.LOG_LEVEL.INFO);
            }
            window.gpsLocationSet = true;
        }
    }
}

window.updateDronePosition = updateDronePosition;

// ================== WAYPOINT MANAGEMENT ==================

function addWaypoint(lat, lng, alt) {
    if (alt === undefined) {
        alt = window.missionSettings.maxAltitude;
    }
    
    const waypointNumber = window.waypoints.length + 1;
    const waypoint = {
        lat: lat,
        lng: lng,
        alt: alt,
        name: `Waypoint ${waypointNumber}`
    };
    
    const waypointIcon = L.divIcon({
        html: `<div class="waypoint-number" style="background: #3498db; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${waypointNumber}</div>`,
        className: 'waypoint-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    const marker = L.marker([lat, lng], { icon: waypointIcon }).addTo(window.map);
    marker.bindPopup(`${waypoint.name}<br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}<br>Alt: ${alt}m`);
    
    waypoint.marker = marker;
    window.waypoints.push(waypoint);
    
    if (window.updateWaypointsList) {
        window.updateWaypointsList();
    }
    
    if (window.addLogEntry) {
        window.addLogEntry(`Added ${waypoint.name} at ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
    
    if (window.calculateETA) {
        window.calculateETA().then(eta => {
            const etaElement = document.querySelector('.eta-value');
            if (etaElement) {
                etaElement.innerHTML = eta;
            }
        });
    }
}

window.addWaypoint = addWaypoint;

function removeWaypoint(index) {
    if (index >= 0 && index < window.waypoints.length) {
        const waypoint = window.waypoints[index];
        
        if (waypoint.marker) {
            window.map.removeLayer(waypoint.marker);
        }
        
        window.waypoints.splice(index, 1);
        
        window.waypoints.forEach((wp, newIndex) => {
            wp.name = `Waypoint ${newIndex + 1}`;
            
            if (wp.marker) {
                const newIcon = L.divIcon({
                    html: `<div class="waypoint-number" style="background: #3498db; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${newIndex + 1}</div>`,
                    className: 'waypoint-marker',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                wp.marker.setIcon(newIcon);
                wp.marker.setPopupContent(`${wp.name}<br>Lat: ${wp.lat.toFixed(6)}<br>Lng: ${wp.lng.toFixed(6)}<br>Alt: ${wp.alt}m`);
            }
        });
        
        if (window.updateWaypointsList) {
            window.updateWaypointsList();
        }
        
        if (window.addLogEntry) {
            window.addLogEntry(`Removed waypoint ${index + 1}`, window.LOG_LEVEL.INFO);
        }
        
        if (window.calculateETA) {
            window.calculateETA().then(eta => {
                const etaElement = document.querySelector('.eta-value');
                if (etaElement) {
                    etaElement.innerHTML = eta;
                }
            });
        }
    }
}

window.removeWaypoint = removeWaypoint;

function clearAllWaypoints() {
    if (window.waypoints.length === 0) {
        if (window.addLogEntry) {
            window.addLogEntry('No waypoints to clear', window.LOG_LEVEL.INFO);
        }
        return;
    }
    
    const confirmed = confirm(`Clear all ${window.waypoints.length} waypoint${window.waypoints.length > 1 ? 's' : ''}?`);
    if (!confirmed) return;
    
    window.waypoints.forEach(waypoint => {
        if (waypoint.marker) {
            try {
                window.map.removeLayer(waypoint.marker);
            } catch (error) {
                console.warn('Error removing marker:', error);
            }
        }
    });
    
    window.waypoints.splice(0, window.waypoints.length);
    
    if (window.updateWaypointsList) {
        window.updateWaypointsList();
    }
    
    if (window.addLogEntry) {
        window.addLogEntry('All waypoints cleared', window.LOG_LEVEL.INFO);
    }
    
    const etaElement = document.querySelector('.eta-value');
    if (etaElement) {
        etaElement.textContent = '--:--';
    }
    
    window.flightPathAnalysisData = null;
}

window.clearAllWaypoints = clearAllWaypoints;

// ================== MAP EVENTS ==================

function initializeMapEvents() {
    window.map.on('click', function(e) {
        addWaypoint(e.latlng.lat, e.latlng.lng);
        
        const clickIndicator = L.circleMarker([e.latlng.lat, e.latlng.lng], {
            radius: 10,
            fillColor: '#3498db',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.3
        }).addTo(window.map);
        
        setTimeout(() => {
            window.map.removeLayer(clickIndicator);
        }, 1000);
    });
}

// ================== UTILITY FUNCTIONS ==================

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

window.calculateDistance = calculateDistance;
