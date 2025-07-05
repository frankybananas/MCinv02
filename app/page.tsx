import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import MainPage from './components/main-page';

export default async function Page() {
  let isAuthenticated = false;

  try {
    const cookieStore = await cookies(); // Await the cookies() function
    const token = cookieStore.get('session_token')?.value;

    if (token) {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined in environment variables.');
      }
      jwt.verify(token, jwtSecret);
      isAuthenticated = true;
    }
  } catch (error) {
    console.error('[SERVER] JWT Verification Error:', error);
    isAuthenticated = false;
  }

  return <MainPage initialIsAuthenticated={isAuthenticated} />;
}
