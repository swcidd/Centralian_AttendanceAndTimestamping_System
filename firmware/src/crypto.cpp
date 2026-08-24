#include "crypto.h"
#include "config.h"
#include <mbedtls/md.h>

String signPayload(const String &deviceMac, unsigned long timestamp, const String &nfcUid) {
  String message = deviceMac + String(timestamp) + nfcUid;

  const mbedtls_md_info_t *mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  uint8_t hmacResult[32];

  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mdInfo, 1 /* use hmac */);
  mbedtls_md_hmac_starts(&ctx, reinterpret_cast<const uint8_t *>(DEVICE_PSK), strlen(DEVICE_PSK));
  mbedtls_md_hmac_update(&ctx, reinterpret_cast<const uint8_t *>(message.c_str()), message.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  String signature;
  for (uint8_t i = 0; i < sizeof(hmacResult); i++) {
    if (hmacResult[i] < 0x10) signature += "0";
    signature += String(hmacResult[i], HEX);
  }
  return signature;
}
