# Accessibility (WCAG 2.1 AA)

The RAG Starter Kit aims for WCAG 2.1 Level AA compliance. This document describes the accessibility features, known limitations, and how to test.

## Keyboard Navigation

### Global Shortcuts

| Key | Action |
|-----|--------|
| Tab | Move focus between interactive elements |
| Shift+Tab | Move focus in reverse |
| Escape | Close modals, sheets, dropdowns |
| Enter/Space | Activate focused button or link |

### Skip to Content

A visually hidden "Skip to content" link appears at the top of every page when a user presses Tab. It jumps focus directly to `#main-content`, bypassing navigation.

### Chat Interface

- New messages are announced by screen readers via `aria-live="polite"` on the messages container
- Loading indicators use `role="status"` for polite announcements
- Error messages use `role="alert"` for immediate announcements
- All icon buttons have descriptive `aria-label` attributes

## Screen Reader Support

The application is tested with:
- VoiceOver (macOS/iOS)
- NVDA (Windows)

### Landmark Regions

The page uses semantic HTML landmarks:
- `<main>` — Primary content area
- `<nav>` — Navigation (navbar, sidebar)
- `<section>` — Content sections with `aria-label` attributes

### Dynamic Content

- Chat messages update in an `aria-live` region
- Loading states are communicated via `aria-busy`
- Error states use `role="alert"`
- Document ingestion status changes are reflected in real time

## Touch Targets

All interactive elements meet the WCAG 2.1 AA minimum touch target size of 44x44 CSS pixels:
- Icon buttons: `min-h-[44px] min-w-[44px]`
- Quick action cards: `min-h-[80px]`
- Upload zones: `min-h-[80px]`
- Suggestion chips: `min-h-[44px]`

## Focus Indicators

All interactive elements have visible focus indicators using Tailwind's `focus-visible:` utilities. Custom focus rings appear on keyboard navigation but not on mouse clicks.

## Color and Contrast

The application uses the project's Tailwind CSS theme which provides:
- Light and dark mode support
- Default color tokens designed for WCAG AA contrast ratios
- Semantic color variables (primary, muted, foreground, etc.)

## Testing Methodology

### Automated Testing

- **Lighthouse**: Run via Chrome DevTools for accessibility scoring
- **axe-core**: Available via automated Playwright accessibility scans
- **ESLint**: `eslint-plugin-jsx-a11y` for static analysis

### Manual Testing Checklist

1. Navigate the entire chat interface using only the keyboard
2. Test with VoiceOver or NVDA — verify all content is announced correctly
3. Upload a document and verify status updates are communicated
4. Open/close modals, sheets, and dropdowns — verify focus management
5. Test the skip-to-content link on each page
6. Verify all form inputs have associated labels
7. Check that error messages are announced by screen readers

### Running Lighthouse

```bash
# Via Chrome DevTools
# 1. Open the app in Chrome
# 2. Open DevTools (F12)
# 3. Go to Lighthouse tab
# 4. Select Accessibility and generate report
```

## Known Limitations

- The code executor sandbox is not fully accessible (output is presented as preformatted text without ARIA annotations)
- Third-party embeds (iframes for OAuth providers) may not be fully accessible
- The Chrome extension has not been audited for accessibility

## Contributing Accessibility Fixes

When adding new components:

1. All icon-only buttons must have `aria-label`
2. All form inputs must have associated `<label>` elements or `aria-label`
3. Dynamic content must use `aria-live` regions
4. Custom interactive elements must have appropriate `role` attributes
5. Test keyboard navigation — every feature should work without a mouse
6. Verify focus management in modals and dialogs
