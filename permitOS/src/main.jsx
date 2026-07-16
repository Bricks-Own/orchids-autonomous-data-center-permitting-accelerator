import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { TooltipProvider } from './components/ui/tooltip'
import { PermitDataProvider } from './context/PermitDataContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <PermitDataProvider>
          <App />
        </PermitDataProvider>
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>,
)
