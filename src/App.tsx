import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import { queryClient } from './lib/queryClient'
import { AppRouter } from './routes/AppRouter'
import { ToastProvider } from './components/ui/Toast'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
