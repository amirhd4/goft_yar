import { useChatStore } from './store/useChatStore';
import Auth from './components/Auth';
import ChatDashboard from './components/ChatDashboard';

function App() {
  const { token } = useChatStore();

  return (
    <div className="font-sans antialiased text-gray-900 h-screen w-full">
      {token ? <ChatDashboard /> : <Auth />}
    </div>
  );
}

export default App;