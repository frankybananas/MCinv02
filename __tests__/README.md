# Test Suite

## Overview

This project uses Jest with React Testing Library for comprehensive testing coverage.

## Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch

# With coverage report
pnpm test:coverage

# CI mode (single run, coverage, no watch)
pnpm test:ci
```

## Test Structure

```
__tests__/
├── api/                    # API route tests
│   ├── admin-users.test.ts # User management endpoints
│   ├── download-*.test.ts  # Image download functionality
│   └── image-proxy.test.ts # Image proxy endpoint
├── components/             # React component tests
│   ├── admin/              # Admin panel components
│   ├── dashboard-*.test.tsx
│   ├── car-detail-*.test.tsx
│   ├── delivery-detail.test.tsx
│   └── main-page.test.tsx
├── lib/                    # Utility function tests
│   ├── security-features.test.ts  # RBAC, validation
│   ├── progressive-rate-limit.test.ts
│   └── encryption.test.ts
└── models/                 # Database model tests
```

## Testing Strategy

### Unit Tests
- **Utilities** (`lib/`): Pure functions for validation, formatting, permissions
- **Components**: Isolated component rendering and interactions

### Integration Tests
- **API Routes**: Request/response testing with mocked database
- **Auth Flow**: OTP send → verify → session creation

### Mocking

| Dependency | Mock Strategy |
|------------|---------------|
| MongoDB | `mongodb-memory-server` for isolated in-memory DB |
| External APIs | Jest mock functions |
| Authentication | Mock session tokens via test utilities |
| File System | Jest spies on fs operations |

## Key Test Files

| File | Coverage | Description |
|------|----------|-------------|
| `security-features.test.ts` | RBAC, validation | Tests permission system and input sanitization |
| `main-page.test.tsx` | Main UI | Tests dashboard interactions and state management |
| `admin-users.test.ts` | User CRUD | Tests admin user management API |

## Writing New Tests

### Component Test Template

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComponentName } from '@/app/components/component-name'

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should handle user interaction', async () => {
    const user = userEvent.setup()
    render(<ComponentName />)
    
    await user.click(screen.getByRole('button'))
    
    expect(screen.getByText('Result')).toBeInTheDocument()
  })
})
```

### API Route Test Template

```typescript
import { GET, POST } from '@/app/api/endpoint/route'
import { NextRequest } from 'next/server'

describe('API /api/endpoint', () => {
  it('should return data for authenticated request', async () => {
    const request = new NextRequest('http://localhost/api/endpoint', {
      headers: { cookie: 'session_token=valid-token' }
    })
    
    const response = await GET(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
```

## Coverage Goals

| Metric | Target | Current |
|--------|--------|---------|
| Statements | 70% | - |
| Branches | 60% | - |
| Functions | 70% | - |
| Lines | 70% | - |

Run `pnpm test:coverage` to see current coverage metrics.
