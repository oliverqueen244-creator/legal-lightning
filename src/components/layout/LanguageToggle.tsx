import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

/**
 * Language Toggle - Switch between English and Hindi
 * Persists preference to localStorage via i18n detector
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  
  const isHindi = i18n.language === 'hi';
  
  const toggleLanguage = () => {
    const newLang = isHindi ? 'en' : 'hi';
    i18n.changeLanguage(newLang);
  };
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
      aria-label={isHindi ? 'Switch to English' : 'हिंदी में बदलें'}
    >
      <Languages className="h-4 w-4" />
      <span className="hidden sm:inline text-xs font-medium">
        {isHindi ? 'English' : 'हिंदी'}
      </span>
    </Button>
  );
}
