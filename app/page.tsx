import MainPage from './components/main-page';

export default function Page() {
  // Remove server-side authentication check to eliminate server delay
  // Authentication will be handled client-side in MainPage component
  return <MainPage initialIsAuthenticated={false} userRole={null} />;
}
