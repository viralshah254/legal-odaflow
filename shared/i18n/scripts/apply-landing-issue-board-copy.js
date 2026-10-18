#!/usr/bin/env node
/**
 * Apply landing issue board + issue checker copy updates across all locales.
 */
const fs = require('fs')
const path = require('path')

const SHARED = path.join(__dirname, '..')
const OVERRIDES = path.join(__dirname, 'locale-overrides')
const LOCALES = ['en', 'fr', 'de', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'ur', 'pa', 'or', 'as']

const MARKETING_KEYS = {
  en: {
    titleIssueCheck: 'Understand your legal situation',
    subtitleIssueCheck:
      'Tell us what happened. Umbrella will identify the key legal issues, explain your options, and guide you toward the documents you may need.',
    titleResearch: 'Research a legal question',
    subtitleResearch:
      'Ask a focused legal question and receive a structured answer supported by relevant legislation, cases, and citations.',
    placeholderIssueCheck:
      'Describe what happened, who was involved, important dates, and what you want to achieve.',
    placeholderResearch: 'Enter the legal question you want researched…',
    helperIssueCheck:
      'You can write in your own words. The more relevant detail you provide, the more useful the analysis will be.',
    helperResearch: 'Include the jurisdiction and specific issue for more precise results.',
    taskIssueCheck: 'Issue Checker',
    taskResearch: 'Legal Research',
    taskDrafting: 'Draft a Document',
    taskDocumentReview: 'Review a Document',
    checkMySituation: 'Check my situation',
    researchThisQuestion: 'Research this question',
    enterAtLeastChars: 'Enter at least {count} characters',
    charCount: '{current} / {max} characters',
    footerIssueCheck1: 'Free initial check',
    footerIssueCheck2: 'Applicable law identified',
    footerIssueCheck3: 'Document guidance included',
    footerResearch1: 'Authority-backed answer',
    footerResearch2: 'Relevant cases and statutes',
    footerResearch3: 'Clear citations',
  },
  hi: {
    titleIssueCheck: 'अपनी कानूनी स्थिति समझें',
    subtitleIssueCheck:
      'हमें बताएं क्या हुआ। Umbrella मुख्य कानूनी मुद्दों की पहचान करेगा, आपके विकल्प समझाएगा और आवश्यक दस्तावेज़ों की ओर मार्गदर्शन करेगा।',
    titleResearch: 'कानूनी प्रश्न पर शोध करें',
    subtitleResearch:
      'एक स्पष्ट कानूनी प्रश्न पूछें और प्रासंगिक कानून, मामलों और उद्धरणों के साथ संरचित उत्तर पाएं।',
    placeholderIssueCheck:
      'क्या हुआ, कौन शामिल था, महत्वपूर्ण तिथियाँ और आप क्या हासिल करना चाहते हैं — बताएं।',
    placeholderResearch: 'जिस कानूनी प्रश्न पर शोध चाहिए, वह यहाँ लिखें…',
    helperIssueCheck:
      'आप अपने शब्दों में लिख सकते हैं। जितना प्रासंगिक विवरण देंगे, विश्लेषण उतना उपयोगी होगा।',
    helperResearch: 'अधिक सटीक परिणाम के लिए क्षेत्राधिकार और विशिष्ट मुद्दा शामिल करें।',
    taskIssueCheck: 'समस्या जाँच',
    taskResearch: 'कानूनी शोध',
    taskDrafting: 'दस्तावेज़ का मसौदा',
    taskDocumentReview: 'दस्तावेज़ की समीक्षा',
    checkMySituation: 'मेरी स्थिति जाँचें',
    researchThisQuestion: 'इस प्रश्न पर शोध करें',
    enterAtLeastChars: 'कम से कम {count} अक्षर लिखें',
    charCount: '{current} / {max} अक्षर',
    footerIssueCheck1: 'मुफ़्त प्रारंभिक जाँच',
    footerIssueCheck2: 'लागू कानून की पहचान',
    footerIssueCheck3: 'दस्तावेज़ मार्गदर्शन शामिल',
    footerResearch1: 'प्राधिकार-समर्थित उत्तर',
    footerResearch2: 'प्रासंगिक मामले और क़ानून',
    footerResearch3: 'स्पष्ट उद्धरण',
  },
  bn: {
    titleIssueCheck: 'আপনার আইনি পরিস্থিতি বুঝুন',
    subtitleIssueCheck:
      'কী ঘটেছে তা বলুন। Umbrella মূল আইনি বিষয়গুলো চিহ্নিত করবে, আপনার বিকল্পগুলো ব্যাখ্যা করবে এবং প্রয়োজনীয় নথির দিকে গাইড করবে।',
    titleResearch: 'একটি আইনি প্রশ্ন নিয়ে গবেষণা',
    subtitleResearch:
      'একটি নির্দিষ্ট আইনি প্রশ্ন জিজ্ঞাসা করুন এবং প্রাসঙ্গিক আইন, মামলা ও উদ্ধৃতির সহায়তায় কাঠামোবদ্ধ উত্তর পান।',
    placeholderIssueCheck:
      'কী ঘটেছে, কারা জড়িত, গুরুত্বপূর্ণ তারিখ এবং আপনি কী অর্জন করতে চান — বর্ণনা করুন।',
    placeholderResearch: 'যে আইনি প্রশ্ন নিয়ে গবেষণা চান তা লিখুন…',
    helperIssueCheck:
      'আপনি নিজের ভাষায় লিখতে পারেন। যত প্রাসঙ্গিক বিবরণ দেবেন, বিশ্লেষণ তত উপযোগী হবে।',
    helperResearch: 'আরও সুনির্দিষ্ট ফলাফলের জন্য এখতিয়ার ও নির্দিষ্ট বিষয় উল্লেখ করুন।',
    taskIssueCheck: 'সমস্যা যাচাই',
    taskResearch: 'আইনি গবেষণা',
    taskDrafting: 'নথির খসড়া',
    taskDocumentReview: 'নথি পর্যালোচনা',
    checkMySituation: 'আমার পরিস্থিতি যাচাই করুন',
    researchThisQuestion: 'এই প্রশ্ন নিয়ে গবেষণা করুন',
    enterAtLeastChars: 'অন্তত {count}টি অক্ষর লিখুন',
    charCount: '{current} / {max} অক্ষর',
    footerIssueCheck1: 'বিনামূল্যে প্রাথমিক যাচাই',
    footerIssueCheck2: 'প্রযোজ্য আইন চিহ্নিত',
    footerIssueCheck3: 'নথি নির্দেশনা অন্তর্ভুক্ত',
    footerResearch1: 'কর্তৃত্ব-সমর্থিত উত্তর',
    footerResearch2: 'প্রাসঙ্গিক মামলা ও আইন',
    footerResearch3: 'স্পষ্ট উদ্ধৃতি',
  },
  ta: {
    titleIssueCheck: 'உங்கள் சட்ட நிலைமையைப் புரிந்துகொள்ளுங்கள்',
    subtitleIssueCheck:
      'என்ன நடந்தது என்று சொல்லுங்கள். Umbrella முக்கிய சட்ட விஷயங்களைக் கண்டறிந்து, உங்கள் விருப்பங்களை விளக்கி, தேவையான ஆவணங்களுக்கு வழிகாட்டும்.',
    titleResearch: 'ஒரு சட்டக் கேள்வியை ஆராயுங்கள்',
    subtitleResearch:
      'தெளிவான சட்டக் கேள்வியைக் கேட்டு, தொடர்புடைய சட்டம், வழக்குகள் மற்றும் மேற்கோள்களுடன் கட்டமைக்கப்பட்ட பதிலைப் பெறுங்கள்.',
    placeholderIssueCheck:
      'என்ன நடந்தது, யார் சம்பந்தப்பட்டவர், முக்கிய தேதிகள், நீங்கள் எதை அடைய விரும்புகிறீர்கள் — விவரிக்கவும்.',
    placeholderResearch: 'ஆராய வேண்டிய சட்டக் கேள்வியை உள்ளிடவும்…',
    helperIssueCheck:
      'உங்கள் சொந்த வார்த்தைகளில் எழுதலாம். தொடர்புடைய விவரம் அதிகமாக இருந்தால், பகுப்பாய்வு மிகவும் பயனுள்ளதாக இருக்கும்.',
    helperResearch: 'துல்லியமான முடிவுக்கு அதிகார வரம்பு மற்றும் குறிப்பிட்ட விஷயத்தைச் சேர்க்கவும்.',
    taskIssueCheck: 'சிக்கல் சரிபார்ப்பு',
    taskResearch: 'சட்ட ஆராய்ச்சி',
    taskDrafting: 'ஆவணம் வரையுங்கள்',
    taskDocumentReview: 'ஆவணத்தை மதிப்பாய்வு',
    checkMySituation: 'என் நிலைமையை சரிபார்க்கவும்',
    researchThisQuestion: 'இந்தக் கேள்வியை ஆராயுங்கள்',
    enterAtLeastChars: 'குறைந்தது {count} எழுத்துகள் உள்ளிடவும்',
    charCount: '{current} / {max} எழுத்துகள்',
    footerIssueCheck1: 'இலவச ஆரம்ப சரிபார்ப்பு',
    footerIssueCheck2: 'பொருந்தும் சட்டம் கண்டறியப்பட்டது',
    footerIssueCheck3: 'ஆவண வழிகாட்டல் சேர்க்கப்பட்டது',
    footerResearch1: 'அதிகாரம்-ஆதரவு பதில்',
    footerResearch2: 'தொடர்புடைய வழக்குகள் மற்றும் சட்டங்கள்',
    footerResearch3: 'தெளிவான மேற்கோள்கள்',
  },
  te: {
    titleIssueCheck: 'మీ చట్టపరమైన పరిస్థితిని అర్థం చేసుకోండి',
    subtitleIssueCheck:
      'ఏమి జరిగిందో చెప్పండి. Umbrella ప్రధాన చట్టపరమైన అంశాలను గుర్తిస్తుంది, మీ ఎంపికలను వివరిస్తుంది మరియు అవసరమైన పత్రాల వైపు మార్గనిర్దేశం చేస్తుంది.',
    titleResearch: 'చట్టపరమైన ప్రశ్నపై పరిశోధన',
    subtitleResearch:
      'స్పష్టమైన చట్టపరమైన ప్రశ్న అడిగి, సంబంధిత చట్టం, కేసులు మరియు ఉదహరణలతో నిర్మాణాత్మక సమాధానం పొందండి.',
    placeholderIssueCheck:
      'ఏమి జరిగింది, ఎవరు చేరి ఉన్నారు, ముఖ్యమైన తేదీలు, మీరు ఏమి సాధించాలనుకుంటున్నారు — వివరించండి.',
    placeholderResearch: 'మీరు పరిశోధించాలనుకునే చట్టపరమైన ప్రశ్నను నమోదు చేయండి…',
    helperIssueCheck:
      'మీరు మీ స్వంత మాటల్లో రాయవచ్చు. మీరు ఎంత సంబంధిత వివరాలు ఇస్తారో, విశ్లేషణ అంత ఉపయోగకరంగా ఉంటుంది.',
    helperResearch: 'మరింత సరైన ఫలితాల కోసం అధికార పరిధి మరియు నిర్దిష్ట అంశాన్ని చేర్చండి.',
    taskIssueCheck: 'సమస్య తనిఖీ',
    taskResearch: 'చట్టపరమైన పరిశోధన',
    taskDrafting: 'పత్రం రచించండి',
    taskDocumentReview: 'పత్రాన్ని సమీక్షించండి',
    checkMySituation: 'నా పరిస్థితిని తనిఖీ చేయండి',
    researchThisQuestion: 'ఈ ప్రశ్నపై పరిశోధన చేయండి',
    enterAtLeastChars: 'కనీసం {count} అక్షరాలు నమోదు చేయండి',
    charCount: '{current} / {max} అక్షరాలు',
    footerIssueCheck1: 'ఉచిత ప్రారంభ తనిఖీ',
    footerIssueCheck2: 'వర్తించే చట్టం గుర్తించబడింది',
    footerIssueCheck3: 'పత్ర మార్గదర్శకత్వం చేర్చబడింది',
    footerResearch1: 'అధికారం-ఆధారిత సమాధానం',
    footerResearch2: 'సంబంధిత కేసులు మరియు చట్టాలు',
    footerResearch3: 'స్పష్టమైన ఉదహరణలు',
  },
  kn: {
    titleIssueCheck: 'ನಿಮ್ಮ ಕಾನೂನು ಪರಿಸ್ಥಿತಿಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ',
    subtitleIssueCheck:
      'ಏನಾಯಿತೆಂದು ಹೇಳಿ. Umbrella ಪ್ರಮುಖ ಕಾನೂನು ವಿಷಯಗಳನ್ನು ಗುರುತಿಸಿ, ನಿಮ್ಮ ಆಯ್ಕೆಗಳನ್ನು ವಿವರಿಸಿ, ಅಗತ್ಯ ದಾಖಲೆಗಳ ಕಡೆಗೆ ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತದೆ.',
    titleResearch: 'ಕಾನೂನು ಪ್ರಶ್ನೆಯನ್ನು ಸಂಶೋಧಿಸಿ',
    subtitleResearch:
      'ಗಮನಾರ್ಹ ಕಾನೂನು ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ ಮತ್ತು ಸಂಬಂಧಿತ ಕಾನೂನು, ಪ್ರಕರಣಗಳು ಮತ್ತು ಉಲ್ಲೇಖಗಳೊಂದಿಗೆ ರಚನಾತ್ಮಕ ಉತ್ತರ ಪಡೆಯಿರಿ.',
    placeholderIssueCheck:
      'ಏನಾಯಿತು, ಯಾರು ಒಳಗೊಂಡಿದ್ದರು, ಮುಖ್ಯ ದಿನಾಂಕಗಳು, ನೀವು ಏನು ಸಾಧಿಸಲು ಬಯಸುತ್ತೀರಿ — ವಿವರಿಸಿ.',
    placeholderResearch: 'ನೀವು ಸಂಶೋಧಿಸಲು ಬಯಸುವ ಕಾನೂನು ಪ್ರಶ್ನೆಯನ್ನು ನಮೂದಿಸಿ…',
    helperIssueCheck:
      'ನಿಮ್ಮ ಸ್ವಂತ ಪದಗಳಲ್ಲಿ ಬರೆಯಬಹುದು. ಹೆಚ್ಚು ಸಂಬಂಧಿತ ವಿವರ ನೀಡಿದರೆ, ವಿಶ್ಲೇಷಣೆ ಹೆಚ್ಚು ಉಪಯುಕ್ತವಾಗುತ್ತದೆ.',
    helperResearch: 'ಹೆಚ್ಚು ಖಚಿತ ಫಲಿತಾಂಶಗಳಿಗಾಗಿ ಅಧಿಕಾರ ವ್ಯಾಪ್ತಿ ಮತ್ತು ನಿರ್ದಿಷ್ಟ ವಿಷಯವನ್ನು ಸೇರಿಸಿ.',
    taskIssueCheck: 'ಸಮಸ್ಯೆ ಪರಿಶೀಲನೆ',
    taskResearch: 'ಕಾನೂನು ಸಂಶೋಧನೆ',
    taskDrafting: 'ದಾಖಲೆ ರಚಿಸಿ',
    taskDocumentReview: 'ದಾಖಲೆ ಪರಿಶೀಲನೆ',
    checkMySituation: 'ನನ್ನ ಪರಿಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ',
    researchThisQuestion: 'ಈ ಪ್ರಶ್ನೆಯನ್ನು ಸಂಶೋಧಿಸಿ',
    enterAtLeastChars: 'ಕನಿಷ್ಠ {count} ಅಕ್ಷರಗಳನ್ನು ನಮೂದಿಸಿ',
    charCount: '{current} / {max} ಅಕ್ಷರಗಳು',
    footerIssueCheck1: 'ಉಚಿತ ಆರಂಭಿಕ ಪರಿಶೀಲನೆ',
    footerIssueCheck2: 'ಅನ್ವಯವಾಗುವ ಕಾನೂನು ಗುರುತಿಸಲಾಗಿದೆ',
    footerIssueCheck3: 'ದಾಖಲೆ ಮಾರ್ಗದರ್ಶನ ಸೇರಿಸಲಾಗಿದೆ',
    footerResearch1: 'ಅಧಿಕಾರ-ಆಧಾರಿತ ಉತ್ತರ',
    footerResearch2: 'ಸಂಬಂಧಿತ ಪ್ರಕರಣಗಳು ಮತ್ತು ಕಾಯ್ದೆಗಳು',
    footerResearch3: 'ಸ್ಪಷ್ಟ ಉಲ್ಲೇಖಗಳು',
  },
  ml: {
    titleIssueCheck: 'നിങ്ങളുടെ നിയമപരമായ സാഹചര്യം മനസ്സിലാക്കുക',
    subtitleIssueCheck:
      'എന്താണ് സംഭവിച്ചതെന്ന് പറയുക. Umbrella പ്രധാന നിയമ വിഷയങ്ങൾ തിരിച്ചറിയുകയും, നിങ്ങളുടെ തിരഞ്ഞെടുപ്പുകൾ വിശദീകരിക്കുകയും, ആവശ്യമായ രേഖകളിലേക്ക് വഴികാട്ടുകയും ചെയ്യും.',
    titleResearch: 'ഒരു നിയമ ചോദ്യം ഗവേഷണം ചെയ്യുക',
    subtitleResearch:
      'വ്യക്തമായ നിയമ ചോദ്യം ചോദിച്ച്, ബന്ധപ്പെട്ട നിയമം, കേസുകൾ, ഉദ്ധരണികൾ എന്നിവയോടെ ഘടനാപരമായ ഉത്തരം നേടുക.',
    placeholderIssueCheck:
      'എന്ത് സംഭവിച്ചു, ആരൊക്കെ പങ്കെടുത്തു, പ്രധാന തീയതികൾ, നിങ്ങൾ എന്ത് നേടാൻ ആഗ്രഹിക്കുന്നു — വിവരിക്കുക.',
    placeholderResearch: 'ഗവേഷണം ചെയ്യേണ്ട നിയമ ചോദ്യം നൽകുക…',
    helperIssueCheck:
      'നിങ്ങളുടെ സ്വന്തം വാക്കുകളിൽ എഴുതാം. കൂടുതൽ പ്രസക്തമായ വിവരം നൽകുമ്പോൾ, വിശകലനം കൂടുതൽ ഉപയോഗപ്രദമാകും.',
    helperResearch: 'കൂടുതൽ കൃത്യമായ ഫലങ്ങൾക്ക് അധികാരപരിധിയും നിർദ്ദിഷ്ട വിഷയവും ഉൾപ്പെടുത്തുക.',
    taskIssueCheck: 'പ്രശ്ന പരിശോധന',
    taskResearch: 'നിയമ ഗവേഷണം',
    taskDrafting: 'രേഖ തയ്യാറാക്കുക',
    taskDocumentReview: 'രേഖ അവലോകനം',
    checkMySituation: 'എന്റെ സാഹചര്യം പരിശോധിക്കുക',
    researchThisQuestion: 'ഈ ചോദ്യം ഗവേഷണം ചെയ്യുക',
    enterAtLeastChars: 'കുറഞ്ഞത് {count} അക്ഷരങ്ങൾ നൽകുക',
    charCount: '{current} / {max} അക്ഷരങ്ങൾ',
    footerIssueCheck1: 'സൗജന്യ ആദ്യ പരിശോധന',
    footerIssueCheck2: 'ബാധകമായ നിയമം തിരിച്ചറിഞ്ഞു',
    footerIssueCheck3: 'രേഖ മാർഗദർശനം ഉൾപ്പെടുത്തി',
    footerResearch1: 'അധികാര-പിന്തുണയുള്ള ഉത്തരം',
    footerResearch2: 'ബന്ധപ്പെട്ട കേസുകളും ചട്ടങ്ങളും',
    footerResearch3: 'വ്യക്തമായ ഉദ്ധരണികൾ',
  },
  mr: {
    titleIssueCheck: 'तुमची कायदेशीर परिस्थिती समजून घ्या',
    subtitleIssueCheck:
      'काय घडले ते सांगा. Umbrella मुख्य कायदेशीर मुद्दे ओळखेल, तुमचे पर्याय स्पष्ट करेल आणि आवश्यक कागदपत्रांकडे मार्गदर्शन करेल.',
    titleResearch: 'कायदेशीर प्रश्नावर संशोधन',
    subtitleResearch:
      'एक स्पष्ट कायदेशीर प्रश्न विचारा आणि संबंधित कायदा, प्रकरणे आणि उद्धरणांसह संरचित उत्तर मिळवा.',
    placeholderIssueCheck:
      'काय घडले, कोण सहभागी होते, महत्त्वाच्या तारखा, तुम्हाला काय साध्य करायचे — वर्णन करा.',
    placeholderResearch: 'ज्या कायदेशीर प्रश्नावर संशोधन हवे तो प्रविष्ट करा…',
    helperIssueCheck:
      'तुम्ही तुमच्या शब्दात लिहू शकता. जितके प्रासंगिक तपशील द्याल, विश्लेषण तितके उपयुक्त असेल.',
    helperResearch: 'अधिक अचूक निकालासाठी अधिकारक्षेत्र आणि विशिष्ट मुद्दा समाविष्ट करा.',
    taskIssueCheck: 'समस्या तपासणी',
    taskResearch: 'कायदेशीर संशोधन',
    taskDrafting: 'दस्तऐवज मसुदा',
    taskDocumentReview: 'दस्तऐवज पुनरावलोकन',
    checkMySituation: 'माझी परिस्थिती तपासा',
    researchThisQuestion: 'या प्रश्नावर संशोधन करा',
    enterAtLeastChars: 'किमान {count} अक्षरे प्रविष्ट करा',
    charCount: '{current} / {max} अक्षरे',
    footerIssueCheck1: 'मोफत प्रारंभिक तपासणी',
    footerIssueCheck2: 'लागू कायदा ओळखला',
    footerIssueCheck3: 'दस्तऐवज मार्गदर्शन समाविष्ट',
    footerResearch1: 'अधिकार-आधारित उत्तर',
    footerResearch2: 'संबंधित प्रकरणे आणि कायदे',
    footerResearch3: 'स्पष्ट उद्धरणे',
  },
  gu: {
    titleIssueCheck: 'તમારી કાનૂની સ્થિતિ સમજો',
    subtitleIssueCheck:
      'શું થયું તે જણાવો. Umbrella મુખ્ય કાનૂની મુદ્દાઓ ઓળખશે, તમારા વિકલ્પો સમજાવશે અને જરૂરી દસ્તાવેજો તરફ માર્ગદર્શન આપશે.',
    titleResearch: 'કાનૂની પ્રશ્ન પર સંશોધન',
    subtitleResearch:
      'સ્પષ્ટ કાનૂની પ્રશ્ન પૂછો અને સંબંધિત કાયદા, કેસો અને ઉદ્ધરણો સાથે સંરચિત જવાબ મેળવો.',
    placeholderIssueCheck:
      'શું થયું, કોણ સામેલ હતા, મહત્વપૂર્ણ તારીખો, તમે શું પ્રાપ્ત કરવા માંગો છો — વર્ણન કરો.',
    placeholderResearch: 'જે કાનૂની પ્રશ્ન પર સંશોધન જોઈએ તે દાખલ કરો…',
    helperIssueCheck:
      'તમે તમારા પોતાના શબ્દોમાં લખી શકો છો. જેટલી સંબંધિત વિગતો આપશો, વિશ્લેષણ એટલું ઉપયોગી હશે.',
    helperResearch: 'વધુ અચૂક પરિણામ માટે અધિકારક્ષેત્ર અને ચોક્કસ મુદ્દો ઉમેરો.',
    taskIssueCheck: 'સમસ્યા તપાસ',
    taskResearch: 'કાનૂની સંશોધન',
    taskDrafting: 'દસ્તાવેજ ડ્રાફ્ટ',
    taskDocumentReview: 'દસ્તાવેજ review',
    checkMySituation: 'મારી સ્થિતિ તપાસો',
    researchThisQuestion: 'આ પ્રશ્ન પર સંશોધન કરો',
    enterAtLeastChars: 'ઓછામાં ઓછા {count} અક્ષરો દાખલ કરો',
    charCount: '{current} / {max} અક્ષરો',
    footerIssueCheck1: 'મફત પ્રારંભિક તપાસ',
    footerIssueCheck2: 'લાગુ કાયદો ઓળખાયો',
    footerIssueCheck3: 'દસ્તાવેજ માર્ગદર્શન સામેલ',
    footerResearch1: 'અધિકાર-આધારિત જવાબ',
    footerResearch2: 'સંબંધિત કેસો અને કાયદા',
    footerResearch3: 'સ્પષ્ટ ઉદ્ધરણો',
  },
  pa: {
    titleIssueCheck: 'ਆਪਣੀ ਕਾਨੂੰਨੀ ਸਥਿਤੀ ਸਮਝੋ',
    subtitleIssueCheck:
      'ਦੱਸੋ ਕੀ ਹੋਇਆ। Umbrella ਮੁੱਖ ਕਾਨੂੰਨੀ ਮਸਲੇ ਪਛਾਣੇਗਾ, ਤੁਹਾਡੇ ਵਿਕਲਪ ਸਪੱਸ਼ਟ ਕਰੇਗਾ ਅਤੇ ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼ਾਂ ਵੱਲ ਮਾਰਗਦਰਸ਼ਨ ਕਰੇਗਾ।',
    titleResearch: "ਕਾਨੂੰਨੀ ਸਵਾਲ 'ਤੇ ਖੋਜ",
    subtitleResearch:
      'ਇੱਕ ਸਪੱਸ਼ਟ ਕਾਨੂੰਨੀ ਸਵਾਲ ਪੁੱਛੋ ਅਤੇ ਸੰਬੰਧਿਤ ਕਾਨੂੰਨ, ਕੇਸ ਅਤੇ ਹਵਾਲਿਆਂ ਨਾਲ ਢਾਂਚਾਗਤ ਜਵਾਬ ਪਾਓ।',
    placeholderIssueCheck:
      'ਕੀ ਹੋਇਆ, ਕੌਣ ਸ਼ਾਮਲ ਸੀ, ਮਹੱਤਵਪੂਰਨ ਤਾਰੀਖਾਂ, ਤੁਸੀਂ ਕੀ ਹਾਸਲ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ — ਵੇਰਵਾ ਦਿਓ।',
    placeholderResearch: "ਜਿਸ ਕਾਨੂੰਨੀ ਸਵਾਲ 'ਤੇ ਖੋਜ ਚਾਹੀਦੀ ਹੈ ਉਹ ਦਰਜ ਕਰੋ…",
    helperIssueCheck:
      'ਤੁਸੀਂ ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਲਿਖ ਸਕਦੇ ਹੋ। ਜਿੰਨਾ ਸੰਬੰਧਿਤ ਵੇਰਵਾ ਦਿਓਗੇ, ਵਿਸ਼ਲੇਸ਼ਣ ਉਤਨਾ ਲਾਭਦਾਇਕ ਹੋਵੇਗਾ।',
    helperResearch: 'ਵਧੇਰੇ ਸਟੀਕ ਨਤੀਜਿਆਂ ਲਈ ਅਧਿਕਾਰ-ਖੇਤਰ ਅਤੇ ਖਾਸ ਮਸਲਾ ਸ਼ਾਮਲ ਕਰੋ।',
    taskIssueCheck: 'ਮਸਲਾ ਜਾਂਚ',
    taskResearch: 'ਕਾਨੂੰਨੀ ਖੋਜ',
    taskDrafting: 'ਦਸਤਾਵੇਜ਼ ਡਰਾਫਟ',
    taskDocumentReview: 'ਦਸਤਾਵੇਜ਼ review',
    checkMySituation: 'ਮੇਰੀ ਸਥਿਤੀ ਜਾਂਚੋ',
    researchThisQuestion: "ਇਸ ਸਵਾਲ 'ਤੇ ਖੋਜ ਕਰੋ",
    enterAtLeastChars: 'ਘੱਟੋ-ਘੱਟ {count} ਅੱਖਰ ਦਰਜ ਕਰੋ',
    charCount: '{current} / {max} ਅੱਖਰ',
    footerIssueCheck1: 'ਮੁਫ਼ਤ ਸ਼ੁਰੂਆਤੀ ਜਾਂਚ',
    footerIssueCheck2: 'ਲਾਗੂ ਕਾਨੂੰਨ ਪਛਾਣਿਆ',
    footerIssueCheck3: 'ਦਸਤਾਵੇਜ਼ ਮਾਰਗਦਰਸ਼ਨ ਸ਼ਾਮਲ',
    footerResearch1: 'ਅਧਿਕਾਰ-ਆਧਾਰਿਤ ਜਵਾਬ',
    footerResearch2: 'ਸੰਬੰਧਿਤ ਕੇਸ ਅਤੇ ਕਾਨੂੰਨ',
    footerResearch3: 'ਸਪੱਸ਼ਟ ਹਵਾਲੇ',
  },
  as: {
    titleIssueCheck: 'আপোনাৰ আইনী পৰিস্থিতি বুজি লওক',
    subtitleIssueCheck:
      'কি হৈছিল কওক। Umbrella-এ মুখ্য আইনী বিষয় চিনাক্ত কৰিব, আপোনাৰ বিকল্পসমূহ ব্যাখ্যা কৰিব আৰু প্ৰয়োজনীয় নথিৰফালে পথ দেখুৱাব।',
    titleResearch: 'এটা আইনী প্ৰশ্নৰ ওপৰত গৱেষণা',
    subtitleResearch:
      'এটা স্পষ্ট আইনী প্ৰশ্ন সুধি relevant আইন, গোচৰ আৰু উদ্ধৃতিৰ সৈতে structured উত্তৰ পাব।',
    placeholderIssueCheck:
      'কি হৈছিল, কোন involved, গুৰুত্বপূৰ্ণ তাৰিখ, আপুনি কি achieve কৰিব বিচাৰে — বৰ্ণনা কৰক।',
    placeholderResearch: 'গৱেষণা কৰিবলগীয়া আইনী প্ৰশ্ন লিখক…',
    helperIssueCheck:
      'আপুনি নিজৰ ভাষাত লিখিব পাৰে। যত প্ৰাসংগিক বিৱৰণ দিব, বিশ্লেষণ তত উপযোগী হ’ব।',
    helperResearch: 'অধিক সঠিক ফলাফলৰ বাবে বিচাৰ ক্ষমতা আৰু নিৰ্দিষ্ট বিষয় যোগ কৰক।',
    taskIssueCheck: 'সমস্যা পৰীক্ষা',
    taskResearch: 'আইনী গৱেষণা',
    taskDrafting: 'নথি খচৰা',
    taskDocumentReview: 'নথি পৰ্যালোচনা',
    checkMySituation: 'মোৰ পৰিস্থিতি পৰীক্ষা কৰক',
    researchThisQuestion: 'এই প্ৰশ্নৰ ওপৰত গৱেষণা কৰক',
    enterAtLeastChars: 'কমেও {count}টা আখৰ লিখক',
    charCount: '{current} / {max} আখৰ',
    footerIssueCheck1: 'বিনামূলীয়া আৰম্ভনি পৰীক্ষা',
    footerIssueCheck2: 'প্ৰযোজ্য আইন চিনাক্ত',
    footerIssueCheck3: 'নথি guidance অন্তৰ্ভুক্ত',
    footerResearch1: 'authority-সমৰ্থিত উত্তৰ',
    footerResearch2: 'related গোচৰ আৰু আইন',
    footerResearch3: 'স্পষ্ট citations',
  },
  or: {
    titleIssueCheck: 'ଆପଣଙ୍କ ଆଇନଗତ ପରିସ୍ଥିତି ବୁଝନ୍ତୁ',
    subtitleIssueCheck:
      'କ’ଣ ଘଟିଲା କୁହନ୍ତୁ। Umbrella ମୁଖ୍ୟ ଆଇନଗତ ବିଷୟ ଚିହ୍ନଟ କରିବ, ଆପଣଙ୍କ ବିକଳ୍ପ ବ୍ୟାଖ୍ୟା କରିବ ଏବଂ ଆବଶ୍ୟକ ଡକ୍ୟୁମେଣ୍ଟ ଆଡ଼କୁ ମାର୍ଗଦର୍ଶନ ଦେବ।',
    titleResearch: 'ଏକ ଆଇନଗତ ପ୍ରଶ୍ନର ଅନୁସନ୍ଧାନ',
    subtitleResearch:
      'ଏକ ସ୍ପଷ୍ଟ ଆଇନଗତ ପ୍ରଶ୍ନ ପଚାରି ପ୍ରାସଙ୍ଗିକ ଆଇନ, କେସ ଏବଂ ଉଦ୍ଧୃତି ସହ ସଂରଚିତ ଉତ୍ତର ପାଆନ୍ତୁ।',
    placeholderIssueCheck:
      'କ’ଣ ଘଟିଲା, କିଏ ଜଡ଼ିତ, ମୁଖ୍ୟ ତାରିଖ, ଆପଣ କ’ଣ ସାଧ୍ୟ କରିବାକୁ ଚାହାଁନ୍ତି — ବର୍ଣ୍ଣନା କରନ୍ତୁ।',
    placeholderResearch: 'ଅନୁସନ୍ଧାନ କରିବାକୁ ଥିବା ଆଇନଗତ ପ୍ରଶ୍ନ ଲେଖନ୍ତୁ…',
    helperIssueCheck:
      'ଆପଣ ନିଜ ଶବ୍ଦରେ ଲେଖିପାରିବେ। ଯେତେ ପ୍ରାସଙ୍ଗିକ ବିବରଣୀ ଦେବେ, ବିଶ୍ଳେଷଣ ତେତେ ଉପଯୋଗୀ ହେବ।',
    helperResearch: 'ଅଧିକ ନିର୍ଭୁଲ ଫଳାଫଳ ପାଇଁ ଅଧିକାରକ୍ଷେତ୍ର ଏବଂ ନିର୍ଦ୍ଦିଷ୍ଟ ବିଷୟ ଯୋଡ଼ନ୍ତୁ।',
    taskIssueCheck: 'ସମସ୍ୟା ଯାଞ୍ଚ',
    taskResearch: 'ଆଇନଗତ ଅନୁସନ୍ଧାନ',
    taskDrafting: 'ଡକ୍ୟୁମେଣ୍ଟ ଡ୍ରାଫ୍ଟ',
    taskDocumentReview: 'ଡକ୍ୟୁମେଣ୍ଟ ସମୀକ୍ଷା',
    checkMySituation: 'ମୋ ପରିସ୍ଥିତି ଯାଞ୍ଚ କରନ୍ତୁ',
    researchThisQuestion: 'ଏହି ପ୍ରଶ୍ନର ଅନୁସନ୍ଧାନ କରନ୍ତୁ',
    enterAtLeastChars: 'ଅତିକମରେ {count} ଅକ୍ଷର ଲେଖନ୍ତୁ',
    charCount: '{current} / {max} ଅକ୍ଷର',
    footerIssueCheck1: 'ମାଗଣା ଆରମ୍ଭିକ ଯାଞ୍ଚ',
    footerIssueCheck2: 'ପ୍ରଯୋଜ୍ୟ ଆଇନ ଚିହ୍ନଟ',
    footerIssueCheck3: 'ଡକ୍ୟୁମେଣ୍ଟ ମାର୍ଗଦର୍ଶନ ଅନ୍ତର୍ଭୁକ୍ତ',
    footerResearch1: 'କର୍ତ୍ତୃତ୍ୱ-ସମର୍ଥିତ ଉତ୍ତର',
    footerResearch2: 'ପ୍ରାସଙ୍ଗିକ କେସ ଏବଂ ଆଇନ',
    footerResearch3: 'ସ୍ପଷ୍ଟ ଉଦ୍ଧୃତି',
  },
  ur: {
    titleIssueCheck: 'اپنی قانونی صورتحال سمجھیں',
    subtitleIssueCheck:
      'بتائیں کیا ہوا۔ Umbrella اہم قانونی مسائل کی نشاندہی کرے گا، آپ کے اختیارات واضح کرے گا اور ضروری دستاویزات کی طرف رہنمائی کرے گا۔',
    titleResearch: 'قانونی سوال پر تحقیق',
    subtitleResearch:
      'واضح قانونی سوال پوچھیں اور متعلقہ قانون، مقدمات اور حوالوں کے ساتھ منظم جواب حاصل کریں۔',
    placeholderIssueCheck:
      'کیا ہوا، کون شامل تھا، اہم تاریخیں، آپ کیا حاصل کرنا چاہتے ہیں — بیان کریں۔',
    placeholderResearch: 'جس قانونی سوال پر تحقیق چاہیے وہ درج کریں…',
    helperIssueCheck:
      'آپ اپنے الفاظ میں لکھ سکتے ہیں۔ جتنی متعلقہ تفصیل دیں گے، تجزیہ اتنا مفید ہوگا۔',
    helperResearch: 'زیادہ درست نتائج کے لیے دائرہ اختیار اور مخصوص مسئلہ شامل کریں۔',
    taskIssueCheck: 'مسئلہ جانچ',
    taskResearch: 'قانونی تحقیق',
    taskDrafting: 'دستاویز کا مسودہ',
    taskDocumentReview: 'دستاویز کا جائزہ',
    checkMySituation: 'میری صورتحال چیک کریں',
    researchThisQuestion: 'اس سوال پر تحقیق کریں',
    enterAtLeastChars: 'کم از کم {count} حروف درج کریں',
    charCount: '{current} / {max} حروف',
    footerIssueCheck1: 'مفت ابتدائی چیک',
    footerIssueCheck2: 'لاگو قانون کی نشاندہی',
    footerIssueCheck3: 'دستاویز رہنمائی شامل',
    footerResearch1: 'اختیار پر مبنی جواب',
    footerResearch2: 'متعلقہ مقدمات اور قوانین',
    footerResearch3: 'واضح حوالے',
  },
  fr: {
    titleIssueCheck: 'Comprendre votre situation juridique',
    subtitleIssueCheck:
      'Dites-nous ce qui s’est passé. Umbrella identifiera les enjeux juridiques clés, expliquera vos options et vous orientera vers les documents dont vous pourriez avoir besoin.',
    titleResearch: 'Rechercher une question juridique',
    subtitleResearch:
      'Posez une question juridique précise et recevez une réponse structurée appuyée par la législation, la jurisprudence et des citations.',
    placeholderIssueCheck:
      'Décrivez ce qui s’est passé, qui était impliqué, les dates importantes et ce que vous souhaitez obtenir.',
    placeholderResearch: 'Saisissez la question juridique à rechercher…',
    helperIssueCheck:
      'Vous pouvez écrire avec vos propres mots. Plus vous fournissez de détails pertinents, plus l’analyse sera utile.',
    helperResearch: 'Pour des résultats plus précis, indiquez la juridiction et le point juridique visé.',
    taskIssueCheck: 'Vérificateur de situation',
    taskResearch: 'Recherche juridique',
    taskDrafting: 'Rédiger un document',
    taskDocumentReview: 'Examiner un document',
    checkMySituation: 'Analyser ma situation',
    researchThisQuestion: 'Rechercher cette question',
    enterAtLeastChars: 'Saisissez au moins {count} caractères',
    charCount: '{current} / {max} caractères',
    footerIssueCheck1: 'Vérification initiale gratuite',
    footerIssueCheck2: 'Droit applicable identifié',
    footerIssueCheck3: 'Orientation documentaire incluse',
    footerResearch1: 'Réponse fondée sur des sources',
    footerResearch2: 'Jurisprudence et textes pertinents',
    footerResearch3: 'Citations claires',
  },
  de: {
    titleIssueCheck: 'Ihre Rechtssituation verstehen',
    subtitleIssueCheck:
      'Erzählen Sie uns, was passiert ist. Umbrella erkennt die wesentlichen Rechtsfragen, erklärt Ihre Optionen und weist Sie auf benötigte Dokumente hin.',
    titleResearch: 'Eine Rechtsfrage recherchieren',
    subtitleResearch:
      'Stellen Sie eine präzise Rechtsfrage und erhalten Sie eine strukturierte Antwort mit Gesetzen, Urteilen und Quellenangaben.',
    placeholderIssueCheck:
      'Beschreiben Sie, was passiert ist, wer beteiligt war, wichtige Daten und was Sie erreichen möchten.',
    placeholderResearch: 'Geben Sie die Rechtsfrage ein, die recherchiert werden soll…',
    helperIssueCheck:
      'Sie können in eigenen Worten schreiben. Je relevanter die Details, desto nützlicher die Analyse.',
    helperResearch: 'Für genauere Ergebnisse nennen Sie Gerichtsbarkeit und konkretes Rechtsthema.',
    taskIssueCheck: 'Situations-Check',
    taskResearch: 'Rechtsrecherche',
    taskDrafting: 'Dokument entwerfen',
    taskDocumentReview: 'Dokument prüfen',
    checkMySituation: 'Meine Situation prüfen',
    researchThisQuestion: 'Diese Frage recherchieren',
    enterAtLeastChars: 'Mindestens {count} Zeichen eingeben',
    charCount: '{current} / {max} Zeichen',
    footerIssueCheck1: 'Kostenlose Erstprüfung',
    footerIssueCheck2: 'Anwendbares Recht erkannt',
    footerIssueCheck3: 'Dokumenten-Hinweise inklusive',
    footerResearch1: 'Quellengestützte Antwort',
    footerResearch2: 'Relevante Urteile und Gesetze',
    footerResearch3: 'Klare Zitate',
  },
}

const ISSUE_CHECKER_KEYS = {
  en: {
    microFlowFactsPlaceholder:
      'Describe what happened, who was involved, important dates, and what you want to achieve.',
    microFlowFactsHelper:
      'You can write in your own words. The more relevant detail you provide, the more useful the analysis will be.',
    checkMySituation: 'Check my situation',
    enterAtLeastChars: 'Enter at least {count} characters',
    charCount: '{current} / {max} characters',
  },
  hi: {
    microFlowFactsPlaceholder:
      'क्या हुआ, कौन शामिल था, महत्वपूर्ण तिथियाँ और आप क्या हासिल करना चाहते हैं — बताएं।',
    microFlowFactsHelper:
      'आप अपने शब्दों में लिख सकते हैं। जितना प्रासंगिक विवरण देंगे, विश्लेषण उतना उपयोगी होगा।',
    checkMySituation: 'मेरी स्थिति जाँचें',
    enterAtLeastChars: 'कम से कम {count} अक्षर लिखें',
    charCount: '{current} / {max} अक्षर',
  },
  bn: {
    microFlowFactsPlaceholder:
      'কী ঘটেছে, কারা জড়িত, গুরুত্বপূর্ণ তারিখ এবং আপনি কী অর্জন করতে চান — বর্ণনা করুন।',
    microFlowFactsHelper:
      'আপনি নিজের ভাষায় লিখতে পারেন। যত প্রাসঙ্গিক বিবরণ দেবেন, বিশ্লেষণ তত উপযোগী হবে।',
    checkMySituation: 'আমার পরিস্থিতি যাচাই করুন',
    enterAtLeastChars: 'অন্তত {count}টি অক্ষর লিখুন',
    charCount: '{current} / {max} অক্ষর',
  },
  ta: {
    microFlowFactsPlaceholder:
      'என்ன நடந்தது, யார் involved, முக்கிய தேதிகள், நீங்கள் எதை அடைய விரும்புகிறீர்கள் — விவரிக்கவும்.',
    microFlowFactsHelper:
      'உங்கள் சொந்த வார்த்தைகளில் எழுதலாம். தொடர்புடைய விவரம் அதிகமாக இருந்தால், ப analysis மிகவும் பயனுள்ளதாக இருக்கும்.',
    checkMySituation: 'என் நிலைமையை சரிபார்க்கவும்',
    enterAtLeastChars: 'குறைந்தது {count} எழுத்துகள் உள்ளிடவும்',
    charCount: '{current} / {max} எழுத்துகள்',
  },
  te: {
    microFlowFactsPlaceholder:
      'ఏమి జరిగింది, ఎవరు involved, ముఖ్యమైన తేదీలు, మీరు ఏమి సాధించాలనుకుంటున్నారు — వివరించండి.',
    microFlowFactsHelper:
      'మీరు మీ స్వంత మాటల్లో రాయవచ్చు. మీరు ఎంత సంబంధిత వివరాలు ఇస్తారో, వ analysis అంత ఉపయోగకరంగా ఉంటుంది.',
    checkMySituation: 'నా పరిస్థితిని తనిఖీ చేయండి',
    enterAtLeastChars: 'కనీసం {count} అక్షరాలు నమోదు చేయండి',
    charCount: '{current} / {max} అక్షరాలు',
  },
  kn: {
    microFlowFactsPlaceholder:
      'ಏನಾಯಿತು, ಯಾರು involved, ಮುಖ್ಯ ದಿನಾಂಕಗಳು, ನೀವು ಏನು ಸಾಧಿಸಲು ಬಯಸುತ್ತೀರಿ — ವಿವರಿಸಿ.',
    microFlowFactsHelper:
      'ನಿಮ್ಮ ಸ್ವಂತ ಪದಗಳಲ್ಲಿ ಬರೆಯಬಹುದು. ಹೆಚ್ಚು ಸಂಬಂಧಿತ ವಿವರ ನೀಡಿದರೆ, ವಿಶ್ಲೇಷಣೆ ಹೆಚ್ಚು ಉಪಯುಕ್ತವಾಗುತ್ತದೆ.',
    checkMySituation: 'ನನ್ನ ಪರಿಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ',
    enterAtLeastChars: 'ಕನಿಷ್ಠ {count} ಅಕ್ಷರಗಳನ್ನು ನಮೂದಿಸಿ',
    charCount: '{current} / {max} ಅಕ್ಷರಗಳು',
  },
  ml: {
    microFlowFactsPlaceholder:
      'എന്ത് സംഭവിച്ചു, ആരൊക്കെ പങ്കെടുത്തു, പ്രധാന തീയതികൾ, നിങ്ങൾ എന്ത് നേടാൻ ആഗ്രഹിക്കുന്നു — വിവരിക്കുക.',
    microFlowFactsHelper:
      'നിങ്ങളുടെ സ്വന്തം വാക്കുകളിൽ എഴുതാം. കൂടുതൽ പ്രസക്തമായ വിവരം നൽകുമ്പോൾ, വിശകലനം കൂടുതൽ ഉപയോഗപ്രദമാകും.',
    checkMySituation: 'എന്റെ സാഹചര്യം പരിശോധിക്കുക',
    enterAtLeastChars: 'കുറഞ്ഞത് {count} അക്ഷരങ്ങൾ നൽകുക',
    charCount: '{current} / {max} അക്ഷരങ്ങൾ',
  },
  mr: {
    microFlowFactsPlaceholder:
      'काय घडले, कोण involved होते, महत्त्वाच्या तारखा, तुम्हाला काय साध्य करायचे — वर्णन करा.',
    microFlowFactsHelper:
      'तुम्ही तुमच्या शब्दात लिहू शकता. जितके relevant तपशील द्याल, analysis तितके उपयुक्त असेल.',
    checkMySituation: 'माझी परिस्थिती तपासा',
    enterAtLeastChars: 'किमान {count} अक्षरे प्रविष्ट करा',
    charCount: '{current} / {max} अक्षरे',
  },
  gu: {
    microFlowFactsPlaceholder:
      'શું થયું, કોણ involved હતા, મહત્વપૂર્ણ તારીખો, તમે શું achieve કરવા માંગો છો — વર્ણન કરો.',
    microFlowFactsHelper:
      'તમે તમારા પોતાના શબ્દોમાં લખી શકો છો. જેટલી relevant વિગતો આપશો, analysis એટલું ઉપયોગી હશે.',
    checkMySituation: 'મારી સ્થિતિ તપાસો',
    enterAtLeastChars: 'ઓછામાં ઓછા {count} અક્ષરો દાખલ કરો',
    charCount: '{current} / {max} અક્ષરો',
  },
  pa: {
    microFlowFactsPlaceholder:
      'ਕੀ ਹੋਇਆ, ਕੌਣ ਸ਼ਾਮਲ ਸੀ, ਮਹੱਤਵਪੂਰਨ ਤਾਰੀਖਾਂ, ਤੁਸੀਂ ਕੀ ਹਾਸਲ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ — ਵੇਰਵਾ ਦਿਓ।',
    microFlowFactsHelper:
      'ਤੁਸੀਂ ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਲਿਖ ਸਕਦੇ ਹੋ। ਜਿੰਨਾ ਸੰਬੰਧਿਤ ਵੇਰਵਾ ਦਿਓਗੇ, ਵਿਸ਼ਲੇਸ਼ਣ ਉਤਨਾ ਲਾਭਦਾਇਕ ਹੋਵੇਗਾ।',
    checkMySituation: 'ਮੇਰੀ ਸਥਿਤੀ ਜਾਂਚੋ',
    enterAtLeastChars: 'ਘੱਟੋ-ਘੱਟ {count} ਅੱਖਰ ਦਰਜ ਕਰੋ',
    charCount: '{current} / {max} ਅੱਖਰ',
  },
  as: {
    microFlowFactsPlaceholder:
      'কি হৈছিল, কোন involved, গুৰুত্বপূৰ্ণ তাৰিখ, আপুনি কি achieve কৰিব বিচাৰে — বৰ্ণনা কৰক।',
    microFlowFactsHelper:
      'আপুনি নিজৰ ভাষাত লিখিব পাৰে। যত relevant বিৱৰণ দিব, analysis তত উপযোগী হ’ব।',
    checkMySituation: 'মোৰ পৰিস্থিতি পৰীক্ষা কৰক',
    enterAtLeastChars: 'কমেও {count}টা আখৰ লিখক',
    charCount: '{current} / {max} আখৰ',
  },
  or: {
    microFlowFactsPlaceholder:
      'କ’ଣ ଘଟିଲା, କିଏ involved, ମୁଖ୍ୟ ତାରିଖ, ଆପଣ କ’ଣ achieve କରିବାକୁ ଚାହାଁନ୍ତି — ବର୍ଣ୍ଣନା କରନ୍ତୁ।',
    microFlowFactsHelper:
      'ଆପଣ ନିଜ ଶବ୍ଦରେ ଲେଖିପାରିବେ। ଯେତେ relevant ବିବରଣୀ ଦେବେ, analysis ତେତେ ଉପଯୋଗୀ ହେବ।',
    checkMySituation: 'ମୋ ପରିସ୍ଥିତି ଯାଞ୍ଚ କରନ୍ତୁ',
    enterAtLeastChars: 'ଅତିକମରେ {count} ଅକ୍ଷର ଲେଖନ୍ତୁ',
    charCount: '{current} / {max} ଅକ୍ଷର',
  },
  ur: {
    microFlowFactsPlaceholder:
      'کیا ہوا، کون involved تھا، اہم تاریخیں، آپ کیا حاصل کرنا چاہتے ہیں — بیان کریں۔',
    microFlowFactsHelper:
      'آپ اپنے الفاظ میں لکھ سکتے ہیں۔ جتنی relevant تفصیل دیں گے، analysis اتنا مفید ہوگا۔',
    checkMySituation: 'میری صورتحال چیک کریں',
    enterAtLeastChars: 'کم از کم {count} حروف درج کریں',
    charCount: '{current} / {max} حروف',
  },
  fr: {
    microFlowFactsPlaceholder:
      'Décrivez ce qui s’est passé, qui était impliqué, les dates importantes et ce que vous souhaitez obtenir.',
    microFlowFactsHelper:
      'Vous pouvez écrire avec vos propres mots. Plus vous fournissez de détails pertinents, plus l’analyse sera utile.',
    checkMySituation: 'Analyser ma situation',
    enterAtLeastChars: 'Saisissez au moins {count} caractères',
    charCount: '{current} / {max} caractères',
  },
  de: {
    microFlowFactsPlaceholder:
      'Beschreiben Sie, was passiert ist, wer beteiligt war, wichtige Daten und was Sie erreichen möchten.',
    microFlowFactsHelper:
      'Sie können in eigenen Worten schreiben. Je relevanter die Details, desto nützlicher die Analyse.',
    checkMySituation: 'Meine Situation prüfen',
    enterAtLeastChars: 'Mindestens {count} Zeichen eingeben',
    charCount: '{current} / {max} Zeichen',
  },
}

function patchLandingIssueBoard(obj, keys) {
  obj.home ??= {}
  obj.home.landingIssueBoard ??= {}
  Object.assign(obj.home.landingIssueBoard, keys)
}

function patchIssueChecker(obj, keys) {
  Object.assign(obj, keys)
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
}

function patchFile(filePath, patchFn, keys) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  patchFn(data, keys)
  writeJson(filePath, data)
}

for (const locale of LOCALES) {
  const marketingKeys = MARKETING_KEYS[locale]
  const issueKeys = ISSUE_CHECKER_KEYS[locale]
  if (!marketingKeys || !issueKeys) {
    console.warn(`Missing translations for ${locale}`)
    continue
  }

  const marketingPath = path.join(SHARED, locale, 'marketing.json')
  const issuePath = path.join(SHARED, locale, 'issueChecker.json')

  patchFile(marketingPath, patchLandingIssueBoard, marketingKeys)
  patchFile(issuePath, patchIssueChecker, issueKeys)

  if (locale !== 'en') {
    const overrideMarketing = path.join(OVERRIDES, locale, 'marketing.json')
    const overrideIssue = path.join(OVERRIDES, locale, 'issueChecker.json')
    if (fs.existsSync(path.dirname(overrideMarketing))) {
      const om = fs.existsSync(overrideMarketing)
        ? JSON.parse(fs.readFileSync(overrideMarketing, 'utf8'))
        : {}
      patchLandingIssueBoard(om, marketingKeys)
      writeJson(overrideMarketing, om)
    }
    if (fs.existsSync(path.dirname(overrideIssue))) {
      const oi = fs.existsSync(overrideIssue)
        ? JSON.parse(fs.readFileSync(overrideIssue, 'utf8'))
        : {}
      patchIssueChecker(oi, issueKeys)
      writeJson(overrideIssue, oi)
    }
  }

  console.log(`[i18n] patched ${locale}`)
}
