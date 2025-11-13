# Phase 4: Gemini AI Post Generation

**Phase:** 4 of 8  
**Duration:** 2-3 days  
**Dependencies:** Phase 1, 3  
**Status:** Ready

---

## Overview

Integrate Google Gemini AI to generate engaging, varied Facebook posts for selected cars.

---

## AI Service Architecture

```typescript
// lib/ai/gemini-service.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

export interface CarPostInput {
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  color: string;
  transmission: string;
  status: string;
  features?: string[];
  // User contact
  businessName: string;
  whatsappNumber: string;
  location: string;
}

export interface GeneratedPostOutput {
  content: string;
  hashtags: string[];
  tone: 'professional' | 'enthusiastic' | 'luxury' | 'budget-friendly';
  generationTime: number;
}

export class GeminiPostGenerator {
  private model;
  
  constructor() {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',  // Cost-effective as per user preference
      generationConfig: {
        temperature: 0.9,  // High variability
        topP: 0.95,
        maxOutputTokens: 1024
      }
    });
  }
  
  async generatePost(car: CarPostInput): Promise<GeneratedPostOutput> {
    const startTime = Date.now();
    
    const prompt = this.buildPrompt(car);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse response
      const { content, hashtags } = this.parseResponse(text);
      const tone = this.determineTone(car);
      
      return {
        content,
        hashtags,
        tone,
        generationTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Gemini generation error:', error);
      throw new Error('Failed to generate post content');
    }
  }
  
  private buildPrompt(car: CarPostInput): string {
    const priceCategory = this.categorizPrice(car.price);
    
    return `
You are an expert automotive social media marketer. Create an engaging Facebook post for the following vehicle.

**Vehicle Details:**
- Make & Model: ${car.make} ${car.model}
- Year: ${car.year}
- Price: R ${car.price.toLocaleString()}
- Mileage: ${car.mileage.toLocaleString()} km
- Color: ${car.color}
- Transmission: ${car.transmission}
- Status: ${car.status}
${car.features ? `- Features: ${car.features.join(', ')}` : ''}

**Seller Information:**
- Business: ${car.businessName}
- Location: ${car.location}
- Contact: ${car.whatsappNumber}

**Requirements:**
1. Write in English only
2. Vary the tone based on the vehicle:
   - Luxury vehicles (>R1M): Professional, sophisticated
   - Performance cars: Enthusiastic, exciting
   - Family vehicles: Practical, trustworthy
   - Budget-friendly (<R300k): Value-focused, approachable
3. Include key selling points (year, mileage, status)
4. Add compelling call-to-action
5. Include seller contact (WhatsApp & location)
6. Generate 5-7 relevant hashtags (mix of general and specific)
7. Keep post between 150-250 words
8. Use emojis sparingly (1-3 max)

**Output Format:**
POST:
[Your engaging post content here]

HASHTAGS:
#Hashtag1 #Hashtag2 #Hashtag3 ...
`;
  }
  
  private parseResponse(text: string): { content: string; hashtags: string[] } {
    const lines = text.split('\n');
    let content = '';
    let hashtags: string[] = [];
    let inHashtagSection = false;
    
    for (const line of lines) {
      if (line.startsWith('POST:')) {
        continue;
      } else if (line.startsWith('HASHTAGS:')) {
        inHashtagSection = true;
        // Extract hashtags from this line if present
        const hashtagsOnLine = line.replace('HASHTAGS:', '').trim();
        if (hashtagsOnLine) {
          hashtags.push(...this.extractHashtags(hashtagsOnLine));
        }
      } else if (inHashtagSection) {
        hashtags.push(...this.extractHashtags(line));
      } else {
        content += line + '\n';
      }
    }
    
    return {
      content: content.trim(),
      hashtags: [...new Set(hashtags)]  // Remove duplicates
    };
  }
  
  private extractHashtags(text: string): string[] {
    const matches = text.match(/#[a-zA-Z0-9_]+/g);
    return matches || [];
  }
  
  private determineTone(car: CarPostInput): GeneratedPostOutput['tone'] {
    if (car.price >= 1000000) return 'luxury';
    if (car.price <= 300000) return 'budget-friendly';
    if (car.model.toLowerCase().includes('amg') || car.model.toLowerCase().includes('sport')) {
      return 'enthusiastic';
    }
    return 'professional';
  }
  
  private categorizPrice(price: number): 'budget' | 'mid-range' | 'premium' | 'luxury' {
    if (price < 300000) return 'budget';
    if (price < 600000) return 'mid-range';
    if (price < 1000000) return 'premium';
    return 'luxury';
  }
}
```

---

## API Endpoint

**Endpoint:** `POST /api/facebook/generate-post`

**Purpose:** Generate AI post for a single car (used internally and for preview)

**Request:**
```typescript
{
  carId: string
}
```

**Response:**
```typescript
{
  success: true,
  post: {
    content: string,
    hashtags: string[],
    tone: string,
    generationTime: number
  }
}
```

**Implementation:**
```typescript
// app/api/facebook/generate-post/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { connectDB } from '@/lib/mongodb';
import Car from '@/models/Car';
import User from '@/models/User';
import { GeminiPostGenerator } from '@/lib/ai/gemini-service';

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { carId } = await request.json();
  
  await connectDB();
  
  // Fetch car
  const car = await Car.findById(carId);
  if (!car) {
    return NextResponse.json({ error: 'Car not found' }, { status: 404 });
  }
  
  // Fetch user for contact info
  const user = await User.findById(session.userId);
  if (!user?.businessName || !user?.whatsappNumber) {
    return NextResponse.json({ 
      error: 'Please complete your contact information in Profile' 
    }, { status: 400 });
  }
  
  // Generate post
  const generator = new GeminiPostGenerator();
  const post = await generator.generatePost({
    make: car.make,
    model: car.model,
    year: car.year,
    price: car.price,
    mileage: car.mileage,
    color: car.color,
    transmission: car.transmission,
    status: car.status,
    features: car.features,
    businessName: user.businessName,
    whatsappNumber: user.whatsappNumber,
    location: user.location || 'South Africa'
  });
  
  return NextResponse.json({ success: true, post });
}
```

---

## Prompt Engineering

### Tone Variations

**Luxury Example (>R1M):**
```
Exquisite 2023 Mercedes-Benz S-Class now available. 

This masterpiece combines cutting-edge technology with timeless elegance. 
Featuring premium leather, advanced driver assistance, and a silky-smooth 
powertrain. Only 15,000km. 

Experience automotive excellence.

📍 Frederik Brand @ Halfway Toyota George
📱 WhatsApp: +27824544656

#MercedesBenz #LuxuryCar #SClass #GeorgeWesternCape #PremiumVehicles
```

**Budget-Friendly Example (<R300k):**
```
Great value! 2018 Toyota Corolla – perfect for families 🚗

Reliable, fuel-efficient, and ready to go. This well-maintained Corolla 
has been serviced regularly and runs like new. 

Don't miss out on this fantastic deal!

Call/WhatsApp: +27824544656
Visit us in George, Western Cape

#ToyotaCorolla #AffordableCars #FamilyCar #UsedCars #George
```

---

## Error Handling

### Fallback Templates

If Gemini API fails, use template:

```typescript
const fallbackTemplate = (car: CarPostInput): string => {
  return `
${car.year} ${car.make} ${car.model} 

✅ Price: R ${car.price.toLocaleString()}
✅ Mileage: ${car.mileage.toLocaleString()} km
✅ Status: ${car.status}

Contact us for more details:
📱 ${car.whatsappNumber}
📍 ${car.location}

${car.businessName}

#${car.make.replace(/\s/g, '')} #UsedCars #${car.location.split(',')[0]}Cars
`.trim();
};
```

---

## Testing

**File:** `__tests__/lib/gemini-service.test.ts`

```typescript
describe('GeminiPostGenerator', () => {
  test('should generate post with all required fields', async () => {
    const generator = new GeminiPostGenerator();
    const result = await generator.generatePost(mockCarInput);
    
    expect(result.content).toBeTruthy();
    expect(result.hashtags.length).toBeGreaterThan(0);
    expect(result.tone).toBeDefined();
    expect(result.generationTime).toBeGreaterThan(0);
  });
  
  test('should vary tone based on price', async () => {
    const luxuryCar = { ...mockCarInput, price: 1500000 };
    const budgetCar = { ...mockCarInput, price: 250000 };
    
    const result1 = await generator.generatePost(luxuryCar);
    const result2 = await generator.generatePost(budgetCar);
    
    expect(result1.tone).toBe('luxury');
    expect(result2.tone).toBe('budget-friendly');
  });
  
  test('should handle API errors gracefully', async () => {
    // Mock API failure
    await expect(generator.generatePost(invalidInput)).rejects.toThrow();
  });
});
```

**Coverage:** 90%+

---

## Environment Variables

```env
# Gemini AI
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash  # or gemini-1.5-pro for better quality
```

---

## Cost Optimization

**Gemini 1.5 Flash Pricing (as of 2025):**
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

**Estimated Cost Per Post:**
- Input: ~500 tokens = $0.0000375
- Output: ~200 tokens = $0.00006
- **Total: ~$0.0001 per post**

**Monthly Estimate:**
- 1000 posts/month = ~$0.10

Very cost-effective! ✅

---

**Next Phase:** Phase 5 (Marketing Page UI)
