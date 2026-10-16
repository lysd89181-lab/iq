// ===== إعدادات الربط (عدّل هنا فقط) =====

// مفاتيح Firebase العامة (عادي تكون ظاهرة، الحماية في القواعد والسيرفر)
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD-UBxePNmnAlJJSSIQTRqHieQlQHUVM60',
  authDomain: 'iqplus-a5039.firebaseapp.com',
  projectId: 'iqplus-a5039',
  storageBucket: 'iqplus-a5039.firebasestorage.app',
  messagingSenderId: '464664905054',
  appId: '1:464664905054:web:6f623642493b2c61357bcf',
  measurementId: 'G-YJSK2Z61KG',
};

// رابط السيرفر (Cloudflare Worker) بدون / في الآخر
export const API_BASE = 'https://mithaq-api.sdkhyrallh08.workers.dev';

// المفتاح العام لإشعارات قوقل (Firebase > Project settings > Cloud Messaging > Web Push certificates)
export const VAPID_KEY = 'BLSp5Xbyi7_Ktnjr1i93g3vh00UIsQGeWmf94S1Ju9lxIJkqFDFwJLzi8ifnm8w6KkFJl8Je5fNcV8MKS2jGRqs';

// الصور اللي تتكتب كمسار (مثل uploads/x.webp أو a.jpg) تنفتح من نفس الموقع
export const IMAGE_BASE = new URL('../../', import.meta.url).href;

export const BRAND = { name: 'ميثاق', latin: 'MITHAQ' };
export const FIREBASE_VERSION = '10.12.2';
