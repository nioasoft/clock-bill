# Testing Infrastructure for Clock-Bill

This directory contains unit tests and integration tests for the Clock-Bill application.

## Test Structure

```
tests/
├── unit/                   # Unit tests for utility functions
│   ├── format.test.ts     # Date/time formatting tests
│   └── validation.test.ts # Form validation tests
├── integration/            # Integration tests for API endpoints
│   └── api.test.ts        # API endpoint tests
├── run-tests.ts           # Test runner script
└── README.md              # This file
```

## Unit Tests

Unit tests test individual functions and utilities in isolation.

### Coverage

- **lib/format.ts**: Date/time formatting functions
  - `formatDate()` - Format dates in various formats
  - `formatTime()` - Format time in 12h/24h
  - `formatDateTime()` - Combined date/time formatting
  - `formatDateRange()` - Date range formatting
  - `formatDuration()` - Duration in minutes to readable format

- **lib/validation.ts**: Form validation functions
  - `calculatePasswordStrength()` - Password strength calculator
  - `validateField()` - Generic field validation
  - `validateEmail()` - Email validation
  - `validatePhone()` - Israeli phone number validation
  - `validatePassword()` - Password validation
  - `validatePasswordConfirm()` - Password confirmation
  - `validateNumber()` - Number validation
  - `validateRequired()` - Required field validation
  - `validateUrl()` - URL validation
  - `validateForm()` - Multi-field form validation
  - `validateDate()` - Date format validation
  - `validateDateRange()` - Date range validation
  - `validatePastDate()` - Past date validation
  - `validateFutureDate()` - Future date validation

## Integration Tests

Integration tests test API endpoints and verify they work correctly.

### Coverage

- **Authentication API**
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User login
  - `GET /api/auth/session` - Get current session
  - `POST /api/auth/logout` - User logout

- **Profile API**
  - `GET /api/profile` - Get user profile
  - `PATCH /api/profile` - Update user profile
  - `POST /api/profile/logo` - Upload logo

- **Clients API**
  - `GET /api/clients` - List clients
  - `POST /api/clients` - Create client
  - `GET /api/clients/:id` - Get client details
  - `PATCH /api/clients/:id` - Update client
  - `DELETE /api/clients/:id` - Deactivate client

- **Projects API**
  - `GET /api/projects` - List projects
  - `POST /api/projects` - Create project
  - `GET /api/projects/:id` - Get project details
  - `PATCH /api/projects/:id` - Update project
  - `DELETE /api/projects/:id` - Delete project

- **Time Entries API**
  - `GET /api/entries` - List time entries
  - `POST /api/entries` - Create time entry
  - `GET /api/entries/:id` - Get entry details
  - `PATCH /api/entries/:id` - Update entry
  - `DELETE /api/entries/:id` - Delete entry
  - `POST /api/timer/start` - Start timer
  - `POST /api/timer/stop` - Stop timer
  - `POST /api/timer/pause` - Pause timer
  - `POST /api/timer/resume` - Resume timer
  - `GET /api/timer/running` - Get running timer

- **Reports API**
  - `POST /api/reports` - Generate PDF report
  - `POST /api/reports/excel` - Export to Excel
  - `GET /api/reports/summary` - Get report summary

- **Dashboard API**
  - `GET /api/dashboard/stats` - Get dashboard statistics
  - `GET /api/dashboard/recent` - Get recent entries

## Running Tests

### Prerequisites

1. Ensure dependencies are installed:
   ```bash
   npm install
   ```

2. For integration tests, start the dev server:
   ```bash
   npm run dev
   ```

### Run Unit Tests

```bash
# Run all unit tests
npm test

# Run format tests only
npm run test:format

# Run validation tests only
npm run test:validation
```

### Run Integration Tests

Integration tests require a running server:

```bash
# In one terminal, start the server
npm run dev

# In another terminal, run integration tests
node tests/integration/api.test.ts
```

### Test Environment Variables

For integration tests, you can set:

```bash
# Override base URL (default: http://localhost:3000)
TEST_BASE_URL=http://localhost:3000 node tests/integration/api.test.ts
```

## Test Structure

Each test file uses a simple custom test runner:

```typescript
const runner = new TestRunner();

runner.test('test name', () => {
  // Test code here
  assertEqual(actual, expected, 'optional message');
  assertTrue(condition, 'optional message');
  assertFalse(value, 'optional message');
});

await runner.run();
```

## Writing New Tests

### Unit Test Example

```typescript
// tests/unit/myutil.test.ts
import { myFunction } from '../lib/myutil';

const runner = new TestRunner();

runner.test('myFunction: does something', () => {
  const result = myFunction('input');
  assertEqual(result, 'expected output');
});

runner.run();
```

### Integration Test Example

```typescript
// tests/integration/myendpoint.test.ts
const test = {
  name: 'GET /api/myendpoint - returns data',
  fn: async () => {
    const response = await apiRequest('/api/myendpoint');

    if (response.status === 401) {
      return; // Expected - not authenticated
    }

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    // Validate response...
  },
};
```

## Continuous Integration

Tests should be run in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
```

## Coverage Goals

Target test coverage:

- **Unit tests**: 80%+ coverage of utility functions
- **Integration tests**: All API endpoints covered
- **Critical paths**: Authentication, CRUD operations, reporting

## Troubleshooting

### Tests Fail to Run

If tests fail to run:

1. Check Node.js version (requires 20+)
2. Ensure all dependencies are installed: `npm install`
3. For integration tests, ensure dev server is running

### Integration Tests Fail with Connection Error

If integration tests can't connect:

1. Ensure dev server is running: `npm run dev`
2. Check server is on correct port (default: 3000)
3. Verify TEST_BASE_URL environment variable if needed

### TypeScript Compilation Errors

If you see TypeScript errors:

1. Ensure TypeScript version matches package.json
2. Run: `npm install`
3. Check tsconfig.json settings

## Future Improvements

Potential enhancements to the testing infrastructure:

1. **Add testing framework**: Consider Vitest or Jest for better test runner
2. **Code coverage**: Add Istanbul/nyc for coverage reports
3. **E2E tests**: Add Playwright for end-to-end testing
4. **Performance tests**: Add load testing for API endpoints
5. **Visual regression**: Add screenshot comparison testing
6. **Mock API**: Add mock server for offline testing

## Resources

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [Vitest Documentation](https://vitest.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
