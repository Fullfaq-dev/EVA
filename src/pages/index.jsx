import Layout from "./Layout.jsx";

import Analysis from "./Analysis";

import Dashboard from "./Dashboard";

import FoodDiary from "./FoodDiary";

import Home from "./Home";

import Onboarding from "./Onboarding";

import Profile from "./Profile";

import Stats from "./Stats";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Analysis: Analysis,
    
    Dashboard: Dashboard,
    
    FoodDiary: FoodDiary,
    
    Home: Home,
    
    Onboarding: Onboarding,
    
    Profile: Profile,
    
    Stats: Stats,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    // Если пустой URL (корневой путь), возвращаем Home
    if (!urlLastPart) {
        return 'Home';
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || 'Home';
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>
                
                    <Route path="/" element={<Home />} />
                
                
                <Route path="/analysis" element={<Analysis />} />
                
                <Route path="/dashboard" element={<Dashboard />} />
                
                <Route path="/fooddiary" element={<FoodDiary />} />
                
                <Route path="/home" element={<Home />} />
                
                <Route path="/onboarding" element={<Onboarding />} />
                
                <Route path="/profile" element={<Profile />} />
                
                <Route path="/stats" element={<Stats />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}