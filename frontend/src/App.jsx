import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Validate token on app load
    if (token) {
      axios.get('http://localhost:5000/api/auth/validate', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(() => setIsLoaded(true))
        .catch(() => {
          // Token is invalid, remove it
          localStorage.removeItem('token');
          setToken(null);
          setIsLoaded(true);
        });
    } else {
      setIsLoaded(true);
    }
  }, [token]);

  const handleSetToken = (t) => {
    if (!t) return;
    setToken(t);
    localStorage.setItem('token', t);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <Router>
      <div className={`app ${isLoaded ? 'loaded' : ''}`}>
        <Routes>
          <Route
            path="/login"
            element={
              token ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <div className="auth-shell">
                  <Login setToken={handleSetToken} />
                </div>
              )
            }
          />
          <Route
            path="/register"
            element={
              token ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <div className="auth-shell">
                  <Register setToken={handleSetToken} />
                </div>
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              token ? (
                <Dashboard token={token} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
