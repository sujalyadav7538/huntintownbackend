import "dotenv/config";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import connectDB from "./utils/MongoDBClient.js";
import Post from "./models/postSchema.js";
import User from "./models/userSchema.js";
import Response from "./models/responseSchema.js";
import { POST_STATUS, RESPONSE_STATUS } from "./config/constants.js";

const FRONTEND_CATEGORIES = [
  "technology",
  "design",
  "marketing",
  "writing",
  "education",
  "finance",
  "healthcare",
  "history",
  "legal",
  "home & living",
  "transport",
  "automotive",
  "events",
  "photography",
  "video",
  "music",
  "fitness",
  "beauty",
  "food",
  "cooking",
  "shopping",
  "travel",
  "tourism",
  "business",
  "consulting",
  "freelancing",
  "jobs",
  "accounting",
  "real_estate",
  "construction",
  "repair",
  "plumbing",
  "electrical",
  "cleaning",
  "security",
  "delivery",
  "logistics",
  "childcare",
  "pets",
  "gardening",
  "sports",
  "gaming",
  "entertainment",
  "social",
  "community",
  "other",
];

// ── Cloudinary sample image URLs ─────────────────────────────────────────────
const CLOUDINARY_IMAGES = [
  "https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/architecture-signs.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/beach-boat.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/girl-urban-view.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/nature-mountains.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/food/pot-mussels.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/food/dessert.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/people/smiling-man.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/people/boy-snow-hoodie.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/animals/cat.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/animals/dog.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/car-interior-design.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/leather-bag-gray.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/balloons.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/outdoor-woman.jpg",
  "https://res.cloudinary.com/demo/image/upload/v1/samples/bike.jpg",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
// hoursAgo(n) produces a Date n hours in the past, used to control freshness score
function hoursAgo(n) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

// ── Seed data ─────────────────────────────────────────────────────────────────
// Each template may set:
//   createdAt   → controls freshnessScore (≤6h=20, ≤24h=15, ≤72h=10, ≤168h=5, else=0)
//   applicants  → array length controls engagementScore (0=15, ≤2=10, ≤5=5, else=0)
//   budget      → plain numeric string for budgetScore (≥5000=2 … ≥100000=10)
//                 strings with  prefix produce NaN → score 0, intentional for testing
//   coordinates → [lng, lat] distance from test user drives locationScore
//
// Test user assumed at New Delhi centre: [77.2090, 28.6139]
// Distance bands: ≤2km=30 | ≤5km=20 | ≤10km=10 | ≤20km=5 | >20km=0
const POST_TEMPLATES = [
  // ── LOCATION BAND: ≤2 km (locationScore=30) ─────────────────────────────
  {
    title: "Electrician Needed for Ceiling Fan Repair",
    description:
      "My ceiling fan has stopped working and needs urgent repair. Looking for an experienced electrician who can visit today.",
    category: "Home Services",
    address: "Janpath, New Delhi",
    budget: "1000",
    timeline: "Today before 6 PM",
    questions: [
      "How many years of experience?",
      "Can you visit today?",
      "Do you carry tools?",
    ],
    coordinates: [77.2195, 28.6315], // ~1.5 km
    createdAt: hoursAgo(2), // freshness=20 (≤6h)
    applicants: 0, // engagement=15
  },
  {
    title: "Need a Plumber for Bathroom Tap Fix",
    description:
      "A tap in my bathroom is continuously dripping. Looking for an experienced plumber to fix it quickly.",
    category: "Home Services",
    address: "Mandi House, New Delhi",
    budget: "600",
    timeline: "Today",
    questions: ["Can you come today?", "Do you provide a warranty?"],
    coordinates: [77.2311, 28.6254], // ~2 km
    createdAt: hoursAgo(5), // freshness=20 (≤6h)
    applicants: 1, // engagement=10
  },
  {
    title: "House Cleaning for 3BHK Apartment",
    description:
      "Need a thorough deep cleaning for a 3BHK apartment before Diwali. Prefer experienced team.",
    category: "Cleaning Services",
    address: "Barakhamba Road, New Delhi",
    budget: "2500",
    timeline: "This weekend",
    questions: [
      "Do you bring your own supplies?",
      "How long will it take?",
      "How many people in the team?",
    ],
    coordinates: [77.2245, 28.6285], // ~1.8 km
    createdAt: hoursAgo(18), // freshness=15 (≤24h)
    applicants: 2, // engagement=10
  },
  {
    title: "Legal Advice for Rental Agreement Dispute",
    description:
      "I am in a dispute with my landlord over a rental agreement clause and need a lawyer's opinion.",
    category: "Legal Services",
    address: "ITO, New Delhi",
    budget: "3000",
    timeline: "Within 3 days",
    questions: [
      "Do you specialise in tenant-landlord law?",
      "Do you offer video consultations?",
    ],
    coordinates: [77.2413, 28.6285], // ~3 km but within 2 km band roughly
    createdAt: hoursAgo(30), // freshness=15 (≤24h)
    applicants: 0, // engagement=15
  },

  // ── LOCATION BAND: ≤5 km (locationScore=20) ──────────────────────────────
  {
    title: "React Developer for Dashboard Feature",
    description:
      "Need a React developer to build a real-time analytics dashboard with chart components. Part-time, 2 weeks.",
    category: "Tech & IT",
    address: "Lajpat Nagar, New Delhi",
    budget: "25000", // numeric string → budgetScore=6
    timeline: "2 weeks",
    questions: [
      "Share your GitHub profile?",
      "Are you available for daily standups?",
      "Experience with recharts or Chart.js?",
    ],
    coordinates: [77.243, 28.57], // ~5 km south
    createdAt: hoursAgo(4), // freshness=20 (≤6h)
    applicants: 0, // engagement=15
  },
  {
    title: "Node.js Backend Developer Needed",
    description:
      "Looking for a Node.js developer to build REST APIs for a logistics startup. MongoDB experience preferred.",
    category: "Tech & IT",
    address: "Nehru Place, New Delhi",
    budget: "30000", // numeric string → budgetScore=6
    timeline: "1 month",
    questions: [
      "What is your hourly rate?",
      "Are you comfortable with Express and Mongoose?",
    ],
    coordinates: [77.2507, 28.5494], // ~7 km south
    createdAt: hoursAgo(10), // freshness=15 (≤24h)
    applicants: 3, // engagement=5
  },
  {
    title: "Personal Trainer for Weight Loss Programme",
    description:
      "Looking for a certified personal trainer to design a 3-month weight loss and fitness programme.",
    category: "Health & Fitness",
    address: "South Extension, New Delhi",
    budget: "12000", // numeric string → budgetScore=4
    timeline: "3 months",
    questions: [
      "Are you certified by a recognised body?",
      "Will you create a diet plan too?",
    ],
    coordinates: [77.2195, 28.58], // ~3.5 km south
    createdAt: hoursAgo(48), // freshness=10 (≤72h)
    applicants: 5, // engagement=5
  },
  {
    title: "Graphic Designer for Social Media Pack",
    description:
      "My brand needs a consistent social media design pack — posts, stories, and highlight covers for Instagram.",
    category: "Design & Creative",
    address: "Hauz Khas, New Delhi",
    budget: "8000", // numeric string → budgetScore=2
    timeline: "1 week",
    questions: [
      "Can I see past social media work?",
      "Will you deliver editable files?",
    ],
    coordinates: [77.2048, 28.5494], // ~7 km south-west
    createdAt: hoursAgo(60), // freshness=10 (≤72h)
    applicants: 2, // engagement=10
  },

  // ── LOCATION BAND: ≤10 km (locationScore=10) ─────────────────────────────
  {
    title: "Driving Instructor for 15 Sessions",
    description:
      "Looking for a patient and experienced driving instructor for a complete beginner. Manual car preferred.",
    category: "Transport & Delivery",
    address: "Rohini Sector 3, New Delhi",
    budget: "6000",
    timeline: "Over 3 weeks",
    questions: [
      "Do you provide the car for practice?",
      "Are you licensed to teach?",
    ],
    coordinates: [77.1195, 28.705], // ~10 km north-west
    createdAt: hoursAgo(3), // freshness=20 (≤6h)
    applicants: 0, // engagement=15
  },
  {
    title: "English Tutor for Corporate Communication",
    description:
      "I need an English tutor to help improve my business writing and spoken English for corporate meetings.",
    category: "Education & Tutoring",
    address: "Pitampura, New Delhi",
    budget: "800/hour",
    timeline: "Twice a week",
    questions: [
      "Do you have experience with corporate clients?",
      "Online or in-person?",
    ],
    coordinates: [77.1315, 28.705], // ~9 km north
    createdAt: hoursAgo(20), // freshness=15 (≤24h)
    applicants: 1, // engagement=10
  },
  {
    title: "Event Planner for 50-Guest Birthday Party",
    description:
      "Planning a birthday party for 50 guests and need an experienced event planner to handle décor, catering coordination, and entertainment.",
    category: "Event Planning",
    address: "Janakpuri, New Delhi",
    budget: "50000", // numeric string → budgetScore=8
    timeline: "3 weeks from now",
    questions: [
      "Share your portfolio of past events?",
      "Do you have vendor tie-ups?",
      "Is AV equipment included?",
    ],
    coordinates: [77.0814, 28.6313], // ~8 km west
    createdAt: hoursAgo(96), // freshness=5 (≤168h)
    applicants: 4, // engagement=5
  },
  {
    title: "Tailor for Wedding Suit Stitching",
    description:
      "Need a skilled tailor to stitch a traditional sherwani and suit for an upcoming wedding.",
    category: "Tailoring & Alterations",
    address: "Karol Bagh, New Delhi",
    budget: "9000",
    timeline: "2 weeks",
    questions: [
      "Do you have experience with sherwanis?",
      "Can I visit for trial fitting?",
    ],
    coordinates: [77.1907, 28.6519], // ~5 km north-west
    createdAt: hoursAgo(50), // freshness=10 (≤72h)
    applicants: 0, // engagement=15
  },
  {
    title: "Gardener for Terrace Garden Maintenance",
    description:
      "My terrace garden with 30+ pots needs weekly maintenance — watering, pruning, and seasonal planting.",
    category: "Gardening & Landscaping",
    address: "Mayur Vihar Phase 1, New Delhi",
    budget: "2000/month",
    timeline: "Weekly visits",
    questions: [
      "Do you have experience with container gardening?",
      "Can you also suggest seasonal plants?",
    ],
    coordinates: [77.2965, 28.6053], // ~8 km east
    createdAt: hoursAgo(72), // freshness=10 (≤72h)
    applicants: 0, // engagement=15
  },
  {
    title: "Accountant for GST Filing and Bookkeeping",
    description:
      "Small business owner looking for an accountant to handle monthly GST filing and maintain books of accounts.",
    category: "Finance & Accounting",
    address: "Shahdara, New Delhi",
    budget: "3500/month",
    timeline: "Ongoing",
    questions: [
      "Are you a CA or CMA?",
      "How many clients do you currently handle?",
    ],
    coordinates: [77.2892, 28.6681], // ~10 km north-east
    createdAt: hoursAgo(36), // freshness=15 (≤24h)
    applicants: 2, // engagement=10
  },

  // ── LOCATION BAND: ≤20 km (locationScore=5) ──────────────────────────────
  {
    title: "Plumber for Bathroom Renovation Work",
    description:
      "Full bathroom renovation underway and need an experienced plumber for all plumbing work including new fittings.",
    category: "Home Services",
    address: "Sector 62, Noida, Uttar Pradesh",
    budget: "15000",
    timeline: "Starting next week",
    questions: [
      "Have you done full bathroom plumbing before?",
      "Can you provide an itemised estimate?",
    ],
    coordinates: [77.371, 28.627], // ~15 km east
    createdAt: hoursAgo(1), // freshness=20 (≤6h)
    applicants: 0, // engagement=15
  },
  {
    title: "Digital Marketing Expert for E-commerce Brand",
    description:
      "Looking for a digital marketer to run Facebook and Google Ads campaigns for my online clothing brand.",
    category: "Digital Marketing",
    address: "Sector 18, Noida, Uttar Pradesh",
    budget: "20000", // numeric string → budgetScore=6
    timeline: "3-month retainer",
    questions: [
      "What ROAS have you achieved previously?",
      "Do you manage creatives too?",
    ],
    coordinates: [77.3268, 28.5706], // ~16 km south-east
    createdAt: hoursAgo(8), // freshness=15 (≤24h)
    applicants: 6, // engagement=0
  },
  {
    title: "Video Editor for YouTube Channel",
    description:
      "My YouTube channel (tech niche) needs a skilled video editor for 4 videos per month. Fast turnaround needed.",
    category: "Design & Creative",
    address: "Vaishali, Ghaziabad, Uttar Pradesh",
    budget: "8000/month",
    timeline: "Ongoing monthly",
    questions: [
      "Share your YouTube editing portfolio?",
      "Do you add motion graphics?",
      "What software do you use?",
    ],
    coordinates: [77.3406, 28.6453], // ~13 km east
    createdAt: hoursAgo(140), // freshness=5 (≤168h)
    applicants: 7, // engagement=0
  },
  {
    title: "Chef for Corporate Lunch Catering",
    description:
      "Our 30-person office needs a chef to provide a wholesome North Indian lunch every working day.",
    category: "Food & Catering",
    address: "Sector 44, Gurugram, Haryana",
    budget: "100000", // numeric string → budgetScore=10
    timeline: "Monthly contract",
    questions: [
      "Can you provide a sample menu?",
      "Do you have a valid FSSAI licence?",
      "What is your per-person rate?",
    ],
    coordinates: [77.0741, 28.4511], // ~19 km south-west
    createdAt: hoursAgo(16), // freshness=15 (≤24h)
    applicants: 1, // engagement=10
  },
  {
    title: "Wedding Photographer for December Wedding",
    description:
      "Looking for a professional wedding photographer and videographer combo for a 2-day wedding in December.",
    category: "Photography",
    address: "Faridabad, Haryana",
    budget: "150000", // numeric string → budgetScore=10
    timeline: "December 14-15",
    questions: [
      "Share your wedding portfolio?",
      "Do you cover pre-wedding shoots?",
      "Is drone coverage included?",
    ],
    coordinates: [77.3178, 28.4089], // ~23 km south (just outside 20km band)
    createdAt: hoursAgo(200), // freshness=0 (>168h)
    applicants: 12, // engagement=0
  },

  // ── LOCATION: FAR >20 km (locationScore=0) ───────────────────────────────
  {
    title: "Web Developer for Small Business Website",
    description:
      "Need a simple 5-page business website for my bakery. Mobile-friendly design is a must.",
    category: "Tech & IT",
    address: "Koramangala, Bengaluru, Karnataka",
    budget: "15000", // numeric string → budgetScore=4
    timeline: "Within 2 weeks",
    questions: [
      "Can I see your portfolio?",
      "Will you provide post-launch support?",
      "Do you handle hosting?",
    ],
    coordinates: [77.6245, 12.9352],
    createdAt: hoursAgo(5), // freshness=20 (≤6h)
    applicants: 0, // engagement=15
  },
  {
    title: "Maths Tutor for Class 10 Board Exams",
    description:
      "Looking for an experienced maths tutor for my daughter in class 10. Board exams in 3 months.",
    category: "Education & Tutoring",
    address: "Banjara Hills, Hyderabad, Telangana",
    budget: "500/hour",
    timeline: "Starting this week",
    questions: [
      "Which board do you specialise in?",
      "Can you take online sessions?",
    ],
    coordinates: [78.4483, 17.4126],
    createdAt: hoursAgo(48), // freshness=10 (≤72h)
    applicants: 3, // engagement=5
  },
  {
    title: "Carpenter for Wardrobe Installation",
    description:
      "I have a flat-pack wardrobe that needs to be assembled and installed by a skilled carpenter.",
    category: "Home Services",
    address: "Andheri West, Mumbai, Maharashtra",
    budget: "1500",
    timeline: "This weekend",
    questions: [
      "Have you assembled flat-pack furniture before?",
      "How long will it take?",
    ],
    coordinates: [72.8369, 19.1196],
    createdAt: hoursAgo(100), // freshness=5 (≤168h)
    applicants: 0, // engagement=15
  },
  {
    title: "Yoga Instructor for Home Sessions",
    description:
      "Looking for a certified yoga instructor for morning sessions at home, for a family of 3.",
    category: "Health & Fitness",
    address: "Jubilee Hills, Hyderabad, Telangana",
    budget: "700/session",
    timeline: "3 days a week",
    questions: ["Are you certified?", "What yoga styles do you teach?"],
    coordinates: [78.4073, 17.4325],
    createdAt: hoursAgo(250), // freshness=0 (>168h)
    applicants: 8, // engagement=0
  },
  {
    title: "Content Writer for 10 SEO Blog Articles",
    description:
      "Need a freelance content writer to produce 10 SEO-optimised blog articles on home décor topics.",
    category: "Writing & Content",
    address: "Pune, Maharashtra",
    budget: "300/article",
    timeline: "10 days",
    questions: [
      "Can you share writing samples?",
      "Are you comfortable with Surfer SEO?",
    ],
    coordinates: [73.8567, 18.5204],
    createdAt: hoursAgo(3), // freshness=20 (≤6h)
    applicants: 1, // engagement=10
  },
  {
    title: "Logo and Brand Identity Design",
    description:
      "My startup needs a professional logo and brand identity kit from a creative designer.",
    category: "Design & Creative",
    address: "Salt Lake City, Kolkata, West Bengal",
    budget: "5000", // numeric string → budgetScore=2
    timeline: "5 business days",
    questions: [
      "Can you share 3 initial concepts?",
      "How many revision rounds?",
      "Do you provide source files?",
    ],
    coordinates: [88.4178, 22.5764],
    createdAt: hoursAgo(22), // freshness=15 (≤24h)
    applicants: 2, // engagement=10
  },
  {
    title: "Cook for Weekend House Party (15 Guests)",
    description:
      "Planning a party for 15 guests. Need a skilled cook for North Indian and Chinese dishes.",
    category: "Food & Catering",
    address: "Powai, Mumbai, Maharashtra",
    budget: "3000",
    timeline: "This Saturday",
    questions: [
      "What cuisines can you cook?",
      "Do you bring ingredients?",
      "How early will you arrive?",
    ],
    coordinates: [72.908, 19.1176],
    createdAt: hoursAgo(70), // freshness=10 (≤72h)
    applicants: 5, // engagement=5
  },
  {
    title: "Security Guard for Office Night Duty",
    description:
      "Our small office needs a security guard for night duty, Monday to Friday.",
    category: "Security Services",
    address: "Cyber City, Gurugram, Haryana",
    budget: "15000/month",
    timeline: "ASAP",
    questions: [
      "Do you have prior experience?",
      "Are you registered with an agency?",
    ],
    coordinates: [77.0888, 28.4595],
    createdAt: hoursAgo(180), // freshness=0 (>168h)
    applicants: 0, // engagement=15
  },
  {
    title: "Pet Sitter for Labrador (3 Days)",
    description:
      "Travelling out of town and need a responsible pet sitter for my Labrador for 3 days.",
    category: "Pet Care",
    address: "Koregaon Park, Pune, Maharashtra",
    budget: "500/day",
    timeline: "Next Friday to Sunday",
    questions: [
      "Do you have experience with large dogs?",
      "Will you stay at my home?",
    ],
    coordinates: [73.893, 18.5362],
    createdAt: hoursAgo(130), // freshness=5 (≤168h)
    applicants: 3, // engagement=5
  },
  {
    title: "Birthday Party Photographer",
    description:
      "Need a candid photographer for my daughter's 5th birthday party.",
    category: "Photography",
    address: "Anna Nagar, Chennai, Tamil Nadu",
    budget: "4000",
    timeline: "Next Sunday 3 PM to 7 PM",
    questions: [
      "Share your event portfolio?",
      "Edited photos within 48 hours?",
      "Do you have own equipment?",
    ],
    coordinates: [80.2101, 13.085],
    createdAt: hoursAgo(55), // freshness=10 (≤72h)
    applicants: 1, // engagement=10
  },
  {
    title: "House Painter for 2BHK Flat",
    description:
      "Looking for a professional painter to repaint our 2BHK. Walls only, no woodwork required.",
    category: "Home Services",
    address: "Indiranagar, Bengaluru, Karnataka",
    budget: "12000",
    timeline: "Within 1 week",
    questions: ["Do you supply the paint?", "How many coats will you apply?"],
    coordinates: [77.6413, 12.9719],
    createdAt: hoursAgo(160), // freshness=5 (≤168h)
    applicants: 4, // engagement=5
  },
  {
    title: "AC Technician for Servicing and Gas Refill",
    description:
      "My split AC is not cooling properly. Need a technician for servicing and possible gas refill.",
    category: "Home Services",
    address: "Sector 17, Chandigarh",
    budget: "1200",
    timeline: "Tomorrow",
    questions: ["What brands do you service?", "Do you carry gas cylinders?"],
    coordinates: [76.7794, 30.7333],
    createdAt: hoursAgo(9), // freshness=15 (≤24h)
    applicants: 0, // engagement=15
  },
  {
    title: "Driver for Airport Drop at 4 AM",
    description:
      "Need a reliable driver to drop me to IGI Airport Terminal 3 early tomorrow morning.",
    category: "Transport & Delivery",
    address: "Dwarka Sector 10, New Delhi",
    budget: "600",
    timeline: "Tomorrow 4 AM",
    questions: ["Do you know the route to T3?", "Is your vehicle AC?"],
    coordinates: [76.9948, 28.595],
    createdAt: hoursAgo(1), // freshness=20 (≤6h)
    applicants: 0, // engagement=15
  },

  // ── HIGH-BUDGET posts (testing budgetScore across all tiers) ─────────────
  {
    title: "Full-Stack Developer for SaaS Product (6 Months)",
    description:
      "Series A startup looking for a senior full-stack developer to lead product development for 6 months.",
    category: "Tech & IT",
    address: "HSR Layout, Bengaluru, Karnataka",
    budget: "300000", // → budgetScore=10 (≥100000)
    timeline: "6 months",
    questions: [
      "Share your LinkedIn and GitHub?",
      "Have you led a product team before?",
      "Are you open to equity?",
    ],
    coordinates: [77.6434, 12.9116],
    createdAt: hoursAgo(2), // freshness=20
    applicants: 0, // engagement=15
  },
  {
    title: "Interior Designer for 4BHK Villa",
    description:
      "Need a premium interior designer for a 4BHK villa — living room, bedrooms, kitchen, and bathrooms.",
    category: "Design & Creative",
    address: "Whitefield, Bengaluru, Karnataka",
    budget: "200000", // → budgetScore=10 (≥100000)
    timeline: "3 months",
    questions: [
      "Share your portfolio of premium projects?",
      "Do you manage contractors too?",
    ],
    coordinates: [77.748, 12.9698],
    createdAt: hoursAgo(30), // freshness=15 (≤24h)
    applicants: 2, // engagement=10
  },
  {
    title: "Wedding Planner for Destination Wedding (Rajasthan)",
    description:
      "Planning a 3-day destination wedding in Udaipur for 200 guests. Need an experienced wedding planner.",
    category: "Event Planning",
    budget: "500000", // → budgetScore=10 (≥100000)
    address: "Udaipur, Rajasthan",
    timeline: "Event in February",
    questions: [
      "Have you done destination weddings?",
      "Do you have Udaipur vendor contacts?",
      "Can you handle travel logistics?",
    ],
    coordinates: [73.7125, 24.5854],
    createdAt: hoursAgo(50), // freshness=10 (≤72h)
    applicants: 5, // engagement=5
  },
  {
    title: "Corporate Videographer for Product Launch",
    description:
      "Tech company needs a professional videographer for a product launch event — 2-day shoot with post-production.",
    category: "Photography",
    budget: "75000", // → budgetScore=8 (≥50000)
    address: "BKC, Mumbai, Maharashtra",
    timeline: "In 3 weeks",
    questions: [
      "Share your corporate video portfolio?",
      "Do you have 4K equipment?",
      "Is colour grading included?",
    ],
    coordinates: [72.8644, 19.0596],
    createdAt: hoursAgo(12), // freshness=15 (≤24h)
    applicants: 3, // engagement=5
  },
  {
    title: "Legal Counsel for Startup Incorporation",
    description:
      "Founding team needs a startup lawyer to handle company incorporation, shareholder agreement, and IP filing.",
    category: "Legal Services",
    budget: "60000", // → budgetScore=8 (≥50000)
    address: "Bandra West, Mumbai, Maharashtra",
    timeline: "Within 2 weeks",
    questions: [
      "How many startups have you incorporated?",
      "Do you handle DPIIT recognition?",
    ],
    coordinates: [72.8347, 19.0596],
    createdAt: hoursAgo(40), // freshness=10 (≤72h)
    applicants: 1, // engagement=10
  },
  {
    title: "Senior Data Scientist for ML Model",
    description:
      "Fintech startup needs a data scientist to build a credit scoring model using ML. Remote friendly.",
    category: "Tech & IT",
    budget: "80000", // → budgetScore=8 (≥50000)
    address: "Andheri East, Mumbai, Maharashtra",
    timeline: "3 months contract",
    questions: [
      "Share past ML projects?",
      "Experience with scikit-learn / XGBoost?",
      "Are you open to remote?",
    ],
    coordinates: [72.8692, 19.1136],
    createdAt: hoursAgo(6), // freshness=20 (≤6h)
    applicants: 0, // engagement=15
  },

  // ── HIGH ENGAGEMENT (testing low engagement score) ───────────────────────
  {
    title: "House Help Needed for Daily Chores",
    description:
      "Looking for a full-time house help for daily chores — cooking, cleaning, and grocery assistance.",
    category: "Cleaning Services",
    address: "Vasant Kunj, New Delhi",
    budget: "8000/month",
    timeline: "Immediate",
    questions: ["Do you have references?", "Are you comfortable with cooking?"],
    coordinates: [77.1561, 28.5274], // ~9 km
    createdAt: hoursAgo(24), // freshness=15 (≤24h)
    applicants: 15, // engagement=0 (>5)
  },
  {
    title: "Delivery Partner for D2C Brand",
    description:
      "Our D2C snack brand needs a delivery partner for same-day deliveries within Delhi NCR.",
    category: "Transport & Delivery",
    address: "Okhla Industrial Area, New Delhi",
    budget: "1000/day",
    timeline: "Ongoing",
    questions: [
      "Do you own a 2-wheeler?",
      "How many orders can you deliver per day?",
    ],
    coordinates: [77.2762, 28.5366], // ~11 km
    createdAt: hoursAgo(48), // freshness=10 (≤72h)
    applicants: 20, // engagement=0 (>5)
  },
  {
    title: "Part-Time Receptionist for Clinic",
    description:
      "A dental clinic in Saket needs a part-time receptionist for weekday mornings.",
    category: "Healthcare Support",
    address: "Saket, New Delhi",
    budget: "5000/month",
    timeline: "Immediate joining",
    questions: [
      "Do you have clinic reception experience?",
      "Are you comfortable with billing software?",
    ],
    coordinates: [77.2136, 28.5279], // ~10 km south
    createdAt: hoursAgo(72), // freshness=10 (≤72h)
    applicants: 11, // engagement=0 (>5)
  },

  // ── STALE posts (freshnessScore=0) ───────────────────────────────────────
  {
    title: "App UI/UX Designer for Mobile App Redesign",
    description:
      "Our 2-year-old app needs a visual redesign. Looking for a UI/UX designer who has worked on consumer apps.",
    category: "Design & Creative",
    address: "Kondapur, Hyderabad, Telangana",
    budget: "35000", // → budgetScore=6 (≥20000)
    timeline: "6 weeks",
    questions: [
      "Share your Figma portfolio?",
      "Do you conduct user research?",
      "Can you deliver a design system?",
    ],
    coordinates: [78.3631, 17.4713],
    createdAt: hoursAgo(210), // freshness=0 (>168h)
    applicants: 0, // engagement=15
  },
  {
    title: "Accountant for Annual ITR Filing",
    description:
      "Looking for a CA to file my personal and business ITR. Have income from salary, freelancing, and capital gains.",
    category: "Finance & Accounting",
    address: "T Nagar, Chennai, Tamil Nadu",
    budget: "4000",
    timeline: "Before July 31",
    questions: [
      "Are you a practising CA?",
      "How do you handle capital gains calculations?",
    ],
    coordinates: [80.2319, 13.0408],
    createdAt: hoursAgo(300), // freshness=0 (>168h)
    applicants: 6, // engagement=0
  },
  {
    title: "Landscaper for Front Garden Redesign",
    description:
      "My front garden needs a complete redesign with seasonal plants, mulching, and a small water feature.",
    category: "Gardening & Landscaping",
    address: "Whitefield, Bengaluru, Karnataka",
    budget: "20000",
    timeline: "Within 1 month",
    questions: [
      "Do you design and execute yourself?",
      "Can you suggest low-maintenance plants?",
    ],
    coordinates: [77.748, 12.9698],
    createdAt: hoursAgo(400), // freshness=0 (>168h)
    applicants: 2, // engagement=10
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function pickRandom(arr, count = 1) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return count === 1 ? shuffled[0] : shuffled.slice(0, count);
}

function randomExpiryDays() {
  return [3, 5, 7, 10, 14][Math.floor(Math.random() * 5)];
}

// ── Main seed function ────────────────────────────────────────────────────────
async function seed() {
  await connectDB();

  // Keep abc/xyz as post authors only (never as responders).
  const postAuthorEmails = ["abc@gmail.com", "xyz@gmail.com"];
  // Response seed users (third user + others) used only for response seeding.
  const responseSeederEmails = [
    "third.user@gmail.com",
    "helper.one@gmail.com",
    "helper.two@gmail.com",
    "helper2.two@gmail.com",
    "helper3.two@gmail.com",
  ];
  const hashed = await bcrypt.hash("qwerty", 10);

  const postAuthorUsers = [];
  const responseSeedUsers = [];

  for (const email of postAuthorEmails) {
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        id: uuidv4(),
        email,
        passwordHash: hashed,
        name: email.split("@")[0],
        bio: "Auto-generated seed account",
        location: {
          type: "Point",
          coordinates: [77.209, 28.6139],
        },
        address: "New Delhi, India",
      });
      console.log("Created seed user:", user.email);
    }

    postAuthorUsers.push(user);
  }

  for (const email of responseSeederEmails) {
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        id: uuidv4(),
        email,
        passwordHash: hashed,
        name: email.split("@")[0],
        bio: "Auto-generated response seed account",
        location: {
          type: "Point",
          coordinates: [77.209, 28.6139],
        },
        address: "New Delhi, India",
      });
      console.log("Created response seed user:", user.email);
    }

    responseSeedUsers.push(user);
  }

  // Clear existing seeded posts by these users only.
  const deleted = await Post.deleteMany({
    author: { $in: postAuthorUsers.map((u) => u._id) },
  });
  console.log(`Cleared ${deleted.deletedCount} existing seed posts`);

  // Build post documents
  const posts = POST_TEMPLATES.map((template, index) => {
    const expiryDays = randomExpiryDays();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const imageCount = Math.floor(Math.random() * 3) + 1; // 1–3 images
    const images = pickRandom(CLOUDINARY_IMAGES, imageCount);

    // Seed fake applicant ObjectIds so engagementScore is testable
    const applicantCount = template.applicants ?? 0;
    const fakeApplicants = Array.from(
      { length: applicantCount },
      () => new mongoose.Types.ObjectId(),
    );

    const randomAuthor =
      postAuthorUsers[Math.floor(Math.random() * postAuthorUsers.length)];
    const normalizedCategory =
      FRONTEND_CATEGORIES[index % FRONTEND_CATEGORIES.length];

    return {
      title: template.title,
      description: template.description,
      category: normalizedCategory,
      address: template.address,
      location: {
        type: "Point",
        coordinates: template.coordinates, // [longitude, latitude]
      },
      type: "help_needed",
      budget: template.budget,
      timeline: template.timeline,
      expiryDays,
      expiresAt,
      status: POST_STATUS.LIVE,
      questions: template.questions,
      images: Array.isArray(images) ? images : [images],
      contactMethods: {
        whatsApp: Math.random() > 0.3,
        phone: Math.random() > 0.2,
        chat: true,
      },
      author: randomAuthor._id,
      applicants: fakeApplicants,
      responsesCount: applicantCount,
      createdAt: template.createdAt ?? new Date(), // control freshnessScore
    };
  });

  // timestamps:false lets our explicit createdAt values survive (controls freshnessScore)
  const inserted = await Post.insertMany(posts, { timestamps: false });
  console.log(`Seeded ${inserted.length} posts successfully`);

  // Clear existing seeded responses
  const deletedResponses = await Response.deleteMany({
    respondedBy: {
      $in: [...postAuthorUsers, ...responseSeedUsers].map((u) => u._id),
    },
  });
  console.log(
    `Cleared ${deletedResponses.deletedCount} existing seed responses`,
  );

  if (responseSeedUsers.length < 5) {
    throw new Error(
      "Need at least 2 response seed users to create 2 unique responses per post",
    );
  }

  // Create dummy responses for some posts for testing
  const dummyMessages = [
    "I can help you with this. I have 5+ years of experience in this field.",
    "Interested in this work. Available immediately and can start right away.",
    "Perfect timing! I specialize in this area. Let's connect soon.",
    "I have done similar projects before. Check my portfolio for reference.",
    "Very interested! Can deliver quality work within your timeline.",
  ];

  // Add responses to all posts (at least 2 unique responses per post)
  for (let i = 0; i < inserted.length; i++) {
    const post = inserted[i];
    const responseCount =
      responseSeedUsers.length === 2
        ? 2
        : Math.floor(Math.random() * (responseSeedUsers.length - 1)) + 2;

    const selectedResponders = pickRandom(responseSeedUsers, responseCount);
    const respondents = [];

    for (const responder of selectedResponders) {
      const messageIndex = Math.floor(Math.random() * dummyMessages.length);
      const answersToQuestions = (post.questions || []).map((question) => ({
        question,
        answer: "Yes, I can handle this requirement. Let's discuss further.",
      }));

      await Response.create({
        postId: post._id,
        respondedBy: responder._id,
        message: dummyMessages[messageIndex],
        answers: answersToQuestions,
        status: RESPONSE_STATUS.PENDING,
      });

      respondents.push(responder._id);
    }

    // Update post with respondents and count
    await Post.updateOne(
      { _id: post._id },
      {
        respondents: [...new Set(respondents)], // unique respondents
        responsesCount: respondents.length,
      },
    );
  }

  console.log(`Seeded responses for ${inserted.length} posts successfully`);

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
