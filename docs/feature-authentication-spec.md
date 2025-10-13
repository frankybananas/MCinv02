# User Isolation & Authentication Feature Specification

## Overview and Purpose
The User Isolation & Authentication feature ensures secure multi-user access with complete data segregation. Each user can only access their own clients, requests, and deliveries while the AI matching system operates across all users to find optimal matches.

## Key Components and Architecture

### Core Components
- **Frontend Components**:
  - `login-form.tsx` - Phone number authentication interface
  - `login-screen.tsx` - Initial login flow management
  - `otp-screen.tsx` - SMS OTP verification
  - `header-bar.tsx` - User session display and logout
  - `main-menu.tsx` - Role-based navigation

- **API Endpoints**:
  - `GET/POST /api/auth/send/` - SMS OTP sending
  - `GET/POST /api/auth/verify/` - OTP verification and token generation
  - `GET /api/users/` - User management (admin functions)

### Data Models

**User Interface** (`models/User.ts`):
```typescript
interface User {
  _id: string;
  phone: string; // Primary identifier
  name?: string;
  role: 'user' | 'admin' | 'manager';
  matchingEnabled?: boolean; // AI matching participation toggle
  createdAt: Date;
  updatedAt: Date;
}
```

**Session Interface** (`models/Session.ts`):
```typescript
interface Session {
  _id: string;
  userId: string;
  token: string; // JWT token
  expiresAt: Date;
  createdAt: Date;
}
```

## User Interactions and Workflows

### Primary Authentication Flow

#### 1. Initial Login
1. User enters phone number in `login-form.tsx`
2. System validates South African phone number format
3. Automatic formatting to +27 international format
4. SMS OTP sent via Twilio integration

#### 2. OTP Verification
1. User enters 6-digit OTP code
2. `otp-screen.tsx` handles verification
3. JWT token generated with user claims
4. Session stored in HTTP-only cookie
5. Redirect to main application

#### 3. Session Management
1. JWT token validation on each request
2. Automatic token refresh before expiry
3. Secure logout with session cleanup

### User Isolation Implementation

#### Data Filtering Strategy
```javascript
// Middleware-based isolation (middleware.ts)
const userIsolation = (userPhone: string, userRole: string) => {
  const isPrivileged = ['admin', 'manager'].includes(userRole);

  return {
    clients: isPrivileged ? {} : { createdByPhone: userPhone },
    requests: isPrivileged ? {} : { createdByPhone: userPhone },
    deliveries: { salesperson: getUserIdByPhone(userPhone) },
    matches: { createdByPhone: userPhone }
  };
};
```

#### Cross-User AI Matching
- **Request Matching**: Searches across ALL active requests regardless of owner
- **Result Filtering**: Users only see matches for their own requests
- **Privacy Preservation**: Match explanations don't reveal other users' data

## Integration Points

### Authentication Middleware Integration
- **Request Processing**: All API routes validate authentication before processing
- **Header Injection**: User phone and name injected into request headers
- **Role-Based Access**: Different access levels for admin/manager/user roles

### Database-Level Isolation
- **Client Ownership**: `createdByPhone` field ensures data segregation
- **Request Ownership**: All requests tied to creator's phone number
- **Delivery Assignment**: Deliveries linked to specific salesperson user IDs
- **Match Visibility**: Users only see matches for their own requests

### Session Management Integration
- **JWT Token Strategy**: Stateless authentication with signed tokens
- **Secure Storage**: HTTP-only cookies prevent XSS attacks
- **Automatic Refresh**: Token refresh before expiry for seamless UX

## Business Logic and Validations

### Phone Number Validation
```javascript
// South African phone number validation and formatting
const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');

  // Remove leading 0 for +27 formatting
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Add +27 prefix if not present
  if (!cleaned.startsWith('27')) {
    cleaned = `27${cleaned}`;
  }

  return `+${cleaned}`;
};
```

### Role-Based Permissions
```typescript
const rolePermissions = {
  user: {
    canViewOwnData: true,
    canCreateClients: true,
    canManageRequests: true,
    canAccessDeliveries: true,
    canAccessAdmin: false
  },
  manager: {
    canViewOwnData: true,
    canCreateClients: true,
    canManageRequests: true,
    canAccessDeliveries: true,
    canAccessAdmin: true,
    canViewTeamData: false
  },
  admin: {
    canViewOwnData: true,
    canCreateClients: true,
    canManageRequests: true,
    canAccessDeliveries: true,
    canAccessAdmin: true,
    canViewTeamData: true,
    canManageUsers: true
  }
};
```

### Session Security
- **Token Expiration**: 7-day token lifetime with refresh capability
- **Secure Headers**: JWT tokens signed with strong secret
- **IP Tracking**: Optional IP-based session validation
- **Concurrent Session Management**: Support for multiple active sessions

## Edge Cases and Error Handling

### Authentication Failures
- **Invalid Phone Numbers**: Clear error messages for malformed numbers
- **OTP Timeouts**: Graceful handling of expired verification codes
- **Network Issues**: Retry logic for SMS delivery failures
- **Rate Limiting**: Prevention of OTP spam attacks

### Session Management Issues
- **Token Corruption**: Automatic session cleanup and re-authentication
- **Concurrent Access**: Proper handling of multiple browser tabs
- **Logout Edge Cases**: Cleanup of local storage and active requests

### Data Consistency Issues
- **Orphaned Records**: Cleanup processes for users who no longer exist
- **Permission Changes**: Real-time permission updates across active sessions
- **Cross-User Data Leaks**: Comprehensive filtering prevents data exposure

## Advanced Features

### Multi-Factor Authentication
- **SMS OTP**: Primary authentication method
- **Backup Codes**: Offline authentication capability
- **Session Management**: Multiple active session support

### Advanced User Management
- **Profile Management**: User name and preference updates
- **Matching Preferences**: Granular control over AI matching participation
- **Notification Settings**: Customizable notification preferences

### Audit and Compliance
- **Authentication Logging**: All login/logout events tracked
- **Data Access Logging**: Sensitive operation audit trails
- **Compliance Reporting**: User activity and data access reports

## File References

### Core Implementation Files
- **API Routes**:
  - `app/api/auth/send/` - SMS OTP sending
  - `app/api/auth/verify/` - OTP verification and session creation
  - `app/api/users/` - User management endpoints

- **Components**:
  - `app/components/login-form.tsx` - Phone number input
  - `app/components/login-screen.tsx` - Authentication flow management
  - `app/components/otp-screen.tsx` - OTP verification interface
  - `app/components/header-bar.tsx` - User session display

- **Models**:
  - `models/User.ts` - User account schema
  - `models/Session.ts` - Session management schema

- **Utilities**:
  - `lib/auth-session.ts` - Authentication and session utilities
  - `lib/user-isolation.ts` - Data filtering and access control
  - `middleware.ts` - Authentication middleware

### External Integrations
- **Twilio API**: SMS delivery for OTP verification
- **JWT Library**: Token generation and validation (`jose` package)
- **Phone Number Parsing**: International phone number formatting (`libphonenumber-js`)

### Security Infrastructure
- **HTTPS Enforcement**: All authentication over secure connections
- **CSRF Protection**: Token-based request validation
- **Secure Headers**: Security headers for session protection
- **Rate Limiting**: API rate limiting to prevent abuse
