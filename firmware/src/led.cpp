#include "led.h"
#include "pins.h"

static void blink(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(150);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(150);
  }
}

void ledBegin() {
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
}

void ledIndicateResult(int statusCode) {
  if (statusCode >= 200 && statusCode < 300) {
    blink(1);
  } else if (statusCode == 409) {
    blink(2);
  } else {
    blink(3);
  }
}

void ledIndicateInvalidUid() {
  blink(4);
}
