#!/usr/bin/env node
/**
 * One-off: locale overrides for new mobile keys (aiConsent, docuDraft, mobile,
 * auth.phoneRequired, settings delete-account, matters intake/conflict).
 */
const fs = require('fs')
const path = require('path')
const { TARGET_LOCALES } = require('./namespaces')

const OVERRIDES_DIR = path.join(__dirname, 'locale-overrides')

const T = {
  fr: {
    auth: { phoneRequired: 'Le numéro de téléphone est requis' },
    aiConsent: {
      dialogTitle: 'Consentement au traitement par IA',
      dialogBody:
        "Umbrella envoie votre requête et le contexte du dossier à des fournisseurs d'IA tiers pour l'analyse juridique, la rédaction et la recherche. Vos données ne sont pas utilisées pour entraîner des modèles d'IA.",
      dialogProviders: 'Fournisseurs : OpenAI, Anthropic, DeepSeek et Deepgram (transcription).',
      dialogPurpose:
        'Vous pouvez retirer votre consentement à tout moment dans Confidentialité et sécurité. Sans consentement, les fonctionnalités IA seront indisponibles.',
      dialogLearnMore: 'En savoir plus dans notre',
      dialogDecline: 'Pas maintenant',
      dialogAgree: "J'accepte",
      settingsTitle: "Consentement à l'inférence IA",
      settingsDescription:
        'Consentement réinitialisé. Vous serez invité à nouveau avant la prochaine fonctionnalité IA.',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'Décrivez votre besoin, trouvez le formulaire adapté et générez des brouillons avec l\'IA.',
      stepDescribe: 'Décrire',
      stepUnderstand: 'Comprendre',
      stepMatch: 'Correspondre',
      stepDraft: 'Rédiger',
      findAndDraft: 'Rechercher et rédiger',
      browseFormats: 'Parcourir les formats',
      whatToDraft: 'Que souhaitez-vous rédiger ?',
      contextDetected: 'Contexte détecté',
      whatWeUnderstood: 'Ce que nous avons compris',
      refineContext: 'Affiner la description',
      refineHint: 'Ajoutez des détails pour améliorer les correspondances de documents.',
      updateAnalysis: "Mettre à jour l'analyse",
      findMatchingForms: 'Trouver les formulaires correspondants',
      resultsFor: 'Résultats pour',
      recommendedFilingSet: 'Ensemble de dépôt recommandé',
      draftSelected:
        '{count, plural, one {Rédiger # document sélectionné} other {Rédiger # documents sélectionnés}}',
      draftNow: 'Rédiger maintenant',
      otherMatches: 'Autres correspondances',
      officialForms: 'Formulaires juridiques officiels',
      searchFormats: 'Rechercher des formats…',
      generationFailed: 'Impossible de générer le brouillon. Veuillez réessayer.',
      copied: 'Brouillon copié dans le presse-papiers',
      generateDraft: 'Générer le brouillon',
      proceduralNote: 'Note procédurale',
      caseDetails: 'Détails du dossier',
      autoFill: 'Remplir automatiquement',
      copyDraft: 'Copier le brouillon',
      redo: 'Régénérer',
    },
    mobile: {
      creditsExhaustedWebOnly:
        "Vous n'avez plus de crédits IA. Rechargez ou mettez à niveau votre forfait sur umbrella.okaylegal.ai — les achats intégrés ne sont pas disponibles sur mobile.",
    },
    settings: {
      deleteAccount: 'Supprimer le compte',
      deleteAccountSettingsHint: 'Supprimer définitivement votre compte et vos données personnelles',
      deleteAccountDescription:
        'Supprimez définitivement votre compte Umbrella et les données personnelles associées. Cette action est irréversible.',
      deleteAccountConfirmTitle: 'Supprimer définitivement votre compte ?',
      deleteAccountConfirmBody:
        'Vos données personnelles seront supprimées ou anonymisées sous 30 jours, sous réserve des obligations légales de conservation.',
      deleteAccountConfirmAction: 'Supprimer le compte',
      deleteAccountEmailMismatch: "L'e-mail ne correspond pas à votre compte.",
      deleteAccountError:
        'Impossible de supprimer le compte. Réessayez ou écrivez à support@odaflow.com.',
      deleteAccountSuccess: 'Votre compte a été supprimé. Vous avez été déconnecté.',
      deleteAccountFormHeading: 'Supprimer le compte maintenant',
      deleteAccountFormDescription:
        'Les utilisateurs connectés peuvent supprimer définitivement leur compte ci-dessous. Cette action est irréversible.',
      deleteAccountEmailLabel: 'Confirmez votre e-mail',
      deleteAccountEmailRequired: "L'e-mail est requis",
      deleteAccountSubmitting: 'Suppression…',
      deleteAccountSubmit: 'Supprimer mon compte',
      privacyRightToErasure: "Droit à l'effacement",
      privacyRightToErasureBody:
        'Demandez la suppression définitive de votre compte et de vos données personnelles.',
    },
    matters: {
      clientRequiredError: 'Veuillez sélectionner ou créer un client',
      addPartyForConflictCheck:
        'Ajoutez au moins une partie pour lancer le contrôle de conflits',
      intakeStepType: 'Type',
      intakeStepBasics: 'Base',
      intakeStepSpecifics: 'Détails',
      intakeStepBackground: 'Contexte',
      intakeStepReview: 'Révision',
      noAdditionalFieldsForType: 'Aucun champ supplémentaire pour ce type de dossier',
      conflictCheckTitle: 'Contrôle de conflits',
      conflictCheckDescription:
        'Vérifiez les parties par rapport aux clients et dossiers existants avant d\'ouvrir le dossier.',
      conflictCheckPartyHint:
        'Ajoutez des parties à l\'étape Base pour activer le contrôle de conflits.',
      checkingConflict: 'Contrôle des conflits…',
      runConflictCheck: 'Lancer le contrôle de conflits',
    },
  },
  de: {
    auth: { phoneRequired: 'Telefonnummer ist erforderlich' },
    aiConsent: {
      dialogTitle: 'Einwilligung zur KI-Verarbeitung',
      dialogBody:
        'Umbrella sendet Ihre Anfrage und den Aktenkontext an Drittanbieter-KI-Dienste für Rechtsanalyse, Entwurfserstellung und Recherche. Ihre Daten werden nicht zum Trainieren von KI-Modellen verwendet.',
      dialogProviders: 'Anbieter: OpenAI, Anthropic, DeepSeek und Deepgram (Transkription).',
      dialogPurpose:
        'Sie können die Einwilligung jederzeit unter Datenschutz & Sicherheit widerrufen. Ohne Einwilligung sind KI-Funktionen nicht verfügbar.',
      dialogLearnMore: 'Mehr erfahren in unserer',
      dialogDecline: 'Nicht jetzt',
      dialogAgree: 'Ich stimme zu',
      settingsTitle: 'Einwilligung zur KI-Inferenz',
      settingsDescription:
        'Einwilligung zurückgesetzt. Sie werden vor der nächsten KI-Funktion erneut gefragt.',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'Beschreiben Sie Ihr Anliegen, finden Sie passende Formulare und erstellen Sie Entwürfe mit KI.',
      stepDescribe: 'Beschreiben',
      stepUnderstand: 'Verstehen',
      stepMatch: 'Abgleichen',
      stepDraft: 'Entwurf',
      findAndDraft: 'Suchen & Entwerfen',
      browseFormats: 'Formate durchsuchen',
      whatToDraft: 'Was möchten Sie entwerfen?',
      contextDetected: 'Kontext erkannt',
      whatWeUnderstood: 'Was wir verstanden haben',
      refineContext: 'Beschreibung verfeinern',
      refineHint: 'Fügen Sie Details hinzu, um Dokumenttreffer zu verbessern.',
      updateAnalysis: 'Analyse aktualisieren',
      findMatchingForms: 'Passende Formulare finden',
      resultsFor: 'Ergebnisse für',
      recommendedFilingSet: 'Empfohlenes Einreichungspaket',
      draftSelected:
        '{count, plural, one {# ausgewähltes Dokument entwerfen} other {# ausgewählte Dokumente entwerfen}}',
      draftNow: 'Jetzt entwerfen',
      otherMatches: 'Weitere Treffer',
      officialForms: 'Offizielle Rechtsformulare',
      searchFormats: 'Formate suchen…',
      generationFailed: 'Entwurf konnte nicht erstellt werden. Bitte erneut versuchen.',
      copied: 'Entwurf in die Zwischenablage kopiert',
      generateDraft: 'Entwurf generieren',
      proceduralNote: 'Verfahrenshinweis',
      caseDetails: 'Aktenangaben',
      autoFill: 'Felder automatisch ausfüllen',
      copyDraft: 'Entwurf kopieren',
      redo: 'Neu generieren',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'Ihre KI-Guthaben sind aufgebraucht. Laden Sie auf oder upgraden Sie Ihren Plan auf umbrella.okaylegal.ai — In-App-Käufe sind in der mobilen App nicht verfügbar.',
    },
    settings: {
      deleteAccount: 'Konto löschen',
      deleteAccountSettingsHint: 'Konto und personenbezogene Daten dauerhaft löschen',
      deleteAccountDescription:
        'Löschen Sie Ihr Umbrella-Konto und zugehörige personenbezogene Daten dauerhaft. Dies kann nicht rückgängig gemacht werden.',
      deleteAccountConfirmTitle: 'Konto dauerhaft löschen?',
      deleteAccountConfirmBody:
        'Ihre personenbezogenen Daten werden innerhalb von 30 Tagen gelöscht oder anonymisiert, vorbehaltlich gesetzlicher Aufbewahrungspflichten.',
      deleteAccountConfirmAction: 'Konto löschen',
      deleteAccountEmailMismatch: 'E-Mail stimmt nicht mit Ihrem Konto überein.',
      deleteAccountError:
        'Konto konnte nicht gelöscht werden. Erneut versuchen oder support@odaflow.com kontaktieren.',
      deleteAccountSuccess: 'Ihr Konto wurde gelöscht. Sie wurden abgemeldet.',
      deleteAccountFormHeading: 'Konto jetzt löschen',
      deleteAccountFormDescription:
        'Angemeldete Nutzer können ihr Konto unten dauerhaft löschen. Dies kann nicht rückgängig gemacht werden.',
      deleteAccountEmailLabel: 'E-Mail bestätigen',
      deleteAccountEmailRequired: 'E-Mail ist erforderlich',
      deleteAccountSubmitting: 'Wird gelöscht…',
      deleteAccountSubmit: 'Mein Konto löschen',
      privacyRightToErasure: 'Recht auf Löschung',
      privacyRightToErasureBody:
        'Dauerhafte Löschung Ihres Kontos und Ihrer personenbezogenen Daten anfordern.',
    },
    matters: {
      clientRequiredError: 'Bitte wählen oder erstellen Sie einen Mandanten',
      addPartyForConflictCheck:
        'Fügen Sie mindestens eine Partei hinzu, um einen Interessenkonflikt-Check durchzuführen',
      intakeStepType: 'Typ',
      intakeStepBasics: 'Grundlagen',
      intakeStepSpecifics: 'Details',
      intakeStepBackground: 'Hintergrund',
      intakeStepReview: 'Prüfung',
      noAdditionalFieldsForType: 'Keine zusätzlichen Felder für diesen Akten-Typ',
      conflictCheckTitle: 'Interessenkonflikt-Check',
      conflictCheckDescription:
        'Prüfen Sie Parteien gegen bestehende Mandanten und Akten, bevor Sie den Fall eröffnen.',
      conflictCheckPartyHint:
        'Fügen Sie Parteien im Schritt Grundlagen hinzu, um den Konflikt-Check zu aktivieren.',
      checkingConflict: 'Konflikte werden geprüft…',
      runConflictCheck: 'Konflikt-Check starten',
    },
  },
  hi: {
    auth: { phoneRequired: 'फ़ोन नंबर आवश्यक है' },
    aiConsent: {
      dialogTitle: 'AI प्रसंस्करण सहमति',
      dialogBody:
        'अम्ब्रेला आपके प्रश्न और मामले का संदर्भ तृतीय-पक्ष AI प्रदाताओं को कानूनी विश्लेषण, मसौदा तैयारी और अनुसंधान के लिए भेजता है। आपका डेटा AI मॉडल प्रशिक्षण के लिए उपयोग नहीं किया जाता।',
      dialogProviders: 'प्रदाता: OpenAI, Anthropic, DeepSeek, और Deepgram (ट्रांसक्रिप्शन)।',
      dialogPurpose:
        'आप कभी भी गोपनीयता और सुरक्षा सेटिंग्स में सहमति वापस ले सकते हैं। सहमति के बिना, AI सुविधाएँ उपलब्ध नहीं होंगी।',
      dialogLearnMore: 'और जानें हमारी',
      dialogDecline: 'अभी नहीं',
      dialogAgree: 'मैं सहमत हूँ',
      settingsTitle: 'AI अनुमान सहमति',
      settingsDescription: 'सहमति रीसेट हो गई। अगली AI सुविधा से पहले आपसे फिर पूछा जाएगा।',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle: 'अपनी जरूरत बताएं, सही फॉर्म चुनें, और AI से ड्राफ्ट बनाएं।',
      stepDescribe: 'वर्णन',
      stepUnderstand: 'समझें',
      stepMatch: 'मिलान',
      stepDraft: 'मसौदा',
      findAndDraft: 'खोजें और मसौदा बनाएं',
      browseFormats: 'प्रारूप ब्राउज़ करें',
      whatToDraft: 'आप क्या मसौदा तैयार करना चाहते हैं?',
      contextDetected: 'संदर्भ पहचाना गया',
      whatWeUnderstood: 'हमने क्या समझा',
      refineContext: 'विवरण सुधारें',
      refineHint: 'दस्तावेज़ मिलान बेहतर करने के लिए विवरण जोड़ें।',
      updateAnalysis: 'विश्लेषण अपडेट करें',
      findMatchingForms: 'मिलते-जुलते फॉर्म खोजें',
      resultsFor: 'परिणाम',
      recommendedFilingSet: 'अनुशंसित फाइलिंग सेट',
      draftSelected:
        '{count, plural, one {# चयनित दस्तावेज़ का मसौदा} other {# चयनित दस्तावेज़ों का मसौदा}}',
      draftNow: 'अभी मसौदा बनाएं',
      otherMatches: 'अन्य मिलान',
      officialForms: 'आधिकारिक कानूनी फॉर्म',
      searchFormats: 'प्रारूप खोजें…',
      generationFailed: 'मसौदा नहीं बनाया जा सका। कृपया पुनः प्रयास करें।',
      copied: 'मसौदा क्लिपबोर्ड पर कॉपी हो गया',
      generateDraft: 'मसौदा बनाएं',
      proceduralNote: 'प्रक्रियात्मक नोट',
      caseDetails: 'मामले का विवरण',
      autoFill: 'रिक्त स्थान स्वतः भरें',
      copyDraft: 'मसौदा कॉपी करें',
      redo: 'पुनः बनाएं',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'आपके AI क्रेडिट समाप्त हो गए हैं। umbrella.okaylegal.ai पर टॉप-अप या प्लान अपग्रेड करें — मोबाइल ऐप में इन-ऐप खरीद उपलब्ध नहीं है।',
    },
    settings: {
      deleteAccount: 'खाता हटाएं',
      deleteAccountSettingsHint: 'अपना खाता और व्यक्तिगत डेटा स्थायी रूप से हटाएं',
      deleteAccountDescription:
        'अपना Umbrella खाता और संबंधित व्यक्तिगत डेटा स्थायी रूप से हटाएं। यह क्रिया पूर्ववत नहीं की जा सकती।',
      deleteAccountConfirmTitle: 'क्या आप अपना खाता स्थायी रूप से हटाना चाहते हैं?',
      deleteAccountConfirmBody:
        'आपका व्यक्तिगत डेटा 30 दिनों के भीतर हटाया या अनाम किया जाएगा, कानूनी प्रतिधारण आवश्यकताओं के अधीन।',
      deleteAccountConfirmAction: 'खाता हटाएं',
      deleteAccountEmailMismatch: 'ईमेल आपके खाते से मेल नहीं खाता।',
      deleteAccountError:
        'खाता हटाया नहीं जा सका। पुनः प्रयास करें या support@odaflow.com पर लिखें।',
      deleteAccountSuccess: 'आपका खाता हटा दिया गया है। आप साइन आउट हो गए हैं।',
      deleteAccountFormHeading: 'अभी खाता हटाएं',
      deleteAccountFormDescription:
        'साइन-इन उपयोगकर्ता नीचे अपना खाता स्थायी रूप से हटा सकते हैं। यह क्रिया पूर्ववत नहीं की जा सकती।',
      deleteAccountEmailLabel: 'अपना ईमेल पुष्टि करें',
      deleteAccountEmailRequired: 'ईमेल आवश्यक है',
      deleteAccountSubmitting: 'हटाया जा रहा है…',
      deleteAccountSubmit: 'मेरा खाता हटाएं',
      privacyRightToErasure: 'मिटाने का अधिकार',
      privacyRightToErasureBody:
        'अपने खाते और व्यक्तिगत डेटा की स्थायी हटाने का अनुरोध करें।',
    },
    matters: {
      clientRequiredError: 'कृपया एक ग्राहक चुनें या बनाएं',
      addPartyForConflictCheck: 'संघर्ष जांच के लिए कम से कम एक पक्ष जोड़ें',
      intakeStepType: 'प्रकार',
      intakeStepBasics: 'मूल बातें',
      intakeStepSpecifics: 'विशेष',
      intakeStepBackground: 'पृष्ठभूमि',
      intakeStepReview: 'समीक्षा',
      noAdditionalFieldsForType: 'इस मामले के प्रकार के लिए कोई अतिरिक्त फ़ील्ड नहीं',
      conflictCheckTitle: 'संघर्ष जांच',
      conflictCheckDescription:
        'मामला खोलने से पहले मौजूदा ग्राहकों और मामलों के विरुद्ध पक्षों की जांच करें।',
      conflictCheckPartyHint: 'संघर्ष जांच सक्षम करने के लिए मूल बातें चरण में पक्ष जोड़ें।',
      checkingConflict: 'संघर्ष जांच हो रही है…',
      runConflictCheck: 'संघर्ष जांच चलाएं',
    },
  },
  bn: {
    auth: { phoneRequired: 'ফোন নম্বর প্রয়োজন' },
    aiConsent: {
      dialogTitle: 'AI প্রক্রিয়াকরণ সম্মতি',
      dialogBody:
        'Umbrella আপনার প্রশ্ন এবং মামলার প্রসঙ্গ তৃতীয়-পক্ষ AI প্রদানকারীদের কাছে পাঠায় আইনি বিশ্লেষণ, খসড়া প্রস্তুতি ও গবেষণার জন্য। আপনার ডেটা AI মডেল প্রশিক্ষণে ব্যবহার হয় না।',
      dialogProviders: 'প্রদানকারী: OpenAI, Anthropic, DeepSeek, এবং Deepgram (ট্রান্সক্রিপশন)।',
      dialogPurpose:
        'গোপনীয়তা ও নিরাপত্তা সেটিংসে যেকোনো সময় সম্মতি প্রত্যাহার করতে পারেন। সম্মতি ছাড়া AI বৈশিষ্ট্য উপলব্ধ থাকবে না।',
      dialogLearnMore: 'আরও জানুন আমাদের',
      dialogDecline: 'এখন নয়',
      dialogAgree: 'আমি সম্মত',
      settingsTitle: 'AI inference সম্মতি',
      settingsDescription:
        'সম্মতি রিসেট হয়েছে। পরবর্তী AI বৈশিষ্ট্যের আগে আবার জিজ্ঞাসা করা হবে।',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'আপনার প্রয়োজন বর্ণনা করুন, সঠিক ফর্ম মিলান এবং AI দিয়ে খসড়া তৈরি করুন।',
      stepDescribe: 'বর্ণনা',
      stepUnderstand: 'বুঝুন',
      stepMatch: 'মিল',
      stepDraft: 'খসড়া',
      findAndDraft: 'খুঁজুন ও খসড়া',
      browseFormats: 'ফর্ম্যাট ব্রাউজ',
      whatToDraft: 'আপনি কী খসড়া তৈরি করতে চান?',
      contextDetected: 'প্রসঙ্গ শনাক্ত',
      whatWeUnderstood: 'আমরা যা বুঝেছি',
      refineContext: 'বর্ণনা পরিমার্জন',
      refineHint: 'নথি মিল উন্নত করতে বিবরণ যোগ করুন।',
      updateAnalysis: 'বিশ্লেষণ আপডেট',
      findMatchingForms: 'মিলে যাওয়া ফর্ম খুঁজুন',
      resultsFor: 'ফলাফল',
      recommendedFilingSet: 'প্রস্তাবিত ফাইলিং সেট',
      draftSelected:
        '{count, plural, one {# নির্বাচিত নথির খসড়া} other {# নির্বাচিত নথির খসড়া}}',
      draftNow: 'এখনই খসড়া',
      otherMatches: 'অন্যান্য মিল',
      officialForms: 'আধিকারিক আইনি ফর্ম',
      searchFormats: 'ফর্ম্যাট খুঁজুন…',
      generationFailed: 'খসড়া তৈরি করা যায়নি। আবার চেষ্টা করুন।',
      copied: 'খসড়া ক্লিপবোর্ডে কপি হয়েছে',
      generateDraft: 'খসড়া তৈরি',
      proceduralNote: 'প্রক্রিয়াগত নোট',
      caseDetails: 'মামলার বিবরণ',
      autoFill: 'স্বয়ংক্রিয় পূরণ',
      copyDraft: 'খসড়া কপি',
      redo: 'পুনরায় তৈরি',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'আপনার AI ক্রেডিট শেষ। umbrella.okaylegal.ai-এ টপ-আপ বা প্ল্যান আপগ্রেড করুন — মোবাইলে in-app কেনাকাটা উপলব্ধ নয়।',
    },
    settings: {
      deleteAccount: 'অ্যাকাউন্ট মুছুন',
      deleteAccountSettingsHint: 'অ্যাকাউন্ট ও ব্যক্তিগত ডেটা স্থায়ীভাবে মুছুন',
      deleteAccountDescription:
        'আপনার Umbrella অ্যাকাউন্ট ও সংশ্লিষ্ট ব্যক্তিগত ডেটা স্থায়ীভাবে মুছুন। এটি পূর্বাবস্থায় ফেরানো যাবে না।',
      deleteAccountConfirmTitle: 'অ্যাকাউন্ট স্থায়ীভাবে মুছবেন?',
      deleteAccountConfirmBody:
        'ব্যক্তিগত ডেটা 30 দিনের মধ্যে মুছে বা অজ্ঞাত করা হবে, আইনি সংরক্ষণের শর্ত সাপেক্ষে।',
      deleteAccountConfirmAction: 'অ্যাকাউন্ট মুছুন',
      deleteAccountEmailMismatch: 'ইমেল আপনার অ্যাকাউন্টের সাথে মেলে না।',
      deleteAccountError:
        'অ্যাকাউন্ট মুছতে পারেনি। আবার চেষ্টা করুন বা support@odaflow.com।',
      deleteAccountSuccess: 'আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে। সাইন আউট হয়েছেন।',
      deleteAccountFormHeading: 'এখনই অ্যাকাউন্ট মুছুন',
      deleteAccountFormDescription:
        'সাইন-ইন ব্যবহারকারীরা নিচে অ্যাকাউন্ট স্থায়ীভাবে মুছতে পারেন। এটি পূর্বাবস্থায় ফেরানো যাবে না।',
      deleteAccountEmailLabel: 'ইমেল নিশ্চিত করুন',
      deleteAccountEmailRequired: 'ইমেল প্রয়োজন',
      deleteAccountSubmitting: 'মুছছে…',
      deleteAccountSubmit: 'আমার অ্যাকাউন্ট মুছুন',
      privacyRightToErasure: 'মুছে ফেলার অধিকার',
      privacyRightToErasureBody:
        'অ্যাকাউন্ট ও ব্যক্তিগত ডেটা স্থায়ীভাবে মুছে ফেলার অনুরোধ করুন।',
    },
    matters: {
      clientRequiredError: 'একটি ক্লায়েন্ট নির্বাচন বা তৈরি করুন',
      addPartyForConflictCheck: 'দ্বন্দ্ব পরীক্ষার জন্য অন্তত একটি পক্ষ যোগ করুন',
      intakeStepType: 'ধরন',
      intakeStepBasics: 'মৌলিক',
      intakeStepSpecifics: 'বিশেষ',
      intakeStepBackground: 'পটভূমি',
      intakeStepReview: 'পর্যালোচনা',
      noAdditionalFieldsForType: 'এই মামলার ধরনের জন্য অতিরিক্ত ক্ষেত্র নেই',
      conflictCheckTitle: 'দ্বন্দ্ব পরীক্ষা',
      conflictCheckDescription:
        'মামলা খোলার আগে বিদ্যমান ক্লায়েন্ট ও মামলার বিরুদ্ধে পক্ষ যাচাই করুন।',
      conflictCheckPartyHint: 'দ্বন্দ্ব পরীক্ষা সক্রিয় করতে মৌলিক ধাপে পক্ষ যোগ করুন।',
      checkingConflict: 'দ্বন্দ্ব যাচাই হচ্ছে…',
      runConflictCheck: 'দ্বন্দ্ব পরীক্ষা চালান',
    },
  },
}

// Fix Bengali proceduralNote typo
T.bn.docuDraft.proceduralNote = 'প্রক্রিয়াগত নোট'
T.bn.settings.deleteAccountConfirmBody =
  'ব্যক্তিগত ডেটা 30 দিনের মধ্যে মুছে বা অজ্ঞাত করা হবে, আইনি সংরক্ষণের শর্ত সাপেক্ষে।'

Object.assign(T, {
  te: {
    auth: { phoneRequired: 'ఫోన్ నంబర్ అవసరం' },
    aiConsent: {
      dialogTitle: 'AI ప్రాసెసింగ్ సమ్మతి',
      dialogBody:
        'Umbrella మీ ప్రశ్న మరియు విషయ సందర్భాన్ని చట్టపరమైన విశ్లేషణ, డ్రాఫ్టింగ్ మరియు పరిశోధన కోసం తృతీయ-పక్ష AI ప్రదాతలకు పంపుతుంది. మీ డేటా AI మోడల్‌లకు శిక్షణ కోసం ఉపయోగించబడదు.',
      dialogProviders: 'ప్రదాతలు: OpenAI, Anthropic, DeepSeek, మరియు Deepgram (ట్రాన్స్‌క్రిప్షన్).',
      dialogPurpose:
        'గోప్యత & భద్రతా సెట్టింగ్‌లలో ఎప్పుడైనా సమ్మతిని ఉపసంహరించుకోవచ్చు. సమ్మతి లేకుండా AI ఫీచర్‌లు అందుబాటులో ఉండవు.',
      dialogLearnMore: 'మా ద్వారా మరింత తెలుసుకోండి',
      dialogDecline: 'ఇప్పుడు కాదు',
      dialogAgree: 'నేను అంగీకరిస్తున్నాను',
      settingsTitle: 'AI inference సమ్మతి',
      settingsDescription:
        'సమ్మతి రీసెట్ చేయబడింది. తదుపరి AI ఫీచర్‌కు ముందు మళ్లీ అడుగుతారు.',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'మీ అవసరాన్ని వివరించండి, అధికారిక ఫారమ్‌లను సరిపోల్చండి, AIతో డ్రాఫ్ట్‌లు సృష్టించండి.',
      stepDescribe: 'వివరించండి',
      stepUnderstand: 'అర్థం చేసుకోండి',
      stepMatch: 'సరిపోల్చండి',
      stepDraft: 'డ్రాఫ్ట్',
      findAndDraft: 'కనుగొని & డ్రాఫ్ట్',
      browseFormats: 'ఫార్మాట్‌లను బ్రౌజ్ చేయండి',
      whatToDraft: 'మీరు ఏమి డ్రాఫ్ట్ చేయాలనుకుంటున్నారు?',
      contextDetected: 'సందర్భం గుర్తించబడింది',
      whatWeUnderstood: 'మేము అర్థం చేసుకున్నది',
      refineContext: 'వివరణను మెరుగుపరచండి',
      refineHint: 'పత్రం మ్యాచ్‌లను మెరుగుపరచడానికి వివరాలు జోడించండి.',
      updateAnalysis: 'విశ్లేషణను నవీకరించండి',
      findMatchingForms: 'సరిపోయే ఫారమ్‌లను కనుగొనండి',
      resultsFor: 'ఫలితాలు',
      recommendedFilingSet: 'సిఫార్సు చేసిన ఫైలింగ్ సెట్',
      draftSelected:
        '{count, plural, one {# ఎంచుకున్న పత్రం డ్రాఫ్ట్} other {# ఎంచుకున్న పత్రాలు డ్రాఫ్ట్}}',
      draftNow: 'ఇప్పుడే డ్రాఫ్ట్',
      otherMatches: 'ఇతర మ్యాచ్‌లు',
      officialForms: 'అధికారిక చట్టపరమైన ఫారమ్‌లు',
      searchFormats: 'ఫార్మాట్‌లను శోధించండి…',
      generationFailed: 'డ్రాఫ్ట్‌ను రూపొందించలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.',
      copied: 'డ్రాఫ్ట్ క్లిప్‌బోర్డ్‌కు కాపీ చేయబడింది',
      generateDraft: 'డ్రాఫ్ట్‌ను రూపొందించండి',
      proceduralNote: 'ప్రక్రియాత్మక గమనిక',
      caseDetails: 'కేసు వివరాలు',
      autoFill: 'ఖాళీలను స్వయంచాలకంగా నింపండి',
      copyDraft: 'డ్రాఫ్ట్‌ను కాపీ చేయండి',
      redo: 'మళ్లీ రూపొందించండి',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'మీ AI క్రెడిట్‌లు అయిపోయాయి. umbrella.okaylegal.aiలో టాప్-అప్ లేదా ప్లాన్ అప్‌గ్రేడ్ చేయండి — మొబైల్‌లో in-app కొనుగోళ్లు అందుబాటులో లేవు.',
    },
    settings: {
      deleteAccount: 'ఖాతాను తొలగించండి',
      deleteAccountSettingsHint: 'మీ ఖాతా మరియు వ్యక్తిగత డేటాను శాశ్వతంగా తొలగించండి',
      deleteAccountDescription:
        'మీ Umbrella ఖాతా మరియు సంబంధిత వ్యక్తిగత డేటాను శాశ్వతంగా తొలగించండి. ఈ చర్యను రద్దు చేయలేరు.',
      deleteAccountConfirmTitle: 'మీ ఖాతాను శాశ్వతంగా తొలగించాలా?',
      deleteAccountConfirmBody:
        'మీ వ్యక్తిగత డేటా 30 రోజులలోపు తొలగించబడుతుంది లేదా అజ్ఞాతం చేయబడుతుంది, చట్టపరమైన నిల్వ అవసరాలకు లోబడి.',
      deleteAccountConfirmAction: 'ఖాతాను తొలగించండి',
      deleteAccountEmailMismatch: 'ఇమెయిల్ మీ ఖాతాకు సరిపోలడం లేదు.',
      deleteAccountError:
        'ఖాతాను తొలగించలేకపోయాము. మళ్లీ ప్రయత్నించండి లేదా support@odaflow.comకు ఇమెయిల్ చేయండి.',
      deleteAccountSuccess: 'మీ ఖాతా తొలగించబడింది. మీరు సైన్ అవుట్ అయ్యారు.',
      deleteAccountFormHeading: 'ఇప్పుడే ఖాతాను తొలగించండి',
      deleteAccountFormDescription:
        'సైన్-ఇన్ చేసిన వినియోగదారులు క్రింద తమ ఖాతాను శాశ్వతంగా తొలగించవచ్చు. ఈ చర్యను రద్దు చేయలేరు.',
      deleteAccountEmailLabel: 'మీ ఇమెయిల్‌ను నిర్ధారించండి',
      deleteAccountEmailRequired: 'ఇమెయిల్ అవసరం',
      deleteAccountSubmitting: 'తొలగిస్తోంది…',
      deleteAccountSubmit: 'నా ఖాతాను తొలగించండి',
      privacyRightToErasure: 'తొలగింపు హక్కు',
      privacyRightToErasureBody:
        'మీ ఖాతా మరియు వ్యక్తిగత డేటా శాశ్వత తొలగింపును అభ్యర్థించండి.',
    },
    matters: {
      clientRequiredError: 'దయచేసి క్లయింట్‌ను ఎంచుకోండి లేదా సృష్టించండి',
      addPartyForConflictCheck: 'వైరుధ్య తనిఖీ కోసం కనీసం ఒక పార్టీని జోడించండి',
      intakeStepType: 'రకం',
      intakeStepBasics: 'ప్రాథమిక',
      intakeStepSpecifics: 'విశిష్ట',
      intakeStepBackground: 'నేపథ్యం',
      intakeStepReview: 'సమీక్ష',
      noAdditionalFieldsForType: 'ఈ విషయ రకానికి అదనపు ఫీల్డ్‌లు లేవు',
      conflictCheckTitle: 'వైరుధ్య తనిఖీ',
      conflictCheckDescription:
        'కేసు తెరవడానికి ముందు ఉన్న క్లయింట్‌లు మరియు విషయాలకు వ్యతిరేకంగా పార్టీలను తనిఖీ చేయండి.',
      conflictCheckPartyHint:
        'వైరుధ్య తనిఖీని ప్రారంభించడానికి ప్రాథమిక దశలో పార్టీలను జోడించండి.',
      checkingConflict: 'వైరుధ్యాలను తనిఖీ చేస్తోంది…',
      runConflictCheck: 'వైరుధ్య తనిఖీని అమలు చేయండి',
    },
  },
})

T.te.docuDraft.proceduralNote = 'ప్రక్రియాత్మక గమనిక'
T.te.docuDraft.autoFill = 'ఖాళీలను స్వయంచాలకంగా నింపండి'

Object.assign(T, {
  mr: {
    auth: { phoneRequired: 'फोन नंबर आवश्यक आहे' },
    aiConsent: {
      dialogTitle: 'AI प्रक्रिया संमती',
      dialogBody:
        'Umbrella तुमचा प्रश्न आणि मामल्याचा संदर्भ कायदेशीर विश्लेषण, मसुदा तयार करणे आणि संशोधनासाठी तृतीय-पक्ष AI प्रदात्यांकडे पाठवते. तुमचा डेटा AI मॉडेल प्रशिक्षणासाठी वापरला जात नाही.',
      dialogProviders: 'प्रदाते: OpenAI, Anthropic, DeepSeek, आणि Deepgram (ट्रान्सक्रिप्शन).',
      dialogPurpose:
        'गोपनीयता आणि सुरक्षा सेटिंग्जमध्ये कधीही संमती मागे घेऊ शकता. संमतीशिवाय AI वैशिष्ट्ये उपलब्ध नसतील.',
      dialogLearnMore: 'अधिक जाणून घ्या आमच्या',
      dialogDecline: 'आता नाही',
      dialogAgree: 'मी सहमत आहे',
      settingsTitle: 'AI inference संमती',
      settingsDescription:
        'संमती रीसेट झाली. पुढील AI वैशिष्ट्यापूर्वी पुन्हा विचारले जाईल.',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'तुमची गरज सांगा, योग्य फॉर्म जुळवा आणि AI ने मसुदे तयार करा.',
      stepDescribe: 'वर्णन',
      stepUnderstand: 'समजून घ्या',
      stepMatch: 'जुळवा',
      stepDraft: 'मसुदा',
      findAndDraft: 'शोधा आणि मसुदा',
      browseFormats: 'फॉर्मॅट ब्राउझ करा',
      whatToDraft: 'तुम्हाला काय मसुदा तयार करायचा आहे?',
      contextDetected: 'संदर्भ ओळखला',
      whatWeUnderstood: 'आम्हाला काय समजले',
      refineContext: 'वर्णन सुधारा',
      refineHint: 'दस्तऐवज जुळणी सुधारण्यासाठी तपशील जोडा.',
      updateAnalysis: 'विश्लेषण अद्यतनित करा',
      findMatchingForms: 'जुळणारे फॉर्म शोधा',
      resultsFor: 'निकाल',
      recommendedFilingSet: 'शिफारस केलेला फाइलिंग सेट',
      draftSelected:
        '{count, plural, one {# निवडलेल्या दस्तऐवजाचा मसुदा} other {# निवडलेल्या दस्तऐवजांचा मसुदा}}',
      draftNow: 'आता मसुदा तयार करा',
      otherMatches: 'इतर जुळण्या',
      officialForms: 'अधिकृत कायदेशीर फॉर्म',
      searchFormats: 'फॉर्मॅट शोधा…',
      generationFailed: 'मसुदा तयार करता आला नाही. कृपया पुन्हा प्रयत्न करा.',
      copied: 'मसुदा क्लिपबोर्डवर कॉपी झाला',
      generateDraft: 'मसुदा तयार करा',
      proceduralNote: 'प्रक्रियात्मक टीप',
      caseDetails: 'प्रकरणाचा तपशील',
      autoFill: 'रिकामी जागा स्वयंचलित भरा',
      copyDraft: 'मसुदा कॉपी करा',
      redo: 'पुन्हा तयार करा',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'तुमचे AI क्रेडिट संपले. umbrella.okaylegal.ai वर टॉप-अप किंवा प्लान अपग्रेड करा — मोबाइलवर in-app खरेदी उपलब्ध नाही.',
    },
    settings: {
      deleteAccount: 'खाते हटवा',
      deleteAccountSettingsHint: 'तुमचे खाते आणि वैयक्तिक डेटा कायमचे हटवा',
      deleteAccountDescription:
        'तुमचे Umbrella खाते आणि संबंधित वैयक्तिक डेटा कायमचे हटवा. ही कृती पूर्ववत करता येत नाही.',
      deleteAccountConfirmTitle: 'तुमचे खाते कायमचे हटवायचे?',
      deleteAccountConfirmBody:
        'तुमचा वैयक्तिक डेटा 30 दिवसांत हटवला किंवा अनामिक केला जाईल, कायदेशीर प्रतिधारण आवश्यकतांनुसार.',
      deleteAccountConfirmAction: 'खाते हटवा',
      deleteAccountEmailMismatch: 'ईमेल तुमच्या खात्याशी जुळत नाही.',
      deleteAccountError:
        'खाते हटवता आले नाही. पुन्हा प्रयत्न करा किंवा support@odaflow.com वर लिहा.',
      deleteAccountSuccess: 'तुमचे खाते हटवले. तुम्ही साइन आउट झाला आहात.',
      deleteAccountFormHeading: 'आता खाते हटवा',
      deleteAccountFormDescription:
        'साइन-इन वापरकर्ते खाली त्यांचे खाते कायमचे हटवू शकतात. ही कृती पूर्ववत करता येत नाही.',
      deleteAccountEmailLabel: 'तुमचा ईमेल पुष्टी करा',
      deleteAccountEmailRequired: 'ईमेल आवश्यक आहे',
      deleteAccountSubmitting: 'हटवत आहे…',
      deleteAccountSubmit: 'माझे खाते हटवा',
      privacyRightToErasure: 'मिटवण्याचा अधिकार',
      privacyRightToErasureBody:
        'तुमच्या खात्याची आणि वैयक्तिक डेटाची कायमची हटवणी विनंती करा.',
    },
    matters: {
      clientRequiredError: 'कृपया क्लायंट निवडा किंवा तयार करा',
      addPartyForConflictCheck: 'विवाद तपासणीसाठी किमान एक पक्ष जोडा',
      intakeStepType: 'प्रकार',
      intakeStepBasics: 'मूलभूत',
      intakeStepSpecifics: 'विशिष्ट',
      intakeStepBackground: 'पार्श्वभूमी',
      intakeStepReview: 'पुनरावलोकन',
      noAdditionalFieldsForType: 'या मामल्याच्या प्रकारासाठी अतिरिक्त फील्ड नाहीत',
      conflictCheckTitle: 'विवाद तपास',
      conflictCheckDescription:
        'प्रकरण उघडण्यापूर्वी विद्यमान क्लायंट आणि मामल्यांविरुद्ध पक्ष तपासा.',
      conflictCheckPartyHint: 'विवाद तपासणी सक्षम करण्यासाठी मूलभूत पायरीत पक्ष जोडा.',
      checkingConflict: 'विवाद तपासत आहे…',
      runConflictCheck: 'विवाद तपास चालवा',
    },
  },
  ta: {
    auth: { phoneRequired: 'தொலைபேசி எண் தேவை' },
    aiConsent: {
      dialogTitle: 'AI செயலாக்க ஒப்புதல்',
      dialogBody:
        'Umbrella உங்கள் கேள்வி மற்றும் விஷய சூழலை சட்ட பகுப்பாய்வு, வரைவு உருவாக்கம் மற்றும் ஆராய்ச்சிக்காக மூன்றாம் தரப்பு AI வழங்குநர்களுக்கு அனுப்புகிறது. உங்கள் தரவு AI மாதிரிகளை பயிற்றுவிக்க பயன்படுத்தப்படுவதில்லை.',
      dialogProviders: 'வழங்குநர்கள்: OpenAI, Anthropic, DeepSeek, மற்றும் Deepgram (படியெடுப்பு).',
      dialogPurpose:
        'தனியுரிமை & பாதுகாப்பு அமைப்புகளில் எப்போதும் ஒப்புதலை திரும்பப் பெறலாம். ஒப்புதல் இல்லாமல் AI அம்சங்கள் கிடைக்காது.',
      dialogLearnMore: 'மேலும் அறிய எங்கள்',
      dialogDecline: 'இப்போது வேண்டாம்',
      dialogAgree: 'நான் ஒப்புக்கொள்கிறேன்',
      settingsTitle: 'AI inference ஒப்புதல்',
      settingsDescription:
        'ஒப்புதல் மீட்டமைக்கப்பட்டது. அடுத்த AI அம்சத்திற்கு முன் மீண்டும் கேட்கப்படும்.',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'உங்கள் தேவையை விவரிக்கவும், அதிகாரப்பூர்வ படிவங்களை பொருத்தவும், AI மூலம் வரைவுகளை உருவாக்கவும்.',
      stepDescribe: 'விவரி',
      stepUnderstand: 'புரிந்துகொள்',
      stepMatch: 'பொருத்து',
      stepDraft: 'வரைவு',
      findAndDraft: 'கண்டறிந்து வரைவு',
      browseFormats: 'வடிவங்களை உலாவு',
      whatToDraft: 'நீங்கள் எதை வரைவாக்க விரும்புகிறீர்கள்?',
      contextDetected: 'சூழல் கண்டறியப்பட்டது',
      whatWeUnderstood: 'நாங்கள் புரிந்துகொண்டது',
      refineContext: 'விளக்கத்தை மேம்படுத்து',
      refineHint: 'ஆவண பொருத்தங்களை மேம்படுத்த விவரங்களை சேர்க்கவும்.',
      updateAnalysis: 'பகுப்பாய்வை புதுப்பி',
      findMatchingForms: 'பொருந்தும் படிவங்களை கண்டறி',
      resultsFor: 'முடிவுகள்',
      recommendedFilingSet: 'பரிந்துரைக்கப்பட்ட தாக்கல் தொகுப்பு',
      draftSelected:
        '{count, plural, one {# தேர்ந்தெடுக்கப்பட்ட ஆவண வரைவு} other {# தேர்ந்தெடுக்கப்பட்ட ஆவணங்கள் வரைவு}}',
      draftNow: 'இப்போது வரைவு',
      otherMatches: 'பிற பொருத்தங்கள்',
      officialForms: 'அதிகாரப்பூர்வ சட்ட படிவங்கள்',
      searchFormats: 'வடிவங்களை தேடு…',
      generationFailed: 'வரைவை உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
      copied: 'வரைவு கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது',
      generateDraft: 'வரைவை உருவாக்கு',
      proceduralNote: 'செயல்முறை குறிப்பு',
      caseDetails: 'வழக்கு விவரங்கள்',
      autoFill: 'வெற்றிடங்களை தானாக நிரப்பு',
      copyDraft: 'வரைவை நகலெடு',
      redo: 'மீண்டும் உருவாக்கு',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'உங்கள் AI கிரெடிட்கள் தீர்ந்துவிட்டன. umbrella.okaylegal.ai-ல் டாப்-அப் அல்லது திட்டத்தை மேம்படுத்தவும் — மொபைலில் in-app வாங்குதல் கிடைக்காது.',
    },
    settings: {
      deleteAccount: 'கணக்கை நீக்கு',
      deleteAccountSettingsHint: 'உங்கள் கணக்கையும் தனிப்பட்ட தரவையும் நிரந்தரமாக நீக்கு',
      deleteAccountDescription:
        'உங்கள் Umbrella கணக்கையும் தொடர்புடைய தனிப்பட்ட தரவையும் நிரந்தரமாக நீக்கு. இந்த செயலை மீளமுடியாது.',
      deleteAccountConfirmTitle: 'உங்கள் கணக்கை நிரந்தரமாக நீக்கவா?',
      deleteAccountConfirmBody:
        'உங்கள் தனிப்பட்ட தரவு 30 நாட்களுக்குள் நீக்கப்படும் அல்லது அநாமதேயமாக்கப்படும், சட்ட தக்கவைப்பு தேவைகளுக்கு உட்பட்டு.',
      deleteAccountConfirmAction: 'கணக்கை நீக்கு',
      deleteAccountEmailMismatch: 'மின்னஞ்சல் உங்கள் கணக்குடன் பொருந்தவில்லை.',
      deleteAccountError:
        'கணக்கை நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும் அல்லது support@odaflow.com-க்கு மின்னஞ்சல் அனுப்பவும்.',
      deleteAccountSuccess: 'உங்கள் கணக்கு நீக்கப்பட்டது. நீங்கள் வெளியேற்றப்பட்டீர்கள்.',
      deleteAccountFormHeading: 'இப்போது கணக்கை நீக்கு',
      deleteAccountFormDescription:
        'உள்நுழைந்த பயனர்கள் கீழே தங்கள் கணக்கை நிரந்தரமாக நீக்கலாம். இந்த செயலை மீளமுடியாது.',
      deleteAccountEmailLabel: 'உங்கள் மின்னஞ்சலை உறுதிப்படுத்து',
      deleteAccountEmailRequired: 'மின்னஞ்சல் தேவை',
      deleteAccountSubmitting: 'நீக்குகிறது…',
      deleteAccountSubmit: 'எனது கணக்கை நீக்கு',
      privacyRightToErasure: 'அழிக்கும் உரிமை',
      privacyRightToErasureBody:
        'உங்கள் கணக்கு மற்றும் தனிப்பட்ட தரவின் நிரந்தர நீக்கத்தை கோருங்கள்.',
    },
    matters: {
      clientRequiredError: 'தயவுசெய்து வாடிக்கையை தேர்ந்தெடுக்கவும் அல்லது உருவாக்கவும்',
      addPartyForConflictCheck: 'மோதல் சரிபார்ப்புக்கு குறைந்தது ஒரு தரப்பை சேர்க்கவும்',
      intakeStepType: 'வகை',
      intakeStepBasics: 'அடிப்படை',
      intakeStepSpecifics: 'குறிப்பிட்ட',
      intakeStepBackground: 'பின்னணி',
      intakeStepReview: 'மதிப்பாய்வு',
      noAdditionalFieldsForType: 'இந்த விஷய வகைக்கு கூடுதல் புலங்கள் இல்லை',
      conflictCheckTitle: 'மோதல் சரிபார்ப்பு',
      conflictCheckDescription:
        'வழக்கை திறப்பதற்கு முன் இருக்கும் வாடிக்கைகள் மற்றும் விஷயங்களுக்கு எதிராக தரப்புகளை சரிபார்.',
      conflictCheckPartyHint: 'மோதல் சரிபார்ப்பை இயக்க அடிப்படை படியில் தரப்புகளை சேர்க்கவும்.',
      checkingConflict: 'மோதல்களை சரிபார்க்கிறது…',
      runConflictCheck: 'மோதல் சரிபார்ப்பை இயக்கு',
    },
  },
})

T.ta.docuDraft.proceduralNote = 'செயல்முறை குறிப்பு'
T.ta.mobile.creditsExhaustedWebOnly =
  'உங்கள் AI கிரெடிட்கள் தீர்ந்துவிட்டன. umbrella.okaylegal.ai-ல் டாப்-அப் அல்லது திட்டத்தை மேம்படுத்தவும் — மொபைலில் in-app வாங்குதல் கிடைக்காது.'

Object.assign(T, {
  gu: {
    auth: { phoneRequired: 'ફોન નંબર જરૂરી છે' },
    aiConsent: {
      dialogTitle: 'AI પ્રોસેસિંગ સંમતિ',
      dialogBody:
        'Umbrella તમારો પ્રશ્ન અને મામલાનો સંદર્ભ કાનૂની વિશ્લેષણ, ડ્રાફ્ટિંગ અને સંશોધન માટે તૃતીય-પક્ષ AI પ્રદાતાઓને મોકલે છે. તમારો ડેટા AI મોડેલ તાલીમ માટે ઉપયોગમાં લેવાતો નથી.',
      dialogProviders: 'પ્રદાતાઓ: OpenAI, Anthropic, DeepSeek, અને Deepgram (ટ્રાન્સક્રિપ્શન).',
      dialogPurpose:
        'ગોપનીયતા અને સુરક્ષા સેટિંગ્સમાં કોઈપણ સમયે સંમતિ પાછી ખેંચી શકો. સંમતિ વિના AI સુવિધાઓ ઉપલબ્ધ નહીં રહે.',
      dialogLearnMore: 'વધુ જાણો અમારી',
      dialogDecline: 'હમણાં નહીં',
      dialogAgree: 'હું સહમત છું',
      settingsTitle: 'AI inference સંમતિ',
      settingsDescription:
        'સંમતિ રીસેટ થઈ. આગલી AI સુવિધા પહેલાં ફરી પૂછવામાં આવશે.',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'તમારી જરૂરિયાત કહો, અધિકૃત ફોર્મ મેળ કરો અને AI થી ડ્રાફ્ટ બનાવો.',
      stepDescribe: 'વર્ણન',
      stepUnderstand: 'સમજો',
      stepMatch: 'મેળ',
      stepDraft: 'ડ્રાફ્ટ',
      findAndDraft: 'શોધો અને ડ્રાફ્ટ',
      browseFormats: 'ફોર્મેટ બ્રાઉઝ કરો',
      whatToDraft: 'તમે શું ડ્રાફ્ટ બનાવવા માંગો છો?',
      contextDetected: 'સંદર્ભ ઓળખાયો',
      whatWeUnderstood: 'અમે શું સમજ્યા',
      refineContext: 'વર્ણન સુધારો',
      refineHint: 'દસ્તાવેજ મેળ સુધારવા વિગતો ઉમેરો.',
      updateAnalysis: 'વિશ્લેષણ અપડેટ કરો',
      findMatchingForms: 'મેળ ખાતા ફોર્મ શોધો',
      resultsFor: 'પરિણામો',
      recommendedFilingSet: 'ભલામણ કરેલ ફાઇલિંગ સેટ',
      draftSelected:
        '{count, plural, one {# પસંદ કરેલ દસ્તાવેજનો ડ્રાફ્ટ} other {# પસંદ કરેલ દસ્તાવેજોનો ડ્રાફ્ટ}}',
      draftNow: 'હવે ડ્રાફ્ટ બનાવો',
      otherMatches: 'અન્ય મેળ',
      officialForms: 'અધિકૃત કાનૂની ફોર્મ',
      searchFormats: 'ફોર્મેટ શોધો…',
      generationFailed: 'ડ્રાફ્ટ બનાવી શકાયું નહીં. કૃપા કરીને ફરી પ્રયાસ કરો.',
      copied: 'ડ્રાફ્ટ ક્લિપબોર્ડ પર કૉપી થયો',
      generateDraft: 'ડ્રાફ્ટ બનાવો',
      proceduralNote: 'પ્રક્રિયાત્મક નોંધ',
      caseDetails: 'કેસની વિગતો',
      autoFill: 'ખાલી જગ્યાઓ સ્વયં ભરો',
      copyDraft: 'ડ્રાફ્ટ કૉપી કરો',
      redo: 'ફરી બનાવો',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'તમારા AI ક્રેડિટ પૂરા થઈ ગયા. umbrella.okaylegal.ai પર ટોપ-અપ અથવા પ્લાન અપગ્રેડ કરો — મોબાઇલ પર in-app ખરીદી ઉપલબ્ધ નથી.',
    },
    settings: {
      deleteAccount: 'એકાઉન્ટ કાઢી નાખો',
      deleteAccountSettingsHint: 'તમારું એકાઉન્ટ અને વ્યક્તિગત ડેટા કાયમી રીતે કાઢી નાખો',
      deleteAccountDescription:
        'તમારું Umbrella એકાઉન્ટ અને સંબંધિત વ્યક્તિગત ડેટા કાયમી રીતે કાઢી નાખો. આ ક્રિયા પૂર્વવત્ કરી શકાતી નથી.',
      deleteAccountConfirmTitle: 'તમારું એકાઉન્ટ કાયમી રીતે કાઢી નાખવું?',
      deleteAccountConfirmBody:
        'તમારો વ્યક્તિગત ડેટા 30 દિવસમાં કાઢી નાખવામાં અથવા અનામ કરવામાં આવશે, કાનૂની પ્રતિધારણ જરૂરિયાતો અનુસાર.',
      deleteAccountConfirmAction: 'એકાઉન્ટ કાઢી નાખો',
      deleteAccountEmailMismatch: 'ઈમેલ તમારા એકાઉન્ટ સાથે મેળ ખાતો નથી.',
      deleteAccountError:
        'એકાઉન્ટ કાઢી શકાયું નહીં. ફરી પ્રયાસ કરો અથવા support@odaflow.com પર લખો.',
      deleteAccountSuccess: 'તમારું એકાઉન્ટ કાઢી નાખવામાં આવ્યું. તમે સાઇન આઉટ થયા.',
      deleteAccountFormHeading: 'હવે એકાઉન્ટ કાઢી નાખો',
      deleteAccountFormDescription:
        'સાઇન-ઇન વપરાશકર્તાઓ નીચે તેમનું એકાઉન્ટ કાયમી રીતે કાઢી શકે. આ ક્રિયા પૂર્વવત્ કરી શકાતી નથી.',
      deleteAccountEmailLabel: 'તમારો ઈમેલ પુષ્ટિ કરો',
      deleteAccountEmailRequired: 'ઈમેલ જરૂરી છે',
      deleteAccountSubmitting: 'કાઢી રહ્યા છીએ…',
      deleteAccountSubmit: 'મારું એકાઉન્ટ કાઢી નાખો',
      privacyRightToErasure: 'મિટાવવાનો અધિકાર',
      privacyRightToErasureBody:
        'તમારા એકાઉન્ટ અને વ્યક્તિગત ડેટાની કાયમી હટાવટની વિનંતી કરો.',
    },
    matters: {
      clientRequiredError: 'કૃપા કરીને ક્લાયન્ટ પસંદ કરો અથવા બનાવો',
      addPartyForConflictCheck: 'વિરોધાભાસ તપાસ માટે ઓછામાં ઓછી એક પક્ષ ઉમેરો',
      intakeStepType: 'પ્રકાર',
      intakeStepBasics: 'મૂળભૂત',
      intakeStepSpecifics: 'વિશિષ્ટ',
      intakeStepBackground: 'પૃષ્ઠભૂમિ',
      intakeStepReview: 'સમીક્ષા',
      noAdditionalFieldsForType: 'આ મામલા પ્રકાર માટે વધારાના ફીલ્ડ નથી',
      conflictCheckTitle: 'વિરોધાભાસ તપાસ',
      conflictCheckDescription:
        'કેસ ખોલતા પહેલાં હાજર ક્લાયન્ટ અને મામલા સામે પક્ષો તપાસો.',
      conflictCheckPartyHint: 'વિરોધાભાસ તપાસ સક્ષમ કરવા મૂળભૂત પગલે પક્ષો ઉમેરો.',
      checkingConflict: 'વિરોધાભાસ તપાસી રહ્યા છીએ…',
      runConflictCheck: 'વિરોધાભાસ તપાસ ચલાવો',
    },
  },
  kn: {
    auth: { phoneRequired: 'ಫೋನ್ ಸಂಖ್ಯೆ ಅಗತ್ಯ' },
    aiConsent: {
      dialogTitle: 'AI ಪ್ರಕ್ರಿಯೆ ಸಮ್ಮತಿ',
      dialogBody:
        'Umbrella ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಮತ್ತು ವಿಷಯದ ಸಂದರ್ಭವನ್ನು ಕಾನೂನು ವಿಶ್ಲೇಷಣೆ, ಕರಡು ರಚನೆ ಮತ್ತು ಸಂಶೋಧನೆಗಾಗಿ ತೃತೀಯ-ಪಕ್ಷ AI ಒದಗಿಸುವವರಿಗೆ ಕಳುಹಿಸುತ್ತದೆ. ನಿಮ್ಮ ಡೇಟಾವನ್ನು AI ಮಾದರಿ ತರಬೇತಿಗೆ ಬಳಸಲಾಗುವುದಿಲ್ಲ.',
      dialogProviders: 'ಒದಗಿಸುವವರು: OpenAI, Anthropic, DeepSeek, ಮತ್ತು Deepgram (ಟ್ರಾನ್ಸ್‌ಕ್ರಿಪ್ಶನ್).',
      dialogPurpose:
        'ಗೌಪ್ಯತೆ ಮತ್ತು ಭದ್ರತಾ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಯಾವಾಗ ಬೇಕಾದರೂ ಸಮ್ಮತಿಯನ್ನು ಹಿಂತೆಗೆದುಕೊಳ್ಳಬಹುದು. ಸಮ್ಮತಿಯಿಲ್ಲದೆ AI ವೈಶಿಷ್ಟ್ಯಗಳು ಲಭ್ಯವಿರುವುದಿಲ್ಲ.',
      dialogLearnMore: 'ಹೆಚ್ಚು ತಿಳಿಯಿರಿ ನಮ್ಮ',
      dialogDecline: 'ಈಗ ಅಲ್ಲ',
      dialogAgree: 'ನಾನು ಒಪ್ಪಿಗೆ ನೀಡುತ್ತೇನೆ',
      settingsTitle: 'AI inference ಸಮ್ಮತಿ',
      settingsDescription:
        'ಸಮ್ಮತಿ ಮರುಹೊಂದಿಸಲಾಗಿದೆ. ಮುಂದಿನ AI ವೈಶಿಷ್ಟ್ಯಕ್ಕೂ ಮೊದಲು ಮತ್ತೆ ಕೇಳಲಾಗುತ್ತದೆ.',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'ನಿಮ್ಮ ಅಗತ್ಯವನ್ನು ವಿವರಿಸಿ, ಅಧಿಕೃತ ಫಾರ್ಮ್‌ಗಳನ್ನು ಹೊಂದಿಸಿ, AI ಮೂಲಕ ಕರಡುಗಳನ್ನು ರಚಿಸಿ.',
      stepDescribe: 'ವಿವರಿಸಿ',
      stepUnderstand: 'ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ',
      stepMatch: 'ಹೊಂದಿಸಿ',
      stepDraft: 'ಕರಡು',
      findAndDraft: 'ಹುಡುಕಿ ಮತ್ತು ಕರಡು',
      browseFormats: 'ಫಾರ್ಮ್ಯಾಟ್‌ಗಳನ್ನು ಬ್ರೌಸ್ ಮಾಡಿ',
      whatToDraft: 'ನೀವು ಏನನ್ನು ಕರಡು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?',
      contextDetected: 'ಸಂದರ್ಭ ಪತ್ತೆಯಾಗಿದೆ',
      whatWeUnderstood: 'ನಾವು ಅರ್ಥಮಾಡಿಕೊಂಡದು',
      refineContext: 'ವಿವರಣೆಯನ್ನು ಸುಧಾರಿಸಿ',
      refineHint: 'ದಾಖಲೆ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ಸುಧಾರಿಸಲು ವಿವರಗಳನ್ನು ಸೇರಿಸಿ.',
      updateAnalysis: 'ವಿಶ್ಲೇಷಣೆಯನ್ನು ನವೀಕರಿಸಿ',
      findMatchingForms: 'ಹೊಂದುವ ಫಾರ್ಮ್‌ಗಳನ್ನು ಹುಡುಕಿ',
      resultsFor: 'ಫಲಿತಾಂಶಗಳು',
      recommendedFilingSet: 'ಶಿಫಾರಸು ಮಾಡಿದ ಫೈಲಿಂಗ್ ಸೆಟ್',
      draftSelected:
        '{count, plural, one {# ಆಯ್ಕೆಮಾಡಿದ ದಾಖಲೆಯ ಕರಡು} other {# ಆಯ್ಕೆಮಾಡಿದ ದಾಖಲೆಗಳ ಕರಡು}}',
      draftNow: 'ಈಗ ಕರಡು ಮಾಡಿ',
      otherMatches: 'ಇತರ ಹೊಂದಾಣಿಕೆಗಳು',
      officialForms: 'ಅಧಿಕೃತ ಕಾನೂನು ಫಾರ್ಮ್‌ಗಳು',
      searchFormats: 'ಫಾರ್ಮ್ಯಾಟ್‌ಗಳನ್ನು ಹುಡುಕಿ…',
      generationFailed: 'ಕರಡು ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      copied: 'ಕರಡು ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ',
      generateDraft: 'ಕರಡು ರಚಿಸಿ',
      proceduralNote: 'ಕಾರ್ಯವಿಧಾನ ಟಿಪ್ಪಣಿ',
      caseDetails: 'ಪ್ರಕರಣದ ವಿವರಗಳು',
      autoFill: 'ಖಾಲಿ ಜಾಗಗಳನ್ನು ಸ್ವಯಂ ತುಂಬಿ',
      copyDraft: 'ಕರಡು ನಕಲಿಸಿ',
      redo: 'ಮತ್ತೆ ರಚಿಸಿ',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'ನಿಮ್ಮ AI ಕ್ರೆಡಿಟ್‌ಗಳು ಮುಗಿದಿವೆ. umbrella.okaylegal.ai ನಲ್ಲಿ ಟಾಪ್-ಅಪ್ ಅಥವಾ ಪ್ಲಾನ್ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ — ಮೊಬೈಲ್‌ನಲ್ಲಿ in-app ಖರೀದಿ ಲಭ್ಯವಿಲ್ಲ.',
    },
    settings: {
      deleteAccount: 'ಖಾತೆಯನ್ನು ಅಳಿಸಿ',
      deleteAccountSettingsHint: 'ನಿಮ್ಮ ಖಾತೆ ಮತ್ತು ವೈಯಕ್ತಿಕ ಡೇಟಾವನ್ನು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಿ',
      deleteAccountDescription:
        'ನಿಮ್ಮ Umbrella ಖಾತೆ ಮತ್ತು ಸಂಬಂಧಿತ ವೈಯಕ್ತಿಕ ಡೇಟಾವನ್ನು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಿ. ಈ ಕ್ರಿಯೆಯನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗುವುದಿಲ್ಲ.',
      deleteAccountConfirmTitle: 'ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಬೇಕೆ?',
      deleteAccountConfirmBody:
        'ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಡೇಟಾವನ್ನು 30 ದಿನಗಳಲ್ಲಿ ಅಳಿಸಲಾಗುತ್ತದೆ ಅಥವಾ ಅನಾಮಧೇಯಗೊಳಿಸಲಾಗುತ್ತದೆ, ಕಾನೂನು ಪ್ರತिधಾರಣೆ ಅವಶ್ಯಕತೆಗಳಿಗೆ ಒಳಪಟ್ಟು.',
      deleteAccountConfirmAction: 'ಖಾತೆಯನ್ನು ಅಳಿಸಿ',
      deleteAccountEmailMismatch: 'ಇಮೇಲ್ ನಿಮ್ಮ ಖಾತೆಗೆ ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ.',
      deleteAccountError:
        'ಖಾತೆಯನ್ನು ಅಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ support@odaflow.com ಗೆ ಬರೆಯಿರಿ.',
      deleteAccountSuccess: 'ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಅಳಿಸಲಾಗಿದೆ. ನೀವು ಸೈನ್ ಔಟ್ ಆಗಿದ್ದೀರಿ.',
      deleteAccountFormHeading: 'ಈಗ ಖಾತೆಯನ್ನು ಅಳಿಸಿ',
      deleteAccountFormDescription:
        'ಸೈನ್-ಇನ್ ಬಳಕೆದಾರರು ಕೆಳಗೆ ತಮ್ಮ ಖಾತೆಯನ್ನು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಬಹುದು. ಈ ಕ್ರಿಯೆಯನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗುವುದಿಲ್ಲ.',
      deleteAccountEmailLabel: 'ನಿಮ್ಮ ಇಮೇಲ್ ದೃಢೀಕರಿಸಿ',
      deleteAccountEmailRequired: 'ಇಮೇಲ್ ಅಗತ್ಯ',
      deleteAccountSubmitting: 'ಅಳಿಸಲಾಗುತ್ತಿದೆ…',
      deleteAccountSubmit: 'ನನ್ನ ಖಾತೆಯನ್ನು ಅಳಿಸಿ',
      privacyRightToErasure: 'ಅಳಿಸುವ ಹಕ್ಕು',
      privacyRightToErasureBody:
        'ನಿಮ್ಮ ಖಾತೆ ಮತ್ತು ವೈಯಕ್ತಿಕ ಡೇಟಾದ ಶಾಶ್ವತ ಅಳಿಸುವಿಕೆಯನ್ನು ವಿನಂತಿಸಿ.',
    },
    matters: {
      clientRequiredError: 'ದಯವಿಟ್ಟು ಕ್ಲೈಂಟ್ ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ರಚಿಸಿ',
      addPartyForConflictCheck: 'ಸಂಘರ್ಷ ಪರಿಶೀಲನೆಗಾಗಿ ಕನಿಷ್ಠ ಒಂದು ಪಕ್ಷವನ್ನು ಸೇರಿಸಿ',
      intakeStepType: 'ಪ್ರಕಾರ',
      intakeStepBasics: 'ಮೂಲಭೂತ',
      intakeStepSpecifics: 'ವಿಶಿಷ್ಟ',
      intakeStepBackground: 'ಹಿನ್ನೆಲೆ',
      intakeStepReview: 'ಪರಿಶೀಲನೆ',
      noAdditionalFieldsForType: 'ಈ ವಿಷಯ ಪ್ರಕಾರಕ್ಕೆ ಹೆಚ್ಚುವರಿ ಫೀಲ್ಡ್‌ಗಳಿಲ್ಲ',
      conflictCheckTitle: 'ಸಂಘರ್ಷ ಪರಿಶೀಲನೆ',
      conflictCheckDescription:
        'ಪ್ರಕರಣ ತೆರೆಯುವ ಮೊದಲು ಅಸ್ತಿತ್ವದಲ್ಲಿರುವ ಕ್ಲೈಂಟ್‌ಗಳು ಮತ್ತು ವಿಷಯಗಳ ವಿರುದ್ಧ ಪಕ್ಷಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.',
      conflictCheckPartyHint: 'ಸಂಘರ್ಷ ಪರಿಶೀಲನೆಯನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಲು ಮೂಲಭೂತ ಹಂತದಲ್ಲಿ ಪಕ್ಷಗಳನ್ನು ಸೇರಿಸಿ.',
      checkingConflict: 'ಸಂಘರ್ಷಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…',
      runConflictCheck: 'ಸಂಘರ್ಷ ಪರಿಶೀಲನೆ ನಡೆಸಿ',
    },
  },
  ml: {
    auth: { phoneRequired: 'ഫോൺ നമ്പർ ആവശ്യമാണ്' },
    aiConsent: {
      dialogTitle: 'AI പ്രോസസ്സിംഗ് സമ്മതം',
      dialogBody:
        'Umbrella നിങ്ങളുടെ ചോദ്യവും കാര്യത്തിന്റെ സന്ദർഭവും നിയമപരമായ വിശകലനം, ഡ്രാഫ്റ്റിംഗ്, ഗവേഷണം എന്നിവയ്‌ക്കായി മൂന്നാം കക്ഷി AI providersക്ക് അയയ്‌ക്കുന്നു. നിങ്ങളുടെ ഡാറ്റ AI മോഡലുകൾ പരിശീലിപ്പിക്കാൻ ഉപയോഗിക്കുന്നില്ല.',
      dialogProviders: 'Providers: OpenAI, Anthropic, DeepSeek, Deepgram (transcription).',
      dialogPurpose:
        'സ്വകാര്യതയും സുരക്ഷാ ക്രമീകരണങ്ങളിലും എപ്പോൾ വേണമെങ്കിലും സമ്മതം പിൻവലിക്കാം. സമ്മതമില്ലാതെ AI സവിശേഷതകൾ ലഭ്യമാകില്ല.',
      dialogLearnMore: 'കൂടുതൽ അറിയുക ഞങ്ങളുടെ',
      dialogDecline: 'ഇപ്പോൾ വേണ്ട',
      dialogAgree: 'ഞാൻ സമ്മതിക്കുന്നു',
      settingsTitle: 'AI inference സമ്മതം',
      settingsDescription:
        'സമ്മതം പുനഃസജ്ജമാക്കി. അടുത്ത AI സവിശേഷതയ്ക്ക് മുമ്പ് വീണ്ടും ചോദിക്കും.',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'നിങ്ങളുടെ ആവശ്യം പറയുക, ഔദ്യോഗിക ഫോമുകൾ പൊരുത്തപ്പെടുത്തുക, AI ഉപയോഗിച്ച് ഡ്രാഫ്റ്റുകൾ ഉണ്ടാക്കുക.',
      stepDescribe: 'വിവരിക്കുക',
      stepUnderstand: 'മനസ്സിലാക്കുക',
      stepMatch: 'പൊരുത്തുക',
      stepDraft: 'ഡ്രാഫ്റ്റ്',
      findAndDraft: 'കണ്ടെത്തി & ഡ്രാഫ്റ്റ്',
      browseFormats: 'ഫോർമാറ്റുകൾ ബ്രൗസ് ചെയ്യുക',
      whatToDraft: 'നിങ്ങൾ എന്താണ് ഡ്രാഫ്റ്റ് ചെയ്യാൻ ആഗ്രഹിക്കുന്നത്?',
      contextDetected: 'സന്ദർഭം കണ്ടെത്തി',
      whatWeUnderstood: 'ഞങ്ങൾ മനസ്സിലാക്കിയത്',
      refineContext: 'വിവരണം മെച്ചപ്പെടുത്തുക',
      refineHint: 'രേഖാ പൊരുത്തങ്ങൾ മെച്ചപ്പെടുത്താൻ വിവരങ്ങൾ ചേർക്കുക.',
      updateAnalysis: 'വിശകലനം അപ്‌ഡേറ്റ് ചെയ്യുക',
      findMatchingForms: 'പൊരുത്തപ്പെടുന്ന ഫോമുകൾ കണ്ടെത്തുക',
      resultsFor: 'ഫലങ്ങൾ',
      recommendedFilingSet: 'ശുപാർശ ചെയ്ത ഫൈലിംഗ് സെറ്റ്',
      draftSelected:
        '{count, plural, one {# തിരഞ്ഞെടുത്ത രേഖയുടെ ഡ്രാഫ്റ്റ്} other {# തിരഞ്ഞെടുത്ത രേഖകളുടെ ഡ്രാഫ്റ്റ്}}',
      draftNow: 'ഇപ്പോൾ ഡ്രാഫ്റ്റ്',
      otherMatches: 'മറ്റ് പൊരുത്തങ്ങൾ',
      officialForms: 'ഔദ്യോഗിക നിയമ ഫോമുകൾ',
      searchFormats: 'ഫോർമാറ്റുകൾ തിരയുക…',
      generationFailed: 'ഡ്രാഫ്റ്റ് ഉണ്ടാക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.',
      copied: 'ഡ്രാഫ്റ്റ് ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി',
      generateDraft: 'ഡ്രാഫ്റ്റ് ഉണ്ടാക്കുക',
      proceduralNote: 'നടപടിക്രമ കുറിപ്പ്',
      caseDetails: 'കേസ് വിവരങ്ങൾ',
      autoFill: 'ഖാലി സ്ഥലങ്ങൾ സ്വയം നിറയ്ക്കുക',
      copyDraft: 'ഡ്രാഫ്റ്റ് പകർത്തുക',
      redo: 'വീണ്ടും ഉണ്ടാക്കുക',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'നിങ്ങളുടെ AI ക്രെഡിറ്റുകൾ തീർന്നു. umbrella.okaylegal.ai-ൽ ടോപ്പ്-അപ്പ് അല്ലെങ്കിൽ പ്ലാൻ അപ്‌ഗ്രേഡ് ചെയ്യുക — മൊബൈലിൽ in-app purchases ലഭ്യമല്ല.',
    },
    settings: {
      deleteAccount: 'അക്കൗണ്ട് ഇല്ലാതാക്കുക',
      deleteAccountSettingsHint: 'നിങ്ങളുടെ അക്കൗണ്ടും വ്യക്തിഗത ഡാറ്റയും ശാശ്വതമായി ഇല്ലാതാക്കുക',
      deleteAccountDescription:
        'നിങ്ങളുടെ Umbrella അക്കൗണ്ടും ബന്ധപ്പെട്ട വ്യക്തിഗത ഡാറ്റയും ശാശ്വതമായി ഇല്ലാതാക്കുക. ഈ പ്രവർത്തനം പഴയപടിയാക്കാൻ കഴിയില്ല.',
      deleteAccountConfirmTitle: 'നിങ്ങളുടെ അക്കൗണ്ട് ശാശ്വതമായി ഇല്ലാതാക്കണോ?',
      deleteAccountConfirmBody:
        'നിങ്ങളുടെ വ്യക്തിഗത ഡാറ്റ 30 ദിവസത്തിനുള്ളിൽ ഇല്ലാതാക്കുകയോ അജ്ഞാതമാക്കുകയോ ചെയ്യും, നിയമപരമായ നിലനിർത്തൽ ആവശ്യങ്ങൾക്ക് വിധേയമായി.',
      deleteAccountConfirmAction: 'അക്കൗണ്ട് ഇല്ലാതാക്കുക',
      deleteAccountEmailMismatch: 'ഇമെയിൽ നിങ്ങളുടെ അക്കൗണ്ടുമായി പൊരുത്തപ്പെടുന്നില്ല.',
      deleteAccountError:
        'അക്കൗണ്ട് ഇല്ലാതാക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ support@odaflow.com-ലേക്ക് ഇമെയിൽ ചെയ്യുക.',
      deleteAccountSuccess: 'നിങ്ങളുടെ അക്കൗണ്ട് ഇല്ലാതാക്കി. നിങ്ങൾ സൈൻ ഔട്ട് ചെയ്തു.',
      deleteAccountFormHeading: 'ഇപ്പോൾ അക്കൗണ്ട് ഇല്ലാതാക്കുക',
      deleteAccountFormDescription:
        'സൈൻ-ഇൻ ചെയ്ത ഉപയോക്താക്കൾക്ക് താഴെ അവരുടെ അക്കൗണ്ട് ശാശ്വതമായി ഇല്ലാതാക്കാം. ഈ പ്രവർത്തനം പഴയപടിയാക്കാൻ കഴിയില്ല.',
      deleteAccountEmailLabel: 'നിങ്ങളുടെ ഇമെയിൽ സ്ഥിരീകരിക്കുക',
      deleteAccountEmailRequired: 'ഇമെയിൽ ആവശ്യമാണ്',
      deleteAccountSubmitting: 'ഇല്ലാതാക്കുന്നു…',
      deleteAccountSubmit: 'എന്റെ അക്കൗണ്ട് ഇല്ലാതാക്കുക',
      privacyRightToErasure: 'മായ്ക്കാനുള്ള അവകാശം',
      privacyRightToErasureBody:
        'നിങ്ങളുടെ അക്കൗണ്ടിന്റെയും വ്യക്തിഗത ഡാറ്റയുടെയും ശാശ്വതമായ ഇല്ലാതാക്കൽ അഭ്യർത്ഥിക്കുക.',
    },
    matters: {
      clientRequiredError: 'ദയവായി ക്ലയന്റ് തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ ഉണ്ടാക്കുക',
      addPartyForConflictCheck: 'വൈരുദ്ധ്യ പരിശോധനയ്ക്ക് കുറഞ്ഞത് ഒരു പാർട്ടി ചേർക്കുക',
      intakeStepType: 'തരം',
      intakeStepBasics: 'അടിസ്ഥാന',
      intakeStepSpecifics: 'പ്രത്യേക',
      intakeStepBackground: 'പശ്ചാത്തലം',
      intakeStepReview: 'അവലോകനം',
      noAdditionalFieldsForType: 'ഈ കാര്യ തരത്തിന് അധിക ഫീൽഡുകൾ ഇല്ല',
      conflictCheckTitle: 'വൈരുദ്ധ്യ പരിശോധന',
      conflictCheckDescription:
        'കേസ് തുറക്കുന്നതിന് മുമ്പ് നിലവിലുള്ള ക്ലയന്റുകളും കാര്യങ്ങളും എതിരായി പാർട്ടികളെ പരിശോധിക്കുക.',
      conflictCheckPartyHint:
        'വൈരുദ്ധ്യ പരിശോധന സജീവമാക്കാൻ അടിസ്ഥാന ഘട്ടത്തിൽ പാർട്ടികൾ ചേർക്കുക.',
      checkingConflict: 'വൈരുദ്ധ്യങ്ങൾ പരിശോധിക്കുന്നു…',
      runConflictCheck: 'വൈരുദ്ധ്യ പരിശോധന നടത്തുക',
    },
  },
  ur: {
    auth: { phoneRequired: 'فون نمبر درکار ہے' },
    aiConsent: {
      dialogTitle: 'AI پروسیسنگ رضامندی',
      dialogBody:
        'Umbrella آپ کے سوال اور معاملے کا سیاق و سباق قانونی تجزیہ، مسودہ سازی اور تحقیق کے لیے تیسرے فریق AI فراہم کنندگان کو بھیجتا ہے۔ آپ کا ڈیٹا AI ماڈلز کی تربیت کے لیے استعمال نہیں ہوتا۔',
      dialogProviders: 'فراہم کنندگان: OpenAI، Anthropic، DeepSeek، اور Deepgram (ٹرانسکرپشن)۔',
      dialogPurpose:
        'آپ رازداری اور سیکیورٹی کی ترتیبات میں کسی بھی وقت رضامندی واپس لے سکتے ہیں۔ رضامندی کے بغیر AI خصوصیات دستیاب نہیں ہوں گی۔',
      dialogLearnMore: 'مزید جانیں ہماری',
      dialogDecline: 'ابھی نہیں',
      dialogAgree: 'میں متفق ہوں',
      settingsTitle: 'AI inference رضامندی',
      settingsDescription:
        'رضامندی دوبارہ سیٹ ہو گئی۔ اگلی AI خصوصیت سے پہلے دوبارہ پوچھا جائے گا۔',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle: 'اپنی ضرورت بیان کریں، سرکاری فارم ملائیں، اور AI سے مسودے بنائیں۔',
      stepDescribe: 'بیان',
      stepUnderstand: 'سمجھیں',
      stepMatch: 'میل',
      stepDraft: 'مسودہ',
      findAndDraft: 'تلاش اور مسودہ',
      browseFormats: 'فارمیٹس دیکھیں',
      whatToDraft: 'آپ کیا مسودہ تیار کرنا چاہتے ہیں؟',
      contextDetected: 'سیاق و سباق کی نشاندہی',
      whatWeUnderstood: 'ہم نے کیا سمجھا',
      refineContext: 'تفصیل بہتر بنائیں',
      refineHint: 'دستاویز کے میل بہتر کرنے کے لیے تفصیلات شامل کریں۔',
      updateAnalysis: 'تجزیہ اپ ڈیٹ کریں',
      findMatchingForms: 'مماثل فارم تلاش کریں',
      resultsFor: 'نتائج',
      recommendedFilingSet: 'تجویز کردہ فائلنگ سیٹ',
      draftSelected:
        '{count, plural, one {# منتخب دستاویز کا مسودہ} other {# منتخب دستاویزات کا مسودہ}}',
      draftNow: 'ابھی مسودہ',
      otherMatches: 'دیگر میل',
      officialForms: 'سرکاری قانونی فارم',
      searchFormats: 'فارمیٹس تلاش کریں…',
      generationFailed: 'مسودہ نہیں بنایا جا سکا۔ دوبارہ کوشش کریں۔',
      copied: 'مسودہ کلپ بورڈ پر کاپی ہو گیا',
      generateDraft: 'مسودہ بنائیں',
      proceduralNote: 'عملی نوٹ',
      caseDetails: 'کیس کی تفصیل',
      autoFill: 'خالی جگہیں خود بھریں',
      copyDraft: 'مسودہ کاپی کریں',
      redo: 'دوبارہ بنائیں',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'آپ کے AI کریڈٹ ختم ہو گئے۔ umbrella.okaylegal.ai پر ٹاپ اپ یا پلان اپ گریڈ کریں — موبائل پر in-app خریداری دستیاب نہیں۔',
    },
    settings: {
      deleteAccount: 'اکاؤنٹ حذف کریں',
      deleteAccountSettingsHint: 'اپنا اکاؤنٹ اور ذاتی ڈیٹا مستقل طور پر حذف کریں',
      deleteAccountDescription:
        'اپنا Umbrella اکاؤنٹ اور متعلقہ ذاتی ڈیٹا مستقل طور پر حذف کریں۔ یہ عمل واپس نہیں لیا جا سکتا۔',
      deleteAccountConfirmTitle: 'کیا آپ اپنا اکاؤنٹ مستقل طور پر حذف کرنا چاہتے ہیں؟',
      deleteAccountConfirmBody:
        'آپ کا ذاتی ڈیٹا 30 دنوں کے اندر حذف یا گمنام کیا جائے گا، قانونی برقراری کی ضروریات کے تابع۔',
      deleteAccountConfirmAction: 'اکاؤنٹ حذف کریں',
      deleteAccountEmailMismatch: 'ای میل آپ کے اکاؤنٹ سے میل نہیں کھاتی۔',
      deleteAccountError:
        'اکاؤنٹ حذف نہیں ہو سکا۔ دوبارہ کوشش کریں یا support@odaflow.com پر لکھیں۔',
      deleteAccountSuccess: 'آپ کا اکاؤنٹ حذف ہو گیا۔ آپ سائن آؤٹ ہو گئے ہیں۔',
      deleteAccountFormHeading: 'ابھی اکاؤنٹ حذف کریں',
      deleteAccountFormDescription:
        'سائن ان صارفین نیچے اپنا اکاؤنٹ مستقل طور پر حذف کر سکتے ہیں۔ یہ عمل واپس نہیں لیا جا سکتا۔',
      deleteAccountEmailLabel: 'اپنا ای میل تصدیق کریں',
      deleteAccountEmailRequired: 'ای میل درکار ہے',
      deleteAccountSubmitting: 'حذف ہو رہا ہے…',
      deleteAccountSubmit: 'میرا اکاؤنٹ حذف کریں',
      privacyRightToErasure: 'مٹانے کا حق',
      privacyRightToErasureBody: 'اپنے اکاؤنٹ اور ذاتی ڈیٹا کی مستقل حذف شدگی کی درخواست کریں۔',
    },
    matters: {
      clientRequiredError: 'براہ کرم کلائنٹ منتخب یا بنائیں',
      addPartyForConflictCheck: 'تنازعات کی جانچ کے لیے کم از کم ایک فریق شامل کریں',
      intakeStepType: 'قسم',
      intakeStepBasics: 'بنیادی',
      intakeStepSpecifics: 'مخصوص',
      intakeStepBackground: 'پس منظر',
      intakeStepReview: 'جائزہ',
      noAdditionalFieldsForType: 'اس معاملے کی قسم کے لیے کوئی اضافی فیلڈ نہیں',
      conflictCheckTitle: 'تنازعات کی جانچ',
      conflictCheckDescription:
        'کیس کھولنے سے پہلے موجودہ کلائنٹس اور معاملات کے خلاف فریقوں کی جانچ کریں۔',
      conflictCheckPartyHint: 'تنازعات کی جانچ فعال کرنے کے لیے بنیادی مرحلے میں فریق شامل کریں۔',
      checkingConflict: 'تنازعات کی جانچ ہو رہی ہے…',
      runConflictCheck: 'تنازعات کی جانچ چلائیں',
    },
  },
  pa: {
    auth: { phoneRequired: 'ਫ਼ੋਨ ਨੰਬਰ ਲੋੜੀਂਦਾ ਹੈ' },
    aiConsent: {
      dialogTitle: 'AI ਪ੍ਰੋਸੈਸਿੰਗ ਸਹਿਮਤੀ',
      dialogBody:
        'Umbrella ਤੁਹਾਡਾ ਸਵਾਲ ਅਤੇ ਮਾਮਲੇ ਦਾ ਸੰਦਰਭ ਕਾਨੂੰਨੀ ਵਿਸ਼ਲੇਸ਼ਣ, ਡਰਾਫਟਿੰਗ ਅਤੇ ਖੋਜ ਲਈ ਤੀਜੀ-ਧਿਰ AI providers ਨੂੰ ਭੇਜਦਾ ਹੈ। ਤੁਹਾਡਾ ਡੇਟਾ AI ਮਾਡਲਾਂ ਦੀ ਸਿਖਲਾਈ ਲਈ ਵਰਤਿਆ ਨਹੀਂ ਜਾਂਦਾ।',
      dialogProviders: 'Providers: OpenAI, Anthropic, DeepSeek, ਅਤੇ Deepgram (transcription).',
      dialogPurpose:
        'ਤੁਸੀਂ ਗੋਪਨੀਯਤਾ ਅਤੇ ਸੁਰੱਖਿਆ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਕਿਸੇ ਵੀ ਸਮੇਂ ਸਹਿਮਤੀ ਵਾਪਸ ਲੈ ਸਕਦੇ ਹੋ। ਸਹਿਮਤੀ ਤੋਂ ਬਿਨਾਂ AI ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ ਉਪਲਬਧ ਨਹੀਂ ਹੋਣਗੀਆਂ।',
      dialogLearnMore: 'ਹੋਰ ਜਾਣੋ ਸਾਡੀ',
      dialogDecline: 'ਹੁਣੇ ਨਹੀਂ',
      dialogAgree: 'ਮੈਂ ਸਹਿਮਤ ਹਾਂ',
      settingsTitle: 'AI inference ਸਹਿਮਤੀ',
      settingsDescription:
        'ਸਹਿਮਤੀ ਰੀਸੈੱਟ ਹੋ ਗਈ। ਅਗਲੀ AI ਵਿਸ਼ੇਸ਼ਤਾ ਤੋਂ ਪਹਿਲਾਂ ਦੁਬਾਰਾ ਪੁੱਛਿਆ ਜਾਵੇਗਾ।',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle: 'ਆਪਣੀ ਲੋੜ ਦੱਸੋ, ਅਧਿਕਾਰਤ ਫਾਰਮ ਮਿਲਾਓ, ਅਤੇ AI ਨਾਲ ਡਰਾਫਟ ਬਣਾਓ।',
      stepDescribe: 'ਵਰਣਨ',
      stepUnderstand: 'ਸਮਝੋ',
      stepMatch: 'ਮਿਲਾਓ',
      stepDraft: 'ਡਰਾਫਟ',
      findAndDraft: 'ਖੋਜੋ ਅਤੇ ਡਰਾਫਟ',
      browseFormats: 'ਫਾਰਮੈਟ ਬ੍ਰਾਊਜ਼ ਕਰੋ',
      whatToDraft: 'ਤੁਸੀਂ ਕੀ ਡਰਾਫਟ ਬਣਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ?',
      contextDetected: 'ਸੰਦਰਭ ਪਛਾਣਿਆ',
      whatWeUnderstood: 'ਅਸੀਂ ਕੀ ਸਮਝਿਆ',
      refineContext: 'ਵਰਣਨ ਸੁਧਾਰੋ',
      refineHint: 'ਦਸਤਾਵੇਜ਼ ਮੇਲ ਸੁਧਾਰਨ ਲਈ ਵੇਰਵੇ ਜੋੜੋ।',
      updateAnalysis: 'ਵਿਸ਼ਲੇਸ਼ਣ ਅਪਡੇਟ ਕਰੋ',
      findMatchingForms: 'ਮਿਲਦੇ ਫਾਰਮ ਖੋਜੋ',
      resultsFor: 'ਨਤੀਜੇ',
      recommendedFilingSet: 'ਸਿਫਾਰਸ਼ੀ ਫਾਈਲਿੰਗ ਸੈੱਟ',
      draftSelected:
        '{count, plural, one {# ਚੁਣੇ ਦਸਤਾਵੇਜ਼ ਦਾ ਡਰਾਫਟ} other {# ਚੁਣੇ ਦਸਤਾਵੇਜ਼ਾਂ ਦਾ ਡਰਾਫਟ}}',
      draftNow: 'ਹੁਣੇ ਡਰਾਫਟ',
      otherMatches: 'ਹੋਰ ਮੇਲ',
      officialForms: 'ਅਧਿਕਾਰਤ ਕਾਨੂੰਨੀ ਫਾਰਮ',
      searchFormats: 'ਫਾਰਮੈਟ ਖੋਜੋ…',
      generationFailed: 'ਡਰਾਫਟ ਨਹੀਂ ਬਣਾਇਆ ਜਾ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      copied: 'ਡਰਾਫਟ ਕਲਿਪਬੋਰਡ \'ਤੇ ਕਾਪੀ ਹੋਇਆ',
      generateDraft: 'ਡਰਾਫਟ ਬਣਾਓ',
      proceduralNote: 'ਪ੍ਰਕਿਰਿਆ ਸੰਬੰਧੀ ਨੋਟ',
      caseDetails: 'ਕੇਸ ਵੇਰਵੇ',
      autoFill: 'ਖਾਲੀ ਥਾਵਾਂ ਆਟੋ ਭਰੋ',
      copyDraft: 'ਡਰਾਫਟ ਕਾਪੀ ਕਰੋ',
      redo: 'ਦੁਬਾਰਾ ਬਣਾਓ',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'ਤੁਹਾਡੇ AI ਕ੍ਰੈਡਿਟ ਖਤਮ ਹੋ ਗਏ। umbrella.okaylegal.ai \'ਤੇ ਟਾਪ-ਅੱਪ ਜਾਂ ਪਲਾਨ ਅਪਗ੍ਰੇਡ ਕਰੋ — ਮੋਬਾਇਲ \'ਤੇ in-app ਖਰੀਦੀ ਉਪਲਬਧ ਨਹੀਂ।',
    },
    settings: {
      deleteAccount: 'ਖਾਤਾ ਮਿਟਾਓ',
      deleteAccountSettingsHint: 'ਆਪਣਾ ਖਾਤਾ ਅਤੇ ਨਿੱਜੀ ਡੇਟਾ ਸਥਾਈ ਤੌਰ \'ਤੇ ਮਿਟਾਓ',
      deleteAccountDescription:
        'ਆਪਣਾ Umbrella ਖਾਤਾ ਅਤੇ ਸੰਬੰਧਿਤ ਨਿੱਜੀ ਡੇਟਾ ਸਥਾਈ ਤੌਰ \'ਤੇ ਮਿਟਾਓ। ਇਹ ਕਾਰਵਾਈ ਵਾਪਸ ਨਹੀਂ ਲਈ ਜਾ ਸਕਦੀ।',
      deleteAccountConfirmTitle: 'ਕੀ ਤੁਸੀਂ ਆਪਣਾ ਖਾਤਾ ਸਥਾਈ ਤੌਰ \'ਤੇ ਮਿਟਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ?',
      deleteAccountConfirmBody:
        'ਤੁਹਾਡਾ ਨਿੱਜੀ ਡੇਟਾ 30 ਦਿਨਾਂ ਵਿੱਚ ਮਿਟਾਇਆ ਜਾਂ ਗੁਮਨਾਮ ਕੀਤਾ ਜਾਵੇਗਾ, ਕਾਨੂੰਨੀ ਰੱਖ-ਰਖਾਅ ਲੋੜਾਂ ਦੇ ਅਧੀਨ।',
      deleteAccountConfirmAction: 'ਖਾਤਾ ਮਿਟਾਓ',
      deleteAccountEmailMismatch: 'ਈਮੇਲ ਤੁਹਾਡੇ ਖਾਤੇ ਨਾਲ ਮੇਲ ਨਹੀਂ ਖਾਂਦੀ।',
      deleteAccountError:
        'ਖਾਤਾ ਮਿਟਾਇਆ ਨਹੀਂ ਜਾ ਸਕਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ support@odaflow.com \'ਤੇ ਲਿਖੋ।',
      deleteAccountSuccess: 'ਤੁਹਾਡਾ ਖਾਤਾ ਮਿਟਾ ਦਿਤੁਤਾ ਗਿਆ। ਤੁਸੀਂ ਸਾਈਨ ਆਊਟ ਹੋ ਗਏ ਹੋ।',
      deleteAccountFormHeading: 'ਹੁਣੇ ਖਾਤਾ ਮਿਟਾਓ',
      deleteAccountFormDescription:
        'ਸਾਈਨ-ਇਨ ਉਪਭੋਗਤਾ ਹੇਠਾਂ ਆਪਣਾ ਖਾਤਾ ਸਥਾਈ ਤੌਰ \'ਤੇ ਮਿਟਾ ਸਕਦੇ ਹਨ। ਇਹ ਕਾਰਵਾਈ ਵਾਪਸ ਨਹੀਂ ਲਈ ਜਾ ਸਕਦੀ।',
      deleteAccountEmailLabel: 'ਆਪਣੀ ਈਮੇਲ ਪੁਸ਼ਟੀ ਕਰੋ',
      deleteAccountEmailRequired: 'ਈਮੇਲ ਲੋੜੀਂਦੀ ਹੈ',
      deleteAccountSubmitting: 'ਮਿਟਾਇਆ ਜਾ ਰਿਹਾ ਹੈ…',
      deleteAccountSubmit: 'ਮੇਰਾ ਖਾਤਾ ਮਿਟਾਓ',
      privacyRightToErasure: 'ਮਿਟਾਉਣ ਦਾ ਅਧਿਕਾਰ',
      privacyRightToErasureBody: 'ਆਪਣੇ ਖਾਤੇ ਅਤੇ ਨਿੱਜੀ ਡੇਟਾ ਦੀ ਸਥਾਈ ਮਿਟਾਉਣ ਦੀ ਬੇਨਤੀ ਕਰੋ।',
    },
    matters: {
      clientRequiredError: 'ਕਿਰਪਾ ਕਰਕੇ ਕਲਾਇੰਟ ਚੁਣੋ ਜਾਂ ਬਣਾਓ',
      addPartyForConflictCheck: 'ਵਿਵਾਦ ਜਾਂਚ ਲਈ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਧਿਰ ਜੋੜੋ',
      intakeStepType: 'ਕਿਸਮ',
      intakeStepBasics: 'ਮੂਲ',
      intakeStepSpecifics: 'ਵਿਸ਼ੇਸ਼',
      intakeStepBackground: 'ਪਿਛੋਕੜ',
      intakeStepReview: 'ਸਮੀਖਿਆ',
      noAdditionalFieldsForType: 'ਇਸ ਮਾਮਲੇ ਦੀ ਕਿਸਮ ਲਈ ਕੋਈ ਵਾਧੂ ਫੀਲਡ ਨਹੀਂ',
      conflictCheckTitle: 'ਵਿਵਾਦ ਜਾਂਚ',
      conflictCheckDescription:
        'ਕੇਸ ਖੋਲ੍ਹਣ ਤੋਂ ਪਹਿਲਾਂ ਮੌਜੂਦਾ ਕਲਾਇੰਟਾਂ ਅਤੇ ਮਾਮਲਿਆਂ ਦੇ ਵਿਰੁੱਧ ਧਿਰਾਂ ਦੀ ਜਾਂਚ ਕਰੋ।',
      conflictCheckPartyHint: 'ਵਿਵਾਦ ਜਾਂਚ ਸਮਰੱਥ ਕਰਨ ਲਈ ਮੂਲ ਕਦਮ ਵਿੱਚ ਧਿਰਾਂ ਜੋੜੋ।',
      checkingConflict: 'ਵਿਵਾਦਾਂ ਦੀ ਜਾਂਚ ਹੋ ਰਹੀ ਹੈ…',
      runConflictCheck: 'ਵਿਵਾਦ ਜਾਂਚ ਚਲਾਓ',
    },
  },
  or: {
    auth: { phoneRequired: 'ଫୋନ୍ ନମ୍ବର ଆବଶ୍ୟକ' },
    aiConsent: {
      dialogTitle: 'AI ପ୍ରକ୍ରିୟାକରଣ ସମ୍ମତି',
      dialogBody:
        'Umbrella ଆପଣଙ୍କ ପ୍ରଶ୍ନ ଏବଂ ମାମଲାର ପ୍ରସଙ୍ଗକୁ ଆଇନି ବିଶ୍ଳେଷଣ, ଡ୍ରାଫ୍ଟିଂ ଏବଂ ଅନୁସନ୍ଧାନ ପାଇଁ ତୃତୀୟ-ପକ୍ଷ AI providersଙ୍କୁ ପଠାଏ। ଆପଣଙ୍କ ଡାଟା AI ମଡେଲ ପ୍ରଶିକ୍ଷଣ ପାଇଁ ବ୍ୟବହୃତ ହୁଏ ନାହିଁ।',
      dialogProviders: 'Providers: OpenAI, Anthropic, DeepSeek, ଏବଂ Deepgram (transcription).',
      dialogPurpose:
        'ଗୋପନୀୟତା ଏବଂ ସୁରକ୍ଷା ସେଟିଂସରେ ଯେକୌଣସି ସମୟରେ ସମ୍ମତି ପ୍ରତ୍ୟାହାର କରିପାରିବେ। ସମ୍ମତି ବିନା AI ବିଶେଷତା ଉପଲବ୍ଧ ହେବ ନାହିଁ।',
      dialogLearnMore: 'ଅଧିକ ଜାଣନ୍ତୁ ଆମର',
      dialogDecline: 'ଏବେ ନୁହେଁ',
      dialogAgree: 'ମୁଁ ସହମତ',
      settingsTitle: 'AI inference ସମ୍ମତି',
      settingsDescription:
        'ସମ୍ମତି ପୁନଃସେଟ୍ ହୋଇଛି। ପରବର୍ତ୍ତୀ AI ବିଶେଷତା ପୂର୍ବରୁ ପୁନଃ ପଚରାଯିବ।',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'ଆପଣଙ୍କ ଆବଶ୍ୟକତା କହନ୍ତୁ, ଅଧିକୃତ ଫର୍ମ ମିଳାନ୍ତୁ, ଏବଂ AI ଦ୍ୱାରା ଡ୍ରାଫ୍ଟ ତିଆରି କରନ୍ତୁ।',
      stepDescribe: 'ବର୍ଣ୍ଣନା',
      stepUnderstand: 'ବୁଜ୍ଞନ୍ତୁ',
      stepMatch: 'ମିଳାନ',
      stepDraft: 'ଡ୍ରାଫ୍ଟ',
      findAndDraft: 'ଖୋଜନ୍ତୁ ଏବଂ ଡ୍ରାଫ୍ଟ',
      browseFormats: 'ଫର୍ମାଟ୍ ବ୍ରାଉଜ୍',
      whatToDraft: 'ଆପଣ କ\'ଣ ଡ୍ରାଫ୍ଟ ତିଆରି କରିବାକୁ ଚାହୁଁଛନ୍ତି?',
      contextDetected: 'ପ୍ରସଙ୍ଗ ଚିହ୍ନଟ',
      whatWeUnderstood: 'ଆମେ ଯାହା ବୁଜ୍ଛୁ',
      refineContext: 'ବର୍ଣ୍ଣନା ସୁଧାରନ୍ତୁ',
      refineHint: 'ଦଲିଲ ମିଳାଣୀ ଉନ୍ନତ କରିବାକୁ ବିବରଣୀ ଯୋଡ଼ନ୍ତୁ।',
      updateAnalysis: 'ବିଶ୍ଳେଷଣ ଅପଡେଟ୍',
      findMatchingForms: 'ମିଳୁଥିବା ଫର୍ମ ଖୋଜନ୍ତୁ',
      resultsFor: 'ଫଳାଫଳ',
      recommendedFilingSet: 'ସୁପାରିଶ ଫାଇଲିଂ ସେଟ୍',
      draftSelected:
        '{count, plural, one {# ଚୟନିତ ଦଲିଲର ଡ୍ରାଫ୍ଟ} other {# ଚୟନିତ ଦଲିଲର ଡ୍ରାଫ୍ଟ}}',
      draftNow: 'ଏବେ ଡ୍ରାଫ୍ଟ',
      otherMatches: 'ଅନ୍ୟ ମିଳାଣ',
      officialForms: 'ଅଧିକୃତ ଆଇନି ଫର୍ମ',
      searchFormats: 'ଫର୍ମାଟ୍ ଖୋଜନ୍ତୁ…',
      generationFailed: 'ଡ୍ରାଫ୍ଟ ତିଆରି ହୋଇପାରିଲା ନାହିଁ। ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ।',
      copied: 'ଡ୍ରାଫ୍ଟ କ୍ଲିପବୋର୍ଡରେ କପି',
      generateDraft: 'ଡ୍ରାଫ୍ଟ ତିଆରି',
      proceduralNote: 'ପ୍ରକ୍ରିୟାଗତ ଟିପ୍ପଣୀ',
      caseDetails: 'ମାମଲା ବିବରଣୀ',
      autoFill: 'ଖାଲୀ ସ୍ଥାନ ସ୍ରଯଂ ପୂରଣ',
      copyDraft: 'ଡ୍ରାଫ୍ଟ କପି',
      redo: 'ପୁନଃ ତିଆରି',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'ଆପଣଙ୍କ AI କ୍ରେଡିଟ ଶେଷ। umbrella.okaylegal.ai ରେ ଟପ-ଅପ୍ କିମ୍ବା ପ୍ଲାନ ଅପଗ୍ରେଡ୍ — ମୋବାଇଲରେ in-app କିଣାକଟ ଉପଲବ୍ଧ ନୁହେଁ।',
    },
    settings: {
      deleteAccount: 'ଖାତା ଡିଲିଟ୍',
      deleteAccountSettingsHint: 'ଆପଣଙ୍କ ଖାତା ଏବଂ ବ୍ୟକ୍ତିଗତ ଡାଟା ସ୍ଥାୟୀ ଭାବେ ଡିଲିଟ୍',
      deleteAccountDescription:
        'ଆପଣଙ୍କ Umbrella ଖାତା ଏବଂ ସମ୍ବନ୍ଧିତ ବ୍ୟକ୍ତିଗତ ଡାଟା ସ୍ଥାୟୀ ଭାବେ ଡିଲିଟ୍। ଏହି କାର୍ଯ୍ୟ ପୂର୍ବବତ୍ ହୋଇପାରିବ ନାହିଁ।',
      deleteAccountConfirmTitle: 'ଆପଣଙ୍କ ଖାତା ସ୍ଥାୟୀ ଭାବେ ଡିଲିଟ୍?',
      deleteAccountConfirmBody:
        'ଆପଣଙ୍କ ବ୍ୟକ୍ତିଗତ ଡାଟା 30 ଦିନ ମଧ୍ୟରେ ଡିଲିଟ୍ କିମ୍ବା ଅଜ୍ଞାତ କରାଯିବ, ଆଇନି ସଂରକ୍ଷଣ ନିୟମ ଅନୁଯାୟୀ।',
      deleteAccountConfirmAction: 'ଖାତା ଡିଲିଟ୍',
      deleteAccountEmailMismatch: 'ଇମେଲ୍ ଆପଣଙ୍କ ଖାତା ସହିତ ମେଳ ଖାଏ ନାହିଁ।',
      deleteAccountError:
        'ଖାତା ଡିଲିଟ୍ ହୋଇପାରିଲା ନାହିଁ। ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ କିମ୍ବା support@odaflow.com।',
      deleteAccountSuccess: 'ଆପଣଙ୍କ ଖାତା ଡିଲିଟ୍ ହୋଇଛି। ଆପଣ ସାଇନ୍ ଆଉଟ୍ ହୋଇଛନ୍ତି।',
      deleteAccountFormHeading: 'ଏବେ ଖାତା ଡିଲିଟ୍',
      deleteAccountFormDescription:
        'ସାଇନ୍-ଇନ୍ ହୋଇଥିବା ଉପଭୋକ୍ତା ନିମ୍ନରେ ସ୍ଥାୟୀ ଭାବେ ଖାତା ଡିଲିଟ୍ କରିପାରିବେ। ଏହି କାର୍ଯ୍ୟ ପୂର୍ବବତ୍ ହୋଇପାରିବ ନାହିଁ।',
      deleteAccountEmailLabel: 'ଇମେଲ୍ ନିଶ୍ଚିତ',
      deleteAccountEmailRequired: 'ଇମେଲ୍ ଆବଶ୍ୟକ',
      deleteAccountSubmitting: 'ଡିଲିଟ୍…',
      deleteAccountSubmit: 'ମୋ ଖାତା ଡିଲିଟ୍',
      privacyRightToErasure: 'ମିଟାଇବା ଅଧିକାର',
      privacyRightToErasureBody: 'ଖାତା ଏବଂ ବ୍ୟକ୍ତିଗତ ଡାଟା ସ୍ଥାୟୀ ଡିଲିଟ୍ ଅନୁରୋଧ।',
    },
    matters: {
      clientRequiredError: 'ଦୟାକରି ଗ୍ରାହକ ଚୟନ କରନ୍ତୁ କିମ୍ବା ସୃଷ୍ଟି କରନ୍ତୁ',
      addPartyForConflictCheck: 'ବିରୋଧ ଯାଞ୍ଚ ପାଇଁ ଅତିକମରେ ଗୋଟିଏ ପକ୍ଷ ଯୋଡ଼ନ୍ତୁ',
      intakeStepType: 'ପ୍ରକାର',
      intakeStepBasics: 'ମୂଳ',
      intakeStepSpecifics: 'ବିଶେଷ',
      intakeStepBackground: 'ପୃଷ୍ଠଭୂମି',
      intakeStepReview: 'ସମୀକ୍ଷା',
      noAdditionalFieldsForType: 'ଏହି ମାମଲା ପ୍ରକାର ପାଇଁ ଅତିରିକ୍ତ କ୍ଷେତ୍ର ନାହିଁ',
      conflictCheckTitle: 'ବିରୋଧ ଯାଞ୍ଚ',
      conflictCheckDescription: 'ମାମଲା ଖୋଲିବା ପୂର୍ବରୁ ବିଦ୍ୟମାନ ଗ୍ରାହକ ଏବଂ ମାମଲା ବିରୁଦ୍ଧରେ ପକ୍ଷଗୁଡ଼ିକୁ ଯାଞ୍ଚ କରନ୍ତୁ।',
      conflictCheckPartyHint: 'ବିରୋଧ ଯାଞ୍ଚ ସକ୍ଷମ କରିବାକୁ ମୂଳ ପଦକ୍ଷେପରେ ପକ୍ଷ ଯୋଡ଼ନ୍ତୁ।',
      checkingConflict: 'ବିରୋଧ ଯାଞ୍ଚ ହେଉଛି…',
      runConflictCheck: 'ବିରୋଧ ଯାଞ୍ଚ ଚଲାନ୍ତୁ',
    },
  },
  as: {
    auth: { phoneRequired: 'ফোন নম্বৰ প্ৰয়োজন' },
    aiConsent: {
      dialogTitle: 'AI প্ৰক্ৰিয়াকৰণ সন্মতি',
      dialogBody:
        'Umbrella আপোনাৰ প্ৰশ্ন আৰু মামলাৰ প্ৰসংগ তৃতীয়-পক্ষ AI providersলৈ আইনী বিশ্লেষণ, খচৰা আৰু গৱেষণাৰ বাবে পঠায়। আপোনাৰ ডেটা AI মডেল প্ৰশিক্ষণৰ ব্যবহাৰ নহৰ।',
      dialogProviders: 'Providers: OpenAI, Anthropic, DeepSeek, Deepgram (transcription).',
      dialogPurpose:
        'গোপনীয়তা আৰু সুৰক্ষা ছেটিংছত যিকোনো সময়ত সন্মতি প্ৰত্যাহাৰ কৰিব পাৰে। সন্মতি নোহোৱাকৈ AI বৈশিষ্ট্য উপলব্ধ নহ\'ব।',
      dialogLearnMore: 'অধিক জানক আমাৰ',
      dialogDecline: 'এতিয়া নহয়',
      dialogAgree: 'মই সন্মত',
      settingsTitle: 'AI inference সন্মতি',
      settingsDescription:
        'সন্মতি ৰিছেট। পৰৱৰ্তী AI বৈশিষ্ট্যৰ আগতে পুনৰ সোধা হ\'ব।',
    },
    docuDraft: {
      title: 'Docu Draft',
      subtitle:
        'আপোনাৰ প্ৰয়োজনীয়তা কওক, সঠিক ফৰ্ম বাছনি কৰক, আৰু AI ৰে খচৰা তৈয়াৰ কৰক।',
      stepDescribe: 'বৰ্ণনা',
      stepUnderstand: 'বুজক',
      stepMatch: 'মিল',
      stepDraft: 'খচৰা',
      findAndDraft: 'সন্ধান আৰু খচৰা',
      browseFormats: 'ফৰ্মেট ব্ৰাউজ',
      whatToDraft: 'আপুনি কি খচৰা তৈয়াৰ কৰিব বিচাৰে?',
      contextDetected: 'প্ৰসংগ চিনাক্ত',
      whatWeUnderstood: 'আমি যি বুজিলো',
      refineContext: 'বৰ্ণনা উন্নত',
      refineHint: 'নথি মিল উন্নত কৰিবলৈ বিৱৰণ যোগ কৰক।',
      updateAnalysis: 'বিশ্লেষণ আপডেট',
      findMatchingForms: 'মিলা ফৰ্ম বিচাৰক',
      resultsFor: 'ফলাফল',
      recommendedFilingSet: 'পৰামৰ্শ ফাইলিং ছেট',
      draftSelected:
        '{count, plural, one {# নিৰ্বাচিত নথিৰ খচৰা} other {# নিৰ্বাচিত নথিৰ খচৰা}}',
      draftNow: 'এতিয়াই খচৰা',
      otherMatches: 'অন্য মিল',
      officialForms: 'অধিকাৰিক আইনী ফৰ্ম',
      searchFormats: 'ফৰ্মেট বিচাৰক…',
      generationFailed: 'খচৰা তৈয়াৰ কৰিব পৰা নগ\'ল। পুনৰ চেষ্টা কৰক।',
      copied: 'খচৰা ক্লিপব\'ৰ্ডত কপি',
      generateDraft: 'খচৰা তৈয়াৰ',
      proceduralNote: 'প্ৰক্ৰিয়াগত নোট',
      caseDetails: 'মামলাৰ বিৱৰণ',
      autoFill: 'খালী স্থান স্বয়ং পূৰণ',
      copyDraft: 'খচৰা কপি',
      redo: 'পুনৰ তৈয়াৰ',
    },
    mobile: {
      creditsExhaustedWebOnly:
        'আপোনাৰ AI ক্ৰেডিট শেষ। umbrella.okaylegal.ai ত টপ-আপ বা প্লান আপগ্ৰেড — মোবাইলত in-app ক্ৰয় উপলব্ধ নহয়।',
    },
    settings: {
      deleteAccount: 'একাউণ্ট মচক',
      deleteAccountSettingsHint: 'আপোনাৰ একাউণ্ট আৰু ব্যক্তিগত ডেটা স্থায়ীভাৱে মচক',
      deleteAccountDescription:
        'আপোনাৰ Umbrella একাউণ্ট আৰু সম্পৰ্কিত ব্যক্তিগত ডেটা স্থায়ীভাৱে মচক। এই কাৰ্য্য পূৰ্ববত কৰিব নোৱাৰি।',
      deleteAccountConfirmTitle: 'আপোনাৰ একাউণ্ট স্থায়ীভাৱে মচিবনে?',
      deleteAccountConfirmBody:
        'ব্যক্তিগত ডেটা 30 দিনত মচা বা অজ্ঞাত কৰা হ\'ব, আইনী সংৰক্ষণৰ শর্ত সাপেক্ষে।',
      deleteAccountConfirmAction: 'একাউণ্ট মচক',
      deleteAccountEmailMismatch: 'ইমেইল একাউণ্টৰ সৈতে মিল নাই।',
      deleteAccountError:
        'একাউণ্ট মচিব পৰা নগ\'ল। পুনৰ চেষ্টা বা support@odaflow.com।',
      deleteAccountSuccess: 'আপোনাৰ একাউণ্ট মচা হ\'ল। আপুনি ছাইন আউট হ\'ল।',
      deleteAccountFormHeading: 'এতিয়াই একাউণ্ট মচক',
      deleteAccountFormDescription:
        'ছাইন-ইন কৰা ব্যৱহাৰকাৰীয়ে তলত স্থায়ীভাৱে একাউণ্ট মচিব পাৰে। এই কাৰ্য্য পূৰ্ববত কৰিব নোৱাৰি।',
      deleteAccountEmailLabel: 'ইমেইল নিশ্চিত',
      deleteAccountEmailRequired: 'ইমেইল প্ৰয়োজন',
      deleteAccountSubmitting: 'মচা হৈছে…',
      deleteAccountSubmit: 'মোৰ একাউণ্ট মচক',
      privacyRightToErasure: 'মচি পেলোৱাৰ অধিকাৰ',
      privacyRightToErasureBody: 'একাউণ্ট আৰু ব্যক্তিগত ডেটা স্থায়ী মচাৰ অনুৰোধ।',
    },
    matters: {
      clientRequiredError: 'অনুগ্ৰহ কৰি ক্লায়েণ্ট বাছনি বা সৃষ্টি কৰক',
      addPartyForConflictCheck: 'সংঘাত পৰীক্ষাৰ বাবে কমেও এটা পক্ষ যোগ কৰক',
      intakeStepType: 'প্ৰকাৰ',
      intakeStepBasics: 'মূল',
      intakeStepSpecifics: 'বিশেষ',
      intakeStepBackground: 'পটভূমি',
      intakeStepReview: 'পৰ্যালোচনা',
      noAdditionalFieldsForType: 'এই মামলাৰ ধৰণৰ বাবে অতিরিক্ত ক্ষেত্ৰ নাই',
      conflictCheckTitle: 'সংঘাত পৰীক্ষা',
      conflictCheckDescription: 'মামলা খোলাৰ আগতে বিদ্যমান ক্লায়েণ্ট আৰু মামলাৰ বিৰুদ্ধে পক্ষসমূহ পৰীক্ষা কৰক।',
      conflictCheckPartyHint: 'সংঘাত পৰীক্ষা সক্ৰিয় কৰিবলৈ মূল পদক্ষেপত পক্ষ যোগ কৰক।',
      checkingConflict: 'সংঘাত পৰীক্ষা হৈ আছে…',
      runConflictCheck: 'সংঘাত পৰীক্ষা চলাওক',
    },
  },
})

function deepMerge(base, override) {
  if (!override) return base
  for (const [k, v] of Object.entries(override)) {
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      typeof base[k] === 'object' &&
      base[k] !== null
    ) {
      deepMerge(base[k], v)
    } else {
      base[k] = v
    }
  }
  return base
}

function mergeFile(locale, ns, patch) {
  const dir = path.join(OVERRIDES_DIR, locale)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${ns}.json`)
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  fs.writeFileSync(file, `${JSON.stringify(deepMerge(existing, patch), null, 2)}\n`)
}

let filesWritten = 0
for (const locale of TARGET_LOCALES) {
  const data = T[locale]
  if (!data) {
    console.warn(`[skip] no translations for ${locale}`)
    continue
  }
  for (const [ns, patch] of Object.entries(data)) {
    mergeFile(locale, ns, patch)
    filesWritten++
    console.log(`[translate] ${locale}/${ns}.json`)
  }
}

console.log(`Done. Wrote ${filesWritten} namespace files across ${TARGET_LOCALES.length} locales.`)
