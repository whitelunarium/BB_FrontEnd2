// assets/js/chatbot/i18n.js
// PNEC Helper Bot v3 — Phase 4 multilingual support.
//
// Three locales: en (default), es (Spanish — large Poway demographic),
// tl (Tagalog — significant Filipino community in San Diego County).
// Strings are organized by namespace so missing keys fall back to en.
// The model is also nudged via prompt.js → languageBlock() to respond
// in the active language.

const STRINGS = {
  en: {
    'greet.morning':           'Good morning',
    'greet.afternoon':         'Good afternoon',
    'greet.evening':           'Good evening',
    'greet.late':              'Hello',
    'greet.neighbor':          'neighbor',
    'greet.default':           "Ask me anything about emergency preparedness, your block, or PNEC programs.",
    'greet.with_neighborhood': (n) => `Your block (${n}) is here. What can I help with?`,
    'status.ready':            'PNEC · ready',
    'status.thinking':         'Thinking…',
    'status.emergency':        'Emergency mode',
    'status.voice_unavailable':"Voice input isn't available in this browser",
    'rail.empty':              'No conversations yet — start a new chat below.',
    'confirm.delete_convo':    "Delete this conversation? This can't be undone.",
    'confirm.clear_all':       'Permanently delete all chat history?',
    'export.empty':            'Nothing to export — start a conversation first.',
    'prompt.edit':             'Edit your message:',
    'error.timeout':           "I'm taking longer than expected to reach my brain. Could you try again?",
    'error.network':           "I can't reach the PNEC server right now. Check your connection and retry?",
    'error.empty':             "I got an empty response. Could you rephrase your question?",
    'error.config':            "Helper Bot is offline right now — a PNEC volunteer has been notified. Please use the contact form for now.",
    'error.generic':           "Something went wrong. Could you try again, or use the contact form for now?",
  },
  es: {
    'greet.morning':           'Buenos días',
    'greet.afternoon':         'Buenas tardes',
    'greet.evening':           'Buenas noches',
    'greet.late':              'Hola',
    'greet.neighbor':          'vecino',
    'greet.default':           'Pregúntame sobre preparación para emergencias, tu vecindario o los programas de PNEC.',
    'greet.with_neighborhood': (n) => `Tu cuadra (${n}) está aquí. ¿En qué puedo ayudarte?`,
    'status.ready':            'PNEC · listo',
    'status.thinking':         'Pensando…',
    'status.emergency':        'Modo emergencia',
    'status.voice_unavailable':'La entrada de voz no está disponible en este navegador',
    'rail.empty':              'No hay conversaciones aún — inicia una abajo.',
    'confirm.delete_convo':    '¿Eliminar esta conversación? Esto no se puede deshacer.',
    'confirm.clear_all':       '¿Eliminar permanentemente todo el historial de chat?',
    'export.empty':            'Nada que exportar — inicia una conversación primero.',
    'prompt.edit':             'Edita tu mensaje:',
    'error.timeout':           'Estoy tardando más de lo esperado. ¿Puedes intentarlo de nuevo?',
    'error.network':           'No puedo conectarme al servidor de PNEC ahora. ¿Revisa tu conexión y vuelve a intentar?',
    'error.empty':             'Recibí una respuesta vacía. ¿Puedes reformular tu pregunta?',
    'error.config':            'Helper Bot está fuera de línea ahora — un voluntario de PNEC ha sido notificado. Usa el formulario de contacto por ahora.',
    'error.generic':           'Algo salió mal. ¿Puedes intentarlo de nuevo o usar el formulario de contacto?',
  },
  tl: {
    'greet.morning':           'Magandang umaga',
    'greet.afternoon':         'Magandang hapon',
    'greet.evening':           'Magandang gabi',
    'greet.late':              'Kumusta',
    'greet.neighbor':          'kapitbahay',
    'greet.default':           'Magtanong sa akin tungkol sa emergency preparedness, sa iyong block, o sa mga programa ng PNEC.',
    'greet.with_neighborhood': (n) => `Ang block mo (${n}) ay narito. Paano kita matutulungan?`,
    'status.ready':            'PNEC · handa',
    'status.thinking':         'Iniisip…',
    'status.emergency':        'Emergency mode',
    'status.voice_unavailable':'Hindi available ang voice input sa browser na ito',
    'rail.empty':              'Wala pang conversation — magsimula ng bago sa ibaba.',
    'confirm.delete_convo':    'Burahin ang conversation na ito? Hindi ito mababawi.',
    'confirm.clear_all':       'Permanenteng burahin ang lahat ng chat history?',
    'export.empty':            'Walang i-export — magsimula muna ng conversation.',
    'prompt.edit':             'I-edit ang iyong mensahe:',
    'error.timeout':           'Mas matagal akong nakakakonekta. Subukan ulit?',
    'error.network':           'Hindi ko maabot ang PNEC server ngayon. Tingnan ang connection mo at subukan ulit.',
    'error.empty':             'Walang sagot na natanggap. Subukan ulit ang tanong mo?',
    'error.config':            'Offline ang Helper Bot ngayon — may na-notify nang PNEC volunteer. Gamitin ang contact form pansamantala.',
    'error.generic':           'May problema. Subukan ulit, o gamitin ang contact form.',
  },
};

const LANG_NAMES = {
  en: 'English',
  es: 'Español',
  tl: 'Tagalog',
};
const LANG_TAGS = {
  en: 'en-US',
  es: 'es-US',
  tl: 'fil-PH',
};

let activeLang = 'en';

export function setLang(lang) {
  if (STRINGS[lang]) activeLang = lang;
}

export function getLang() { return activeLang; }
export function langTag()  { return LANG_TAGS[activeLang] || 'en-US'; }
export function langName() { return LANG_NAMES[activeLang] || 'English'; }

export function t(key, ...args) {
  const tbl = STRINGS[activeLang] || STRINGS.en;
  const en  = STRINGS.en;
  const v = tbl[key] != null ? tbl[key] : en[key];
  if (v == null) return key;
  return typeof v === 'function' ? v(...args) : v;
}

// Prompt-block helper used by prompt.js to nudge the model into the
// active language. Imported lazily there so we don't hard-couple.
export function languageBlock() {
  if (activeLang === 'en') return '';
  return `LANGUAGE: Respond in ${langName()} (${activeLang}). Use natural, plainspoken ${langName()} that a Poway neighbor would use.`;
}
