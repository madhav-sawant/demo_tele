

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi Credentials - CHANGE THESE TO YOUR NETWORK
const char* ssid = "Madhav";
const char* password = "06112004";

// Server Configuration - CHANGE THIS TO YOUR SERVER IP
const char* serverName = "http://192.168.1.11/Test0/mission_data.php?esp32=1";

// Mission Data Structure
struct Waypoint {
  int sequence;
  double lat;
  double lng;
  double alt;
};

// Mission Configuration
const int MAX_WAYPOINTS = 50;
Waypoint waypoints[MAX_WAYPOINTS];
int waypointCount = 0;
double maxSpeed = 20.0;        // km/h
double maxAltitude = 50.0;     // meters
bool returnToHome = true;
String missionEndAction = "RTH"; // "RTH" or "LAND"

// Mission State
bool missionDataReceived = false;
bool missionInProgress = false;
int currentWaypointIndex = 0;

// Polling Configuration
unsigned long lastPollTime = 0;
const unsigned long POLL_INTERVAL = 5000; // Check for new missions every 5 seconds

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("ESP32 Drone Mission Controller");
  Serial.println("=================================\n");
  
  // Connect to WiFi
  connectToWiFi();
  
  // Wait for WiFi connection
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi Connected Successfully!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    
    // Fetch mission data from server
    fetchMissionData();
  } else {
    Serial.println("WiFi Connection Failed!");
  }
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Disconnected! Reconnecting...");
    connectToWiFi();
    delay(5000);
    return;
  }
  
  // Poll for new missions periodically (only when not in active mission)
  unsigned long currentTime = millis();
  if (!missionInProgress && (currentTime - lastPollTime >= POLL_INTERVAL)) {
    lastPollTime = currentTime;
    
    // Fetch mission data from server (silent polling)
    fetchMissionData();
  }
  
  // If mission data received and not yet started, display menu
  if (missionDataReceived && !missionInProgress) {
    displayMissionMenu();
    delay(10000); // Check every 10 seconds
  }
  
  // If mission is in progress, execute waypoint navigation
  if (missionInProgress) {
    executeMission();
  }
  
  delay(100);
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✅ WiFi connected!");
    Serial.print("📶 IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("⚠️ WiFi connection failed!");
  }
}

void fetchMissionData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi Disconnected");
    return;
  }
  
  HTTPClient http;
  http.begin(serverName);
  http.setTimeout(10000); // 10 second timeout
  
  int httpResponseCode = http.GET();
  
  if (httpResponseCode > 0) {
    String payload = http.getString();
    
    // Only print full response when mission is ready or error occurs
    if (!missionDataReceived) {
      // Serial.println("📥 Server Response:");
      // Serial.println(payload);
    }
    
    // Parse JSON response
    DynamicJsonDocument doc(8192);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error && doc.containsKey("current_message")) {
      String message = doc["current_message"];
      
      // Parse mission data if available
      if (doc.containsKey("mission_ready") && doc["mission_ready"].as<bool>()) {
        parseMissionData(payload);
      }
      
      // Only show important messages (not routine status)
      if (message != "Waiting for mission..." && 
          message != "Mission already retrieved" && 
          message != "No waypoints configured" &&
          message != "No mission file found") {
        Serial.println("📩 Server: " + message);
      }
    } else if (error) {
      Serial.print("⚠️ JSON Parse Error: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.print("❌ HTTP Error code: ");
    Serial.println(httpResponseCode);
    
    // Print more detailed error info
    if (httpResponseCode == -1) {
      Serial.println("   Connection failed - check server IP and network");
    } else if (httpResponseCode == -11) {
      Serial.println("   Timeout - server not responding");
    }
  }
  
  http.end();
}

void parseMissionData(String jsonData) {
  // Create JSON document
  DynamicJsonDocument doc(8192);
  
  DeserializationError error = deserializeJson(doc, jsonData);
  
  if (error) {
    Serial.print("❌ JSON Parsing Failed: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Check mission status
  String status = doc["status"].as<String>();
  bool missionReady = doc["mission_ready"].as<bool>();
  
  if (status == "success" && missionReady) {
    Serial.println("\n✅ Mission Data Received Successfully!\n");
    
    // Extract mission parameters
    waypointCount = doc["waypoint_count"].as<int>();
    maxSpeed = doc["max_speed"].as<double>();
    maxAltitude = doc["max_altitude"].as<double>();
    returnToHome = doc["return_to_home"].as<bool>();
    missionEndAction = doc["mission_end_action"].as<String>();
    
    // Extract waypoints
    JsonArray waypointsArray = doc["waypoints"].as<JsonArray>();
    int index = 0;
    
    for (JsonObject wp : waypointsArray) {
      if (index < MAX_WAYPOINTS) {
        waypoints[index].sequence = wp["sequence"].as<int>();
        waypoints[index].lat = wp["lat"].as<double>();
        waypoints[index].lng = wp["lng"].as<double>();
        waypoints[index].alt = wp["alt"].as<double>();
        index++;
      }
    }
    
    missionDataReceived = true;
    
    // Display mission summary
    displayMissionSummary();
    
    // Send confirmation to server
    sendStatus("Mission data received - " + String(waypointCount) + " waypoints");
    
    // Automatically start the mission
    Serial.println("\n🚀 AUTO-STARTING MISSION\n");
    delay(1000);
    startMission();
    
  } else if (status == "already_sent") {
    // Mission already retrieved - silent
  } else {
    // Other status - only log if we don't have mission
    if (!missionDataReceived) {
      String msg = doc["current_message"].as<String>();
      if (msg.length() > 0 && msg != "Waiting for mission...") {
        Serial.println("ℹ️ " + msg);
      }
    }
  }
}

void displayMissionSummary() {
  Serial.println("=================================");
  Serial.println("      MISSION SUMMARY");
  Serial.println("=================================");
  Serial.print("Waypoints: ");
  Serial.println(waypointCount);
  Serial.print("Max Speed: ");
  Serial.print(maxSpeed);
  Serial.println(" km/h");
  Serial.print("Max Altitude: ");
  Serial.print(maxAltitude);
  Serial.println(" m");
  Serial.print("Mission End Action: ");
  Serial.println(missionEndAction);
  Serial.println("---------------------------------");
  
  Serial.println("\nWaypoint Details:");
  for (int i = 0; i < waypointCount; i++) {
    Serial.print("WP");
    Serial.print(waypoints[i].sequence);
    Serial.print(": Lat=");
    Serial.print(waypoints[i].lat, 6);
    Serial.print(", Lng=");
    Serial.print(waypoints[i].lng, 6);
    Serial.print(", Alt=");
    Serial.print(waypoints[i].alt, 1);
    Serial.println("m");
  }
  
  Serial.println("=================================\n");
}

void displayMissionMenu() {
  Serial.println("\n--- Mission Ready ---");
  Serial.println("Mission data loaded and ready to execute.");
  Serial.println("To start mission, call startMission() function.");
  Serial.println("Waiting...\n");
}

void startMission() {
  if (!missionDataReceived) {
    Serial.println("❌ Cannot start mission: No mission data received!");
    return;
  }
  
  if (missionInProgress) {
    Serial.println("⚠️ Mission already in progress!");
    return;
  }
  
  Serial.println("\n=================================");
  Serial.println("    STARTING MISSION");
  Serial.println("=================================");
  
  missionInProgress = true;
  currentWaypointIndex = 0;
  
  Serial.println("Mission started. Navigating to waypoints...\n");
  
  // Notify server
  sendStatus("Mission started");
}

void executeMission() {
  if (currentWaypointIndex >= waypointCount) {
    // All waypoints completed
    if (returnToHome) {
      Serial.println("\n✅ All waypoints reached. Returning to home...");
      returnToHomePosition();
    } else {
      Serial.println("\n✅ Mission completed. Landing at last waypoint.");
      landAtCurrentPosition();
    }
    missionInProgress = false;
    
    // Send completion status
    sendStatus("Mission completed successfully");
    
    // Reset mission state to be ready for next mission
    missionDataReceived = false;
    currentWaypointIndex = 0;
    waypointCount = 0;
    Serial.println("\n[READY] ESP32 ready to receive new mission data");
    
    return;
  }
  
  // Navigate to current waypoint
  Waypoint currentWP = waypoints[currentWaypointIndex];
  
  Serial.print("🛫 Navigating to WP");
  Serial.print(currentWP.sequence);
  Serial.print(" (");
  Serial.print(currentWP.lat, 6);
  Serial.print(", ");
  Serial.print(currentWP.lng, 6);
  Serial.print(", ");
  Serial.print(currentWP.alt, 1);
  Serial.println("m)");
  
  // TODO: Implement actual drone navigation logic here
  // This would interface with your flight controller (e.g., Pixhawk, ArduPilot)
  // For now, we simulate reaching the waypoint
  
  delay(2000); // Simulate flight time
  
  Serial.print("✅ Reached WP");
  Serial.println(currentWP.sequence);
  
  // Send waypoint reached status
  sendStatus("Reached waypoint " + String(currentWP.sequence));
  
  // Move to next waypoint
  currentWaypointIndex++;
  
  delay(1000); // Brief pause at waypoint
}

void returnToHomePosition() {
  Serial.println("🏠 Executing Return to Home...");
  sendStatus("Returning to home");
  
  // TODO: Implement RTH logic with your flight controller
  // This would command the drone to return to launch position
  
  delay(3000); // Simulate RTH
  
  Serial.println("✅ Returned to home position.");
  Serial.println("🛬 Landing...");
  
  delay(2000);
  
  Serial.println("✅ Mission Complete!\n");
}

void landAtCurrentPosition() {
  Serial.println("🛬 Landing at current position...");
  sendStatus("Landing at waypoint");
  
  // TODO: Implement landing logic with your flight controller
  
  delay(2000); // Simulate landing
  
  Serial.println("✅ Landed successfully.");
  Serial.println("✅ Mission Complete!\n");
}

// Function to send status updates to server
void sendStatus(String message) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    http.begin(serverName);
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");
    
    String httpRequestData = "status=" + message;
    int httpResponseCode = http.POST(httpRequestData);
    
    if (httpResponseCode > 0) {
      // Status sent successfully - silent
    } else {
      Serial.print("⚠️ Failed to send status: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  }
}

// Function to refetch mission data
void refetchMission() {
  Serial.println("\n🔄 Refetching Mission Data");
  missionDataReceived = false;
  missionInProgress = false;
  currentWaypointIndex = 0;
  waypointCount = 0;
  
  fetchMissionData();
}

// Emergency stop function
void emergencyStop() {
  Serial.println("\n⚠️⚠️⚠️ EMERGENCY STOP ⚠️⚠️⚠️");
  missionInProgress = false;
  sendStatus("EMERGENCY STOP");
  
  // TODO: Implement emergency stop with your flight controller
  // This should immediately halt the drone and enter hover/land mode
  
  Serial.println("Mission aborted. Drone should hover or land safely.");
}
