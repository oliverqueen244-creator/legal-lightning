import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      // Navigation
      'dashboard': 'Dashboard',
      'war_room': 'War Room',
      'control_deck': 'Control Deck',
      
      // Case Status
      'running_now': 'RUNNING NOW',
      'items_away': '{{count}} ITEMS AWAY',
      'completed': 'COMPLETED',
      'skipped': 'SKIPPED',
      'lunch_break': 'LUNCH BREAK',
      'adjourned': 'ADJOURNED',
      'forced_active': 'FORCED ACTIVE',
      'item_no': 'Item #{{number}}',
      'forced': 'FORCED',
      'urgent': 'URGENT',
      'urgent_supp': 'URGENT (SUPP)',
      'supplementary': 'SUPPLEMENTARY',
      
      // Labels
      'court': 'Court',
      'opposing': 'Opposing',
      'petitioner_counsel': 'Pet. Counsel',
      'respondent_counsel': 'Resp. Counsel',
      'judge': 'Judge',
      'cached': 'Cached',
      'pending_review': 'pending review',
      'upload_in_control_deck': 'Upload in Control Deck',
      'vs': 'v.',
      
      // Party labels
      'your_client': 'Your Client',
      'opposite_party': 'Opposite Party',
      
      // Actions
      'force_active': 'Force Active',
      'activating': 'Activating...',
      'sign_out': 'Sign Out',
      'refresh': 'Refresh',
      
      // Tabs
      'tasks': 'Tasks',
      'brief': 'Brief',
      'cases': 'Cases',
      'find': 'Find',
      'later': 'Later',
      
      // Messages
      'connection_required': 'Connection required',
      'must_be_online': 'You must be online to force a case active.',
      'case_marked_active': 'Case marked as active',
      'status_override_applied': 'Status override applied. The case is now in "Running" mode.',
      'failed_update_status': 'Failed to update status',
      
      // Tooltips
      'open_war_room_review': 'Open War Room → Documents tab to review and approve',
      'documents_awaiting_review': 'Documents uploaded, awaiting senior review',
      'click_upload_control_deck': 'Click to open Control Deck where you can upload case documents',
      
      // Header
      'rajasthan_high_court': 'Rajasthan High Court',
    }
  },
  hi: {
    translation: {
      // Navigation
      'dashboard': 'डैशबोर्ड',
      'war_room': 'वॉर रूम',
      'control_deck': 'कंट्रोल डेक',
      
      // Case Status
      'running_now': 'अभी चल रहा है',
      'items_away': '{{count}} मामले बाकी',
      'completed': 'पूर्ण',
      'skipped': 'छोड़ा गया',
      'lunch_break': 'दोपहर का भोजन',
      'adjourned': 'स्थगित',
      'forced_active': 'सक्रिय किया गया',
      'item_no': 'आइटम #{{number}}',
      'forced': 'सक्रिय',
      'urgent': 'अत्यावश्यक',
      'urgent_supp': 'अत्यावश्यक (पूरक)',
      'supplementary': 'पूरक सूची',
      
      // Labels
      'court': 'न्यायालय',
      'opposing': 'विपक्षी',
      'petitioner_counsel': 'याचिकाकर्ता वकील',
      'respondent_counsel': 'प्रतिवादी वकील',
      'judge': 'न्यायाधीश',
      'cached': 'कैश्ड',
      'pending_review': 'समीक्षा लंबित',
      'upload_in_control_deck': 'कंट्रोल डेक में अपलोड करें',
      'vs': 'बनाम',
      
      // Party labels
      'your_client': 'आपका मुवक्किल',
      'opposite_party': 'विपक्षी पार्टी',
      
      // Actions
      'force_active': 'सक्रिय करें',
      'activating': 'सक्रिय हो रहा है...',
      'sign_out': 'साइन आउट',
      'refresh': 'रिफ्रेश',
      
      // Tabs
      'tasks': 'कार्य',
      'brief': 'संक्षेप',
      'cases': 'मामले',
      'find': 'खोजें',
      'later': 'बाद में',
      
      // Messages
      'connection_required': 'कनेक्शन आवश्यक',
      'must_be_online': 'मामले को सक्रिय करने के लिए ऑनलाइन होना आवश्यक है।',
      'case_marked_active': 'मामला सक्रिय के रूप में चिह्नित',
      'status_override_applied': 'स्थिति ओवरराइड लागू। मामला अब "चल रहा है" मोड में है।',
      'failed_update_status': 'स्थिति अपडेट करने में विफल',
      
      // Tooltips
      'open_war_room_review': 'समीक्षा और अनुमोदन के लिए वॉर रूम → दस्तावेज़ टैब खोलें',
      'documents_awaiting_review': 'दस्तावेज़ अपलोड किए गए, वरिष्ठ समीक्षा की प्रतीक्षा में',
      'click_upload_control_deck': 'केस दस्तावेज़ अपलोड करने के लिए कंट्रोल डेक खोलने के लिए क्लिक करें',
      
      // Header
      'rajasthan_high_court': 'राजस्थान उच्च न्यायालय',
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
