# CVSmith UI Design System

**Aesthetic:** Stripe/Notion-inspired (Modern, Clean, Startup-friendly)  
**Status:** DRAFT (Awaiting feedback)

---

## Part 1: Color Palette

### Primary Colors
```
Brand Blue:      #2563EB (Primary action, links)
Dark Blue:       #1E40AF (Hover state, active)
Light Blue:      #DBEAFE (Background, subtle)

Success Green:   #10B981 (Confirmations, success states)
Warning Orange:  #F59E0B (Cautions, warnings)
Error Red:       #EF4444 (Errors, deletions)
```

### Neutral Colors
```
Slate 50:        #F8FAFC (Page background)
Slate 100:       #F1F5F9 (Subtle background)
Slate 200:       #E2E8F0 (Border, divider)
Slate 400:       #94A3B8 (Placeholder, hint text)
Slate 600:       #475569 (Secondary text)
Slate 800:       #1E293B (Primary text)
Slate 900:       #0F172A (Headings)
```

### Usage
```
Page background:    Slate 50
Cards/panels:       White or Slate 100
Text (primary):     Slate 900
Text (secondary):   Slate 600
Borders:            Slate 200
Links:              Brand Blue
Buttons (primary):  Brand Blue
Buttons (hover):    Dark Blue
Buttons (disabled): Slate 300
Success:            Success Green
Error:              Error Red
```

---

## Part 2: Typography

### Font Family
```
Primary Font:   "Inter" (system fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)
Monospace:      "IBM Plex Mono" (for JSON, code)
```

### Font Sizes & Weights

```
Display:         48px / 600 weight    (Page title, hero text)
H1 (Heading 1):  36px / 600 weight    (Section title)
H2 (Heading 2):  28px / 600 weight    (Subsection)
H3 (Heading 3):  24px / 600 weight    (Card title)
Body Large:      18px / 400 weight    (Large body text)
Body:            16px / 400 weight    (Default body text)
Body Small:      14px / 400 weight    (Secondary text, labels)
Caption:         12px / 400 weight    (Captions, hints)
```

### Line Heights
```
Display/H1: 1.2 (tight)
H2/H3:      1.3 (tight)
Body:       1.6 (comfortable)
```

### Letter Spacing
```
Headings:   -0.01em (slightly tight)
Body:       0 (normal)
```

---

## Part 3: Spacing System

### Base Unit: 4px (Tailwind-compatible)

```
XS:   4px   (spacing-1)
SM:   8px   (spacing-2)
MD:   16px  (spacing-4)
LG:   24px  (spacing-6)
XL:   32px  (spacing-8)
2XL:  48px  (spacing-12)
```

### Padding
```
Input fields:       12px vertical, 16px horizontal
Buttons:            12px vertical, 24px horizontal
Cards:              24px
Sections:           32px
Page edges:         24px (mobile), 32px (desktop)
```

### Margin
```
Between sections:   32px
Between components: 24px
Between elements:   16px
```

### Border Radius
```
Small (inputs, small buttons):    6px
Medium (cards, modals):           12px
Large (feature cards):            16px
Pill buttons:                     9999px
```

---

## Part 4: Component Library

### Buttons

#### Primary Button
```
Background:     Brand Blue (#2563EB)
Text:           White
Padding:        12px 24px
Border radius:  6px
Font size:      16px / 500 weight
Hover:          Dark Blue (#1E40AF), shadow
Active:         Darker, no shadow
Disabled:       Slate 300, cursor not-allowed
```

#### Secondary Button
```
Background:     Slate 100
Text:           Slate 900
Border:         1px solid Slate 200
Padding:        12px 24px
Hover:          Slate 200 background
```

#### Ghost Button (Text-only)
```
Background:     Transparent
Text:           Brand Blue
Padding:        12px 16px
Hover:          Light Blue background
```

#### Button States
```
Default:        Full opacity, shadow
Hover:          Slightly darker, lifted shadow
Active:         No shadow, pressed feel
Disabled:       40% opacity, cursor not-allowed
Loading:        Show spinner, disabled state
```

### Input Fields

```
Border:         1px solid Slate 200
Background:     White
Padding:        12px 16px
Border radius:  6px
Font size:      16px
Focus:          2px solid Brand Blue border, light blue background
Placeholder:    Slate 400
Disabled:       Slate 100 background, cursor not-allowed
Error:          2px solid Error Red border
Error message:  Error Red text, 12px font
```

### Cards

```
Background:     White
Border:         1px solid Slate 200 (optional)
Padding:        24px
Border radius:  12px
Shadow:         0 1px 3px rgba(0,0,0,0.1)
Hover shadow:   0 10px 25px rgba(0,0,0,0.1)
```

### Modal / Dialog

```
Overlay:        50% opacity black, covers entire screen
Modal:          White background, 12px border radius
Max width:      600px (desktop), 90% (mobile)
Padding:        32px
Title:          H2 size, Slate 900
Close button:   X icon, top right, ghost button
Actions:        Primary + Secondary buttons in footer
```

### Form Label

```
Font size:      14px / 500 weight
Color:          Slate 900
Margin:         0 0 8px 0 (above input)
Required:       Red asterisk *
```

---

## Part 5: Layouts

### Desktop (1024px+)
```
Header:         Fixed, 64px height
Sidebar:        (Optional, not in R1)
Main content:   Full width
Max width:      1280px, centered
Gutters:        32px each side
```

### Tablet (768px–1024px)
```
Header:         Fixed, 56px height
Padding:        24px sides
Main content:   Full width
Gutters:        24px each side
```

### Mobile (<768px)
```
Header:         Fixed, 56px height
Padding:        16px sides
Main content:   Full width, stacked layout
Gutters:        16px each side
```

---

## Part 6: Navigation & Header

### Header Bar
```
Height:         64px (desktop), 56px (mobile)
Background:     White
Border:         1px solid Slate 200 (bottom)
Position:       Fixed, top
Z-index:        100
```

### Logo
```
Font size:      20px / 700 weight
Color:          Brand Blue
Margin:         0 32px 0 0
```

### Navigation Links
```
Font size:      14px / 500 weight
Color:          Slate 600
Active:         Brand Blue
Padding:        20px 16px
Border bottom:  3px solid Brand Blue (active)
Hover:          Slate 900
```

### User Menu
```
Profile icon:   32px circular image
Dropdown:       Ghost button style
Items:          Settings, Billing, Logout
```

---

## Part 7: Key Screens

### Screen 1: Landing / Signup Entry
```
Layout:         Full width, centered
Max width:      400px
Hero:           Logo + headline + description
CTA buttons:    "Sign Up" (primary), "Log In" (secondary)
Spacing:        64px top margin
```

### Screen 2: Signup Form
```
Layout:         Centered form
Max width:      400px
Fields:         Email, Password, Confirm Password
Submit:         Primary button "Create Account"
Error display:  Inline error messages in red
Success:        Confirmation message + redirect
```

### Screen 3: Email Verification
```
Layout:         Centered, full screen
Message:        "Check your email to verify"
CTA:            "Open email" (external) or "Resend" (button)
Countdown:      "Expires in X minutes"
```

### Screen 4: Dashboard (Main Canvas)
```
Layout:         Two-column (canvas + preview)
Left (Canvas):  Live editor, 60% width
Right (Preview): PDF preview, 40% width
Header:         CV title, privacy toggle, action buttons
Footer:         "Saving..." indicator, keyboard shortcuts hint
Responsive:    Stacks to full width on mobile (<768px)
```

### Screen 5: Download Modal
```
Title:          "Download Your CV"
Option:         PDF format (Word disabled for R1)
Button:         "Download" (primary)
Message:        "Your JSON Resume is always available in settings"
```

### Screen 6: Settings Page
```
Sections:       Account, Privacy, Billing, Data
Account:        Name, email, password change
Privacy:        Public/Private toggle
Billing:        Current tier, upgrade button, usage
Data:           Download JSON, Delete account
```

### Screen 7: Upgrade Modal
```
Title:          "Upgrade to Pro"
Pricing:        $9.99/month
Benefits:       50 suggestions/month, priority support
CTA:            "Upgrade Now" (primary)
Payment:        Stripe checkout (external)
```

---

## Part 8: Animations & Interactions

### Transitions
```
Button hover:       100ms ease-out
Modal open:         200ms ease-out (fade + scale)
Loading spinner:    Smooth rotation
Toast appear:       150ms slide-in from top
```

### Loading States
```
Button:         Show spinner inside, disable text
Page section:   Show skeleton loader
Card:           Gray placeholder, no interaction
```

### Feedback
```
Success:        Green toast "Saved successfully"
Error:          Red toast with error message
Warning:        Orange toast with explanation
Info:           Blue toast with tip
```

### Hover States
```
Button:         Color shift + subtle shadow lift
Link:           Underline appear
Card:           Subtle shadow increase
Input (focus):  Blue border + background shift
```

---

## Part 9: Responsive Design

### Breakpoints
```
Mobile:         < 768px
Tablet:         768px – 1024px
Desktop:        1024px+
```

### Mobile-First Strategy
```
Default:        Mobile layout (100% width, stacked)
768px+:         Tablet adjustments (wider, sidebars)
1024px+:        Desktop (multi-column, max-width)
```

### Touch-Friendly
```
Button size:    Min 44px × 44px (mobile)
Tap targets:    Min 8px spacing
Input padding:  Slightly larger on mobile
```

---

## Part 10: Accessibility

### WCAG 2.1 AA Compliance
```
Contrast:       4.5:1 for text, 3:1 for large text
Focus:          Visible focus ring on all interactive elements
Labels:         All inputs have associated labels
Icons:          Icon buttons have aria-labels
Colors:         Not the only way to convey info (use text + color)
```

### Focus Ring
```
Color:          Brand Blue (#2563EB)
Width:          2px
Offset:         2px from element
Style:          Solid
```

---

## Part 11: Dark Mode (Future)

### Future (Release 2)
```
Background:     Slate 900
Text:           Slate 50
Cards:          Slate 800
Borders:        Slate 700
Accents:        Slightly brighter blues
```

**For Release 1:** Light mode only

---

## Part 12: Design Tokens (CSS Variables)

```css
:root {
  /* Colors */
  --color-primary: #2563EB;
  --color-primary-dark: #1E40AF;
  --color-primary-light: #DBEAFE;
  
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  
  --color-slate-50: #F8FAFC;
  --color-slate-900: #0F172A;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-size-body: 16px;
  --line-height-body: 1.6;
  
  /* Border radius */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  
  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 25px rgba(0,0,0,0.1);
}
```

---

## Summary: Design Philosophy

**CVSmith Design Principles:**
1. **Clean & Minimal** – No clutter, maximum clarity
2. **Professional** – Trustworthy, serious about data
3. **Startup Vibe** – Modern, approachable, not corporate
4. **Accessible** – Works for everyone, all abilities
5. **Responsive** – Mobile-first, looks great everywhere
6. **Fast** – Smooth animations, quick feedback

**Inspiration:** Stripe, Notion, Linear

---

## Next: Interactive Prototypes

See the following artifacts for clickable prototypes of:
1. Signup / Login flow
2. Dashboard (canvas + preview)
3. Download modal
4. Settings page
5. Upgrade to Pro

**Ready for feedback?** Click through the prototypes and let me know what to adjust!

