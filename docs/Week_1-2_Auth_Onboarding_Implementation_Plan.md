# Week 1-2: Foundation & Auth Implementation Plan

**Timeline:** Week 1-2 (10 working days)  
**Goal:** User can signup/login with email or social, upload CV, proceed to dashboard without blocking verification  
**Status:** READY TO IMPLEMENT

---

## Overview

This is the foundation phase where we build the authentication system and onboarding flow. By the end of Week 2, users should be able to:

1. ✅ Sign up with email & password
2. ✅ Log in with email & password
3. ✅ Sign in with Google OAuth
5. ✅ Upload a CV (PDF/Word)
6. ✅ Access dashboard (Canvas)
7. ✅ Access settings page
8. ⏳ Email verification (optional, non-blocking)

---

## Architecture Overview

```
Frontend (React)                    Backend (FastAPI)                Database (PostgreSQL)
────────────────────────────────────────────────────────────────────────────────────────

User enters email/password          POST /api/auth/signup            users table
         ↓                                   ↓                             ↓
Calls signup endpoint    ─────→     Hash password                  Store user record
         ↓                           Validate email                 JWT token returned
Receives JWT token               Generate JWT token
         ↓                           Send verification email
Stores in localStorage
         ↓
Redirects to Dashboard
```

---

## Backend Tasks (Week 1-2)

### Day 1-2: Project Setup & Database Foundation

**Task 1: Initialize FastAPI Project**
- [ ] Create project structure as per setup guide
- [ ] Set up main.py with FastAPI app
- [ ] Configure CORS, error handlers, logging
- [ ] Set up config.py for environment variables (Pydantic Settings)
- [ ] Initialize database.py with SQLAlchemy + PostgreSQL connection
- [ ] Create alembic migrations setup

**Task 2: Create User Model & Migration**
```python
# models/user.py
class User(Base):
    __tablename__ = "users"
    
    id: UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email: str = Column(String(255), unique=True, index=True, nullable=False)
    password_hash: str = Column(String(255), nullable=True)  # Nullable for social login
    email_verified: bool = Column(Boolean, default=False)
    email_verified_at: Optional[datetime] = Column(DateTime, nullable=True)
    google_id: Optional[str] = Column(String(255), unique=True, nullable=True)
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
    updated_at: datetime = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] Create migration: `alembic revision --autogenerate -m "Create users table"`
- [ ] Run migration: `alembic upgrade head`
- [ ] Verify table structure

---

### Day 3-4: Authentication System

**Task 3: JWT & Password Handling**
```python
# utils/jwt_handler.py
def create_access_token(user_id: str, expires_delta: timedelta) -> str:
    """Create JWT access token"""
    
def verify_token(token: str) -> dict:
    """Verify and decode JWT"""
    
def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Dependency for protected routes"""

# utils/security.py
def hash_password(password: str) -> str:
    """Hash password with bcrypt"""
    
def verify_password(plain: str, hashed: str) -> bool:
    """Verify password"""
```

- [ ] Implement JWT utilities
- [ ] Implement password hashing/verification
- [ ] Create OAuth2 bearer token dependency
- [ ] Write tests for JWT creation/verification
- [ ] Write tests for password hashing

**Task 4: Email/Password Auth Endpoints**
```python
# routes/auth.py

# POST /api/auth/signup
@router.post("/auth/signup")
def signup(email: str, password: str, password_confirm: str) -> TokenResponse:
    """
    Register new user with email & password
    - Validate email format
    - Validate password strength (min 8 chars, 1 uppercase, 1 number)
    - Check email not already registered
    - Hash password
    - Create user record
    - Send verification email (async)
    - Return JWT token + user_id
    """

# POST /api/auth/login
@router.post("/auth/login")
def login(email: str, password: str) -> TokenResponse:
    """
    Login user with email & password
    - Find user by email
    - Verify password
    - Generate JWT token
    - Return token + user_id
    """

# POST /api/auth/logout
@router.post("/auth/logout")
def logout(current_user: User = Depends(get_current_user)):
    """
    Logout user (frontend should delete JWT)
    """
```

- [ ] Implement /api/auth/signup with validation
- [ ] Implement /api/auth/login
- [ ] Implement /api/auth/logout (simple, frontend handles JWT deletion)
- [ ] Add comprehensive error handling (email exists, wrong password, etc.)
- [ ] Write unit tests for each endpoint

---

### Day 5-6: OAuth Integration (Google)

**Task 5: Google OAuth**
```python
# routes/auth.py

# POST /api/auth/google/callback
@router.post("/auth/google/callback")
def google_callback(id_token: str) -> TokenResponse:
    """
    Handle Google OAuth token
    - Verify Google ID token
    - Extract email, name, picture
    - Check if user exists
      - If yes: Update last_login, return JWT
      - If no: Create user, return JWT
    - Return token + user_id
    """
```

- [ ] Integrate google-auth library
- [ ] Implement Google token verification
- [ ] Create or update user on Google login
- [ ] Return JWT token
- [ ] Test with Google Test Account

---

### Day 7: Email Verification (Non-blocking)

**Task 7: Email Verification Endpoint**
```python
# routes/auth.py

# POST /api/auth/send-verification
@router.post("/auth/send-verification")
def send_verification_email(current_user: User = Depends(get_current_user)):
    """
    Send verification email (available in Settings)
    - Generate verification token
    - Send email with verification link
    - Return success message
    """

# PATCH /api/auth/verify/{token}
@router.patch("/auth/verify/{token}")
def verify_email(token: str) -> dict:
    """
    Verify email with token
    - Decode verification token
    - Find user
    - Mark email_verified = true
    - Set email_verified_at
    - Return success
    """
```

- [ ] Create verification token generation (short-lived, 24 hours)
- [ ] Implement email sending via SendGrid
- [ ] Implement email verification endpoint
- [ ] Store verification token (in JWT or database)
- [ ] Test email delivery

---

### Day 8: CV Upload Endpoint (Prep for Week 3)

**Task 8: CV Upload Foundation**
```python
# models/cv.py
class CV(Base):
    __tablename__ = "cvs"
    
    id: UUID = Column(UUID(as_uuid=True), primary_key=True)
    user_id: UUID = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title: str = Column(String(255), default="My CV")
    json_resume: dict = Column(JSON, default={})  # Will be populated in Week 3
    privacy: str = Column(Enum("private", "public"), default="public")
    parsing_status: str = Column(Enum("pending", "in_progress", "complete", "failed"), default="pending")
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
    updated_at: datetime = Column(DateTime, default=datetime.utcnow)

# routes/cv.py
@router.post("/cv/upload")
def upload_cv(file: UploadFile, current_user: User = Depends(get_current_user)) -> dict:
    """
    Upload CV file (PDF/Word)
    - Validate file type (PDF, DOCX)
    - Validate file size (<10MB)
    - Save to S3
    - Create CV record with parsing_status = "pending"
    - Queue parsing worker (Week 3)
    - Return CV_id + parsing_status
    """
```

- [ ] Create CV model migration
- [ ] Implement file upload validation
- [ ] Implement S3/MinIO storage integration
- [ ] Create CV record in database
- [ ] Return upload confirmation
- [ ] Test file upload

---

### Day 9: Error Handling & Validation

**Task 9: Comprehensive Error Handling**
```python
# utils/errors.py
class CVSmithException(Exception):
    """Base exception"""
    
class InvalidEmailException(CVSmithException):
    """Invalid email format"""
    
class UserAlreadyExistsException(CVSmithException):
    """Email already registered"""
    
class InvalidPasswordException(CVSmithException):
    """Password doesn't meet requirements"""
    
class InvalidTokenException(CVSmithException):
    """JWT token invalid/expired"""

# Main error handler
@app.exception_handler(CVSmithException)
async def exception_handler(request, exc):
    """Return consistent error format"""
    return JSONResponse(
        status_code=400,
        content={"error": str(exc), "type": exc.__class__.__name__}
    )
```

- [ ] Create custom exception classes
- [ ] Implement global exception handler
- [ ] Add validation for all inputs
- [ ] Return consistent error responses
- [ ] Document error codes

---

### Day 10: Testing & Documentation

**Task 10: Unit & Integration Tests**
```python
# tests/test_auth.py
def test_signup_success():
    """Test successful signup"""
    
def test_signup_email_exists():
    """Test signup with existing email"""
    
def test_signup_weak_password():
    """Test signup with weak password"""
    
def test_login_success():
    """Test successful login"""
    
def test_login_wrong_password():
    """Test login with wrong password"""
    
def test_google_login():
    """Test Google OAuth flow"""
    
```

- [ ] Write unit tests for all endpoints
- [ ] Write integration tests (signup → login → protected endpoint)
- [ ] Achieve 80%+ code coverage
- [ ] Test error cases
- [ ] Document API endpoints in Swagger

---

## Frontend Tasks (Week 1-2)

### Day 1-2: Project Setup & Components

**Task 1: Initialize React Project**
- [ ] Create project structure as per setup guide
- [ ] Configure Vite, TypeScript, Tailwind CSS
- [ ] Set up Zustand stores (authStore, cvStore, uiStore)
- [ ] Configure Axios API client
- [ ] Set up routing (React Router)

**Task 2: Create Base Components**
```typescript
// components/Common/Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

// components/Common/Input.tsx
interface InputProps {
  label?: string;
  placeholder?: string;
  type: 'text' | 'email' | 'password';
  error?: string;
  value: string;
  onChange: (value: string) => void;
}
```

- [ ] Create Button component (primary/secondary/ghost variants)
- [ ] Create Input component (text/email/password with error display)
- [ ] Create Header/Navigation component
- [ ] Create Modal/Dialog component
- [ ] Style with Tailwind CSS per design system

---

### Day 3-4: Onboarding Screen

**Task 3: Onboarding Page**
```typescript
// components/Auth/OnboardingScreen.tsx

// Layout:
// 1. Logo + "Welcome to CVSmith"
// 2. CV Upload (drag-drop area)
// 3. "Or" separator
// 4. "Get Started with Email" button
// 5. Social login buttons (Google)
// 6. "Log in" link for existing users

interface OnboardingProps {
  onCVSelect: (file: File) => void;
  onEmailSignup: () => void;
  onGoogleSignup: () => void;
}
```

- [ ] Create CV drag-drop upload area
- [ ] Add visual feedback during drag
- [ ] Create "Get Started with Email" button
- [ ] Create social login buttons (Google)
- [ ] Add styling per design system
- [ ] Implement responsive design

---

### Day 5-6: Auth Modals

**Task 4: Email/Password Signup Modal**
```typescript
// components/Auth/SignupModal.tsx
interface SignupForm {
  email: string;
  password: string;
  passwordConfirm: string;
}

// Features:
// - Email input with validation
// - Password input with strength indicator
// - Confirm password input
// - Submit button
// - Error message display
// - "Log in instead" link
```

- [ ] Create signup form with validation
- [ ] Add password strength indicator
- [ ] Add error message display
- [ ] Implement submit handler
- [ ] Call backend /api/auth/signup
- [ ] Store JWT token in localStorage
- [ ] Redirect to Canvas on success

**Task 5: Email/Password Login Modal**
```typescript
// components/Auth/LoginModal.tsx
interface LoginForm {
  email: string;
  password: string;
}

// Features:
// - Email input
// - Password input
// - Remember me checkbox
// - Submit button
// - Error message display
// - "Sign up instead" link
// - "Forgot password" link
```

- [ ] Create login form
- [ ] Add error message display
- [ ] Implement submit handler
- [ ] Call backend /api/auth/login
- [ ] Store JWT token
- [ ] Redirect to Canvas

---

### Day 7: Social Login Integration

**Task 6: Social Login Buttons & Flow**
```typescript
// components/Auth/SocialLoginButtons.tsx
// - Google button (use @react-oauth/google)

// Flow:
// 1. User clicks Google button
// 2. OAuth popup opens
// 3. User approves
// 4. Receive ID token
// 5. Send to backend /api/auth/google/callback
// 6. Store JWT token
// 7. Redirect to Canvas
```

- [ ] Install OAuth libraries
- [ ] Implement Google login button
- [ ] Handle OAuth callbacks
- [ ] Call backend callback endpoints
- [ ] Store JWT token
- [ ] Redirect to Canvas
- [ ] Test with Google test accounts

---

### Day 8: Auth Store & API Client

**Task 7: Zustand Auth Store**
```typescript
// store/authStore.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => void;
}
```

- [ ] Create Zustand store with auth state
- [ ] Add signup/login/logout actions
- [ ] Add social login actions
- [ ] Persist token to localStorage
- [ ] Load token from localStorage on app start

**Task 8: API Client Setup**
```typescript
// services/api.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
});

// Automatically add JWT to headers
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
    }
    return Promise.reject(error);
  }
);
```

- [ ] Create Axios client with base URL
- [ ] Add JWT token to all requests
- [ ] Handle 401 unauthorized responses
- [ ] Add error handling
- [ ] Create API methods for auth endpoints

---

### Day 9: Navigation & Protected Routes

**Task 9: Routing & Protected Routes**
```typescript
// App.tsx or Router.tsx

const Router = () => {
  const { isLoggedIn } = useAuth();
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/onboarding" element={<OnboardingScreen />} />
      
      {/* Protected routes */}
      {isLoggedIn ? (
        <>
          <Route path="/canvas" element={<Dashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/onboarding" />} />
      )}
    </Routes>
  );
};
```

- [ ] Set up React Router
- [ ] Create protected route component
- [ ] Implement route guards based on auth state
- [ ] Redirect unauthenticated users to onboarding
- [ ] Redirect authenticated users away from onboarding

---

### Day 10: Integration Testing

**Task 10: E2E Tests with Playwright**
```typescript
// tests/auth.spec.ts
test('signup flow', async ({ page }) => {
  await page.goto('/onboarding');
  await page.click('button:has-text("Get Started with Email")');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button:has-text("Create Account")');
  await expect(page).toHaveURL('/canvas');
});
```

- [ ] Set up Playwright for E2E testing
- [ ] Test signup flow
- [ ] Test login flow
- [ ] Test social login
- [ ] Test protected route access
- [ ] Test error handling

---

## Success Criteria (Definition of Done)

### Backend ✅
- [ ] All auth endpoints working (signup, login, logout)
- [ ] JWT token generation & verification working
- [ ] Google OAuth integration tested
- [ ] Password hashing working
- [ ] Email verification endpoint available
- [ ] Error handling for all edge cases
- [ ] Unit tests passing (80%+ coverage)
- [ ] API documentation in Swagger

### Frontend ✅
- [ ] Onboarding screen fully functional
- [ ] Email/password signup modal working
- [ ] Email/password login modal working
- [ ] Social login buttons functional
- [ ] JWT token stored in localStorage
- [ ] Protected routes working
- [ ] Navigation between screens working
- [ ] Error messages displayed correctly
- [ ] Responsive design on mobile/tablet/desktop
- [ ] E2E tests passing

### Integration ✅
- [ ] User can signup → login → access canvas
- [ ] User can login with Google → access canvas
- [ ] JWT token persists across page reloads
- [ ] Protected routes redirect to onboarding when not logged in
- [ ] Logout clears token and redirects to onboarding

---

## Testing Strategy

### Unit Tests
- Auth service (password hashing, token generation)
- API endpoints (validation, error cases)
- Form validation
- State management (Zustand)

### Integration Tests
- Full signup flow (frontend → backend → database)
- Full login flow
- OAuth flows
- Protected route access

### E2E Tests
- User signup journey
- User login journey
- Error scenarios

---

## Deployment Checklist (End of Week 2)

- [ ] Code reviewed and merged to main
- [ ] All tests passing
- [ ] No console errors/warnings
- [ ] API documentation complete
- [ ] Environment variables documented
- [ ] Database migrations tested on fresh database
- [ ] Ready for Week 3 (CV upload & parsing)

---

## Key Files Created/Modified

### Backend
- `app/main.py` - FastAPI app setup
- `app/config.py` - Configuration
- `app/database.py` - Database connection
- `app/models/user.py` - User model
- `app/routes/auth.py` - Auth endpoints
- `app/services/auth_service.py` - Auth business logic
- `app/utils/jwt_handler.py` - JWT utilities
- `app/utils/security.py` - Password hashing
- `migrations/versions/001_create_users_table.py` - Database migration
- `tests/test_auth.py` - Auth tests

### Frontend
- `src/main.tsx` - React entry point
- `src/App.tsx` - Root component
- `src/store/authStore.ts` - Zustand auth store
- `src/services/api.ts` - Axios client
- `src/components/Auth/OnboardingScreen.tsx`
- `src/components/Auth/SignupModal.tsx`
- `src/components/Auth/LoginModal.tsx`
- `src/components/Auth/SocialLoginButtons.tsx`
- `src/components/Common/Button.tsx`
- `src/components/Common/Input.tsx`
- `tests/auth.spec.ts` - E2E tests

---

## Next Steps (Week 3)

Once Week 1-2 is complete:
1. Start Week 3: CV Upload & Parsing
2. Implement file upload validation
3. Integrate text extraction (PyPDF2, python-docx)
4. Set up Celery worker for async parsing
5. Call Claude API for CV structure extraction

---

## Reference Links

- [FastAPI Auth Tutorial](https://fastapi.tiangolo.com/advanced/security/)
- [React Router](https://reactrouter.com/en/main)
- [Zustand Store](https://github.com/pmndrs/zustand)
- [Tailwind CSS](https://tailwindcss.com/)
- [Stripe Documentation](https://stripe.com/docs)
- [Google OAuth](https://developers.google.com/identity/protocols/oauth2)

---

**Status: READY TO IMPLEMENT WEEK 1-2 ✅**
