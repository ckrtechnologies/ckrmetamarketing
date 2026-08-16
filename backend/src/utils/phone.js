/**
 * Phone number normalization & formatting utilities for WhatsApp
 */

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');

  // Strip leading zeros if 11 digits (e.g. 07982296878)
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.substring(1);
  }

  // If 10 digits (standard Indian mobile), automatically prefix with India country code 91
  if (digits.length === 10) {
    digits = '91' + digits;
  }

  return digits;
}

function formatPhoneDisplay(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `+${digits}`;
}

module.exports = { normalizePhoneNumber, formatPhoneDisplay };
