// Pulled from the restaurant's own printed menu — parchment ground, deep
// maroon section bars, warm gold rules — rather than a generic bright
// red/orange app-template look. Red is reserved for price and selection,
// not used as a fill color throughout.
export const colors = {
  red: '#6E1B14', // maroon — primary CTA / brand accent, used sparingly
  // Deepened from #B98A34 for legibility. The old gold sat at 2.78:1 against
  // the parchment ground — below WCAG's 3:1 floor even for large text — while
  // being used for cart prices, order status and the "browse" link. This tone
  // reads as the same gold and clears AA for body text at 4.77:1.
  orange: '#8A6420', // gold — secondary accent (rules, highlights, prices)
  white: '#FFFDF8', // warm parchment white, not stark white
  ink: '#2C1B10',
  inkSoft: '#6F5B42', // secondary text; 5.76:1 on parchment (was #8A7458 at 3.97)
  bg: '#FBF1DE', // parchment
  border: '#DCC79A', // gold-tan rule line
  success: '#1F7A44', // 4.77:1 (was #2F9E5C at 3.04)
  danger: '#C6281E', // true alert red — distinct from the maroon brand color
  ember: '#9A4517', // calorie mark; 5.79:1 (was #B5541F at 4.41)
};

export const gradient = [colors.red, '#4A0F0A'];
