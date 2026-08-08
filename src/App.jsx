import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AdminProvider } from './context/AdminContext'
import Header from './components/Header'
import AdminPinModal from './components/AdminPinModal'
import Dashboard from './pages/Dashboard'
import Cycles from './pages/Cycles'
import Assignments from './pages/Assignments'
import Resources from './pages/Resources'
import Calendar from './pages/Calendar'

export default function App() {
  return (
    <AdminProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <Header />
          <AdminPinModal />
          <main className="mx-auto max-w-6xl px-4 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/cycles" element={<Cycles />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/calendar" element={<Calendar />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AdminProvider>
  )
}
