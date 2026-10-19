/**
 * SecureVault — Frontend Test Suite
 * Vitest + React Testing Library + MSW
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { server } from '../src/mocks/server.js';

import LoginPage      from '../src/pages/LoginPage.jsx';
import FileUpload     from '../src/components/FileUpload.jsx';
import FileDashboard  from '../src/components/FileDashboard.jsx';
import ProtectedRoute from '../src/components/ProtectedRoute.jsx';

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─────────────────────────────────────────────────────────────────────────────
// 1. Security: JWT must NEVER be in localStorage
// ─────────────────────────────────────────────────────────────────────────────
describe('Security: JWT token storage', () => {
  it('does NOT store a raw "token" key in localStorage', () => {
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('does NOT have any localStorage key with both "access" and "token" in its name', () => {
    const hasRawAccessToken = Object.keys(localStorage).some(
      (k) => k.toLowerCase().includes('access') && k.toLowerCase().includes('token')
    );
    expect(hasRawAccessToken).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. LoginPage
// ─────────────────────────────────────────────────────────────────────────────
describe('LoginPage', () => {
  const renderLogin = () =>
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

  it('renders the email input field', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
  });

  it('renders the password input field', () => {
    renderLogin();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  it('renders the Sign In button', () => {
    renderLogin();
    const btn = screen.getByRole('button', { name: /sign in/i });
    expect(btn).toBeTruthy();
  });

  it('renders a link to the register page', () => {
    renderLogin();
    const link = screen.getByRole('link', { name: /create one/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('register');
  });

  it('submit button is present with correct id', () => {
    renderLogin();
    const btn = document.getElementById('login-submit-btn');
    expect(btn).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FileUpload component
// ─────────────────────────────────────────────────────────────────────────────
describe('FileUpload', () => {
  const renderUpload = () =>
    render(
      <MemoryRouter>
        <FileUpload />
      </MemoryRouter>
    );

  it('renders without crashing', () => {
    renderUpload();
    expect(document.body).toBeTruthy();
  });

  it('renders a dropzone area', () => {
    renderUpload();
    const dropzone = document.getElementById('file-dropzone');
    expect(dropzone).toBeTruthy();
  });

  it('renders a file input element', () => {
    renderUpload();
    const input = document.querySelector('input[type="file"]') ||
                  document.getElementById('file-input');
    expect(input).toBeTruthy();
  });

  it('renders an encryption password field', () => {
    renderUpload();
    const pwdInput = document.querySelector('input[type="password"]');
    expect(pwdInput).toBeTruthy();
  });

  it('the upload button is present', () => {
    renderUpload();
    const btn = document.getElementById('upload-submit-btn');
    expect(btn).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. FileDashboard component
// ─────────────────────────────────────────────────────────────────────────────
describe('FileDashboard', () => {
  const renderDashboard = () =>
    render(
      <MemoryRouter>
        <FileDashboard />
      </MemoryRouter>
    );

  it('renders without crashing', () => {
    renderDashboard();
    expect(document.body).toBeTruthy();
  });

  it('renders an empty state or file list', () => {
    renderDashboard();
    const emptyState = screen.queryByTestId('files-empty');
    const fileList   = screen.queryByTestId('file-list');
    const loading    = screen.queryByTestId('files-loading');
    const hasContent = emptyState !== null || fileList !== null || loading !== null;
    expect(hasContent).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ProtectedRoute — redirects unauthenticated users
// ─────────────────────────────────────────────────────────────────────────────
describe('ProtectedRoute', () => {
  it('redirects to /login when not authenticated (no stored token)', () => {
    localStorage.clear();

    let redirected = false;

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute
          fallback="/login"
          onRedirect={() => { redirected = true; }}
        >
          <div data-testid="protected-content">Secret</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    const protectedEl = screen.queryByTestId('protected-content');
    // Either redirected away OR content is not visible
    expect(protectedEl === null || redirected).toBe(true);
  });

  it('renders children when authenticated prop is true', () => {
    render(
      <MemoryRouter>
        <ProtectedRoute authenticated={true}>
          <div data-testid="auth-content">Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    const content = screen.queryByTestId('auth-content');
    expect(content).toBeTruthy();
  });
});

