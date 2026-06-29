import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLanguage = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(newLanguage);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-2"
      title={i18n.language === 'en' ? '切換為中文' : 'Switch to English'}
    >
      <Globe className="w-4 h-4" />
      <span>{i18n.language.toUpperCase()}</span>
    </Button>
  );
}
