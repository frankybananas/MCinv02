import { cookies } from 'next/headers';
import MainPage from './components/main-page';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;

  // The middleware handles JWT verification. We just check for the token's 
  // presence to determine the initial authenticated state for the client component.
  const isAuthenticated = !!token;

  return <MainPage initialIsAuthenticated={isAuthenticated} />;
}
