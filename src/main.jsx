import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './lib/toast.jsx'
import StagingGate from './components/StagingGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <StagingGate>
          <App />
        </StagingGate>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
