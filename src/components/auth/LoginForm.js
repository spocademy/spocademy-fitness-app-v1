// src/components/auth/LoginForm.js
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './LoginForm.css';

const LoginForm = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('mr'); // Marathi default
  const { login } = useAuth();

  const text = {
    en: {
      welcome: 'Welcome',
      subtitle: 'Your personal fitness coach',
      phone: 'Phone Number',
      password: 'Password',
      login: 'Login',
      help: 'Need help? Contact us',
      invalidPhone: 'Please enter a valid 10-digit phone number',
      invalidCredentials: 'Invalid phone number or password',
      loggingIn: 'Logging in...',
      required: 'This field is required',
      accountInactive: 'Your account is inactive. Please contact support.'
    },
    mr: {
      welcome: 'स्वागत',
      subtitle: 'तुमचा वैयक्तिक फिटनेस प्रशिक्षक',
      phone: 'फोन नंबर',
      password: 'पासवर्ड',
      login: 'लॉगिन',
      help: 'मदत हवी आहे? आमच्याशी संपर्क साधा',
      invalidPhone: 'कृपया वैध 10-अंकी फोन नंबर टाका',
      invalidCredentials: 'चुकीचा फोन नंबर किंवा पासवर्ड',
      loggingIn: 'लॉगिन करत आहे...',
      required: 'हे फील्ड आवश्यक आहे',
      accountInactive: 'तुमचे खाते निष्क्रिय आहे. कृपया सपोर्टशी संपर्क साधा.'
    }
  };

  const t = text[language];

  // Form validation
  const validateForm = () => {
    if (!phone.trim()) {
      setError(t.required + ' - ' + t.phone);
      return false;
    }
    
    if (phone.length !== 10) {
      setError(t.invalidPhone);
      return false;
    }

    if (!password.trim()) {
      setError(t.required + ' - ' + t.password);
      return false;
    }

    if (password.length < 6) {
      setError(language === 'en' ? 'Password must be at least 6 characters' : 'पासवर्ड किमान 6 अक्षरांचा असावा');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await login(phone, password);
    } catch (error) {
      console.error('Login error:', error);
      
      if (error.message === 'ACCOUNT_INACTIVE') {
        setError(t.accountInactive);
      } else {
        setError(t.invalidCredentials);
      }
    }
    
    setLoading(false);
  };

  // WhatsApp click handler
  const handleWhatsAppClick = () => {
    const message = language === 'en' 
      ? 'Hi, I need help with Spocademy login'
      : 'नमस्कार, मला Spocademy लॉगिनसाठी मदत हवी';
    
    const whatsappUrl = `https://wa.me/919359246193?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="login-container">
      {/* Language toggle - floating top right */}
      <button 
        className="lang-toggle-floating"
        onClick={() => setLanguage(language === 'en' ? 'mr' : 'en')}
        type="button"
      >
        {language === 'en' ? 'मराठी' : 'EN'}
      </button>

      <div className="login-form">
        <div className="brand-logo">
          {/* Logo with white circle background */}
          <div className="logo-container">
            <img src="/logo.png" alt="Spocademy Logo" className="logo-image" />
          </div>
          <h1>{t.welcome}</h1>
          <p>{t.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="phone">{t.phone}</label>
            <input
              id="phone"
              type="tel"
              placeholder="9876543210"
              value={phone}
              onChange={(e) => {
                setError(''); // Clear error on input change
                setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
              }}
              disabled={loading}
              required
              autoComplete="tel"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t.password}</label>
            <input
              id="password"
              type="password"
              placeholder={t.password}
              value={password}
              onChange={(e) => {
                setError(''); // Clear error on input change
                setPassword(e.target.value);
              }}
              disabled={loading}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading || !phone || !password}>
            {loading ? t.loggingIn : t.login}
          </button>
        </form>

        <div className="help-text">
          <p>{t.help}</p>
        </div>
      </div>

      <div className="whatsapp-float" onClick={handleWhatsAppClick} title="Contact Support">
        💬
      </div>
    </div>
  );
};

export default LoginForm;