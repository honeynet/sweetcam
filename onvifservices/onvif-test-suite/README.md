# ONVIF Test Suite with Jest

A testing framework for ONVIF honeypot services using Jest, covering all aspects of functionality, security and performance.

## Overview

This test suite is designed to test ONVIF honeypot services, ensuring they work correctly across all camera brands, handle port changes properly, maintain workflow integrity, provide camera accessibility, implement logging and store payload data in the database.

## Features

### Core Testing Areas

1. **Brand Port Accessibility** - Tests all 6 camera brand services on their respective ports
2. **Port Configurability** - Verifies ports can be changed without breaking functionality
3. **Workflow Impact Analysis** - Ensures port changes don't affect service workflows
4. **Camera Accessibility** - Tests access to all `/onvif/` endpoints
5. **Logging Functionality** - Verifies logging across all services
6. **Database Payload Storage** - Ensures all logs and payloads are stored in SQL database
7. **UDP Discovery Service** - Tests WS-Discovery protocol implementation
8. **SOAP Service Functionality** - Validates ONVIF SOAP operations and payloads
9. **Session Management** - Tests session creation, timeout, and cleanup
10. **Brand-Specific Responses** - Verifies each brand responds with appropriate device information


## Prerequisites

- Node.js 16+ installed
- MySQL/MariaDB database running
- ONVIF services running in Docker containers
- Access to the database with proper credentials

## Installation

1. **Navigate to the test suite directory:**
   ```bash
   cd onvif-test-suite
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   export DB_HOST=localhost
   export DB_USER=root
   export DB_PASSWORD=your_password
   export DB_NAME=sweetcam
   export DB_PORT=3306
   export TEST_BASE_URL=http://localhost
   export VERBOSE_TESTS=false
   export CHECK_SERVICES=true
   ```

## Running Tests

### Quick Start

Run all tests with coverage:
```bash
npm test
```

### Specific Test Suites

Run only port testing:
```bash
npm run test:port
```

Run only database testing:
```bash
npm run test:database
```

Run only ONVIF functionality testing:
```bash
npm run test:onvif
```
