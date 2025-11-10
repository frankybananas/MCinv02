# Car-Client Linking Integration Test Plan

## Test Scenarios

### 1. Reserve Car with Client Linking
**Steps:**
1. User selects a car with status 'in-stock'
2. User changes status to 'reserved'
3. System prompts for client selection
4. User selects an existing client
5. System links car to client

**Expected Results:**
- Car `owner` field is set to client ID
- Client `cars` array includes the car ID
- Delivery record is created with car, salesperson, and client
- Car status is 'reserved'

### 2. View Client with Associated Cars
**Steps:**
1. User navigates to client detail page
2. System fetches client data with populated cars

**Expected Results:**
- Only cars with status 'reserved' are shown in "Associated Cars"
- Cars from both `client.cars` array and delivery records are merged
- No duplicate cars are shown

### 3. Unreserve Car
**Steps:**
1. User changes car status from 'reserved' to 'in-stock'

**Expected Results:**
- Car `owner` field is set to undefined
- Car ID is removed from client's `cars` array
- Delivery records for the car are deleted

### 4. User Isolation
**Steps:**
1. Regular user attempts to link car to client they don't own

**Expected Results:**
- Linking is rejected
- Car `owner` remains null
- Client `cars` array is not updated

### 5. Admin Override
**Steps:**
1. Admin user links car to any client

**Expected Results:**
- Linking succeeds regardless of client ownership
- Car and client are properly linked

## Manual Testing Checklist

- [ ] Reserve car and link to client
- [ ] View client detail page - verify car appears
- [ ] Refresh page - verify car still appears
- [ ] Change car status back to in-stock
- [ ] View client detail - verify car no longer appears
- [ ] Test with multiple cars per client
- [ ] Test user isolation (non-admin linking to other user's client)
- [ ] Test admin can link to any client
