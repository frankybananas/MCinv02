# Appendices

## A. Pseudocode for Critical Functions

### A.1 AI Parsing Function

```typescript
async function parseClientPreferences(rawText: string): Promise<ParsedCriteria> {
  // Check cache first
  const cached = await getCachedParse(rawText);
  if (cached) return cached;
  
  // Build prompt with examples and context
  const prompt = buildGeminiPrompt(rawText);
  
  // Call Gemini AI with retry logic
  let attempts = 0;
  while (attempts < MAX_RETRIES) {
    try {
      const response = await geminiClient.generateContent({
        model: 'gemini-1.5-flash',
        prompt: prompt,
        temperature: 0.1,
        maxTokens: 2048,
        timeout: 10000
      });
      
      // Parse and validate JSON
      const parsed = JSON.parse(response.text);
      const validated = validateParsedOutput(parsed);
      
      // Cache result
      await cacheParse(rawText, validated);
      
      // Flag for review if low confidence
      if (validated.confidence < 0.6) {
        validated.requiresManualReview = true;
      }
      
      return validated;
      
    } catch (error) {
      attempts++;
      if (attempts >= MAX_RETRIES) {
        // Fallback: flag for manual review
        return {
          requiresManualReview: true,
          parsingConfidence: 0,
          ambiguities: ['AI parsing failed after retries'],
          ...extractKeywords(rawText) // Simple keyword extraction
        };
      }
      await sleep(Math.pow(2, attempts) * 1000); // Exponential backoff
    }
  }
}
```

### A.2 Scoring Algorithm

```typescript
function calculateMatchScore(inventory: Inventory, criteria: ParsedCriteria): ScoreResult {
  let score = 0;
  const breakdown = { makeMatch: 0, modelMatch: 0, yearMatch: 0, priceMatch: 0, colorMatch: 0, otherMatch: 0 };
  
  // MAKE (25 points max)
  if (exactMatch(inventory.make, criteria.makes)) {
    score += 25;
    breakdown.makeMatch = 25;
  } else if (fuzzyMatch(inventory.make, criteria.makes)) {
    score += 20;
    breakdown.makeMatch = 20;
  }
  
  // MODEL (25 points max)
  if (exactMatch(inventory.model, criteria.models)) {
    score += 25;
    breakdown.modelMatch = 25;
  } else if (fuzzyMatch(inventory.model, criteria.models)) {
    score += 20;
    breakdown.modelMatch = 20;
  } else if (familyMatch(inventory.model, criteria.models)) {
    score += 15;
    breakdown.modelMatch = 15;
  }
  
  // YEAR (15 points max)
  if (withinRange(inventory.year, criteria.yearMin, criteria.yearMax)) {
    score += 15;
    breakdown.yearMatch = 15;
  } else if (closeToRange(inventory.year, criteria.yearMin, criteria.yearMax, 1)) {
    score += 10;
    breakdown.yearMatch = 10;
  }
  
  // PRICE (15 points max) - CRITICAL
  if (criteria.priceMax && inventory.price > criteria.priceMax) {
    if (!criteria.priceFlexible) {
      return { score: 0, breakdown, disqualified: true, reason: 'Price over budget' };
    } else if (inventory.price > criteria.priceMax * 1.1) {
      return { score: 0, breakdown, disqualified: true, reason: 'Price significantly over budget' };
    } else {
      score += 8;
      breakdown.priceMatch = 8;
    }
  } else if (withinRange(inventory.price, criteria.priceMin, criteria.priceMax)) {
    score += 15;
    breakdown.priceMatch = 15;
  }
  
  // COLOR (10 points max)
  if (criteria.colors.preferred.length > 0) {
    if (exactMatch(inventory.color, criteria.colors.preferred)) {
      score += 10;
      breakdown.colorMatch = 10;
    } else if (similarColor(inventory.color, criteria.colors.preferred)) {
      score += 7;
      breakdown.colorMatch = 7;
    } else if (criteria.colors.exclusive) {
      return { score: 0, breakdown, disqualified: true, reason: 'Color not in exclusive list' };
    }
  }
  
  // OTHER (10 points max combined)
  if (criteria.transmission.length > 0 && criteria.transmission.includes(inventory.transmission)) {
    score += 5;
    breakdown.otherMatch += 5;
  }
  
  if (criteria.fuelType.length > 0) {
    if (criteria.fuelType.includes(inventory.fuelType)) {
      score += criteria.fuelTypePreferred ? 3 : 5;
      breakdown.otherMatch += criteria.fuelTypePreferred ? 3 : 5;
    } else if (!criteria.fuelTypePreferred) {
      score -= 5;
      breakdown.otherMatch -= 5;
    }
  }
  
  if (criteria.mileageMax && inventory.mileage) {
    if (inventory.mileage <= criteria.mileageMax) {
      score += 5;
      breakdown.otherMatch += 5;
    } else if (inventory.mileage > criteria.mileageMax * 1.2) {
      score -= 5;
      breakdown.otherMatch -= 5;
    }
  }
  
  const matchQuality = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : 'Poor';
  
  return { 
    score: Math.max(0, score), 
    breakdown, 
    disqualified: false,
    matchQuality,
    matchReason: generateMatchReason(breakdown, score)
  };
}
```

### A.3 Match Engine

```typescript
async function matchClientToInventory(clientId: string): Promise<Match[]> {
  // Get client with parsed criteria
  const client = await db.clients.findOne({ _id: clientId });
  if (!client.lookingFor?.parsedCriteria) {
    throw new Error('Client preferences not parsed yet');
  }
  
  const criteria = client.lookingFor.parsedCriteria;
  const userId = client.userId;
  
  // Query inventory (filtered by userId and status)
  const inventoryQuery = {
    userId: userId,
    status: { $in: ['In-Stock', 'Coming'] }
  };
  
  // Add criteria filters for efficiency
  if (criteria.makes.length > 0) {
    inventoryQuery['matchableFields.makeNormalized'] = { 
      $in: criteria.makes.map(m => m.toLowerCase()) 
    };
  }
  
  const inventoryItems = await db.cars.find(inventoryQuery).toArray();
  
  const matches = [];
  for (const inventory of inventoryItems) {
    // Calculate score
    const scoreResult = calculateMatchScore(inventory, criteria);
    
    // Only create match if score >= threshold
    if (scoreResult.score >= MATCH_THRESHOLD) {
      // Check for duplicate
      const existing = await db.matches.findOne({
        clientId: clientId,
        inventoryId: inventory._id
      });
      
      if (!existing) {
        // Create match document
        const match = await createMatch({
          userId: userId,
          clientId: clientId,
          inventoryId: inventory._id,
          matchScore: scoreResult.score,
          matchQuality: scoreResult.matchQuality,
          matchBreakdown: scoreResult.breakdown,
          matchReason: scoreResult.matchReason,
          matchDetails: {
            clientName: client.clientName,
            clientPreferences: client.lookingFor.rawText.substring(0, 200),
            vehicleSummary: `${inventory.year} ${inventory.make} ${inventory.model} - ${inventory.color} - R${inventory.price.toLocaleString()}`,
            vehicleImage: inventory.images[0]
          },
          inventoryStatusAtMatch: inventory.status,
          inventoryCurrentStatus: inventory.status
        });
        
        matches.push(match);
        
        // Queue notification job
        await jobQueue.add('create-notification', { matchId: match._id });
      }
    }
  }
  
  // Update client match count
  await db.clients.updateOne(
    { _id: clientId },
    { $set: { matchCount: matches.length } }
  );
  
  return matches;
}
```

---

## B. MongoDB Query Examples

### B.1 Find Matches with Aggregation

```javascript
db.matches.aggregate([
  // Stage 1: Filter by user
  { $match: { 
      userId: ObjectId("..."),
      dismissed: false 
  }},
  
  // Stage 2: Lookup client details
  { $lookup: {
      from: "clients",
      localField: "clientId",
      foreignField: "_id",
      as: "client"
  }},
  { $unwind: "$client" },
  
  // Stage 3: Lookup inventory details
  { $lookup: {
      from: "cars",
      localField: "inventoryId",
      foreignField: "_id",
      as: "inventory"
  }},
  { $unwind: "$inventory" },
  
  // Stage 4: Filter by match quality
  { $match: { matchQuality: "Excellent" } },
  
  // Stage 5: Sort by score
  { $sort: { matchScore: -1 } },
  
  // Stage 6: Paginate
  { $skip: 0 },
  { $limit: 20 },
  
  // Stage 7: Project fields
  { $project: {
      matchScore: 1,
      matchQuality: 1,
      matchReason: 1,
      "client.clientName": 1,
      "inventory.make": 1,
      "inventory.model": 1,
      "inventory.price": 1,
      createdAt: 1
  }}
])
```

---

## C. Email Templates

### C.1 Match Notification Email (HTML)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; }
    .match-card { background: white; border: 2px solid #4CAF50; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .vehicle-image { width: 100%; max-width: 400px; border-radius: 8px; margin: 15px 0; }
    .score-badge { display: inline-block; background: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
    .btn { display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
    .btn-secondary { background: #2196F3; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #ddd; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 New {{matchQuality}} Match Found!</h1>
    </div>
    
    <div class="content">
      <h2>{{clientName}} is looking for:</h2>
      <p style="font-style: italic; background: #fff; padding: 15px; border-left: 4px solid #4CAF50;">
        "{{clientPreferences}}"
      </p>
      
      <div class="match-card">
        <div style="text-align: center; margin-bottom: 15px;">
          <span class="score-badge">{{matchScore}}% Match</span>
        </div>
        
        <img src="{{vehicleImage}}" alt="Vehicle" class="vehicle-image">
        
        <h3>{{year}} {{make}} {{model}}</h3>
        <p><strong>Color:</strong> {{color}}</p>
        <p><strong>Price:</strong> R{{price}}</p>
        <p><strong>Mileage:</strong> {{mileage}} km</p>
        <p><strong>Transmission:</strong> {{transmission}}</p>
        
        <p style="background: #fffacd; padding: 10px; border-radius: 4px; margin-top: 15px;">
          <strong>Why this matches:</strong><br>
          {{matchReason}}
        </p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{appUrl}}/matches/{{matchId}}" class="btn">View Match Details</a>
        <a href="{{appUrl}}/clients/{{clientId}}" class="btn btn-secondary">View Client</a>
      </div>
    </div>
    
    <div class="footer">
      <p>You received this email because a new vehicle match was found in your MCinv02 inventory system.</p>
      <p><a href="{{appUrl}}/settings/notifications">Manage notification preferences</a></p>
      <p style="color: #999; margin-top: 15px;">MCinv02 Vehicle Matching System</p>
    </div>
  </div>
</body>
</html>
```

### C.2 Plain Text Version

```
New {{matchQuality}} Match Found!
================================

{{clientName}} is looking for:
"{{clientPreferences}}"

MATCH FOUND ({{matchScore}}% match):
-----------------------------------
{{year}} {{make}} {{model}}
Color: {{color}}
Price: R{{price}}
Mileage: {{mileage}} km
Transmission: {{transmission}}

Why this matches:
{{matchReason}}

View match details: {{appUrl}}/matches/{{matchId}}
View client: {{appUrl}}/clients/{{clientId}}

---
Manage notification preferences: {{appUrl}}/settings/notifications
```

---

## D. Error Handling Matrix

| Error Type | Code | Message | Action | Retry |
|------------|------|---------|--------|-------|
| **Authentication** |
| No session | 401 | Authentication required | Redirect to login | No |
| Invalid token | 401 | Invalid session token | Redirect to login | No |
| Expired session | 401 | Session expired | Redirect to login | No |
| **Authorization** |
| Resource not owned | 404 | Resource not found | Log attempt | No |
| Insufficient permissions | 403 | Forbidden | Log attempt | No |
| **Validation** |
| Missing required field | 400 | Field {{field}} is required | Show error | No |
| Invalid format | 400 | Invalid {{field}} format | Show error | No |
| Value out of range | 400 | {{field}} must be between X and Y | Show error | No |
| **AI Parsing** |
| API key invalid | 500 | AI service unavailable | Queue for retry | Yes (3x) |
| Rate limit hit | 429 | Too many requests | Queue with delay | Yes (3x) |
| Timeout | 500 | AI parsing timeout | Use fallback | Yes (3x) |
| Low confidence | 200 | Parse completed (low confidence) | Flag for review | No |
| Invalid JSON | 500 | AI response invalid | Queue for retry | Yes (3x) |
| **Database** |
| Connection failed | 500 | Database unavailable | Log + retry | Yes (3x) |
| Duplicate key | 409 | Record already exists | Ignore/update | No |
| Validation error | 400 | Invalid data | Show error | No |
| Timeout | 500 | Query timeout | Log + retry | Yes (2x) |
| **Job Queue** |
| Redis unavailable | 500 | Job queue unavailable | Log alert | Yes (∞) |
| Job timeout | 500 | Job processing timeout | Retry job | Yes (3x) |
| Max retries exceeded | 500 | Job failed permanently | Move to DLQ | No |
| **Email** |
| Invalid recipient | 400 | Invalid email address | Skip email | No |
| Send failed | 500 | Email delivery failed | Queue retry | Yes (3x) |
| Rate limit | 429 | Email rate limit | Queue with delay | Yes |
| **External Services** |
| R2 unavailable | 500 | Storage service unavailable | Use cached | Yes (3x) |
| Network error | 500 | Network request failed | Retry | Yes (3x) |

---

## E. Configuration Examples

### E.1 Matching Configuration

```typescript
// config/matching.ts
export const matchingConfig = {
  scoring: {
    weights: {
      make: 25,
      model: 25,
      year: 15,
      price: 15,
      color: 10,
      transmission: 5,
      fuelType: 5,
      mileage: 5
    },
    thresholds: {
      excellent: 85,
      good: 70,
      fair: 55,
      minNotify: 70
    },
    fuzzy: {
      enabled: true,
      makeAbbreviations: {
        'Merc': 'Mercedes-Benz',
        'Beemer': 'BMW',
        'Bimmer': 'BMW',
        'VW': 'Volkswagen'
      },
      modelFamilies: {
        '3 series': ['320i', '320d', '330i', '330d', '335i'],
        'C-Class': ['C180', 'C200', 'C220', 'C250', 'C300']
      }
    }
  },
  matching: {
    maxMatchesPerClient: 50,
    reMatchOnPriceChange: true,
    reMatchOnStatusChange: true,
    matchableStatuses: ['In-Stock', 'Coming']
  }
};
```

---

## F. Testing Data Sets

### F.1 AI Parsing Test Cases

```typescript
export const parsingTestCases = [
  {
    input: "White/silver only Toyota Cross 2020+ under R480k",
    expected: {
      makes: ['Toyota'],
      models: ['Corolla Cross'],
      colors: { preferred: ['White', 'Silver'], exclusive: true },
      yearMin: 2020,
      priceMax: 480000
    }
  },
  {
    input: "BMW 3 series between 2015-2019, auto, under 100k mileage",
    expected: {
      makes: ['BMW'],
      models: ['3 Series'],
      yearMin: 2015,
      yearMax: 2019,
      transmission: ['Automatic'],
      mileageMax: 100000
    }
  },
  {
    input: "Red or blue VW Polo Vivo, manual, budget R150k-R200k",
    expected: {
      makes: ['Volkswagen'],
      models: ['Polo Vivo'],
      colors: { preferred: ['Red', 'Blue'], exclusive: false },
      transmission: ['Manual'],
      priceMin: 150000,
      priceMax: 200000
    }
  }
];
```

---

## G. Performance Benchmarks

### G.1 Target Benchmarks

| Operation | p50 | p95 | p99 | Max |
|-----------|-----|-----|-----|-----|
| API: GET /api/clients | <100ms | <300ms | <500ms | 1s |
| API: POST /api/clients | <150ms | <400ms | <600ms | 1s |
| API: GET /api/matches | <120ms | <350ms | <550ms | 1s |
| AI: Parse preferences | <2s | <5s | <8s | 10s |
| Job: match-client-to-inventory | <10s | <20s | <30s | 1m |
| Job: match-inventory-to-clients | <20s | <40s | <60s | 2m |
| DB: Client query | <10ms | <50ms | <100ms | 200ms |
| DB: Match aggregation | <50ms | <150ms | <250ms | 500ms |

---

**End of Documentation**

All documentation files have been created in `/docs/ai-vehicle-matching-system/`. Review the README.md for navigation.
