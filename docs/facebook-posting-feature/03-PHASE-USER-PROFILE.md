# Phase 3: User Profile Enhancements

**Phase:** 3 of 8  
**Duration:** 1-2 days  
**Dependencies:** Phase 2 (OAuth)  
**Status:** Ready

---

## Overview

Extend User Profile page to include Facebook connection management and contact information for post generation.

---

## UI Components

### 1. Facebook Connection Section

**Location:** `app/profile/page.tsx`

**Component Structure:**
```typescript
// New section in profile page
<Card className="mt-6">
  <CardHeader>
    <CardTitle>Facebook Connection</CardTitle>
    <CardDescription>
      Connect your Facebook account to post cars directly to your timeline or business page
    </CardDescription>
  </CardHeader>
  <CardContent>
    {!user.facebookConnected ? (
      <Button onClick={handleConnectFacebook}>
        <Facebook className="mr-2 h-4 w-4" />
        Connect Facebook
      </Button>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Connected</p>
            <p className="text-sm text-muted-foreground">
              {user.facebookAccountType === 'business_page' ? 'Business Page' : 'Personal Profile'}
            </p>
          </div>
          <Button variant="destructive" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
        
        {user.facebookAccountType === 'business_page' && (
          <p className="text-sm">Page: {user.facebookPageName}</p>
        )}
      </div>
    )}
  </CardContent>
</Card>
```

---

### 2. Contact Information Section

**Fields:**
```typescript
interface ContactFields {
  whatsappNumber: string;  // E.164 format
  location: string;        // "George, Western Cape"
  businessName: string;    // "Frederik Brand @ Halfway Toyota George"
}
```

**Form Implementation:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Contact Information</CardTitle>
    <CardDescription>
      These details will appear in your Facebook posts
    </CardDescription>
  </CardHeader>
  <CardContent>
    <form onSubmit={handleSaveContact}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="businessName">Business Name</Label>
          <Input
            id="businessName"
            placeholder="Frederik Brand @ Halfway Toyota George"
            value={contactInfo.businessName}
            onChange={(e) => setContactInfo({...contactInfo, businessName: e.target.value})}
            maxLength={100}
          />
        </div>
        
        <div>
          <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
          <Input
            id="whatsappNumber"
            type="tel"
            placeholder="+27824544656"
            value={contactInfo.whatsappNumber}
            onChange={(e) => setContactInfo({...contactInfo, whatsappNumber: e.target.value})}
          />
          <p className="text-sm text-muted-foreground mt-1">
            Format: +27XXXXXXXXX (include country code)
          </p>
        </div>
        
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="George, Western Cape"
            value={contactInfo.location}
            onChange={(e) => setContactInfo({...contactInfo, location: e.target.value})}
            maxLength={200}
          />
        </div>
        
        <Button type="submit">Save Contact Information</Button>
      </div>
    </form>
  </CardContent>
</Card>
```

---

### 3. Posting Preferences

**Fields:**
```typescript
<Card className="mt-6">
  <CardHeader>
    <CardTitle>Posting Preferences</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="autoHashtags">Auto-generate Hashtags</Label>
        <Switch
          id="autoHashtags"
          checked={preferences.autoHashtags}
          onCheckedChange={(checked) => setPreferences({...preferences, autoHashtags: checked})}
        />
      </div>
      
      <div>
        <Label htmlFor="postingCooldown">Cooldown Between Posts (minutes)</Label>
        <Input
          id="postingCooldown"
          type="number"
          min="1"
          max="60"
          value={preferences.postingCooldown}
          onChange={(e) => setPreferences({...preferences, postingCooldown: parseInt(e.target.value)})}
        />
      </div>
    </div>
  </CardContent>
</Card>
```

---

## API Endpoints

### Update Contact Info

**Endpoint:** `PATCH /api/profile/contact`

**Request:**
```typescript
{
  whatsappNumber?: string,
  location?: string,
  businessName?: string
}
```

**Response:**
```typescript
{
  success: true,
  user: { /* updated user object */ }
}
```

---

### Update Preferences

**Endpoint:** `PATCH /api/profile/preferences`

**Request:**
```typescript
{
  autoHashtags?: boolean,
  postingCooldown?: number
}
```

---

## Validation

**Phone Number:**
```typescript
const validateWhatsAppNumber = (phone: string): boolean => {
  return /^\+\d{10,15}$/.test(phone);
};
```

**Business Name:**
- Max 100 characters
- Allow alphanumeric, spaces, @, -

**Location:**
- Max 200 characters
- Free text

---

## Testing

**File:** `__tests__/profile/facebook-section.test.tsx`

- Test connect/disconnect flow
- Test contact form validation
- Test preference toggles
- Test API error handling

**Coverage Target:** 85%+

---

**Next Phase:** Phase 4 (Gemini AI Integration)
