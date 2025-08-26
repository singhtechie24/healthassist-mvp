import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import { ThemeProvider } from './contexts/ThemeContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Mood from './pages/Mood';
import Reminders from './pages/Reminders';
import Emergency from './pages/Emergency';
import Settings from './pages/Settings';
import Tips from './pages/Tips';

function App() {
  return (
    <ThemeProvider>
      <Router>
      <Routes>
        {/* Landing page - no layout */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        
        {/* Protected/Layout pages */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/mood" element={<Mood />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/emergency" element={<Emergency />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/tips" element={<Tips />} />
            </Routes>
          </Layout>
        } />
      </Routes>
      </Router>
      
      {/* Toast notifications container */}
      <Toaster 
        position="top-right"
        gutter={8}
        containerClassName=""
        containerStyle={{}}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </ThemeProvider>
  );
}

export default App
