Voice-Enabled Input Strategy for TradieMate

🎯 WHY VOICE INPUT IS CRITICAL FOR TRADIES
The Tradie Reality:
Typical Job Site Scenario:
├─ Hands dirty/wet/oily
├─ Wearing gloves
├─ Holding tools
├─ On ladder/scaffold
├─ Poor lighting
├─ Time pressure (client waiting)
└─ Phone in pocket

Problem: Typing on phone = nightmare
Solution: Voice input = game changer

Tradie Pain Points Voice Solves:
❌ Without Voice:
├─ "Can't type with gloves on"
├─ "Phone screen doesn't work when wet"
├─ "Takes 5 mins to type quote items"
├─ "Client watching me fumble with phone"
└─ "Easier to write on paper" (defeats purpose)

✅ With Voice:
├─ "Just say the items out loud"
├─ "Done in 30 seconds"
├─ "Looks professional"
├─ "Can do it while packing tools"
└─ "Actually faster than paper"


📱 VOICE INPUT METHODS & USE CASES

Method 3: Voice Templates (Hybrid Approach)
How it works:
Pre-built templates with voice fill-ins
├─ User selects template (e.g., "Downlight Installation")
├─ App prompts for variables
├─ User speaks answers
└─ Quote built automatically

Cost: $0 (uses native speech recognition)
Accuracy: 95%+ (structured prompts reduce errors)

Example Flow:
🎤 Voice-Guided Quote Creation:

App: "Select quote template"
User: Taps "Downlight Installation"

App: "How many downlights?"
User: 🎤 "Six"
App: ✅ Quantity set to 6

App: "Labour hours?"
User: 🎤 "Two hours"
App: ✅ Labour set to 2 hours

App: "Additional items?"
User: 🎤 "Switchboard safety check"
App: ✅ Added switchboard check ($150)

App: "Client name?"
User: 🎤 "John Smith"
App: ✅ Client set

App: "Quote ready. Review or send?"
User: Taps "Send via SMS"

Total time: 30 seconds


🛠️ TECHNICAL IMPLEMENTATION
Architecture Overview:
Voice Input Stack:

┌─────────────────────────────────┐
│  User speaks into phone         │
└──────────────┬──────────────────┘
               │
     ┌─────────▼─────────┐
     │  Audio Capture    │
     │  (Native APIs)    │
     └─────────┬─────────┘
               │
     ┌─────────▼──────────┐
     │  Speech-to-Text    │
     │  (Choose method)   │
     └─────────┬──────────┘
               │
     ┌─────────▼──────────┐
     │  AI Parsing        │
     │  (Claude/GPT)      │
     └─────────┬──────────┘
               │
     ┌─────────▼──────────┐
     │  Structured Data   │
     │  (Quote/Invoice)   │
     └─────────┬──────────┘
               │
     ┌─────────▼──────────┐
     │  Database Storage  │
     │  (Supabase)        │
     └────────────────────┘


Option 1: FREE Native Voice (Recommended for MVP)
iOS Implementation (React Native):
import Voice from '@react-native-voice/voice';

const VoiceQuoteInput = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const startListening = async () => {
    try {
      await Voice.start('en-AU'); // Australian English
      setIsListening(true);
    } catch (error) {
      console.error(error);
    }
  };

  Voice.onSpeechResults = (e) => {
    setTranscript(e.value[0]); // Get spoken text
    parseQuoteFromText(e.value[0]); // Parse into quote fields
  };

  const parseQuoteFromText = (text) => {
    // Simple regex parsing or send to AI
    // Example: "Six downlights at forty five each"
    // Extracts: quantity=6, item="downlights", price=$45
  };

  return (
    <View>
      <TouchableOpacity onPress={startListening}>
        <Icon name="microphone" />
        <Text>{isListening ? 'Listening...' : 'Tap to speak'}</Text>
      </TouchableOpacity>
      <Text>{transcript}</Text>
    </View>
  );
};

Cost: $0 (native APIs) Setup time: 2-4 hours Pros: Free, works offline, fast Cons: Less accurate for complex quotes

Option 2: AI-Powered Voice (Premium Feature)
Using Deepgram + Claude:
import Deepgram from '@deepgram/sdk';
import Anthropic from '@anthropic-ai/sdk';

const AIVoiceQuote = async (audioFile) => {
  // Step 1: Transcribe audio
  const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
  const response = await deepgram.transcription.preRecorded(
    { url: audioFile },
    { 
      model: 'nova-2',
      language: 'en-AU', // Australian English
      punctuate: true,
      diarize: false
    }
  );
  
  const transcript = response.results.channels[0].alternatives[0].transcript;
  // Example: "Create quote for John Smith zero four one two..."

  // Step 2: Parse with Claude AI
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Parse this tradie quote from speech into JSON:

"${transcript}"

Extract:
- Client name, phone, address
- Line items (description, quantity, unit price)
- Calculate subtotal, GST (10%), total

Return valid JSON only.`
    }]
  });

  const quoteData = JSON.parse(message.content[0].text);
  
  /* Example output:
  {
    "client": {
      "name": "John Smith",
      "phone": "0412345678",
      "address": "123 Main St, Parramatta"
    },
    "line_items": [
      {
        "description": "Install downlights",
        "quantity": 6,
        "unit_price": 45.00,
        "total": 270.00
      },
      {
        "description": "Labour (2 hours)",
        "quantity": 2,
        "unit_price": 150.00,
        "total": 300.00
      }
    ],
    "subtotal": 570.00,
    "gst": 57.00,
    "total": 627.00
  }
  */

  return quoteData;
};

Cost per quote:
Deepgram: $0.0043/min × 1 min = $0.0043
Claude: ~$0.015 per quote
Total: ~$0.02 per voice quote
Accuracy: 95-98% Setup time: 8-12 hours Pros: Highly accurate, handles complex quotes Cons: Requires internet, small cost per use

Option 3: Hybrid Approach (Best of Both Worlds)
Strategy:
FREE tier users: Native voice dictation
PAID tier users: AI-powered voice quotes

Implementation:
├─ Solo Plan ($29/mo): 50 AI voice quotes/month
├─ Crew Plan ($49/mo): 200 AI voice quotes/month
├─ Pro Plan ($79/mo): Unlimited AI voice quotes
└─ Unlimited native voice for all tiers


🎤 VOICE INPUT USE CASES
1. Voice Quote Creation
Scenario: Dave on job site, client watching
Traditional (typing):
├─ Time: 5-8 minutes
├─ Awkward: Client waiting while tradie types
├─ Errors: Fat-finger mistakes
└─ Professional: Medium

Voice-enabled:
├─ Time: 30-60 seconds
├─ Smooth: Tradie speaks naturally
├─ Errors: Minimal (AI corrects)
└─ Professional: High (looks efficient)

Voice Command Example:
🎤 Dave speaks:

"New quote.
Client John Smith.
Phone zero four one two three four five six seven eight.
Address one two three Main Street Parramatta.

Item one, install six downlights at forty five dollars each.
Item two, labour two hours at one hundred fifty per hour.
Item three, switchboard safety check one hundred fifty dollars.

Calculate total with GST.
Send via SMS."

✅ Quote created and sent in 45 seconds


2. Voice Job Notes
Scenario: Sarah (plumber) completes job, needs to log details
Traditional:
├─ Takes photos ✅
├─ Types notes manually ❌ (5 mins)
└─ Updates job status ✅

Voice-enabled:
├─ Takes photos ✅
├─ 🎤 "Job notes: Replaced hot water system,
   old unit had major leak, 
   recommended annual service.
   Client happy, left business cards." ✅ (30 seconds)
└─ Updates job status ✅

AI Processing:
Voice input: "Replaced hot water system, old unit had major 
              leak, recommended annual service..."

AI extracts:
├─ Work done: "Replaced hot water system"
├─ Issue found: "Major leak in old unit"
├─ Recommendation: "Annual service"
├─ Upsell opportunity: "Annual maintenance contract"
└─ Client sentiment: "Client happy"

Saved to job record automatically


3. Voice Material Tracking
Scenario: Marcus (carpenter) on job, using materials
Traditional:
├─ Uses materials from ute
├─ Writes on paper
├─ Linda enters into system later
└─ Often forgets items

Voice-enabled:
├─ 🎤 "Add materials:
   Six two-by-four studs,
   Box of screws,
   Three sheets of plywood"
├─ AI logs with quantities
├─ Costs auto-pulled from supplier database
└─ Job profitability updated real-time


4. Voice Client Search
Scenario: Dave needs to find past job for returning client
Traditional:
├─ Open app
├─ Tap search
├─ Type "John Smith"
├─ Select from results
└─ Total: 30 seconds

Voice-enabled:
├─ 🎤 Press voice button
├─ "Find John Smith"
├─ Results appear
└─ Total: 5 seconds


5. Voice Invoice Creation from Job Site
Scenario: Job complete, client wants invoice immediately
Dave (standing in client's living room):

🎤 "Convert job to invoice.
Add fifty dollar call-out fee.
Mark as due on receipt.
Send to client via SMS."

✅ Invoice sent in 10 seconds
✅ Client pays while Dave packs tools
✅ Dave leaves with payment confirmed


🎨 UI/UX DESIGN FOR VOICE INPUT
Voice Button Placement:
Option A: Floating Action Button (FAB)
┌─────────────────────────────┐
│ ☰  TradieMate    🔍 ⚙️      │
├─────────────────────────────┤
│                             │
│   Current Jobs              │
│                             │
│   📋 Job #123               │
│   📋 Job #124               │
│   📋 Job #125               │
│                             │
│                             │
│                             │
│                      ┌────┐ │
│                      │ 🎤 │ │ ← Always visible
│                      └────┘ │    Tap = Voice mode
└─────────────────────────────┘

Option B: Voice-First Quick Actions
┌─────────────────────────────┐
│ What do you want to do?     │
│                             │
│ ┌─────────────────────────┐ │
│ │   🎤 Tap to speak       │ │ ← Primary action
│ │   "Create quote for..." │ │
│ └─────────────────────────┘ │
│                             │
│ Or choose:                  │
│ [📝 Type] [📋 Template]     │
└─────────────────────────────┘

Option C: Context-Aware Voice
┌─────────────────────────────┐
│ Create New Quote            │
│                             │
│ Client name:                │
│ [John Smith......] 🎤       │ ← Per-field voice
│                             │
│ Phone:                      │
│ [0412 345 678....] 🎤       │
│                             │
│ OR                          │
│                             │
│ 🎤 [Voice-create entire     │ ← Full voice mode
│     quote at once]          │
└─────────────────────────────┘


Voice Feedback States:
State 1: Ready to Listen
┌─────────────────────────────┐
│      🎤                      │
│   Tap to speak              │
│                             │
│   "Create quote for..."     │
│   "Add job note..."         │
│   "Find client..."          │
└─────────────────────────────┘

State 2: Listening
┌─────────────────────────────┐
│      🎤 🔴 ●●●●●           │ ← Animated pulse
│   Listening...              │
│                             │
│   "Create quote for John... │ ← Live transcript
└─────────────────────────────┘

State 3: Processing
┌─────────────────────────────┐
│      ⚙️                      │
│   Processing your quote...  │
│                             │
│   [Loading animation]       │
└─────────────────────────────┘

State 4: Confirmation
┌─────────────────────────────┐
│      ✅                      │
│   Quote created!            │
│                             │
│   📋 John Smith - $792      │
│                             │
│   [Review] [Send]           │
└─────────────────────────────┘

State 5: Error Handling
┌─────────────────────────────┐
│      ⚠️                      │
│   Couldn't hear you clearly │
│                             │
│   Try again or type instead │
│                             │
│   [🎤 Retry] [⌨️ Type]     │
└─────────────────────────────┘


🧠 AI VOICE PARSING EXAMPLES
Example 1: Electrician Quote
Voice input:
"Create quote for Sarah Chen, 
phone zero four one five nine nine six three two one,
Fifteen Smith Street Melborne,
Install ceiling fan in bedroom one hundred twenty dollars,
Install two power points at eighty each,
Labour one point five hours at one hundred fifty per hour."

AI parsing (Claude):
{
  "client": {
    "name": "Sarah Chen",
    "phone": "0415996321",
    "address": "15 Smith St, Melbourne"
  },
  "line_items": [
    {
      "description": "Install ceiling fan in bedroom",
      "quantity": 1,
      "unit_price": 120.00,
      "total": 120.00
    },
    {
      "description": "Install power points",
      "quantity": 2,
      "unit_price": 80.00,
      "total": 160.00
    },
    {
      "description": "Labour",
      "quantity": 1.5,
      "unit_price": 150.00,
      "total": 225.00
    }
  ],
  "subtotal": 505.00,
  "gst": 50.50,
  "total": 555.50
}

Confidence: 98%


Example 2: Plumber Quote with Australian Slang
Voice input:
"Quote for Dave, zero four one two three four five six seven eight,
Twenty three High Street Bondi,
Fix the dunny, leaking like a bastard,
Replace tap washers forty bucks,
Emergency call-out one fifty,
About two hours work at one twenty an hour."

AI parsing (handles slang):
{
  "client": {
    "name": "Dave",
    "phone": "0412345678",
    "address": "23 High St, Bondi"
  },
  "line_items": [
    {
      "description": "Fix toilet leak", // "dunny" → "toilet"
      "note": "Major leak requiring urgent repair",
      "quantity": 1,
      "unit_price": 0,
      "total": 0
    },
    {
      "description": "Replace tap washers",
      "quantity": 1,
      "unit_price": 40.00,
      "total": 40.00
    },
    {
      "description": "Emergency call-out fee",
      "quantity": 1,
      "unit_price": 150.00,
      "total": 150.00
    },
    {
      "description": "Labour (2 hours)",
      "quantity": 2,
      "unit_price": 120.00,
      "total": 240.00
    }
  ],
  "subtotal": 430.00,
  "gst": 43.00,
  "total": 473.00
}

Confidence: 95%
Note: Cleaned up informal language for professional quote


Example 3: Carpenter Quote with Materials
Voice input:
"New quote Marcus Timber Services,
Client is Julie at North Sydney Apartments,
zero four one six eight seven five four three two,
Custom bookshelf, three meters wide by two high,
Timber costs about six hundred,
Screws and fixings fifty,
Five days labour at four hundred per day."

AI parsing:
{
  "client": {
    "name": "Julie",
    "company": "North Sydney Apartments",
    "phone": "0416875432"
  },
  "line_items": [
    {
      "description": "Custom bookshelf (3m × 2m)",
      "quantity": 1,
      "unit_price": 600.00,
      "total": 600.00,
      "type": "materials"
    },
    {
      "description": "Screws and fixings",
      "quantity": 1,
      "unit_price": 50.00,
      "total": 50.00,
      "type": "materials"
    },
    {
      "description": "Labour (5 days)",
      "quantity": 5,
      "unit_price": 400.00,
      "total": 2000.00,
      "type": "labour"
    }
  ],
  "subtotal": 2650.00,
  "gst": 265.00,
  "total": 2915.00,
  "materials_total": 650.00,
  "labour_total": 2000.00
}

Confidence: 97%


💰 COST ANALYSIS
Voice Input Costs:
FREE Native Voice:
Cost per quote: $0
Limitations:
├─ Requires manual field-by-field dictation
├─ User must structure input
├─ No AI parsing
└─ Works offline ✅

Best for: Solo tier users (budget-conscious)

AI-Powered Voice:
Cost per quote:
├─ Deepgram transcription: $0.0043
├─ Claude AI parsing: $0.015
└─ Total: ~$0.02 per quote

Benefits:
├─ Natural speech (no structure needed)
├─ Handles slang and colloquialisms
├─ Auto-corrects errors
├─ Extracts structured data
└─ 95-98% accuracy

Best for: Crew/Pro tier users (power users)

Pricing Strategy:
FREE Tier:
├─ Native voice only
└─ Unlimited usage

Solo Tier ($29/mo):
├─ 50 AI voice quotes/month
├─ Then fallback to native voice
└─ $0.02 × 50 = $1 cost (97% margin)

Crew Tier ($49/mo):
├─ 200 AI voice quotes/month
├─ $0.02 × 200 = $4 cost (92% margin)

Pro Tier ($79/mo):
├─ Unlimited AI voice quotes
├─ Estimated 500/mo = $10 cost (87% margin)


🎯 COMPETITIVE ADVANTAGE
Why Voice = TradieMate's Secret Weapon:
Competitors (ServiceM8, Tradify):
├─ Typing-heavy interfaces
├─ No voice input
├─ Complex multi-step forms
└─ Not optimized for job sites

TradieMate with Voice:
├─ Voice-first design
├─ Hands-free operation
├─ 10x faster quote creation
├─ Perfect for dirty/wet hands
└─ Looks professional to clients

Result: Tradies choose TradieMate because
"it actually works on job sites"


📊 SUCCESS METRICS
Voice Feature KPIs:
Adoption Rate:
├─ Target: 60% of users try voice in Week 1
├─ Goal: 40% become daily voice users by Month 3

Time Savings:
├─ Quote creation: 5 mins → 30 seconds (90% faster)
├─ Job notes: 3 mins → 20 seconds (89% faster)

Accuracy:
├─ Native voice: 85-90% accuracy
├─ AI voice: 95-98% accuracy

User Satisfaction:
├─ NPS score for voice users: 70+ (vs 50 for non-voice)
├─ "Most loved feature" in surveys: Voice input

Retention Impact:
├─ Churn rate with voice: 3% (vs 8% without)
├─ Voice users 3x more likely to upgrade


Voice input isn't just a feature—it's the reason tradies will choose TradieMate over expensive competitors. It solves the #1 pain point: "I can't type with dirty hands on a job site."
