import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCCxMNtpL_dQQ9uj_9j-IHVFIi0gxQiW38",
  authDomain: "undercity-98ecd.firebaseapp.com",
  projectId: "undercity-98ecd",
  appId: "1:421884365063:web:6bca404ae0097acac55da2",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
