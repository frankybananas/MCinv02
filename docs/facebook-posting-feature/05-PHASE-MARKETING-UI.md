# Phase 5: Marketing Page UI Updates

**Phase:** 5 of 8  
**Duration:** 1-2 days  
**Dependencies:** Phase 2, 3  
**Status:** Ready

---

## Overview

Add "FBPage" button to Marketing page with proper styling, spacing, and connection status validation.

---

## UI Changes

### Button Layout

**Current Layout:**
```
┌─────────────────────────────────────┐
│  Select All    [Generate]           │
└─────────────────────────────────────┘
```

**New Layout:**
```
┌──────────────────────────────────────────────┐
│  Select All    [Generate]  [FBPage]          │
└──────────────────────────────────────────────┘
```

**Implementation:**
```typescript
// app/components/marketing.tsx

// Add state for FB connection status
const [isFacebookConnected, setIsFacebookConnected] = useState(false);
const [isPosting, setIsPosting] = useState(false);

// Check FB connection on mount
useEffect(() => {
  const checkFacebookConnection = async () => {
    try {
      const res = await fetch('/api/facebook/auth/status');
      const data = await res.json();
      setIsFacebookConnected(data.connected);
    } catch (error) {
      console.error('Failed to check FB status:', error);
    }
  };
  
  checkFacebookConnection();
}, []);

// In the render
<div className="flex items-center gap-4">
  <Button
    variant="outline"
    size="sm"
    onClick={handleSelectAll}
  >
    <CheckSquare className="mr-2 h-4 w-4" />
    Select All
  </Button>
  
  <Button
    size="sm"
    onClick={handleGenerate}
    disabled={selectedCars.length === 0 || isGenerating}
    className="bg-green-600 hover:bg-green-700"
  >
    <MessageSquare className="mr-2 h-4 w-4" />
    {isGenerating ? 'Generating...' : 'Generate'}
  </Button>
  
  <Button
    size="sm"
    onClick={handleFacebookPost}
    disabled={selectedCars.length === 0 || !isFacebookConnected || isPosting}
    className="bg-blue-600 hover:bg-blue-700"
    title={!isFacebookConnected ? 'Connect Facebook in Profile' : 'Post to Facebook'}
  >
    <Facebook className="mr-2 h-4 w-4" />
    {isPosting ? 'Posting...' : 'FBPage'}
  </Button>
  
  {!isFacebookConnected && (
    <p className="text-sm text-muted-foreground">
      <Link href="/profile" className="text-blue-600 hover:underline">
        Connect Facebook
      </Link> to enable posting
    </p>
  )}
</div>
```

---

### Connection Status Check Endpoint

**Endpoint:** `GET /api/facebook/auth/status`

**Response:**
```typescript
{
  connected: boolean,
  accountType?: 'personal' | 'business_page',
  pageName?: string,
  expiresAt?: string
}
```

**Implementation:**
```typescript
// app/api/facebook/auth/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { connectDB } from '@/lib/mongodb';
import FacebookAuth from '@/models/FacebookAuth';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.userId) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  await connectDB();
  
  const auth = await FacebookAuth.findOne({ 
    userId: session.userId, 
    isActive: true,
    expiresAt: { $gt: new Date() }  // Not expired
  });
  
  if (!auth) {
    return NextResponse.json({ connected: false });
  }
  
  return NextResponse.json({
    connected: true,
    accountType: auth.accountType,
    pageName: auth.facebookPageName,
    expiresAt: auth.expiresAt.toISOString()
  });
}
```

---

### Facebook Icon Import

Add to imports:
```typescript
import { Facebook } from 'lucide-react';
```

---

### Button Click Handler

```typescript
const handleFacebookPost = async () => {
  if (selectedCars.length === 0) {
    toast.error('Please select at least one car');
    return;
  }
  
  if (!isFacebookConnected) {
    toast.error('Please connect your Facebook account first');
    return;
  }
  
  // Confirm action
  const confirmed = window.confirm(
    `Post ${selectedCars.length} car(s) to Facebook? This will create ${selectedCars.length} separate posts.`
  );
  
  if (!confirmed) return;
  
  setIsPosting(true);
  
  try {
    const res = await fetch('/api/facebook/post/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carIds: selectedCars,
        scheduledFor: null  // Immediate posting
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Failed to queue posts');
    }
    
    toast.success(`${data.queued} post(s) queued successfully! Check history for status.`);
    setSelectedCars([]);  // Clear selection
    
  } catch (error) {
    console.error('Facebook posting error:', error);
    toast.error(error.message || 'Failed to queue posts');
  } finally {
    setIsPosting(false);
  }
};
```

---

## Styling

### Button Consistency

All buttons should match existing style:
- **Height:** `h-10` (40px)
- **Padding:** `px-4`
- **Gap:** `gap-4` between buttons
- **Border radius:** `rounded-md`
- **Font:** `text-sm font-medium`

### Color Scheme

- **Generate button:** Green (`bg-green-600`)
- **FBPage button:** Facebook blue (`bg-blue-600`)
- **Disabled state:** Opacity 50% with cursor-not-allowed

---

## Car Filtering

### Auto-exclude "Do Not Advertise" Cars

```typescript
// Filter cars before allowing selection
const availableCars = cars.filter(car => !car.doNotAdvertise && car.status !== 'sold');

// In UI, show badge on DNA cars
{car.doNotAdvertise && (
  <span className="absolute top-2 left-2 bg-white text-black px-2 py-1 text-xs font-bold shadow-lg rounded">
    DNA
  </span>
)}
```

---

## Error States

### No Facebook Connection

```typescript
if (!isFacebookConnected) {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Facebook Not Connected</AlertTitle>
      <AlertDescription>
        Please <Link href="/profile" className="underline">connect your Facebook account</Link> 
        to use this feature.
      </AlertDescription>
    </Alert>
  );
}
```

### Token Expired

```typescript
if (data.error === 'TOKEN_EXPIRED') {
  toast.error('Your Facebook connection has expired. Please reconnect in Profile.');
}
```

---

## Mobile Responsiveness

```typescript
// Stack buttons vertically on mobile
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
  <Button className="w-full sm:w-auto" {...props}>Select All</Button>
  <Button className="w-full sm:w-auto" {...props}>Generate</Button>
  <Button className="w-full sm:w-auto" {...props}>FBPage</Button>
</div>
```

---

## Testing

**File:** `__tests__/components/marketing-fbpage.test.tsx`

```typescript
describe('Marketing Page - Facebook Button', () => {
  test('should render FBPage button', () => {
    render(<MarketingPage />);
    expect(screen.getByText('FBPage')).toBeInTheDocument();
  });
  
  test('should disable button when no cars selected', () => {
    render(<MarketingPage />);
    const button = screen.getByText('FBPage');
    expect(button).toBeDisabled();
  });
  
  test('should disable button when Facebook not connected', async () => {
    // Mock disconnected state
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ connected: false })
      })
    );
    
    render(<MarketingPage />);
    await waitFor(() => {
      const button = screen.getByText('FBPage');
      expect(button).toBeDisabled();
    });
  });
  
  test('should show confirmation dialog before posting', async () => {
    window.confirm = jest.fn(() => true);
    
    const { user } = renderWithUser(<MarketingPage />);
    
    const checkbox = screen.getAllByRole('checkbox')[0];
    await user.click(checkbox);
    
    const fbButton = screen.getByText('FBPage');
    await user.click(fbButton);
    
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Post 1 car'));
  });
});
```

**Coverage:** 85%+

---

## Acceptance Criteria

- ✅ FBPage button visible on Marketing page
- ✅ Button disabled when no FB connection
- ✅ Button disabled when no cars selected
- ✅ Button matches styling of Generate button
- ✅ Proper spacing and layout
- ✅ Mobile responsive
- ✅ Shows connection status hint
- ✅ Confirmation dialog before posting
- ✅ DNA cars auto-excluded

---

**Next Phase:** Phase 6 (Facebook Posting Engine)
