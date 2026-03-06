import { HashRouter } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AppRoutes } from './router/routes';

function App() {
  return (
    <HashRouter>
      <Toaster position="top-right" />
      <AppRoutes />
    </HashRouter>
  );
}

export default App;