import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import CallMonitor from './components/CallMonitor';
import Analytics from './components/Analytics';
import KnowledgeBase from './components/KnowledgeBase';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  AI Technical Support Admin
                </h1>
              </div>
            </div>
          </div>
        </nav>
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calls" element={<CallMonitor />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
