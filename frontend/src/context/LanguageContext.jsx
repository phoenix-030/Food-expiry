import { createContext, useContext, useMemo, useState } from 'react';

const translations = {
  en: {
    dashboard: 'Dashboard',
    scanProduct: 'Scan Product',
    productInventory: 'Product Inventory',
    notifications: 'Notifications',
    analytics: 'Analytics',
    settings: 'Settings',
    history: 'Product History',
    logout: 'Logout',
    searchInventory: 'Search inventory...',
    manageProfile: 'Manage your profile information.',
    profileSettings: 'Profile Settings',
    fullName: 'Full name',
    emailAddress: 'Email address',
    profilePicture: 'Profile picture',
    choosePicture: 'Choose picture',
    changePicture: 'Change picture',
    removePicture: 'Remove picture',
    role: 'Role',
    saveProfile: 'Save profile',
    saving: 'Saving...',
    profileUpdated: 'Profile updated successfully.',
    language: 'Language',
    languageUpdated: 'Language updated.',
    english: 'English',
    hindi: 'Hindi',
    tamil: 'Tamil',
    close: 'Close',
    analyticsCopy: 'Inventory trends will appear here as your product history grows.',
    allCaughtUp: 'You are all caught up.'
  },
  hi: {
    dashboard: 'डैशबोर्ड',
    scanProduct: 'उत्पाद स्कैन करें',
    productInventory: 'उत्पाद सूची',
    notifications: 'सूचनाएं',
    analytics: 'विश्लेषण',
    settings: 'सेटिंग्स',
    history: 'उत्पाद इतिहास',
    logout: 'लॉग आउट',
    searchInventory: 'इन्वेंट्री खोजें...',
    manageProfile: 'अपनी प्रोफ़ाइल जानकारी प्रबंधित करें।',
    profileSettings: 'प्रोफ़ाइल सेटिंग्स',
    fullName: 'पूरा नाम',
    emailAddress: 'ईमेल पता',
    profilePicture: 'प्रोफ़ाइल तस्वीर',
    choosePicture: 'तस्वीर चुनें',
    changePicture: 'तस्वीर बदलें',
    removePicture: 'तस्वीर हटाएं',
    role: 'भूमिका',
    saveProfile: 'प्रोफ़ाइल सहेजें',
    saving: 'सहेजा जा रहा है...',
    profileUpdated: 'प्रोफ़ाइल सफलतापूर्वक अपडेट हुई।',
    language: 'भाषा',
    languageUpdated: 'भाषा अपडेट हुई।',
    english: 'अंग्रेज़ी',
    hindi: 'हिंदी',
    tamil: 'तमिल',
    close: 'बंद करें',
    analyticsCopy: 'आपके उत्पाद इतिहास के बढ़ने पर इन्वेंट्री के रुझान यहां दिखाई देंगे।',
    allCaughtUp: 'आप सभी सूचनाओं से अवगत हैं।'
  },
  ta: {
    dashboard: 'டாஷ்போர்டு',
    scanProduct: 'பொருளை ஸ்கேன் செய்க',
    productInventory: 'பொருள் இருப்பு',
    notifications: 'அறிவிப்புகள்',
    analytics: 'பகுப்பாய்வு',
    settings: 'அமைப்புகள்',
    history: 'பொருள் வரலாறு',
    logout: 'வெளியேறு',
    searchInventory: 'இருப்பைத் தேடுங்கள்...',
    manageProfile: 'உங்கள் சுயவிவரத் தகவலை நிர்வகிக்கவும்.',
    profileSettings: 'சுயவிவர அமைப்புகள்',
    fullName: 'முழுப் பெயர்',
    emailAddress: 'மின்னஞ்சல் முகவரி',
    profilePicture: 'சுயவிவரப் படம்',
    choosePicture: 'படத்தைத் தேர்ந்தெடுக்கவும்',
    changePicture: 'படத்தை மாற்றவும்',
    removePicture: 'படத்தை அகற்றவும்',
    role: 'பங்கு',
    saveProfile: 'சுயவிவரத்தைச் சேமிக்கவும்',
    saving: 'சேமிக்கிறது...',
    profileUpdated: 'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது.',
    language: 'மொழி',
    languageUpdated: 'மொழி புதுப்பிக்கப்பட்டது.',
    english: 'ஆங்கிலம்',
    hindi: 'இந்தி',
    tamil: 'தமிழ்',
    close: 'மூடுக',
    analyticsCopy: 'உங்கள் பொருள் வரலாறு வளரும்போது இருப்புப் போக்குகள் இங்கே தோன்றும்.',
    allCaughtUp: 'அனைத்து அறிவிப்புகளும் பார்த்துவிட்டீர்கள்.'
  }
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => localStorage.getItem('freshtrack_language') || 'en');

  const setLanguage = (nextLanguage) => {
    setLanguageState(nextLanguage);
    localStorage.setItem('freshtrack_language', nextLanguage);
  };

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key) => translations[language]?.[key] || translations.en[key] || key
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};
