# Firebase Phone Authentication: Detailed Roll-Out Plan

**Objective:** Implement Firebase Phone Authentication with an admin approval system. This document is the single source of truth for this task.

---

## Stage 1: Firebase & Google Cloud Project Setup

This stage ensures your backend is correctly configured to support phone authentication.

### Step 1.1: Verify Firebase Project Setup

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your project.
3.  In the left-hand menu, click **Build** > **Authentication**.
4.  Go to the **Sign-in method** tab.
5.  **Check:** Ensure the **Phone** provider is **Enabled**. If not, enable it.

### Step 1.2: Verify Authorized Domains

1.  In the **Authentication** > **Settings** tab, scroll down to **Authorized domains**.
2.  **Check:** Ensure `localhost` is listed. If not, click **Add domain** and add it. This is crucial for local testing.

### Step 1.3: Verify reCAPTCHA Configuration

Firebase Phone Auth for web requires reCAPTCHA to prevent abuse. You mentioned you've already done some setup here. Let's verify it.

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Make sure you have the correct project selected (it should have the same name as your Firebase project).
3.  In the search bar, type and navigate to **APIs & Services**.
4.  Click on **Enabled APIs & services**.
5.  **Check:** Look for **reCAPTCHA Enterprise API** or a similar reCAPTCHA API in the list. If it's there, it's likely enabled.
6.  **Check Firebase Link:** In the Firebase Console, under **Authentication** > **Settings** > **reCAPTCHA Key**, see if your web app's reCAPTCHA keys are listed. If Firebase auto-provisioned them, you should see them here. If not, you may need to manually create a reCAPTCHA v2 key in the Google Cloud Console and add the Site Key and Secret Key here.

### Step 1.4: Get Firebase Configuration for Your App

1.  In the Firebase Console, go to **Project Overview** (top of the left menu).
2.  Click the **Project settings** gear icon.
3.  Under the **General** tab, scroll down to **Your apps**.
4.  Select your web app.
5.  In the **Firebase SDK snippet** section, select **Config**.
6.  **Action:** Copy the `firebaseConfig` object. You will need this in Stage 2.

---

## Stage 2: Next.js Project Integration

This stage connects your frontend application to Firebase.

### Step 2.1: Install Firebase SDK

1.  Open your terminal in the project root (`c:\LLM\mcinv02\v0-new-project`).
2.  Run the following command:
    ```bash
    pnpm add firebase
    ```

### Step 2.2: Create Firebase Initialization File

1.  Create a new folder `lib` in your project's root if it doesn't exist.
2.  Inside `lib`, create a new file named `firebase.ts`.
3.  **Action:** Add the following code to `lib/firebase.ts`, pasting your `firebaseConfig` object from Step 1.4.

    ```typescript
    // lib/firebase.ts
    import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
    import { getAuth, Auth } from 'firebase/auth';

    const firebaseConfig = {
      // PASTE YOUR COPIED CONFIG OBJECT HERE
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };

    // Initialize Firebase for SSR
    let app: FirebaseApp;
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }

    const auth: Auth = getAuth(app);

    export { auth };
    ```

---

## Stage 3: Frontend UI and Logic

This stage builds the user-facing sign-in component.

### Step 3.1: Create the Phone Sign-In Component

1.  In your `components` folder, create a new file named `PhoneSignIn.tsx`.
2.  **Action:** Add the following code. This component handles the entire phone auth flow.

    ```tsx
    // components/PhoneSignIn.tsx
    'use client'; // This is a client component

    import { useState, useEffect, useRef } from 'react';
    import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, User } from 'firebase/auth';
    import { auth } from '../lib/firebase';

    const PhoneSignIn = () => {
      const [phoneNumber, setPhoneNumber] = useState('');
      const [otp, setOtp] = useState('');
      const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
      const [user, setUser] = useState<User | null>(null);
      const [error, setError] = useState('');
      const [info, setInfo] = useState('');

      // Ref for the reCAPTCHA container to avoid re-rendering issues
      const recaptchaContainerRef = useRef<HTMLDivElement>(null);

      // Set up reCAPTCHA verifier
      useEffect(() => {
        if (!window.recaptchaVerifier && recaptchaContainerRef.current) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
            'size': 'invisible',
            'callback': () => {
              // reCAPTCHA solved, allow signInWithPhoneNumber.
              setInfo('reCAPTCHA resolved, ready to send OTP.');
            },
            'expired-callback': () => {
              setError('reCAPTCHA expired. Please try again.');
            }
          });
        }
      }, []);

      const handleSendOtp = async () => {
        setError('');
        setInfo('Sending OTP...');
        if (!window.recaptchaVerifier) {
          setError('reCAPTCHA not initialized.');
          return;
        }
        try {
          // The '+' is important for international formatting
          const formattedPhoneNumber = `+${phoneNumber.replace(/[^0-9]/g, '')}`;
          const result = await signInWithPhoneNumber(auth, formattedPhoneNumber, window.recaptchaVerifier);
          setConfirmationResult(result);
          setInfo('OTP has been sent to your phone.');
        } catch (err: any) {
          setError(`Error sending OTP: ${err.message}`);
          setInfo('');
        }
      };

      const handleVerifyOtp = async () => {
        setError('');
        setInfo('Verifying OTP...');
        if (!confirmationResult) {
          setError('Please request an OTP first.');
          return;
        }
        try {
          const userCredential = await confirmationResult.confirm(otp);
          setUser(userCredential.user);
          setInfo('Sign-in successful!');
          // TODO: Check for admin approval here
        } catch (err: any) {
          setError(`Error verifying OTP: ${err.message}`);
          setInfo('');
        }
      };

      if (user) {
        return (
          <div>
            <h2>Welcome!</h2>
            <p>Signed in as: {user.phoneNumber}</p>
            <p>Status: <span style={{color: 'orange'}}>Pending Admin Approval</span></p>
            <button onClick={() => auth.signOut()}>Sign Out</button>
          </div>
        );
      }

      return (
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', maxWidth: '400px' }}>
          <h2>Dealership Log In</h2>
          {!confirmationResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label htmlFor="phone">Phone Number (with country code):</label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g., 11234567890"
                style={{ padding: '8px' }}
              />
              <button onClick={handleSendOtp} style={{ padding: '10px', cursor: 'pointer' }}>Send OTP</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label htmlFor="otp">Enter 6-Digit Code:</label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP"
                style={{ padding: '8px' }}
              />
              <button onClick={handleVerifyOtp} style={{ padding: '10px', cursor: 'pointer' }}>Verify & Sign In</button>
            </div>
          )}
          {/* This div is essential for the invisible reCAPTCHA */}
          <div ref={recaptchaContainerRef}></div>
          {info && <p style={{ color: 'green', marginTop: '10px' }}>{info}</p>}
          {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        </div>
      );
    };

    export default PhoneSignIn;
    ```

### Step 3.2: Add the Component to a Page

1.  **Action:** Open a page where you want the login form to appear, for example, `app/page.tsx`.
2.  Import and add the component.

    ```tsx
    // app/page.tsx
    import PhoneSignIn from '../components/PhoneSignIn';

    export default function HomePage() {
      return (
        <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <PhoneSignIn />
        </main>
      );
    }
    ```

---

## Stage 4: Local Testing

This stage verifies that the entire flow works in your local development environment.

### Step 4.1: Start the Development Server

1.  In your terminal, run:
    ```bash
    pnpm run dev
    ```

### Step 4.2: Test the Sign-In Flow

1.  Open your browser to `http://localhost:3000`.
2.  You should see the "Dealership Log In" form.
3.  Enter a real phone number that can receive SMS messages.
    *   **Note:** You may need to add this phone number as a test number in the Firebase Console (Authentication > Settings > Phone number sign-in) to avoid SMS charges during development, depending on your project settings.
4.  Click **Send OTP**. The invisible reCAPTCHA should trigger.
5.  You should receive an SMS with a 6-digit code.
6.  The UI should now show the OTP input field.
7.  Enter the code and click **Verify & Sign In**.
8.  If successful, you should see the "Welcome!" message with the user's phone number.

**If you encounter errors, check the browser's developer console and the terminal for specific error messages.**

---

## Stage 5: Admin Approval System (Backend)

This stage implements the logic for approving new users.

### Step 5.1: Set up Firebase Cloud Functions

1.  Install the Firebase CLI globally if you haven't already:
    ```bash
    npm install -g firebase-tools
    ```
2.  Log in to Firebase:
    ```bash
    firebase login
    ```
3.  In your project's root directory (`c:\LLM\mcinv02\v0-new-project`), initialize Cloud Functions:
    ```bash
    firebase init functions
    ```
4.  Follow the prompts: Use an existing project, choose TypeScript, and say yes to installing dependencies.
5.  This creates a `functions` directory. Navigate into it:
    ```bash
    cd functions
    ```
6.  Install the Admin SDK:
    ```bash
    npm install firebase-admin
    ```

### Step 5.2: Write the Cloud Functions

1.  **Action:** Open `functions/src/index.ts` and replace its content with the following:

    ```typescript
    // functions/src/index.ts
    import * as functions from "firebase-functions";
    import * as admin from "firebase-admin";

    admin.initializeApp();

    // Function to set a user as an admin. MUST be called securely.
    export const setAdmin = functions.https.onCall(async (data, context) => {
      if (!context.auth?.token?.admin) {
        throw new functions.https.HttpsError("permission-denied", "Caller must be an admin.");
      }
      const { uid } = data;
      await admin.auth().setCustomUserClaims(uid, { admin: true, approved: true });
      return { message: `Success! User ${uid} is now an admin.` };
    });

    // Function for an admin to approve a regular user.
    export const approveUser = functions.https.onCall(async (data, context) => {
      if (!context.auth?.token?.admin) {
        throw new functions.https.HttpsError("permission-denied", "Caller must be an admin.");
      }
      const { uid } = data;
      await admin.auth().setCustomUserClaims(uid, { approved: true });
      return { message: `Success! User ${uid} has been approved.` };
    });

    // Function for an admin to list all users.
    export const listUsers = functions.https.onCall(async (data, context) => {
      if (!context.auth?.token?.admin) {
        throw new functions.https.HttpsError("permission-denied", "Caller must be an admin.");
      }
      const listUsersResult = await admin.auth().listUsers(1000);
      return listUsersResult.users.map((user) => ({
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        customClaims: user.customClaims,
        disabled: user.disabled,
      }));
    });
    ```

### Step 5.3: Deploy the Functions

1.  From the `functions` directory, deploy your functions:
    ```bash
    firebase deploy --only functions
    ```

### Step 5.4: Set the First Admin

This is a critical, one-time manual step.

1.  Sign in to your app with your own phone number using the flow from Stage 4.
2.  Go to the Firebase Console > Authentication > Users tab. Find your account and copy your **User UID**.
3.  Create a temporary script file in your project root, e.g., `temp-set-admin.js`.
4.  Download a service account key: Go to Firebase Console > Project settings > Service accounts > Generate new private key. Save this file (e.g., as `service-account.json`) in your project root.
5.  **Action:** Add this code to `temp-set-admin.js`:

    ```javascript
    const admin = require('firebase-admin');
    const serviceAccount = require('./service-account.json');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const uid = 'PASTE_YOUR_UID_HERE'; // <-- IMPORTANT

    admin.auth().setCustomUserClaims(uid, { admin: true, approved: true })
      .then(() => {
        console.log('Successfully set admin claims.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
      });
    ```
6.  **Action:** Run the script from your project root:
    ```bash
    node temp-set-admin.js
    ```
7.  **CRITICAL:** Delete `temp-set-admin.js` and `service-account.json`. **Do not commit these files to Git.**

---

## Stage 6: Admin Panel (Frontend)

This stage builds the UI for admins to manage users.

*This stage can be built out after confirming the previous stages work. It will involve creating a new page (e.g., `/admin`) that is protected and only visible to users with the `admin: true` claim. This page will call the Cloud Functions from Stage 5 to list and approve users.*

**This concludes the core rollout plan. Follow these stages sequentially to get the system working.**
