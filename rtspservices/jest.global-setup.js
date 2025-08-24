/**
 * Global Setup for RTSP Service Tests
 * Runs once before all test suites
 */

module.exports = async () => {
  console.log('Setting up global RTSP test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.RTSP_PORT = '554';
  process.env.BRAND = 'auto';
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_USER = process.env.DB_USER || 'root';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'password';
  process.env.DB_NAME = process.env.DB_NAME || 'sweetcam';
  process.env.DB_PORT = process.env.DB_PORT || '3306';
  
  // Create test directories if they don't exist
  const fs = require('fs');
  const path = require('path');
  
  const testDirs = [
    path.join(__dirname, 'logs'),
    path.join(__dirname, 'coverage'),
    path.join(__dirname, '__tests__')
  ];
  
  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Create test image file if it doesn't exist
  const testImagePath = path.join(__dirname, 'img.jpg');
  if (!fs.existsSync(testImagePath)) {
    // Create a minimal fake JPEG file for testing
    const fakeJpegData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
      0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08,
      0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x37, 0xFF,
      0xD9
    ]);
    fs.writeFileSync(testImagePath, fakeJpegData);
  }
  
  console.log('Global RTSP test environment setup completed');
}; 