import { useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi, getApiErrorMessage } from '../api/auth.js';
import { useAuth } from '../auth/useAuth.js';

function Brand({ className = '' }) {
  return (
    <Link className={`brand ${className}`} to="/" aria-label="Rojgar Setu home">
      <span className="brand-mark">
        <BriefcaseBusiness size={21} strokeWidth={2.2} />
      </span>
      <span className="brand-name">Rojgar Setu</span>
    </Link>
  );
}

function AuthShell({ children, eyebrow, headline, description }) {
  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Brand />
        <div className="aside-copy">
          <p className="aside-eyebrow">{eyebrow}</p>
          <h1>
            Good work.
            <br />
            <span>Closer to home.</span>
          </h1>
          <p className="aside-description">{description}</p>
        </div>
        <div className="aside-note">
          <MapPin size={16} aria-hidden="true" />
          <span>Local opportunities. Real connections.</span>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <p className="form-eyebrow">{eyebrow}</p>
          <h2>{headline}</h2>
          {children}
        </div>
      </section>
    </main>
  );
}

function TextField({
  autoComplete,
  icon: Icon,
  label,
  name,
  onChange,
  placeholder,
  required = true,
  type = 'text',
  value,
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="field">
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <span className="field-control">
        <Icon size={17} aria-hidden="true" />
        <input
          autoComplete={autoComplete}
          id={name}
          name={name}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          type={isPassword && visible ? 'text' : type}
          value={value}
        />
        {isPassword && (
          <button
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="password-toggle"
            onClick={() => setVisible((current) => !current)}
            type="button"
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </span>
    </div>
  );
}

function FormAlert({ children, success = false }) {
  return (
    <div
      className={`form-alert${success ? ' success' : ''}`}
      role={success ? 'status' : 'alert'}
    >
      {success ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
      <span>{children}</span>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: location.state?.email ?? '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(form);
      const requestedPath = location.state?.from?.pathname;
      navigate(
        requestedPath?.startsWith('/') ? requestedPath : '/dashboard',
        { replace: true },
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      description="Find dependable work or the right local talent, all in one place built for your community."
      eyebrow="Welcome back"
      headline="Sign in to your account"
    >
      <p className="form-intro">
        Pick up where you left off and see what’s waiting for you.
      </p>
      {location.state?.message && (
        <FormAlert success>{location.state.message}</FormAlert>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <TextField
          autoComplete="email"
          icon={Mail}
          label="Email address"
          name="email"
          onChange={(event) =>
            setForm((current) => ({ ...current, email: event.target.value }))
          }
          placeholder="you@example.com"
          type="email"
          value={form.email}
        />
        <TextField
          autoComplete="current-password"
          icon={LockKeyhole}
          label="Password"
          name="password"
          onChange={(event) =>
            setForm((current) => ({ ...current, password: event.target.value }))
          }
          placeholder="Enter your password"
          type="password"
          value={form.password}
        />
        {error && <FormAlert>{error}</FormAlert>}
        <button className="submit-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
          {!isSubmitting && <ArrowRight size={17} />}
        </button>
      </form>
      <p className="auth-switch">
        New to Rojgar Setu? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    capabilities: ['worker'],
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleCapability(capability) {
    setForm((current) => ({
      ...current,
      capabilities: current.capabilities.includes(capability)
        ? current.capabilities.filter((item) => item !== capability)
        : [...current.capabilities, capability],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (form.capabilities.length === 0) {
      setError('Choose at least one account type to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.register(form);
      navigate('/login', {
        replace: true,
        state: {
          email: form.email,
          message: 'Your account is ready. Sign in to get started.',
        },
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      description="Create one account for the work you need and the opportunities you want to find."
      eyebrow="A better way to connect"
      headline="Create your account"
    >
      <p className="form-intro">
        Join your local network of workers and employers.
      </p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <TextField
          autoComplete="name"
          icon={UserRound}
          label="Full name"
          name="name"
          onChange={updateField}
          placeholder="Your name"
          value={form.name}
        />
        <TextField
          autoComplete="email"
          icon={Mail}
          label="Email address"
          name="email"
          onChange={updateField}
          placeholder="you@example.com"
          type="email"
          value={form.email}
        />
        <TextField
          autoComplete="new-password"
          icon={LockKeyhole}
          label="Password"
          name="password"
          onChange={updateField}
          placeholder="At least 8 characters"
          type="password"
          value={form.password}
        />
        <p className="capability-heading">I want to join as</p>
        <div className="capability-options">
          {[
            ['worker', 'Find work'],
            ['employer', 'Hire locally'],
          ].map(([capability, label]) => (
            <label className="capability-option" key={capability}>
              <input
                checked={form.capabilities.includes(capability)}
                onChange={() => toggleCapability(capability)}
                type="checkbox"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <button className="submit-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Creating account…' : 'Create account'}
          {!isSubmitting && <ArrowRight size={17} />}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
