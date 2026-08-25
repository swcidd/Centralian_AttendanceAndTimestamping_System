#pragma once

// Board: ESP32-S3 N16R8 (16MB flash, 8MB octal PSRAM).
// GPIO21/22 are the classic ESP32's I2C defaults, not the S3's —
// arduino-esp32's default Wire pins on ESP32-S3 are GPIO8/GPIO9.
// PN532 (I2C mode, DIP switches: SW1=ON, SW2=OFF)
#define PN532_SDA_PIN 8
#define PN532_SCL_PIN 9

// Tap-result feedback LED. This DOIT ESP32-S3 N16R8 board's onboard
// LED is an addressable WS2812-style RGB LED on GPIO48 (the standard
// pin for the ESP32-S3-WROOM-1-N16R8 reference design) — driven via
// Adafruit_NeoPixel in led.cpp, not a plain digitalWrite().
#define STATUS_LED_PIN 48
