#include "led.h"
#include "pins.h"
#include <Adafruit_NeoPixel.h>

static Adafruit_NeoPixel pixel(1, STATUS_LED_PIN, NEO_GRB + NEO_KHZ800);

static void blink(int times, uint32_t color) {
  for (int i = 0; i < times; i++) {
    pixel.setPixelColor(0, color);
    pixel.show();
    delay(150);
    pixel.setPixelColor(0, 0);
    pixel.show();
    delay(150);
  }
}

void ledBegin() {
  pixel.begin();
  pixel.setBrightness(40);
  pixel.setPixelColor(0, 0);
  pixel.show();
}

void ledIndicateResult(int statusCode) {
  if (statusCode >= 200 && statusCode < 300) {
    blink(1, pixel.Color(0, 255, 0));
  } else if (statusCode == 409) {
    blink(2, pixel.Color(255, 165, 0));
  } else {
    blink(3, pixel.Color(255, 0, 0));
  }
}

void ledIndicateInvalidUid() {
  blink(4, pixel.Color(255, 0, 0));
}

void ledIndicateSessionStart() {
  blink(2, pixel.Color(0, 0, 255));
}

void ledIndicateSessionEnd() {
  blink(1, pixel.Color(0, 0, 255));
}
