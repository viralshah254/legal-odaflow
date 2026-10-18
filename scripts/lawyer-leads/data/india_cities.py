"""Shared India city slugs for directory scrapers."""

INDIAN_CITIES = [
    # Tier 1 metros
    "mumbai", "delhi", "bangalore", "hyderabad", "chennai", "kolkata", "pune",
    "ahmedabad", "surat", "jaipur", "lucknow", "kanpur", "nagpur", "indore",
    "thane", "bhopal", "visakhapatnam", "patna", "vadodara", "ghaziabad",
    "ludhiana", "agra", "nashik", "faridabad", "meerut", "rajkot", "varanasi",
    "srinagar", "aurangabad", "dhanbad", "amritsar", "allahabad", "ranchi",
    "howrah", "coimbatore", "jabalpur", "gwalior", "vijayawada", "jodhpur",
    "madurai", "raipur", "kota", "guwahati", "chandigarh", "solapur", "hubli",
    "mysore", "tiruchirappalli", "bareilly", "aligarh", "tiruppur", "moradabad",
    "jalandhar", "bhubaneswar", "salem", "warangal", "guntur", "bhiwandi",
    "saharanpur", "gorakhpur", "bikaner", "amravati", "noida", "jamshedpur",
    "bhilai", "cuttack", "firozabad", "kochi", "bhavnagar", "dehradun",
    "durgapur", "asansol", "nanded", "kolhapur", "ajmer", "gulbarga", "jamnagar",
    "ujjain", "loni", "siliguri", "jhansi", "ulhasnagar", "jammu", "mangalore",
    "erode", "belgaum", "ambattur", "tirunelveli", "malegaon", "gaya", "jalgaon",
    "udaipur", "maheshtala", "davanagere", "kozhikode", "akola", "kurnool",
    "rajahmundry", "bellary", "patiala", "gopalpur", "agartala", "bhagalpur",
    "muzaffarpur", "bhatpara", "panihati", "latur", "dhule", "rohtak", "korba",
    "bhilwara", "berhampur", "muzaffarnagar", "ahmednagar", "mathura", "kollam",
    "avadi", "kadapa", "kamarhati", "sambalpur", "bilaspur", "shahjahanpur",
    "satara", "bijapur", "rampur", "shimoga", "chandrapur", "junagadh", "thrissur",
    "alwar", "bardhaman", "kulti", "kakinada", "nizamabad", "parbhani", "tumkur",
    "khammam", "ozhukarai", "bihar-sharif", "panipat", "darbhanga", "bally",
    "aizawl", "dewas", "ichalkaranji", "karnal", "bathinda", "jalna", "eluru",
    "kirari-suleman-nagar", "barabanki", "purnia", "satna", "mau", "sonipat",
    "farrukhabad", "sagar", "rourkela", "durg", "imphal", "ratlam", "hapur",
    "arrah", "anantapur", "karimnagar", "etawah", "ambernath", "north-dumdum",
    "bharatpur", "begusarai", "new-delhi", "gandhidham", "barasat", "tiruvottiyur",
    "pondicherry", "sikar", "thoothukudi", "rewa", "mirzapur", "raichur", "pali",
    "ramagundam", "haridwar", "vijayanagaram", "katihar", "nagercoil", "sri-ganganagar",
    "karawal-nagar", "mango", "thanjavur", "bulandshahr", "uluberia", "murwara",
    "sambhal", "singrauli", "nadiad", "secunderabad", "naihati", "yamunanagar",
    "bidhan-nagar", "pallavaram", "bidar", "munger", "panchkula", "burhanpur",
    "kharagpur", "dindigul", "gandhinagar", "hospet", "nangloi-jat", "malda",
    "ongole", "deoghar", "chapra", "haldia", "khandwa", "nandyal", "chittoor",
    "morena", "amroha", "anand", "bhind", "bhalswa-jahangir-pur", "madhyamgram",
    "bhiwani", "berhampore", "ambala", "morbi", "fatehpur", "raebareli", "khora",
    "chhindwara", "bhusawal", "orai", "bahraich", "vellore", "mahesana", "sambalpur",
    "raiganj", "hoshiarpur", "mira-bhayandar", "jalna", "palghar", "shivpuri",
    "roorkee", "hugli-chinsurah", "guntakal", "tenali", "proddatur", "sri-city",
    "shillong", "itanagar", "kohima", "gangtok", "port-blair", "silvassa", "daman",
    "kavaratti", "leh", "shimla", "panaji", "dispur", "itanagar", "kavaratti",
]

# Deduplicated while preserving order
_seen: set[str] = set()
INDIAN_CITIES_UNIQUE: list[str] = []
for _c in INDIAN_CITIES:
    if _c not in _seen:
        _seen.add(_c)
        INDIAN_CITIES_UNIQUE.append(_c)

INDIAN_CITIES = INDIAN_CITIES_UNIQUE
