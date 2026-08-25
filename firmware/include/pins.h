#pragma once

// PN532 (I2C mode, DIP switches: SW1=ON, SW2=OFF)
#define PN532_SDA_PIN 21
#define PN532_SCL_PIN 22

// Tap-result feedback LED. GPIO2 is the onboard LED on most ESP32 dev
// boards; change this if a given board wires it elsewhere.
#define STATUS_LED_PIN 2
