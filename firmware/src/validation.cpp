#include "validation.h"

namespace {
bool isHexDigit(char c) {
  return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');
}

bool isValidUidLength(unsigned int length) {
  return length == 8 || length == 14 || length == 20;
}
}  // namespace

UidValidation validateUidFormat(const String &rawUid) {
  if (!isValidUidLength(rawUid.length())) {
    return UidValidation{false, "", "unexpected UID length: " + String(rawUid.length())};
  }

  for (unsigned int i = 0; i < rawUid.length(); i++) {
    if (!isHexDigit(rawUid[i])) {
      return UidValidation{false, "", "non-hex character in UID"};
    }
  }

  String normalized = rawUid;
  normalized.toUpperCase();
  return UidValidation{true, normalized, ""};
}
