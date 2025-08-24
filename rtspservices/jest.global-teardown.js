/**
 * Global Teardown for RTSP Service Tests
 * Runs once after all test suites
 */

module.exports = async () => {
  console.log('Cleaning up global RTSP test environment...');
  
  // Clean up test files
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Remove test image file
    const testImagePath = path.join(__dirname, 'img.jpg');
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    
    // Clean up test logs (keep coverage)
    const testLogsDir = path.join(__dirname, 'logs');
    if (fs.existsSync(testLogsDir)) {
      const files = fs.readdirSync(testLogsDir);
      files.forEach(file => {
        if (file.endsWith('.log')) {
          fs.unlinkSync(path.join(testLogsDir, file));
        }
      });
    }
    
    console.log('Global RTSP test environment cleanup completed');
  } catch (error) {
    console.warn('Warning: Some cleanup operations failed:', error.message);
  }
}; 