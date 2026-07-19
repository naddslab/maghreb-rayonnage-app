import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Vault from './pages/Vault'
import ClientsOverview from './pages/ClientsOverview'
import Settings from './pages/Settings'
import AIAssistantPage from './pages/AIAssistantPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/clients" element={<ClientsOverview />} />
      <Route path="/vault/:vaultId" element={<Vault />} />
      <Route path="/assistant" element={<AIAssistantPage />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
