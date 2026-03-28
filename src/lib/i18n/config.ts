/**
 * Internationalization Configuration
 *
 * Expanded i18n support with:
 * - 10+ languages
 * - RTL language support
 * - Locale-aware formatting
 * - Pluralization
 * - Date/number formatting
 */

// =============================================================================
// Supported Locales
// =============================================================================

export const locales = [
  // LTR Languages
  { code: 'en', name: 'English', dir: 'ltr', flag: '🇺🇸' },
  { code: 'es', name: 'Español', dir: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', dir: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', dir: 'ltr', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', dir: 'ltr', flag: '🇧🇷' },
  { code: 'ja', name: '日本語', dir: 'ltr', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', dir: 'ltr', flag: '🇰🇷' },
  { code: 'zh', name: '中文', dir: 'ltr', flag: '🇨🇳' },
  { code: 'ru', name: 'Русский', dir: 'ltr', flag: '🇷🇺' },
  { code: 'nl', name: 'Nederlands', dir: 'ltr', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', dir: 'ltr', flag: '🇵🇱' },
  { code: 'tr', name: 'Türkçe', dir: 'ltr', flag: '🇹🇷' },
  { code: 'vi', name: 'Tiếng Việt', dir: 'ltr', flag: '🇻🇳' },

  // RTL Languages
  { code: 'ar', name: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'he', name: 'עברית', dir: 'rtl', flag: '🇮🇱' },
  { code: 'fa', name: 'فارسی', dir: 'rtl', flag: '🇮🇷' },
  { code: 'ur', name: 'اردو', dir: 'rtl', flag: '🇵🇰' },
] as const;

export type SupportedLocale = (typeof locales)[number]['code'];
export const defaultLocale: SupportedLocale = 'en';

// Check if locale is supported
export function isValidLocale(locale: string): locale is SupportedLocale {
  return locales.some((l) => l.code === locale);
}

// Get locale info
export function getLocaleInfo(locale: SupportedLocale) {
  return locales.find((l) => l.code === locale) || locales[0];
}

// Get text direction
export function getTextDirection(locale: SupportedLocale): 'ltr' | 'rtl' {
  return getLocaleInfo(locale).dir;
}

// Check if locale is RTL
export function isRTL(locale: SupportedLocale): boolean {
  return getTextDirection(locale) === 'rtl';
}

// =============================================================================
// Translation Messages
// =============================================================================

// Type for nested translation messages
type Messages = {
  nav: Record<string, string>;
  chat: Record<string, string>;
  documents: Record<string, string>;
  settings: Record<string, string>;
  errors: Record<string, string>;
  common: Record<string, string>;
};

// Core translations for all supported languages
export const messages: Record<SupportedLocale, Messages> = {
  en: {
    // Navigation
    nav: {
      home: 'Home',
      chat: 'Chat',
      documents: 'Documents',
      settings: 'Settings',
      admin: 'Admin',
      logout: 'Sign Out',
      login: 'Sign In',
      register: 'Sign Up',
    },

    // Chat
    chat: {
      title: 'Chat',
      placeholder: 'Type your message...',
      send: 'Send',
      newConversation: 'New Conversation',
      sources: 'Sources',
      thinking: 'Thinking...',
      regenerate: 'Regenerate',
      copy: 'Copy',
      share: 'Share',
      edit: 'Edit',
      delete: 'Delete',
      noMessages: 'Start a conversation by typing a message below.',
      uploadDocuments: 'Upload documents to enhance responses with your knowledge base.',
    },

    // Documents
    documents: {
      title: 'Documents',
      upload: 'Upload',
      uploadDescription: 'Drag and drop files here, or click to select',
      supportedFormats: 'Supported formats: PDF, DOCX, TXT, MD, HTML',
      maxSize: 'Maximum file size: 50MB',
      processing: 'Processing...',
      completed: 'Completed',
      error: 'Error',
      deleteConfirm: 'Are you sure you want to delete this document?',
      noDocuments: 'No documents yet. Upload your first document to get started.',
      search: 'Search documents...',
    },

    // Settings
    settings: {
      title: 'Settings',
      general: 'General',
      appearance: 'Appearance',
      notifications: 'Notifications',
      language: 'Language',
      theme: 'Theme',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeSystem: 'System',
      save: 'Save Changes',
      saved: 'Changes saved successfully',
    },

    // Errors
    errors: {
      generic: 'Something went wrong',
      notFound: 'Page not found',
      unauthorized: 'Please sign in to continue',
      forbidden: 'You do not have permission to access this resource',
      rateLimit: 'Too many requests. Please try again later.',
      validation: 'Please check your input and try again',
      network: 'Network error. Please check your connection.',
    },

    // Common
    common: {
      loading: 'Loading...',
      cancel: 'Cancel',
      confirm: 'Confirm',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      actions: 'Actions',
      more: 'More',
      show: 'Show',
      hide: 'Hide',
      expand: 'Expand',
      collapse: 'Collapse',
    },
  },

  // Spanish
  es: {
    nav: {
      home: 'Inicio',
      chat: 'Chat',
      documents: 'Documentos',
      settings: 'Configuración',
      admin: 'Administración',
      logout: 'Cerrar Sesión',
      login: 'Iniciar Sesión',
      register: 'Registrarse',
    },
    chat: {
      title: 'Chat',
      placeholder: 'Escribe tu mensaje...',
      send: 'Enviar',
      newConversation: 'Nueva Conversación',
      sources: 'Fuentes',
      thinking: 'Pensando...',
      regenerate: 'Regenerar',
      copy: 'Copiar',
      share: 'Compartir',
      edit: 'Editar',
      delete: 'Eliminar',
      noMessages: 'Inicia una conversación escribiendo un mensaje abajo.',
      uploadDocuments: 'Sube documentos para mejorar las respuestas con tu base de conocimientos.',
    },
    documents: {
      title: 'Documentos',
      upload: 'Subir',
      uploadDescription: 'Arrastra y suelta archivos aquí, o haz clic para seleccionar',
      supportedFormats: 'Formatos soportados: PDF, DOCX, TXT, MD, HTML',
      maxSize: 'Tamaño máximo: 50MB',
      processing: 'Procesando...',
      completed: 'Completado',
      error: 'Error',
      deleteConfirm: '¿Estás seguro de que quieres eliminar este documento?',
      noDocuments: 'Aún no hay documentos. Sube tu primer documento para comenzar.',
      search: 'Buscar documentos...',
    },
    settings: {
      title: 'Configuración',
      general: 'General',
      appearance: 'Apariencia',
      notifications: 'Notificaciones',
      language: 'Idioma',
      theme: 'Tema',
      themeLight: 'Claro',
      themeDark: 'Oscuro',
      themeSystem: 'Sistema',
      save: 'Guardar Cambios',
      saved: 'Cambios guardados exitosamente',
    },
    errors: {
      generic: 'Algo salió mal',
      notFound: 'Página no encontrada',
      unauthorized: 'Por favor inicia sesión para continuar',
      forbidden: 'No tienes permiso para acceder a este recurso',
      rateLimit: 'Demasiadas solicitudes. Por favor intenta más tarde.',
      validation: 'Por favor verifica tu entrada e intenta de nuevo',
      network: 'Error de red. Por favor verifica tu conexión.',
    },
    common: {
      loading: 'Cargando...',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      close: 'Cerrar',
      back: 'Atrás',
      next: 'Siguiente',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      create: 'Crear',
      search: 'Buscar',
      filter: 'Filtrar',
      sort: 'Ordenar',
      actions: 'Acciones',
      more: 'Más',
      show: 'Mostrar',
      hide: 'Ocultar',
      expand: 'Expandir',
      collapse: 'Colapsar',
    },
  },

  // Arabic (RTL)
  ar: {
    nav: {
      home: 'الرئيسية',
      chat: 'دردشة',
      documents: 'المستندات',
      settings: 'الإعدادات',
      admin: 'الإدارة',
      logout: 'تسجيل الخروج',
      login: 'تسجيل الدخول',
      register: 'إنشاء حساب',
    },
    chat: {
      title: 'دردشة',
      placeholder: 'اكتب رسالتك...',
      send: 'إرسال',
      newConversation: 'محادثة جديدة',
      sources: 'المصادر',
      thinking: 'جاري التفكير...',
      regenerate: 'إعادة إنشاء',
      copy: 'نسخ',
      share: 'مشاركة',
      edit: 'تعديل',
      delete: 'حذف',
      noMessages: 'ابدأ محادثة بكتابة رسالة أدناه.',
      uploadDocuments: 'ارفع المستندات لتحسين الردود باستخدام قاعدة المعرفة الخاصة بك.',
    },
    documents: {
      title: 'المستندات',
      upload: 'رفع',
      uploadDescription: 'اسحب الملفات وأفلتها هنا، أو انقر للاختيار',
      supportedFormats: 'التنسيقات المدعومة: PDF، DOCX، TXT، MD، HTML',
      maxSize: 'الحد الأقصى للحجم: 50 ميجابايت',
      processing: 'جاري المعالجة...',
      completed: 'تم الاكتمال',
      error: 'خطأ',
      deleteConfirm: 'هل أنت متأكد من حذف هذا المستند؟',
      noDocuments: 'لا توجد مستندات بعد. ارفع مستندك الأول للبدء.',
      search: 'البحث في المستندات...',
    },
    settings: {
      title: 'الإعدادات',
      general: 'عام',
      appearance: 'المظهر',
      notifications: 'الإشعارات',
      language: 'اللغة',
      theme: 'السمة',
      themeLight: 'فاتح',
      themeDark: 'داكن',
      themeSystem: 'النظام',
      save: 'حفظ التغييرات',
      saved: 'تم حفظ التغييرات بنجاح',
    },
    errors: {
      generic: 'حدث خطأ ما',
      notFound: 'الصفحة غير موجودة',
      unauthorized: 'الرجاء تسجيل الدخول للمتابعة',
      forbidden: 'ليس لديك صلاحية للوصول إلى هذا المورد',
      rateLimit: 'طلبات كثيرة جداً. الرجاء المحاولة لاحقاً.',
      validation: 'الرجاء التحقق من المدخلات والمحاولة مرة أخرى',
      network: 'خطأ في الشبكة. الرجاء التحقق من الاتصال.',
    },
    common: {
      loading: 'جاري التحميل...',
      cancel: 'إلغاء',
      confirm: 'تأكيد',
      close: 'إغلاق',
      back: 'رجوع',
      next: 'التالي',
      save: 'حفظ',
      delete: 'حذف',
      edit: 'تعديل',
      create: 'إنشاء',
      search: 'بحث',
      filter: 'تصفية',
      sort: 'ترتيب',
      actions: 'إجراءات',
      more: 'المزيد',
      show: 'إظهار',
      hide: 'إخفاء',
      expand: 'توسيع',
      collapse: 'طي',
    },
  },

  // French
  fr: {
    nav: {
      home: 'Accueil',
      chat: 'Chat',
      documents: 'Documents',
      settings: 'Paramètres',
      admin: 'Admin',
      logout: 'Déconnexion',
      login: 'Connexion',
      register: 'Inscription',
    },
    chat: {
      title: 'Chat',
      placeholder: 'Tapez votre message...',
      send: 'Envoyer',
      newConversation: 'Nouvelle Conversation',
      sources: 'Sources',
      thinking: 'Réflexion...',
      regenerate: 'Régénérer',
      copy: 'Copier',
      share: 'Partager',
      edit: 'Modifier',
      delete: 'Supprimer',
      noMessages: 'Commencez une conversation en tapant un message ci-dessous.',
      uploadDocuments:
        'Téléchargez des documents pour enrichir les réponses avec votre base de connaissances.',
    },
    documents: {
      title: 'Documents',
      upload: 'Télécharger',
      uploadDescription: 'Glissez-déposez des fichiers ici, ou cliquez pour sélectionner',
      supportedFormats: 'Formats supportés : PDF, DOCX, TXT, MD, HTML',
      maxSize: 'Taille maximale : 50 Mo',
      processing: 'Traitement...',
      completed: 'Terminé',
      error: 'Erreur',
      deleteConfirm: 'Êtes-vous sûr de vouloir supprimer ce document ?',
      noDocuments:
        'Aucun document pour le moment. Téléchargez votre premier document pour commencer.',
      search: 'Rechercher des documents...',
    },
    settings: {
      title: 'Paramètres',
      general: 'Général',
      appearance: 'Apparence',
      notifications: 'Notifications',
      language: 'Langue',
      theme: 'Thème',
      themeLight: 'Clair',
      themeDark: 'Sombre',
      themeSystem: 'Système',
      save: 'Enregistrer',
      saved: 'Modifications enregistrées avec succès',
    },
    errors: {
      generic: 'Une erreur est survenue',
      notFound: 'Page non trouvée',
      unauthorized: 'Veuillez vous connecter pour continuer',
      forbidden: "Vous n'avez pas la permission d'accéder à cette ressource",
      rateLimit: 'Trop de requêtes. Veuillez réessayer plus tard.',
      validation: 'Veuillez vérifier vos informations et réessayer',
      network: 'Erreur réseau. Veuillez vérifier votre connexion.',
    },
    common: {
      loading: 'Chargement...',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      close: 'Fermer',
      back: 'Retour',
      next: 'Suivant',
      save: 'Enregistrer',
      delete: 'Supprimer',
      edit: 'Modifier',
      create: 'Créer',
      search: 'Rechercher',
      filter: 'Filtrer',
      sort: 'Trier',
      actions: 'Actions',
      more: 'Plus',
      show: 'Afficher',
      hide: 'Masquer',
      expand: 'Développer',
      collapse: 'Réduire',
    },
  },

  // Hebrew (RTL)
  he: {
    nav: {
      home: 'בית',
      chat: "צ'אט",
      documents: 'מסמכים',
      settings: 'הגדרות',
      admin: 'ניהול',
      logout: 'התנתק',
      login: 'התחבר',
      register: 'הרשם',
    },
    chat: {
      title: "צ'אט",
      placeholder: 'הקלד את ההודעה שלך...',
      send: 'שלח',
      newConversation: 'שיחה חדשה',
      sources: 'מקורות',
      thinking: 'חושב...',
      regenerate: 'צור מחדש',
      copy: 'העתק',
      share: 'שתף',
      edit: 'ערוך',
      delete: 'מחק',
      noMessages: 'התחל שיחה על ידי הקלדת הודעה למטה.',
      uploadDocuments: 'העלה מסמכים כדי לשפר תשובות עם מסד הידע שלך.',
    },
    documents: {
      title: 'מסמכים',
      upload: 'העלה',
      uploadDescription: 'גרור ושחרר קבצים כאן, או לחץ לבחירה',
      supportedFormats: 'פורמטים נתמכים: PDF, DOCX, TXT, MD, HTML',
      maxSize: 'גודל מקסימלי: 50MB',
      processing: 'מעבד...',
      completed: 'הושלם',
      error: 'שגיאה',
      deleteConfirm: 'האם אתה בטוח שברצונך למחוק מסמך זה?',
      noDocuments: 'אין מסמכים עדיין. העלה את המסמך הראשון שלך כדי להתחיל.',
      search: 'חפש מסמכים...',
    },
    settings: {
      title: 'הגדרות',
      general: 'כללי',
      appearance: 'מראה',
      notifications: 'התראות',
      language: 'שפה',
      theme: 'ערכת נושא',
      themeLight: 'בהיר',
      themeDark: 'כהה',
      themeSystem: 'מערכת',
      save: 'שמור שינויים',
      saved: 'השינויים נשמרו בהצלחה',
    },
    errors: {
      generic: 'משהו השתבש',
      notFound: 'הדף לא נמצא',
      unauthorized: 'אנא התחבר כדי להמשיך',
      forbidden: 'אין לך הרשאה לגשת למשאב זה',
      rateLimit: 'יותר מדי בקשות. אנא נסה שוב מאוחר יותר.',
      validation: 'אנא בדוק את הקלט שלך ונסה שוב',
      network: 'שגיאת רשת. אנא בדוק את החיבור שלך.',
    },
    common: {
      loading: 'טוען...',
      cancel: 'ביטול',
      confirm: 'אישור',
      close: 'סגור',
      back: 'חזרה',
      next: 'הבא',
      save: 'שמור',
      delete: 'מחק',
      edit: 'ערוך',
      create: 'צור',
      search: 'חפש',
      filter: 'סנן',
      sort: 'מיין',
      actions: 'פעולות',
      more: 'עוד',
      show: 'הצג',
      hide: 'הסתר',
      expand: 'הרחב',
      collapse: 'כווץ',
    },
  },

  // Placeholder for other languages - extend as needed
  de: {} as Messages,
  it: {} as Messages,
  pt: {} as Messages,
  ja: {} as Messages,
  ko: {} as Messages,
  zh: {} as Messages,
  ru: {} as Messages,
  nl: {} as Messages,
  pl: {} as Messages,
  tr: {} as Messages,
  vi: {} as Messages,
  fa: {} as Messages,
  ur: {} as Messages,
};

// Fill in missing languages with English as fallback
for (const locale of locales) {
  if (!messages[locale.code] || Object.keys(messages[locale.code]).length === 0) {
    (messages as Record<string, Messages>)[locale.code] = messages.en;
  }
}

// =============================================================================
// Formatting Utilities
// =============================================================================

interface FormatNumberOptions {
  locale: SupportedLocale;
  decimals?: number;
  currency?: string;
}

export function formatNumber(value: number, options: FormatNumberOptions): string {
  const { locale, decimals = 0 } = options;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCurrency(value: number, options: FormatNumberOptions): string {
  const { locale, currency = 'USD' } = options;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

export function formatDate(date: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(date: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeTime(date: Date, locale: SupportedLocale): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffMins < 60) return rtf.format(-diffMins, 'minute');
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  if (diffDays < 30) return rtf.format(-diffDays, 'day');

  return formatDate(date, locale);
}

// =============================================================================
// Pluralization
// =============================================================================

type PluralRule = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export function getPluralRule(count: number, locale: SupportedLocale): PluralRule {
  const rules = new Intl.PluralRules(locale);
  return rules.select(count) as PluralRule;
}

export function pluralize(
  count: number,
  locale: SupportedLocale,
  forms: Record<PluralRule, string> | { one: string; other: string }
): string {
  const rule = getPluralRule(count, locale);
  const form = forms[rule as keyof typeof forms] || (forms as { other: string }).other;
  return form.replace('{count}', String(count));
}
