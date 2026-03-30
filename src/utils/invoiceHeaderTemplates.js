/** Header colour bands — same keys as saved `headerTemplate` on invoice documents. */
export const INVOICE_HEADER_TEMPLATES = {
  classic: {
    name: 'Classic White',
    bg: '#ffffff',
    text: '#1a1a1a',
    border: '#1a1a1a',
    palette: '⚪',
  },
  professional: {
    name: 'Professional Navy',
    bg: '#1e3a5f',
    text: '#ffffff',
    border: '#1e3a5f',
    palette: '🔵',
  },
  modern: {
    name: 'Modern Teal',
    bg: '#008b8b',
    text: '#ffffff',
    border: '#008b8b',
    palette: '🟢',
  },
  elegant: {
    name: 'Elegant Purple',
    bg: '#6a1b9a',
    text: '#ffffff',
    border: '#6a1b9a',
    palette: '🟣',
  },
  corporate: {
    name: 'Corporate Gray',
    bg: '#424242',
    text: '#ffffff',
    border: '#424242',
    palette: '⚫',
  },
  fresh: {
    name: 'Fresh Green',
    bg: '#2e7d32',
    text: '#ffffff',
    border: '#2e7d32',
    palette: '🟢',
  },
};

export function getInvoiceHeaderTemplate(key) {
  return INVOICE_HEADER_TEMPLATES[key] || INVOICE_HEADER_TEMPLATES.professional;
}
