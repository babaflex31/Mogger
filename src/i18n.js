import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "matchmaking_active": "MATCHMAKING ACTIVE",
      "searching_opponent": "Searching for worthy opponent...",
      "queue_time": "QUEUE TIME",
      "elo_range": "ELO RANGE",
      "cancel_queue": "CANCEL QUEUE",
      "settings": "Settings",
      "language": "Language",
      "english": "English",
      "turkish": "Türkçe",
      "technical_dashboard": "Technical Dashboard",
      "combat": "Combat",
      "final_score": "Final Score"
    }
  },
  tr: {
    translation: {
      "matchmaking_active": "MAÇ OLUSTURMA AKTİF",
      "searching_opponent": "Uygun rakip aranıyor...",
      "queue_time": "SIRA SÜRESİ",
      "elo_range": "ELO ARALIĞI",
      "cancel_queue": "SIRAYI İPTAL ET",
      "settings": "Ayarlar",
      "language": "Dil",
      "english": "İngilizce",
      "turkish": "Türkçe",
      "technical_dashboard": "Teknik Panel",
      "combat": "Savaş",
      "final_score": "Son Skor"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'tr',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

export default i18n;
