import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Segments from './pages/Segments';
import Campaigns from './pages/Campaigns';
import NewCampaign from './pages/NewCampaign';
import CampaignDetail from './pages/CampaignDetail';
import Analytics from './pages/Analytics';

import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <div className="mesh-bg"></div>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Layout title="Dashboard"><Dashboard /></Layout>} />
        <Route path="/customers" element={<Layout title="Customers"><Customers /></Layout>} />
        <Route path="/segments" element={<Layout title="Audience Segments"><Segments /></Layout>} />
        <Route path="/campaigns" element={<Layout title="Campaigns"><Campaigns /></Layout>} />
        <Route path="/analytics" element={<Layout title="Analytics"><Analytics /></Layout>} />
        <Route path="/campaigns/new" element={<Layout title="Launch Campaign"><NewCampaign /></Layout>} />
        <Route path="/campaigns/:id" element={<Layout title="Campaign Details"><CampaignDetail /></Layout>} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
