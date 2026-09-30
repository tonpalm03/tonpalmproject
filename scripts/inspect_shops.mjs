import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBWZ3AAnjJ_kLyzHlSVRc6MC-mTs-oCK_8",
  authDomain: "tonpalmproject.firebaseapp.com",
  projectId: "tonpalmproject",
  storageBucket: "tonpalmproject.firebasestorage.app",
  messagingSenderId: "854984707571",
  appId: "1:854984707571:web:f68272e0e99545bb6e1686",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  console.log('--- SHOPS ---');
  const shopSnap = await getDocs(collection(db, 'shops'));
  shopSnap.forEach(d => {
    console.log(d.id, '=>', d.data().name, 'owner:', d.data().owner_uid);
  });

  console.log('--- USERS (merchants) ---');
  const userSnap = await getDocs(collection(db, 'users'));
  userSnap.forEach(d => {
    const data = d.data();
    if (data.role === 'merchant' || data.role === 'admin') {
      console.log(d.id, data.display_name, data.role, 'shop_id:', data.shop_id);
    }
  });

  console.log('--- MENU ITEMS COUNT ---');
  const menuSnap = await getDocs(collection(db, 'menu_items'));
  console.log('Total menu items in DB:', menuSnap.size);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
