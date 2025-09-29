# WhatsApp Car Sharing - Test Checklist

**Feature**: Enhanced WhatsApp Car Sharing  
**Version**: Current Implementation  
**Test Date**: _____________  
**Tester**: _____________

---

## Pre-Test Setup

- [ ] Development environment running: `pnpm dev`
- [ ] Test devices available:
  - [ ] iOS device (Safari)
  - [ ] Android device (Chrome)
  - [ ] Desktop browser (fallback testing)
- [ ] Test car data prepared (see Test Data section)
- [ ] WhatsApp installed on test devices

---

## Test Case 1: Image Compression Verification ⚠️ HIGH PRIORITY

**Objective**: Verify images are compressed to correct dimensions and file sizes

### Steps:
1. [ ] Navigate to Add Car page
2. [ ] Upload test image: `test-image-4000x3000.jpg` (original ~5MB)
3. [ ] Wait for upload to complete
4. [ ] Open browser DevTools → Network tab
5. [ ] Find uploaded image request (R2 URL)
6. [ ] Copy image URL
7. [ ] Download image in new tab
8. [ ] Check image properties

### Expected Results:
- [ ] **Dimensions**: Longest side = 1080px (current implementation)
- [ ] **File Size**: ~300-800KB (estimated)
- [ ] **Format**: WebP (if supported) or JPEG

### Actual Results:
- Dimensions: __________ x __________
- File Size: __________
- Format: __________

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

### Notes:
```


```

---

## Test Case 2: Multi-Image Share with VIN Exclusion

**Objective**: Verify VIN image (last in array) is excluded from share

### Test Data:
- Car with 5 images
- Last image is VIN photo
- Expected shareable images: 4

### Steps:
1. [ ] Open car detail page (car with 5 images)
2. [ ] Click SHARE button
3. [ ] Select WhatsApp from share sheet (iOS/Android)
4. [ ] Count images attached to WhatsApp message

### Expected Results:
- [ ] Only first 4 images appear in WhatsApp
- [ ] VIN image (5th image) is NOT included
- [ ] Share text includes car details and dealer info

### Actual Results:
- Images shared: __________
- VIN excluded: ☐ YES | ☐ NO

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

### Notes:
```


```

---

## Test Case 3: Web Share API (Mobile - iOS)

**Objective**: Test native share functionality on iOS Safari

### Device: iPhone (iOS Safari)
### Network: ☐ WiFi | ☐ 4G | ☐ 5G

### Steps:
1. [ ] Open car detail page on iOS device
2. [ ] Click SHARE button
3. [ ] Start timer
4. [ ] Wait for native share sheet to appear
5. [ ] Stop timer
6. [ ] Select WhatsApp
7. [ ] Verify message in WhatsApp

### Expected Results:
- [ ] Native iOS share sheet appears
- [ ] WhatsApp option available
- [ ] All non-VIN images attached
- [ ] Share text properly formatted with emoji
- [ ] Dealer contact info included

### Performance:
- Time to share sheet: __________ seconds
- Time to WhatsApp: __________ seconds (total)
- Images: __________ files

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

### Notes:
```


```

---

## Test Case 4: Web Share API (Mobile - Android)

**Objective**: Test native share functionality on Android Chrome

### Device: Android (Chrome)
### Network: ☐ WiFi | ☐ 4G | ☐ 5G

### Steps:
1. [ ] Open car detail page on Android device
2. [ ] Click SHARE button
3. [ ] Start timer
4. [ ] Wait for native share sheet
5. [ ] Stop timer
6. [ ] Select WhatsApp
7. [ ] Verify message in WhatsApp

### Expected Results:
- [ ] Native Android share sheet appears
- [ ] WhatsApp option available
- [ ] All non-VIN images attached
- [ ] Share text properly formatted
- [ ] Dealer contact info included

### Performance:
- Time to share sheet: __________ seconds
- Time to WhatsApp: __________ seconds (total)
- Images: __________ files

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

### Notes:
```


```

---

## Test Case 5: Batch Sharing (>10 Images)

**Objective**: Verify batched sharing for cars with many images

### Test Data:
- Car with 25 images (24 shareable after VIN exclusion)
- Expected: 3 share dialogs (10 + 10 + 4 images)

### Steps:
1. [ ] Open car detail page (car with 25 images)
2. [ ] Click SHARE button
3. [ ] Count share dialogs/prompts
4. [ ] Share each batch to WhatsApp
5. [ ] Verify in WhatsApp

### Expected Results:
- [ ] First batch: 10 images + text
- [ ] Second batch: 10 images (no text)
- [ ] Third batch: 4 images (no text)
- [ ] Total: 24 images in WhatsApp conversation

### Actual Results:
- Number of share prompts: __________
- Batch 1: __________ images
- Batch 2: __________ images
- Batch 3: __________ images
- Total images: __________

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

### Notes:
```


```

---

## Test Case 6: WhatsApp URL Fallback (Desktop)

**Objective**: Test fallback behavior when Web Share API unavailable

### Device: Desktop browser (Chrome/Firefox/Safari)

### Steps:
1. [ ] Open car detail page on desktop
2. [ ] Click SHARE button
3. [ ] Verify WhatsApp opens in new tab/window
4. [ ] Check message format in WhatsApp Web

### Expected Results:
- [ ] WhatsApp URL opens: `https://wa.me/?text=...`
- [ ] Message text pre-filled with car details
- [ ] Up to 3 image URLs embedded as clickable links
- [ ] Dealer contact info in message
- [ ] Links are clickable

### Actual Results:
- WhatsApp opened: ☐ YES | ☐ NO
- Text pre-filled: ☐ YES | ☐ NO
- Image URLs count: __________

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

### Notes:
```


```

---

## Test Case 7: Single Image Car

**Objective**: Verify single-image cars share correctly

### Test Data:
- Car with only 1 image (not VIN image)

### Steps:
1. [ ] Open car detail page (car with 1 image)
2. [ ] Click SHARE button
3. [ ] Share to WhatsApp

### Expected Results:
- [ ] Single image included in share
- [ ] Car details included
- [ ] Dealer info included

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

---

## Test Case 8: No Images Car

**Objective**: Verify cars with no images share text-only

### Test Data:
- Car with 0 images

### Steps:
1. [ ] Open car detail page (car with no images)
2. [ ] Click SHARE button
3. [ ] Share to WhatsApp

### Expected Results:
- [ ] Text-only message shared
- [ ] No "Sample Photos" section
- [ ] Car details included
- [ ] Dealer info included

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

---

## Test Case 9: Message Formatting Verification

**Objective**: Verify WhatsApp message displays correctly formatted

### Steps:
1. [ ] Share any car to WhatsApp
2. [ ] Review message in WhatsApp

### Expected Format:
```
🚗 2024 Toyota Corolla Cross XR

💰 Price: R 429,000
📊 Kilometers: 17,800 km
🎨 Color: White
⚙️ Transmission: Automatic

[description if present]

Sample Photos:
1. [link]
2. [link]
3. [link]

—
Your Sales Contact:
Name: Admin User
Mobile: +27720560090
Email: admin@example.com
```

### Checklist:
- [ ] Emoji icons display correctly (🚗 💰 📊 🎨 ⚙️)
- [ ] Line breaks preserved
- [ ] Price formatted with R symbol
- [ ] Kilometers formatted with thousands separator
- [ ] Em dash (—) separator before contact section
- [ ] Contact section complete

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

### Screenshot:
☐ Attached

---

## Test Case 10: Dealer Info Fetching

**Objective**: Verify dealer contact information is automatically included

### Steps:
1. [ ] Log in as test user with complete profile
2. [ ] Verify profile has: firstName, lastName, phone, email
3. [ ] Share any car
4. [ ] Check dealer info section in message

### Expected Results:
- [ ] Name: `[firstName] [lastName]`
- [ ] Mobile: `[phone]`
- [ ] Email: `[email]`

### Actual Results:
- Name: __________________
- Mobile: __________________
- Email: __________________

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

---

## Test Case 11: Missing Dealer Info (Graceful Degradation)

**Objective**: Verify share works when dealer profile incomplete

### Steps:
1. [ ] Log in as user with incomplete profile (missing email)
2. [ ] Share any car
3. [ ] Check dealer section

### Expected Results:
- [ ] Name: Displayed
- [ ] Mobile: Displayed
- [ ] Email: Not shown (no "Email:" line)
- [ ] Share completes successfully

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

---

## Test Case 12: Image Download Failure Handling

**Objective**: Verify resilience when some images fail to download

### Setup (DevTools):
1. [ ] Open DevTools → Network tab
2. [ ] Add network blocking rule for one image URL
3. [ ] Click SHARE button

### Expected Results:
- [ ] Share proceeds with available images
- [ ] No error message displayed
- [ ] Failed image is skipped (Promise.allSettled)
- [ ] Successful images are shared

### Status: ☐ PASS | ☐ FAIL | ☐ BLOCKED

---

## Performance Testing

### Test Environment:
- Device: __________________
- Network: ☐ WiFi | ☐ 4G | ☐ 3G | ☐ 5G
- Car images: __________ total

### Measurements:
| Action | Time (seconds) | Notes |
|--------|----------------|-------|
| Click SHARE to share sheet | | |
| Image download (all) | | |
| Share sheet to WhatsApp | | |
| **Total time** | | |

### Acceptance Criteria:
- [ ] Total time < 5 seconds for 10 images on 4G

---

## Security & Privacy Verification

### VIN Protection:
- [ ] VIN image never appears in any shared message
- [ ] Tested with multiple cars (≥3 different cars)
- [ ] Verified on both mobile and desktop

### Data Privacy:
- [ ] No client personal information shared (only car details)
- [ ] Dealer info is logged-in user's own info
- [ ] Image URLs are public (expected for sharing)

---

## Cross-Browser Compatibility

| Browser | Version | SHARE Button | Web Share API | WhatsApp Fallback | Status |
|---------|---------|--------------|---------------|-------------------|--------|
| iOS Safari | | ☐ | ☐ | ☐ | ☐ PASS ☐ FAIL |
| Android Chrome | | ☐ | ☐ | ☐ | ☐ PASS ☐ FAIL |
| Desktop Chrome | | ☐ | N/A | ☐ | ☐ PASS ☐ FAIL |
| Desktop Safari | | ☐ | N/A | ☐ | ☐ PASS ☐ FAIL |
| Desktop Firefox | | ☐ | N/A | ☐ | ☐ PASS ☐ FAIL |

---

## Test Data Requirements

### Test Cars to Create:

**Car A: Standard Multi-Image**
- Make: Toyota
- Model: Corolla Cross XR
- Year: 2024
- Price: R 429,000
- Kilometers: 17,800
- Color: White
- Transmission: Automatic
- Images: 5 photos (last one is VIN)

**Car B: Many Images**
- Any details
- Images: 25 photos (for batch testing)

**Car C: Single Image**
- Any details
- Images: 1 photo (not VIN)

**Car D: No Images**
- Any details
- Images: 0 photos

**Car E: VIN Only**
- Any details
- Images: 1 photo (marked as VIN or last position)

---

## Issues Log

### Issue #1
- **Severity**: ☐ Critical | ☐ High | ☐ Medium | ☐ Low
- **Test Case**: __________
- **Description**: 
- **Steps to Reproduce**:
- **Expected**: 
- **Actual**:
- **Screenshot**: ☐ Attached

### Issue #2
- **Severity**: ☐ Critical | ☐ High | ☐ Medium | ☐ Low
- **Test Case**: __________
- **Description**:
- **Steps to Reproduce**:
- **Expected**:
- **Actual**:
- **Screenshot**: ☐ Attached

---

## Test Summary

**Total Test Cases**: 12  
**Passed**: __________  
**Failed**: __________  
**Blocked**: __________

**Critical Issues**: __________  
**High Priority Issues**: __________

**Overall Status**: ☐ PASS | ☐ FAIL | ☐ NEEDS REWORK

**Recommendation**: ☐ READY FOR PRODUCTION | ☐ REQUIRES FIXES | ☐ REQUIRES DISCUSSION

---

## Sign-Off

**Tester**: __________________ Date: __________  
**Reviewed By**: __________________ Date: __________  
**Approved By**: __________________ Date: __________

---

## Notes & Observations

```




```
