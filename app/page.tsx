import { cookies } from 'next/headers';
import MainPage from './components/main-page';
import { jwtVerify } from 'jose';

async function getUserRole(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not found');
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.role as string;
  } catch (e) {
    // Token is invalid or expired
    return null;
  }
}

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  const isAuthenticated = !!token;
  const userRole = await getUserRole(token);

  return <MainPage initialIsAuthenticated={isAuthenticated} userRole={userRole} />;
}
