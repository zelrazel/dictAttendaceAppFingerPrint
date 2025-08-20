# Profile Picture Upload Sample (Cloudinary)

## Setup

1. Install dependencies globally:
   ```
   npm install
   ```
2. **IMPORTANT: Update the `.env` file with your own credentials!**
   - **The credentials below are mine, so change them using your own MongoDB account, Render account, and Cloudinary account.**
   - You can find the `.env` file in the `backend` folder. Replace the placeholder credential values with your own:
   ```
   MONGO_URI=your_mongodb_connection_string
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   JWT_SECRET=your_jwt_secret
   ```
   - For the frontend, update the API URL in `frontend/frontend-expo/constants/apiUrl.ts`:
   ```
   export const API_URL = 'https://your-render-server-url.com';
   ```
   - **Never commit your real credentials to public repositories.**

3. Install dependencies for both backend and frontend:
   ```
   cd backend
   npm install
   cd ../frontend/frontend-expo
   npm install
   ```

4. Open new terminal and Start the backend server:
   ```
   cd backend
   npm start
   ```

5. Open new terminal and Start the frontend app:
   ```
   cd frontend/frontend-expo
   npm start
   ```
   - After running `npm start`, scan the QR code shown in your terminal or browser using the **Expo Go** app on your mobile device.
   - If you don't have Expo Go, install it from the [Google Play Store] or [Apple App Store].
   - **Make sure your phone and PC are connected to the same Wi-Fi network.**
   - And also temporarily disable your PC's firewall (such as Windows Defender Firewall) to allow your phone to access the development server.

# Profile Picture Upload Sample (Cloudinary)

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. **IMPORTANT: Update the `.env` file with your own credentials!**
   - **The credentials below are mine, so change them using your own MongoDB account, Render account, and Cloudinary account.**
   - You can find the `.env` file in the `backend` folder. Replace the placeholder credential values with your own:
   ```
   MONGO_URI=your_mongodb_connection_string
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   JWT_SECRET=your_jwt_secret
   ```
   - For the frontend, update the API URL in `frontend/frontend-expo/constants/apiUrl.ts`:
   ```
   export const API_URL = 'https://your-render-server-url.com';
   ```
   - **Never commit your real credentials to public repositories.**

3. Install dependencies for both backend and frontend:
   ```
   cd backend
   npm install
   cd ../frontend/frontend-expo
   npm install
   ```

4. Start the backend server:
   ```
   cd backend
   npm start
   ```

5. Start the frontend app:
   ```
   cd frontend/frontend-expo
   npm start
   ```
   - After running `npm start`, scan the QR code shown in your terminal or browser using the **Expo Go** app on your mobile device.
   - If you don't have Expo Go, install it from the [Google Play Store] or [Apple App Store].
   - **Make sure your phone and PC are connected to the same Wi-Fi network.**
   - And also temporarily disable your PC's firewall (such as Windows Defender Firewall) to allow your phone to access the development server.

