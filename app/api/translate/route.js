import { NextResponse } from 'next/server';

const SLANG_DICTIONARY = {
  bn: {
    "developer": "কোদাল চালানো ডেভেলপার",
    "coder": "কোডার ভাই",
    "ceo": "চাপাবাজ সিইও",
    "founder": "ফাউন্ডার সাব",
    "crypto": "ক্রিপ্টো ফকিন্নি",
    "bro": "ভাইয়া",
    "sigma": "সিগমা বাবু",
    "code": "বাগভর্তি কোড",
    "linkedin": "লিঙ্কডইন পন্ডিত",
    "resume": "ফেইক বায়োডাটা",
    "ai": "অটোমেটেড আজাইরাগিরি",
    "roast": "কড়া পচানি",
    "touch grass": "একটু রোদে গিয়া খাড়ান",
    "senior": "সিনিয়র ওরফে গুগল কপি-পেস্টার"
  },
  hi: {
    "developer": "कॉपी-पेस्ट डेवलपर",
    "coder": "कोडर भाई",
    "ceo": "फेकू सीईओ",
    "founder": "फाउंडर साब",
    "crypto": "क्रिप्टो भिखारी",
    "bro": "भाई",
    "sigma": "सिग्मा लौंडा",
    "code": "बग्स का गुच्छा",
    "linkedin": "लिंक्डइन ज्ञानचंद",
    "resume": "झूठा रेज़्यूमे",
    "ai": "फालतू एआई",
    "roast": "कड़क भुनाई",
    "touch grass": "जाकर बाहर धूप लो",
    "senior": "सीनियर उर्फ स्टैकओवरफ्लो रट्टू"
  }
};

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, target_lang } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const lang = target_lang === 'bn' || target_lang === 'hi' ? target_lang : 'bn';
    const dict = SLANG_DICTIONARY[lang];

    let translated = text;
    // Replace matching slang words for funny localized roast feel
    Object.entries(dict).forEach(([enWord, localizedWord]) => {
      const regex = new RegExp(`\\b${enWord}\\b`, 'gi');
      translated = translated.replace(regex, `[${localizedWord}]`);
    });

    if (translated === text) {
      if (lang === 'bn') {
        translated = `(পচানি অনুবাদ) ${text} ...একদম চরম বাঁশ!`;
      } else {
        translated = `(देसी रोस्ट अनुवाद) ${text} ...एकदम भयंकर बेइज़्ज़ती!`;
      }
    }

    return NextResponse.json({
      success: true,
      original: text,
      lang,
      translated_text: translated
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Translation error' }, { status: 500 });
  }
}
