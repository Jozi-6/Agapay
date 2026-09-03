import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = '/api';

async function parseJsonResponse(response) {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    console.error('Received non-JSON API response:', {
      url: response.url,
      status: response.status,
      bodyPreview: rawText.slice(0, 200)
    });
    return null;
  }
}

function getApiErrorMessage(response, data, fallbackMessage) {
  const message = data?.message || data?.error;
  if (message) {
    return message;
  }

  if (response.status === 401) {
    return 'Invalid email or password';
  }

  if (response.status >= 500) {
    return 'Server error. Please try again.';
  }

  if (response.status >= 400) {
    return fallbackMessage;
  }

  return fallbackMessage;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      const response = await fetch(`${API_URL}/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await parseJsonResponse(response);

      if (response.ok && data?.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    let response;

    try {
      response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
    } catch (error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Unable to connect to the AGAPAY server.');
      }
      throw error;
    }

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(getApiErrorMessage(response, data, 'Login failed'));
    }

    if (!data?.user || !data?.token) {
      throw new Error('Server error. Please try again.');
    }

    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const register = async (email, password, name, role) => {
    let response;

    try {
      response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name, role })
      });
    } catch (error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Unable to connect to the AGAPAY server.');
      }
      throw error;
    }

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(getApiErrorMessage(response, data, 'Registration failed'));
    }

    // Registration creates a pending account - user cannot login until approved
    // So we don't set the token or user here
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
