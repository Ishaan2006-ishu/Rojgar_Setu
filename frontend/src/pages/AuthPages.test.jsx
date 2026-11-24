import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/auth-context.js';
import { LoginPage, RegisterPage } from './AuthPages.jsx';

function renderAuthPage(component) {
  return render(
    <AuthContext.Provider
      value={{
        status: 'unauthenticated',
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
      }}
    >
      <MemoryRouter>{component}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('authentication pages', () => {
  it('renders the login form with email and password fields', () => {
    renderAuthPage(<LoginPage />);

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders the registration form and account capabilities', () => {
    renderAuthPage(<RegisterPage />);

    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Find work')).toBeChecked();
    expect(screen.getByLabelText('Hire locally')).not.toBeChecked();
  });
});
