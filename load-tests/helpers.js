// Artillery helper functions for load testing
// These functions can be used in test scenarios

/**
 * Generate random email for testing
 */
function randomEmail() {
  const random = Math.random().toString(36).substring(7);
  return `testuser_${random}@example.com`;
}

/**
 * Generate random string
 */
function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random product ID (adjust based on your product IDs)
 */
function randomProductId() {
  const productIds = [
    'a370af96-f391-4cd6-b42a-33d2e07743f7',
    // Add more product IDs from your database
  ];
  return productIds[Math.floor(Math.random() * productIds.length)] || randomString();
}

/**
 * Pick random item from array
 */
function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate random integer between min and max
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  randomEmail,
  randomString,
  randomProductId,
  pick,
  randomInt,
};


