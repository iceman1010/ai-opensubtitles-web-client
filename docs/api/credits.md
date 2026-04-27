# Credits Management

Track credit balance and manage credit purchases.

## Overview

The AI service uses a credit-based system. Credits are consumed for transcription, translation, and language detection operations.

## Credit Pricing

| Service | Price per Unit | Notes |
|---------|---------------|-------|
| Transcription | ~0.0001 credits/character | Varies by model |
| Translation | ~0.00015 credits/character | Typically 1.5x transcription |
| Language Detection | Included in transcription | No extra cost |
| File Download | Free | No credit cost |

*Exact pricing shown in `getServicesInfo()` response*

## Methods

### getCredits()

Retrieves current credit balance.

**Endpoint**: `POST /ai/credits`

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

**Request Body**: `{}` (empty object)

**Implementation**:
```typescript
async getCredits(): Promise<{
  success: boolean;
  credits?: number;
  error?: string;
}>
```

**Success Response**:
```typescript
{
  success: true,
  credits: 1000.50  // Decimal precision
}
```

**Error Response**:
```typescript
{
  success: false,
  error: "Invalid token"
}
```

**Caching**: Not cached (always fetches fresh balance)

**Retry Logic**: 3 attempts

**Usage**:
```typescript
const { getCredits } = useAPI();

const checkBalance = async () => {
  const result = await getCredits();
  if (result.success) {
    console.log(`Credits: ${result.credits}`);
    setCredits(result.credits);
  }
};
```

**Automatic Checks**:
- After login (verifies token validity)
- Before major operations (optional)
- On user request
- Periodic refresh (recommended every 5-10 minutes)

---

### getCreditPackages()

Retrieves available credit purchase packages.

**Endpoint**: `POST /ai/credits/buy`

**Parameters**:
- `email?`: `string` - Optional email for package recommendation

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

**Request Body**: `FormData` (optional email field)
```typescript
const formData = new FormData();
if (email) formData.append('email', email);
```

**Implementation**:
```typescript
async getCreditPackages(
  email?: string
): Promise<{
  success: boolean;
  data?: CreditPackage[];
  error?: string;
}>
```

**CreditPackage Interface**:
```typescript
interface CreditPackage {
  name: string;              // "Starter Pack", "Pro Bundle", etc.
  value: string;             // "1000", "5000" (as string)
  discount_percent: number;  // 0-100, discount from regular price
  checkout_url: string;      // Redirect URL for payment
}
```

**Success Response**:
```typescript
{
  success: true,
  data: [
    {
      name: "Starter Pack",
      value: "100",
      discount_percent: 0,
      checkout_url: "https://ai.opensubtitles.com/checkout?pkg=starter&token=abc"
    },
    {
      name: "Pro Bundle",
      value: "1000",
      discount_percent: 20,
      checkout_url: "https://ai.opensubtitles.com/checkout?pkg=pro&token=abc"
    },
    {
      name: "Enterprise",
      value: "10000",
      discount_percent: 40,
      checkout_url: "https://ai.opensubtitles.com/checkout?pkg=enterprise&token=abc"
    }
  ]
}
```

**Error Response**:
```typescript
{
  success: false,
  error: "Failed to fetch packages"
}
```

**Caching**: Per-email
- Cache key: `credit_packages_{email || 'default'}`
- Manual invalidation recommended after purchase

**Retry Logic**: 3 attempts

**Usage**:
```typescript
const { getCreditPackages } = useAPI();

const loadPackages = async (userEmail?: string) => {
  const result = await getCreditPackages(userEmail);
  if (result.success) {
    setPackages(result.data);
  }
};

// Display packages
const handlePurchase = (package: CreditPackage) => {
  // Redirect to checkout
  window.location.href = package.checkout_url;
};
```

---

## Credit Consumption

### Estimate Credits Before Operation

```typescript
const estimateTranscriptionCredits = (
  durationMinutes: number,
  model: string
): number => {
  // Rough estimate: 1 min of audio ≈ 1500-2000 characters
  // Whisper models: ~0.0001 per character
  const estimatedChars = durationMinutes * 1800;
  const pricePerChar = model.includes('large') ? 0.0001 : 0.00008;
  return estimatedChars * pricePerChar;
};

const estimateTranslationCredits = (
  subtitleLines: number,
  charsPerLine: number = 40
): number => {
  const totalChars = subtitleLines * charsPerLine;
  return totalChars * 0.00015;  // ~1.5x transcription cost
};

// Usage
const transcriptionCost = estimateTranscriptionCredits(30, 'openai-whisper-large-v3');
console.log(`Estimated cost: ${transcriptionCost.toFixed(2)} credits`);
```

### Check Balance Before Operation

```typescript
const { getCredits } = useAPI();

const canAffordOperation = async (
  estimatedCost: number,
  buffer: number = 10  // Minimum buffer
): Promise<boolean> => {
  const result = await getCredits();
  if (!result.success) return false;
  
  const available = result.credits || 0;
  return available >= (estimatedCost + buffer);
};

// Usage
const handleTranscribe = async (file) => {
  const estimatedCost = estimateTranscriptionCost(file.duration);
  
  if (await canAffordOperation(estimatedCost)) {
    // Proceed with transcription
    const result = await initiateTranscription(file, options);
  } else {
    // Show purchase prompt
    showLowCreditsWarning();
  }
};
```

## Real-Time Credit Tracking

```typescript
const CreditTracker = () => {
  const { getCredits, credits } = useAPI();
  const [balance, setBalance] = useState<number | null>(null);

  // Poll balance periodically
  useEffect(() => {
    const fetchBalance = async () => {
      const result = await getCredits();
      if (result.success) {
        setBalance(result.credits);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 300000); // 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  // Low credits warning
  if (balance !== null && balance < 10) {
    return (
      <div className="low-credits-warning">
        <Alert type="warning">
          Low credits: {balance}. 
          <button onClick={openPurchaseModal}>
            Buy More
          </button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="credit-balance">
      Credits: {balance !== null ? balance.toFixed(2) : '...'}
    </div>
  );
};
```

## Purchase Flow

```typescript
const handlePurchase = async (
  package: CreditPackage
) => {
  // 1. Record current balance
  const beforeBalance = await getCredits();
  
  // 2. Redirect to checkout
  window.location.href = package.checkout_url;
  
  // 3. After return from checkout (via webhook or redirect)
  const afterBalance = await getCredits();
  const purchased = afterBalance - beforeBalance;
  
  console.log(`Purchased ${purchased} credits`);
};
```

## Credit History

Track credit usage via recent activities:

```typescript
const { getRecentActivities } = useAPI();

const loadCreditHistory = async () => {
  const result = await getRecentActivities(1);
  if (result.success) {
    const creditActivities = result.data?.filter(
      a => a.type === 1 || a.type === 2  // Transcription or Translation
    );
    
    const totalSpent = creditActivities.reduce(
      (sum, a) => sum + a.credits, 0
    );
    
    console.log(`Total spent: ${totalSpent} credits`);
  }
};
```

## Best Practices

1. **Always check balance** before expensive operations
   ```typescript
   const result = await getCredits();
   if (result.credits < estimatedCost) {
     showWarning();
     return;
   }
   ```

2. **Add safety buffer** (10-20 credits)
   ```typescript
   const canProceed = availableCredits > (estimatedCost + 10);
   ```

3. **Estimate costs** before user action
   ```typescript
   // Show estimated cost
   <p>Cost: ~{estimate.toFixed(2)} credits</p>
   ```

4. **Handle failures gracefully**
   ```typescript
   // If credits insufficient mid-operation
   if (error.status === 402) {  // Payment required
     showPurchaseModal();
   }
   ```

5. **Monitor usage patterns**
   ```typescript
   // Track daily/weekly spending
   const weeklyUsage = activities
     .filter(a => isThisWeek(a.time))
     .reduce((sum, a) => sum + a.credits, 0);
   ```

## Pricing Transparency

```typescript
const getPricingInfo = async (apiName: string) => {
  const result = await getServicesInfo();
  if (result.success) {
    const service = result.data[apiName];
    return {
      pricePerUnit: service.price,
      reliability: service.reliability,
      languages: service.languages_supported
    };
  }
};
```

## Cost Optimization

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| Use smaller models | 20-40% | Whisper-tiny vs large |
| Batch operations | 10-20% | Process multiple files |
| Reuse subtitles | 100% | Download vs re-transcribe |
| Quality selection | 30-50% | Lower quality for drafts |

## Troubleshooting

### Balance Shows 0

**Causes**:
- Account has no credits
- Token invalid (can't fetch balance)
- API rate limiting

**Solutions**:
- Purchase credits
- Re-authenticate
- Wait and retry

### Purchase Not Reflected

**Causes**:
- Delay in credit addition
- Checkout not completed
- Network error

**Solutions**:
- Wait 1-2 minutes
- Check email for confirmation
- Contact support if persistent

### Operations Fail (Insufficient Credits)

**Cause**: Balance below operation cost

**Solutions**:
- Purchase more credits
- Use smaller/cheaper model
- Split large files

## API Reference

### Balance Check
```typescript
const { getCredits } = useAPI();
const result = await getCredits();
// result.success, result.credits
```

### Package List
```typescript
const { getCreditPackages } = useAPI();
const result = await getCreditPackages(email);
// result.success, result.data[]
```

## Cost Calculator

```typescript
function calculateOperationCosts({
  audioMinutes,
  subtitleLines,
  transcriptionModel = 'whisper-large',
  translateToLanguages = []
}) {
  const transcriptionCost = audioMinutes * 1800 * 0.0001;
  
  const translationCosts = translateToLanguages.map(lang => 
    subtitleLines * 40 * 0.00015
  );
  
  const total = transcriptionCost + 
    translationCosts.reduce((a, b) => a + b, 0);
  
  return {
    transcription: transcriptionCost.toFixed(2),
    translations: translationCosts.map(c => c.toFixed(2)),
    total: total.toFixed(2)
  };
}

// Usage
const costs = calculateOperationCosts({
  audioMinutes: 60,
  subtitleLines: 800,
  translateToLanguages: ['es', 'fr']
});
// { transcription: "10.80", translations: ["48.00", "48.00"], total: "106.80" }
```

## Related Methods

- [Activity History](./media.md) - View credit usage over time
- [Transcription](./transcription.md) - Credit costs for transcription
- [Translation](./translation.md) - Credit costs for translation