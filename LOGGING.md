# Logging Configuration

## Overview

The application uses a centralized logging system (`lib/logger.ts`) that provides structured logging with different severity levels, timestamps, and optional metadata.

## Features

- **Log Levels**: DEBUG, INFO, WARN, ERROR, NONE
- **Structured Logging**: Consistent format with timestamps and metadata
- **Color-coded Output**: ANSI colors for terminal readability (development only)
- **Child Loggers**: Create contextual loggers with prefixes
- **Environment-based Configuration**: Automatic level selection based on NODE_ENV

## Log Levels

| Level | Value | Description |
|-------|-------|-------------|
| DEBUG | 0 | Detailed debugging information (default in development) |
| INFO  | 1 | General informational messages (default in production) |
| WARN  | 2 | Warning messages for potentially harmful situations |
| ERROR | 3 | Error messages for critical issues |
| NONE  | 4 | Disable all logging |

## Configuration

### Environment Variables

```bash
# Set the log level (optional)
LOG_LEVEL=DEBUG  # Options: DEBUG, INFO, WARN, ERROR, NONE

# The application also respects NODE_ENV
NODE_ENV=production  # Uses INFO level by default
NODE_ENV=development # Uses DEBUG level by default
```

### Default Behavior

- **Development**: Log level is DEBUG by default
- **Production**: Log level is INFO by default
- Colors are enabled in development, disabled in production

## Usage

### Basic Logger

```typescript
import { logger } from "@/lib/logger";

// Debug level - detailed information
logger.debug("User fetched from database", { userId: "123", email: "user@example.com" });

// Info level - general information
logger.info("User registered successfully", { userId: "123", email: "user@example.com" });

// Warning level - potential issues
logger.warn("Password reset attempted for non-existent user", { email: "unknown@example.com" });

// Error level - critical issues
logger.error("Database connection failed", error, { host: "localhost", port: 5432 });
```

### Child Logger with Prefix

Create a logger for a specific module or feature:

```typescript
import { createLogger } from "@/lib/logger";

// Create a child logger with a prefix
const logger = createLogger("auth:login");

// All logs will include [auth:login] prefix
logger.info("User logged in successfully", { userId: "123" });
// Output: [2024-02-06T10:30:00.000Z] [INFO] [auth:login] User logged in successfully
```

### Error Logging

```typescript
try {
  await someOperation();
} catch (error) {
  // The logger automatically extracts error message, stack, and name
  logger.error("Operation failed", error, { userId: user.id });
}
```

## Log Format

### Development (with colors)

```
[2024-02-06T10:30:00.000Z] [INFO] [auth:login] User logged in successfully
{
  "userId": "123",
  "email": "user@example.com"
}
```

### Production (without colors)

```
[2024-02-06T10:30:00.000Z] [INFO] [auth:login] User logged in successfully
{
  "userId": "123",
  "email": "user@example.com"
}
```

## Examples in the Codebase

### API Routes

```typescript
// app/api/auth/login/route.ts
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth:login");

export async function POST(request: Request) {
  try {
    // ... authentication logic ...
    logger.info("User logged in successfully", { userId: user.id, email: user.email });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Login failed", error, { email });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
```

### Database Layer

```typescript
// lib/db.ts
import { createLogger } from "./logger";

const logger = createLogger("db");

export async function initSchema(): Promise<void> {
  // ... schema initialization ...
  logger.debug("Database schema initialized successfully");
}
```

## Best Practices

1. **Use Appropriate Log Levels**
   - DEBUG: Detailed flow information, variable values
   - INFO: Important events (user actions, state changes)
   - WARN: Recoverable issues, deprecated usage
   - ERROR: Failures that affect functionality

2. **Include Relevant Metadata**
   ```typescript
   logger.info("Project created", { projectId, clientId, userId });
   logger.error("Timer start failed", error, { userId, projectId });
   ```

3. **Use Child Loggers for Modules**
   - Create a child logger for each module/route
   - Helps filter logs by feature
   - Provides context in log output

4. **Don't Log Sensitive Data**
   - Avoid logging passwords, tokens, API keys
   - Be careful with PII (personally identifiable information)
   - Mask sensitive fields when necessary

5. **Error Logging Pattern**
   ```typescript
   try {
     await operation();
   } catch (error) {
     logger.error("Descriptive message", error, { context: "data" });
     // Handle error appropriately
   }
   ```

## Migration from console.log

### Before
```typescript
console.log("User logged in", userId);
console.error("Error:", error);
console.warn("Warning message");
```

### After
```typescript
logger.info("User logged in", { userId });
logger.error("Error occurred", error, { context });
logger.warn("Warning message", { context });
```

## Benefits of Structured Logging

1. **Consistent Format**: All logs follow the same structure
2. **Searchable**: JSON metadata is easy to search and filter
3. **Level Filtering**: Control verbosity without code changes
4. **Production Ready**: Structured logs work with log aggregation services
5. **Contextual**: Child loggers provide module context
6. **Error Details**: Automatic error message, stack trace, and name extraction

## Testing

To verify logging is working:

1. Start the development server
2. Navigate to any page or API route
3. Check the terminal output for formatted log messages
4. Try changing `LOG_LEVEL` environment variable to see different verbosity

```bash
# Test with DEBUG level (most verbose)
LOG_LEVEL=DEBUG npm run dev

# Test with ERROR level (least verbose)
LOG_LEVEL=ERROR npm run dev
```

## Files Using the Logger

- `lib/db.ts` - Database operations and migrations
- `app/api/auth/login/route.ts` - User authentication
- `app/api/auth/register/route.ts` - User registration
- `app/api/timer/start/route.ts` - Timer operations
- `app/api/profile/route.ts` - User profile management

Additional files will be migrated to use the logger over time.
