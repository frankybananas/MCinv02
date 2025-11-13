# API Endpoints Specification

## Overview
All API endpoints require authentication and enforce multi-tenant isolation via userId filtering.

**Base URL**: `/api`  
**Authentication**: Session-based (existing system)  
**Content-Type**: `application/json`

---

## Client Management APIs

### POST /api/clients
Create a new client with optional vehicle preferences.

**Request**:
```json
{
  "clientName": "John Doe",
  "contactInfo": {
    "email": "john@example.com",
    "phone": "+27123456789",
    "preferredContact": "email"
  },
  "lookingFor": {
    "rawText": "White/silver only Toyota Cross 2020+ under R480k"
  }
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "clientName": "John Doe",
    "contactInfo": { /* ... */ },
    "lookingFor": {
      "rawText": "White/silver only Toyota Cross 2020+ under R480k",
      "parsedCriteria": null,
      "lastUpdated": "2024-01-15T10:30:00Z"
    },
    "matchCount": 0,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Side Effects**: Queues `parse-client-request` job if `lookingFor.rawText` provided.

---

### PUT /api/clients/[id]
Update client details. If `lookingFor.rawText` changed, triggers re-parsing and re-matching.

**Request**:
```json
{
  "lookingFor": {
    "rawText": "Updated preferences text"
  }
}
```

**Response (200)**: Updated client object

**Side Effects**:
- Invalidates old matches if preferences significantly changed
- Queues `parse-client-request` → `match-client-to-inventory`

---

### GET /api/clients/[id]/matches
Get all matches for a specific client.

**Query Params**:
- `quality`: Filter by match quality (Excellent, Good, Fair)
- `dismissed`: Include dismissed matches (default: false)
- `limit`: Results per page (default: 20)
- `offset`: Pagination offset

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "_id": "...",
        "matchScore": 87,
        "matchQuality": "Excellent",
        "matchDetails": {
          "vehicleSummary": "2021 Toyota Corolla Cross - White - R450,000",
          "vehicleImage": "https://r2.../image.jpg"
        },
        "inventoryId": "...",
        "createdAt": "..."
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

---

## Inventory Management APIs

### POST /api/inventory
Create new vehicle. Triggers matching against all client requests.

**Request**:
```json
{
  "make": "Toyota",
  "model": "Corolla Cross",
  "year": 2021,
  "color": "White",
  "price": 450000,
  "mileage": 35000,
  "transmission": "Automatic",
  "fuelType": "Petrol",
  "status": "In-Stock"
}
```

**Response (201)**: Created inventory object

**Side Effects**: Queues `match-inventory-to-clients` job

---

### PUT /api/inventory/[id]
Update vehicle. If key fields changed (price, status, color, etc.), triggers re-matching.

**Trigger Fields**: `price`, `status`, `color`, `year`, `mileage`, `transmission`, `fuelType`

**Side Effects**: Queues `match-inventory-to-clients` if trigger fields modified

---

## Matching APIs

### GET /api/matches
List all matches for authenticated user.

**Query Params**:
- `clientId`: Filter by client
- `inventoryId`: Filter by vehicle
- `quality`: Excellent, Good, Fair
- `dismissed`: Include dismissed (default: false)
- `sort`: `score` (default) or `date`
- `limit`: 20 (default), max 50
- `offset`: Pagination

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "matches": [ /* array of match objects */ ],
    "pagination": { /* ... */ }
  }
}
```

---

### GET /api/matches/[id]
Get detailed match information.

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "matchScore": 87,
    "matchQuality": "Excellent",
    "matchBreakdown": {
      "makeMatch": 25,
      "modelMatch": 25,
      "yearMatch": 15,
      "priceMatch": 15,
      "colorMatch": 10,
      "otherMatch": -3
    },
    "matchReason": "Perfect match! All criteria met except mileage slightly higher.",
    "matchDetails": {
      "clientName": "John Doe",
      "clientPreferences": "White/silver only Toyota Cross 2020+ under R480k",
      "vehicleSummary": "2021 Toyota Corolla Cross - White - R450,000",
      "vehicleImage": "https://..."
    },
    "inventoryCurrentStatus": "In-Stock",
    "notificationSent": true,
    "dismissed": false,
    "createdAt": "..."
  }
}
```

---

### PUT /api/matches/[id]/dismiss
Dismiss a match (remove from active view).

**Request**:
```json
{
  "reason": "Client no longer interested"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "dismissed": true,
    "dismissedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

## Notification APIs

### GET /api/notifications
List notifications for authenticated user.

**Query Params**:
- `read`: Filter by read status (true/false)
- `type`: Filter by type (client_match)
- `quality`: Match quality filter
- `limit`: 20 (default)
- `offset`: Pagination

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "...",
        "type": "client_match",
        "title": "New Excellent Match Found for John Doe",
        "message": "We found a 87% match...",
        "data": {
          "matchId": "...",
          "clientName": "John Doe",
          "vehicleSummary": "2021 Toyota Corolla Cross - White - R450,000",
          "vehicleImage": "https://...",
          "matchScore": 87,
          "matchQuality": "Excellent"
        },
        "read": false,
        "createdAt": "2024-01-15T10:35:00Z"
      }
    ],
    "unreadCount": 3,
    "pagination": { /* ... */ }
  }
}
```

---

### PUT /api/notifications/[id]/read
Mark notification as read.

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "read": true,
    "readAt": "2024-01-15T11:05:00Z"
  }
}
```

---

### PUT /api/notifications/bulk-read
Mark multiple notifications as read.

**Request**:
```json
{
  "notificationIds": ["id1", "id2", "id3"]
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "updated": 3
  }
}
```

---

### PUT /api/notifications/[id]/dismiss
Dismiss notification (also dismisses associated match).

**Response (200)**: Dismissed notification object

---

## Admin/Config APIs

### GET /api/admin/matching-config
Get matching system configuration (admin only).

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "matching": {
      "scoreThreshold": 70,
      "fairMatchThreshold": 55,
      "maxMatchesPerClient": 50
    },
    "notifications": {
      "maxPerUserPerHour": 10,
      "maxEmailsPerUserPerDay": 5,
      "batchWindowMinutes": 5
    },
    "ai": {
      "confidenceThreshold": 0.6,
      "maxRetries": 3,
      "timeoutSeconds": 10
    }
  }
}
```

---

### PUT /api/admin/matching-config
Update configuration (admin only).

**Request**: Partial config object

---

### GET /api/admin/stats
Get system statistics (admin only).

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "totalMatches": 1523,
    "matchesLast24h": 45,
    "avgMatchScore": 78.5,
    "aiParsingSuccessRate": 0.89,
    "notificationsSent": 1203,
    "emailsSent": 987,
    "activeClientRequests": 234,
    "queueStatus": {
      "waiting": 5,
      "active": 2,
      "completed": 1523,
      "failed": 12
    }
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "lookingFor.rawText",
      "constraint": "maxLength",
      "value": 1000
    }
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 60
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req_abc123"
  }
}
```

---

## Rate Limiting

- **Standard endpoints**: 100 requests/minute per user
- **Matching endpoints**: 20 requests/minute per user
- **Admin endpoints**: 50 requests/minute
- **Burst**: 2x limit for 10 seconds

---

## Webhooks (Future Enhancement)

### POST /api/webhooks/match-created
Notify external systems when match is created.

**Payload**:
```json
{
  "event": "match.created",
  "timestamp": "2024-01-15T10:35:00Z",
  "data": {
    "matchId": "...",
    "userId": "...",
    "matchScore": 87,
    "matchQuality": "Excellent"
  }
}
```

---

**Next Document**: [Security Architecture](./01-TECHNICAL-DESIGN-SECURITY.md)
