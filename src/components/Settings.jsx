import React, { useContext, useEffect } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import { Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Settings({ isOpen, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);
  const { language, setLanguage } = useContext(LanguageContext);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setLanguage(e.target.value);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[9999]">
      <div className="bg-dark-900 p-6 rounded-lg shadow-lg min-w-[300px]">
        <h2 className="text-xl font-bold mb-4 text-neon-glow">{t('settings')}</h2>
        <label className="block mb-2 text-sm text-zinc-300">{t('language')}</label>
        <select value={language} onChange={handleChange} className="w-full p-2 bg-dark-800 text-white rounded">
          <option value="en">{t('english')}</option>
          <option value="tr">{t('turkish')}</option>
        </select>
        <button
          onClick={onClose}
          className="mt-4 w-full bg-neon-red/20 text-neon-red py-2 rounded hover:bg-neon-red/30"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
