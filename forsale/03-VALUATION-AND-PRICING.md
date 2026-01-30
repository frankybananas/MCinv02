# Valuation & Pricing Strategy

## 1. Value Proposition (The "Why")
Dealerships operate in a high-turnover, high-speed environment. Legacy DMS (Dealership Management Systems) are often desktop-bound, expensive, and clunky.
**MCinv02 (LotLynx)** solves specific pain points that directly impact revenue:
1.  **Speed to Lead**: AI Matching notifies agents *instantly* when stock arrives for a client.
2.  **Mobile Efficiency**: Agents can load stock, take photos, and close deals standing on the lot.
3.  **Marketing Velocity**: Generating professional WhatsApp assets takes seconds, not minutes.

## 2. Recommended Pricing Models

### Option A: SaaS Subscription (Recurring Revenue)
This is the most sustainable model for a partnership or long-term operation.

| Tier | Monthly Price (ZAR) | Features | Target Audience |
| :--- | :--- | :--- | :--- |
| **Starter** | R 1,500 - R 2,500 | Inventory Management, Client Database, Basic Marketing | Small independent dealers |
| **Growth** | R 3,500 - R 5,000 | **AI Matching**, WhatsApp Generator, Delivery Tracking, 5 Users | Medium-sized dealerships |
| **Pro** | R 7,500+ | Unlimited Users, Multi-branch support, Facebook Posting (Beta), API Access | Large dealer groups |

*   *Note: Add R500/mo per additional user beyond tier limits.*

### Option B: One-Time License / Source Code Sale
Selling the IP outright to a larger software house or a dealership group wanting a proprietary internal system.

*   **Estimated Valuation Range**: **R 450,000 - R 850,000**
    *   *Justification*:
        *   **Development Cost Replacement**: It would take a senior full-stack engineer 3-5 months to replicate this quality (Architecture, AI integration, Security, Testing).
        *   **Time-to-Market**: Immediate deployment vs. months of dev time.
        *   **IP Assets**: Modern codebase, AI prompting logic, automated test suite (high reliability).

## 3. Operational Costs (COGS)
The system is architected for extreme cost efficiency.

| Component | Provider | Estimated Cost (Monthly) | Notes |
| :--- | :--- | :--- | :--- |
| **Compute** | VPS (Coolify) | ~$15 - $25 | Can run on digital ocean/hetzner |
| **Database** | MongoDB Atlas | Free / ~$20 | Free tier supports thousands of records |
| **Storage** | Cloudflare R2 | < $5 | Zero egress fees, extremely cheap |
| **AI Intelligence** | Google Gemini | < $10 | Gemini 1.5 Flash is very cost-effective |
| **Authentication** | Twilio Verify | Variable | ~R 0.90 per OTP (Pass to customer or absorb) |
| **Total Base Cost** | | **~R 500 - R 800 / mo** | High profit margin potential (>80%) |

## 4. Growth & Upsell Opportunities
1.  **White-Labeling**: Sell the platform to other dealer networks with their branding.
2.  **Feature Add-ons**:
    *   **Facebook Auto-Posting**: Charge an extra R500-R1000/mo once fully UI-integrated.
    *   **Lead Generation**: Integrate with web forms (AutoTrader, Cars.co.za leads) to feed the AI matcher.

## 5. Strategic Partnership Proposal
If seeking a partner rather than a buyer:
*   **Tech Partner (You)**: Maintains the code, ensures uptime, builds new features (10-20% equity or revenue share).
*   **Sales/Ops Partner**: Handles sales to dealerships, support, and billing.
