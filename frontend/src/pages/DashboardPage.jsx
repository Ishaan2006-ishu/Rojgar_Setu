import { useState } from 'react';
import { ArrowRight, BriefcaseBusiness, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/auth.js';
import { useAuth } from '../auth/useAuth.js';

export function DashboardPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setError('');
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="brand dashboard-brand" to="/dashboard">
          <span className="brand-mark">
            <BriefcaseBusiness size={20} strokeWidth={2.2} />
          </span>
          <span className="brand-name">Rojgar Setu</span>
        </Link>
        <div className="dashboard-actions">
          <span className="dashboard-user">{user.email}</span>
          <button
            className="logout-button"
            disabled={isLoggingOut}
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={16} />
            {isLoggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <section className="dashboard-content">
        <p className="form-eyebrow">Your account</p>
        <h1>Welcome, {user.name}</h1>
        <p className="dashboard-description">
          You’re signed in and ready to connect with your local community.
        </p>
        <ul aria-label="Your account capabilities" className="capability-list">
          {user.capabilities.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
        {error && (
          <div className="form-alert" role="alert">
            <span>{error}</span>
          </div>
        )}
        <article className="dashboard-card">
          <span className="dashboard-card-icon">
            <BriefcaseBusiness size={21} />
          </span>
          <div>
            <h2>Your Rojgar Setu account is ready</h2>
            <p>
              Your signed-in experience is connected to the authentication
              service. More opportunities and tools will appear here as they
              become available.
            </p>
          </div>
          <ArrowRight aria-hidden="true" size={18} />
        </article>
      </section>
    </main>
  );
}
