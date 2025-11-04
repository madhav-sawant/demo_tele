#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>

// GPS Setup
TinyGPSPlus gps;
HardwareSerial GPS(1);

// Timing
unsigned long lastSend = 0;
unsigned long lastStatusUpdate = 0;
const unsigned long sendInterval = 2000;
const unsigned long statusUpdateInterval = 10000;

// Mission Variables
bool missionActive = false;
int currentWaypointIndex = -1;
int totalWaypoints = 0;
float maxSpeed = 0.0;
float maxAltitude = 0.0;
bool enableReturnToHome = false;
const float waypointReachedDistance = 5.0;
String missionId = "";

enum MissionState { WAITING, LOADED, NAVIGATING, COMPLETE };
MissionState missionState = WAITING;

struct Waypoint {
  String name;
  float lat, lng, alt;
  bool reached;
};
Waypoint waypoints[20];

// Function Declarations
float calculateDistance(float lat1, float lng1, float lat2, float lng2);
void sendJSON(const char* type, DynamicJsonDocument& doc);
void processCommand(String command);
void loadMission(DynamicJsonDocument& doc);
void checkWaypoint();
void completeMission();
void resetMission();

void setup() {
  Serial.begin(115200);
  GPS.begin(115200, SERIAL_8N1, 16, 17);
  Serial.println("GPS Telemetry Ready");
  
  DynamicJsonDocument doc(256);
  doc["status"] = "system_ready";
  sendJSON("status", doc);
}

void loop() {
  while (GPS.available() > 0) gps.encode(GPS.read());

  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() > 0) processCommand(cmd);
  }

  if (millis() - lastSend >= sendInterval) {
    if (gps.location.isValid()) {
      DynamicJsonDocument doc(512);
      doc["lat"] = gps.location.lat();
      doc["lng"] = gps.location.lng();
      doc["alt"] = gps.altitude.meters();
      doc["sat"] = gps.satellites.value();
      doc["speed"] = gps.speed.kmph();
      doc["hdop"] = gps.hdop.hdop();
      doc["direction"] = gps.course.isValid() ? gps.course.deg() : 0;
      doc["timestamp"] = millis();
      sendJSON("telemetry", doc);
    } else {
      DynamicJsonDocument doc(128);
      doc["status"] = "waiting_gps_fix";
      sendJSON("status", doc);
    }
    lastSend = millis();
  }

  if (missionState == NAVIGATING && gps.location.isValid()) {
    checkWaypoint();
  }

  if (millis() - lastStatusUpdate >= statusUpdateInterval) {
    if (missionState == NAVIGATING && currentWaypointIndex < totalWaypoints) {
      Waypoint wp = waypoints[currentWaypointIndex];
      float dist = calculateDistance(gps.location.lat(), gps.location.lng(), wp.lat, wp.lng);
      Serial.print("Target: "); Serial.print(wp.name);
      Serial.print(" | Distance: "); Serial.print(dist, 1); 
      Serial.print("m | Progress: "); Serial.print(currentWaypointIndex + 1);
      Serial.print("/"); Serial.println(totalWaypoints);
    }
    lastStatusUpdate = millis();
  }
}

void sendJSON(const char* type, DynamicJsonDocument& doc) {
  doc["type"] = type;
  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

void processCommand(String command) {
  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, command)) return;
  
  String action = doc["action"];
  
  if (action == "start_mission") {
    loadMission(doc);
  } else if (action == "get_status") {
    DynamicJsonDocument status(512);
    status["mission_active"] = missionActive;
    status["mission_state"] = missionState;
    status["current_waypoint"] = currentWaypointIndex;
    status["total_waypoints"] = totalWaypoints;
    sendJSON("mission_status", status);
  } else if (action == "emergency_stop") {
    missionActive = false;
    missionState = WAITING;
    Serial.println("EMERGENCY STOP");
    resetMission();
  } else if (action == "return_home") {
    if (missionActive) {
      Serial.println("Return to Home");
      missionState = COMPLETE;
      DynamicJsonDocument rth(256);
      rth["status"] = "returning_home";
      sendJSON("navigation_update", rth);
    }
  }
}

void loadMission(DynamicJsonDocument& doc) {
  totalWaypoints = doc["total_waypoints"];
  maxSpeed = doc["max_speed"];
  maxAltitude = doc["max_altitude"];
  enableReturnToHome = doc["return_to_home"];
  missionId = doc["created_at"].as<String>();
  
  Serial.println("Mission Loading...");
  
  JsonArray waypointArray = doc["waypoints"];
  for (int i = 0; i < totalWaypoints && i < 20; i++) {
    waypoints[i].name = waypointArray[i]["name"].as<String>();
    waypoints[i].lat = waypointArray[i]["latitude"];
    waypoints[i].lng = waypointArray[i]["longitude"];
    waypoints[i].alt = waypointArray[i]["altitude"];
    waypoints[i].reached = false;
    
    Serial.print("WP"); Serial.print(i + 1); Serial.print(": ");
    Serial.print(waypoints[i].name); Serial.print(" (");
    Serial.print(waypoints[i].lat, 6); Serial.print(", ");
    Serial.print(waypoints[i].lng, 6); Serial.println(")");
  }
  
  Serial.print("Mission: "); Serial.print(totalWaypoints); Serial.print(" waypoints, ");
  Serial.print(maxSpeed); Serial.print("km/h, "); Serial.print(maxAltitude); Serial.println("m");
  
  missionActive = true;
  currentWaypointIndex = 0;
  missionState = LOADED;
  
  DynamicJsonDocument conf(256);
  conf["mission_id"] = missionId;
  conf["total_waypoints"] = totalWaypoints;
  conf["status"] = "mission_loaded";
  sendJSON("mission_confirmation", conf);
  
  // Start navigation
  if (totalWaypoints > 0) {
    missionState = NAVIGATING;
    Serial.print("Navigation started to: "); Serial.println(waypoints[0].name);
    
    DynamicJsonDocument nav(512);
    nav["mission_id"] = missionId;
    nav["status"] = "navigation_started";
    nav["current_waypoint_index"] = 0;
    nav["waypoint_name"] = waypoints[0].name;
    nav["target_lat"] = waypoints[0].lat;
    nav["target_lng"] = waypoints[0].lng;
    sendJSON("navigation_update", nav);
  }
}

void checkWaypoint() {
  if (missionState != NAVIGATING || currentWaypointIndex < 0 || currentWaypointIndex >= totalWaypoints) return;

  Waypoint* wp = &waypoints[currentWaypointIndex];
  float dist = calculateDistance(gps.location.lat(), gps.location.lng(), wp->lat, wp->lng);

  if (dist <= waypointReachedDistance && !wp->reached) {
    wp->reached = true;
    
    Serial.print("Waypoint reached: "); Serial.print(wp->name);
    Serial.print(" ("); Serial.print(currentWaypointIndex + 1);
    Serial.print("/"); Serial.print(totalWaypoints); Serial.print(") - ");
    Serial.print(dist, 1); Serial.println("m accuracy");
    
    DynamicJsonDocument nav(512);
    nav["mission_id"] = missionId;
    nav["status"] = "waypoint_reached";
    nav["current_waypoint_index"] = currentWaypointIndex;
    nav["waypoint_name"] = wp->name;
    nav["accuracy_meters"] = dist;
    nav["current_lat"] = gps.location.lat();
    nav["current_lng"] = gps.location.lng();
    sendJSON("navigation_update", nav);

    currentWaypointIndex++;
    
    if (currentWaypointIndex < totalWaypoints) {
      Serial.print("Next target: "); Serial.println(waypoints[currentWaypointIndex].name);
      
      DynamicJsonDocument next(512);
      next["mission_id"] = missionId;
      next["status"] = "navigating_to";
      next["current_waypoint_index"] = currentWaypointIndex;
      next["waypoint_name"] = waypoints[currentWaypointIndex].name;
      next["target_lat"] = waypoints[currentWaypointIndex].lat;
      next["target_lng"] = waypoints[currentWaypointIndex].lng;
      sendJSON("navigation_update", next);
    } else {
      completeMission();
    }
  }
}

void completeMission() {
  Serial.print("Mission complete! "); Serial.print(totalWaypoints); Serial.println(" waypoints reached");
  
  missionState = COMPLETE;
  missionActive = false;
  
  if (enableReturnToHome) {
    Serial.println("Returning to home");
    DynamicJsonDocument rth(256);
    rth["mission_id"] = missionId;
    rth["status"] = "returning_home";
    sendJSON("navigation_update", rth);
  } else {
    DynamicJsonDocument done(256);
    done["mission_id"] = missionId;
    done["status"] = "mission_complete";
    sendJSON("navigation_update", done);
  }
  
  resetMission();
}

void resetMission() {
  for (int i = 0; i < 20; i++) {
    waypoints[i].name = "";
    waypoints[i].lat = waypoints[i].lng = waypoints[i].alt = 0;
    waypoints[i].reached = false;
  }
  
  totalWaypoints = 0;
  currentWaypointIndex = -1;
  missionId = "";
  missionState = WAITING;
  
  Serial.println("Ready for next mission");
}

float calculateDistance(float lat1, float lng1, float lat2, float lng2) {
  const float R = 6371000;
  float dLat = (lat2 - lat1) * PI / 180.0;
  float dLng = (lng2 - lng1) * PI / 180.0;
  float a = sin(dLat/2) * sin(dLat/2) +
            cos(lat1 * PI / 180.0) * cos(lat2 * PI / 180.0) *
            sin(dLng/2) * sin(dLng/2);
  float c = 2 * atan2(sqrt(a), sqrt(1-a));
  return R * c;
}