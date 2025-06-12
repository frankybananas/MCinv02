# Project Checkpoint & Next Steps

**Date:** 2025-06-12

## 1. Project Overview

This project is a Next.js application using TypeScript, Tailwind CSS, and PostCSS, with pnpm as the package manager. The current goal is to implement Firebase phone-based authentication with an admin approval system for new users and basic admin user management capabilities.

## 2. Completed Tasks

*   Initial project setup and dependency detection.
*   Switched to the `hosts` git branch.
*   Successfully scanned and removed all references to "V0" and "Vercel" from the codebase (`README.md`, `package.json`, `app/layout.tsx`).
*   Confirmed project still builds and runs locally after these changes.
*   Outlined a detailed plan for Firebase phone authentication.

## 3. Current Major Task: Firebase Phone Authentication with Admin Approval

The following plan details the steps to integrate Firebase phone authentication:

### Phase 1: Firebase Project & Client-Side Setup (Next.js)

1.  **Firebase Project Configuration:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/).
    *   Create a new project or use an existing one.
    *   Navigate to **Authentication** -> **Sign-in method** tab.
    *   Enable the **Phone** provider.
    *   Under **Authentication** -> **Settings** -> **Authorized domains**, ensure `localhost` is added for development.
    *   Go to **Project settings** (gear icon) -> **Your apps**.
    *   Click the web icon (`</>`) to register your web app.
    *   Copy the `firebaseConfig` object.
    *   **reCAPTCHA Setup:** Configure reCAPTCHA Enterprise API or reCAPTCHA API in Google Cloud Console for your project. Add site key and secret in Firebase Console (Authentication -> Settings -> reCAPTCHA Key). Firebase might auto-provision this.

2.  **Install Firebase SDK:**
    ```bash
    pnpm add firebase
    ```

3.  **Initialize Firebase in Next.js:**
    *   Create `lib/firebase.js` (or `.ts`):
      ```javascript
      // lib/firebase.js
      import { initializeApp, getApps, getApp } from 'firebase/app';
      import { getAuth } from 'firebase/auth';
      // import { getFirestore } from 'firebase/firestore'; // If using Firestore for pending users/roles
      // import { getFunctions } from 'firebase/functions'; // If calling Cloud Functions

      const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_SENDER_ID",
        appId: "YOUR_APP_ID"
        // measurementId is optional
      };

      let app;
      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApp();
      }

      const auth = getAuth(app);
      // const db = getFirestore(app);
      // const functions = getFunctions(app);

      export { auth /*, db, functions */ };
      ```
    *   **Action Required:** Replace placeholder `firebaseConfig` with actual project credentials.

### Phase 2: Phone Authentication UI & Logic (Next.js Component)

1.  **Create `components/PhoneSignIn.js` (or `.tsx`):**
    *   Implement UI for phone number input, OTP input, and reCAPTCHA display.
    *   Use `RecaptchaVerifier` for reCAPTCHA handling.
    *   Use `signInWithPhoneNumber` to send OTP.
    *   Use `confirmationResult.confirm(otp)` to verify OTP and sign in.
    *   After sign-in, fetch the user's ID token and check for custom claims (`approved: true` or `admin: true`) to determine access level or show a "Pending Approval" message.
    *   (Refer to previous detailed response for a more complete code structure for `PhoneSignIn.js`)

### Phase 3: Admin Approval & User Management (Backend with Firebase Admin SDK via Cloud Functions)

1.  **Set up Cloud Functions:**
    *   Install Firebase CLI: `npm install -g firebase-tools`
    *   Login: `firebase login`
    *   Initialize Cloud Functions: `firebase init functions` (choose TypeScript/JavaScript).
    *   In the `functions` directory, install admin SDK: `npm install firebase-admin`.

2.  **Implement Cloud Functions (`functions/index.js` or `functions/src/index.ts`):**
    *   **`setAdmin(data, context)`:** Callable function to grant a user admin privileges (`{admin: true, approved: true }` custom claims). *Security: Ensure only an existing admin can call this.* 
    *   **`approveUser(data, context)`:** Callable function to approve a regular user (`{ approved: true }` custom claim). *Security: Ensure only an admin can call this.* 
    *   **`listAllUsers(data, context)`:** Callable function for admins to list users (paginated) with their current claims and status.
    *   Initialize `admin.initializeApp()` in your functions file.
    *   (Refer to previous detailed response for example Cloud Function implementations).

3.  **Deploy Cloud Functions:**
    ```bash
    firebase deploy --only functions
    ```

### Phase 4: Setting the First Admin User

*   Since `setAdmin` Cloud Function requires an admin caller, the first admin must be set manually.
*   **Recommended Method: One-time Node.js script.**
    *   Create a script (e.g., `scripts/setFirstAdmin.js`) using `firebase-admin` SDK.
    *   Download a service account key JSON file from Firebase Project Settings -> Service Accounts.
    *   The script should take a User UID as an argument and use `admin.auth().setCustomUserClaims(uid, { admin: true, approved: true })`.
    *   **Action Required:** Run this script once with the UID of the intended first admin user. **Keep the service account key secure and do not commit it to Git.**

### Phase 5: Admin Panel (Next.js Frontend)

1.  Create a new section/page in the Next.js app accessible only to users with the `admin: true` custom claim.
2.  This panel should allow admins to:
    *   View a list of users (calling the `listAllUsers` Cloud Function).
    *   Approve pending users (calling the `approveUser` Cloud Function).
    *   Potentially, assign other users as admins (calling the `setAdmin` Cloud Function).

## 4. Next Immediate Steps for Developer

1.  **Firebase Project Setup:** Complete all steps in Phase 1, including obtaining `firebaseConfig` and setting up reCAPTCHA.
2.  **Update `lib/firebase.js`:** Replace placeholder `firebaseConfig` with actual credentials.
3.  **Implement `components/PhoneSignIn.js`:** Build the frontend component for phone authentication flow.
4.  **Set up Firebase Cloud Functions:** Initialize and configure the `functions` directory.
5.  **Implement Cloud Functions:** Write the `setAdmin`, `approveUser`, and `listAllUsers` functions.
6.  **Set First Admin:** Create and run the one-time script to designate the initial admin user.
7.  **Build Admin Panel:** Develop the frontend components for admin user management.
8.  **Testing:** Thoroughly test the entire sign-up, approval, and admin management flow.

## 5. Important Notes & Reminders

*   **Security:** Pay close attention to security rules for Cloud Functions and ensure that sensitive operations like setting admin claims are properly protected.
*   **Service Account Key:** The service account key JSON file for the `setFirstAdmin.js` script is highly sensitive. **DO NOT COMMIT IT TO VERSION CONTROL.** Use it locally and then store it securely or delete it if no longer immediately needed.
*   **Error Handling:** Implement robust error handling on both client and server sides.
*   **User Experience:** Provide clear feedback to users throughout the sign-up and approval process.

This checkpoint should provide a clear path forward. Good luck!
