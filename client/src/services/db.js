import { db } from '../config/firebase';
import { doc, setDoc, getDoc, getDocs, addDoc, collection, serverTimestamp } from 'firebase/firestore';

// Check if a user is an admin
export const checkAdminStatus = async (email) => {
  if (!email) return false;
  const adminRef = doc(db, 'admins', email);
  try {
    const adminSnap = await getDoc(adminRef);
    return adminSnap.exists();
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

// Check if user is allowed to login (10 minute cooldown AND 3 times daily limit)
export const checkLoginCooldown = async (email) => {
  if (!email) return { allowed: true };

  // 1. Check if Admin (Admins bypass all checks - Unlimited Login)
  const isAdmin = await checkAdminStatus(email);
  if (isAdmin) return { allowed: true };

  const userRef = doc(db, 'users', email);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();

    // Check 10-minute cooldown
    if (data.latestAccess) {
      const lastLoginTime = data.latestAccess.toDate().getTime();
      const currentTime = new Date().getTime();
      const differenceInMinutes = (currentTime - lastLoginTime) / 1000 / 60;

      if (differenceInMinutes < 10) {
        return {
          allowed: false,
          message: `Cooldown active: Try again in ${Math.ceil(10 - differenceInMinutes)} minutes.`
        };
      }
    }

    // Check Daily Limit (3 times)
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    if (data.loginDate === today) {
      if ((data.dailyLoginCount || 0) >= 3) {
        return {
          allowed: false,
          message: "Daily login limit reached (3/3). Please try again tomorrow."
        };
      }
    }
  }
  return { allowed: true };
};

// Sync user login to DB
export const syncUserToDB = async (userData) => {
  try {
    const isAdmin = await checkAdminStatus(userData.email);

    // Calculate new daily count
    const userRef = doc(db, 'users', userData.email);
    const userSnap = await getDoc(userRef);

    let newCount = 1;
    const today = new Date().toLocaleDateString('en-CA');

    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.loginDate === today) {
        newCount = (data.dailyLoginCount || 0) + 1;
      }
    }

    // 1. ALWAYS update the main 'users' document (User Entity)
    await setDoc(userRef, {
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      latestAccess: serverTimestamp(),
      loginDate: today,
      dailyLoginCount: newCount
    }, { merge: true });

    // 2. LOGGING LOGIC (SEPARATE COLLECTIONS)
    if (isAdmin) {
      // Store in 'admin_logs' if Admin
      const adminLogsRef = collection(db, 'admin_logs');
      await addDoc(adminLogsRef, {
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        lastLogin: serverTimestamp(),
        role: 'admin'
      });
    } else {
      // Store in 'user_logs' if Student/Guest
      const userLogsRef = collection(db, 'user_logs');
      await addDoc(userLogsRef, {
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        lastLogin: serverTimestamp(),
        role: 'student'
      });
    }

  } catch (error) {
    console.error("Error syncing user to DB:", error);
  }
};

// Fetch all login logs (Merge both collections)
export const getAllUsers = async () => {
  try {
    // Fetch both collections in parallel
    const userLogsRef = collection(db, 'user_logs');
    const adminLogsRef = collection(db, 'admin_logs');

    const [userSnap, adminSnap] = await Promise.all([
      getDocs(userLogsRef),
      getDocs(adminLogsRef)
    ]);

    // Map documents to data objects
    const userLogs = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const adminLogs = adminSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Return combined array
    return [...userLogs, ...adminLogs];
  } catch (error) {
    console.error("Error getting logs:", error);
    return [];
  }
};