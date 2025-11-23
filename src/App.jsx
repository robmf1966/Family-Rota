import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// These imports are needed for the component structure, but we will mock the initialization
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDoc, setLogLevel, query } from 'firebase/firestore';

// --- Placeholder for External Hosting ---
// When hosted on Netlify, the standard environment variables do not exist.
// We use a mock configuration to prevent the application from crashing on startup
// and ensure the UI can still render. Firebase functionality will be disabled.
const isExternalHost = typeof __firebase_config === 'undefined';

const MOCK_FIREBASE_CONFIG = {
    apiKey: "MOCK_API_KEY",
    authDomain: "mock-domain.firebaseapp.com",
    projectId: "mock-project-id",
};

// --- Global Configuration ---
const appId = 'NETLIFY_HOSTED_APP'; // Use a fixed ID for the collection path
const firebaseConfig = isExternalHost ? MOCK_FIREBASE_CONFIG : JSON.parse(__firebase_config);
const initialAuthToken = isExternalHost ? null : (typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null);

// --- App Constants ---
const TASKS = ['Breakfast', 'Lunch', 'Dinner'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ROTA_COLLECTION_PATH = `artifacts/${appId}/public/data/family_care_rota_v2`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Application Version (v2.1) - Fix for External (Netlify) Hosting
const APP_VERSION = 'v2.1 (Netlify Fix)';
const weeksToDisplay = 8; 

// --- Utility Functions ---

/**
 * Calculates the Monday of the week containing the given date.
 * @param {Date} date
 * @returns {Date}
 */
const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); 
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Formats a Date object into YYYY-MM-DD string.
 * @param {Date} date
 * @returns {string}
 */
const formatDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Generates a simple, unique color based on a string.
 * @param {string} str
 * @returns {string} HSL color string
 */
const stringToHslColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

/**
 * Helper function for UK date format (DD Mon).
 * @param {Date} date
 * @returns {string} DD Mon (e.g., 23 Nov)
 */
const getUKShortDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()]; 
  return `${day} ${month}`;
};

// --- Rota Grid Cell Component ---
const RotaCell = React.memo(({ date, task, data, userId, userName, userColor, db, collectionPath }) => {
  const docId = `${formatDate(date)}_${task.replace(/\s/g, '_')}`;
  const slot = data[docId] || {};
  const isClaimed = !!slot.claimedBy;
  const isMine = slot.claimedBy === userId;
  const displayClaimant = slot.name || '';
  const cellColor = slot.color || '';
  
  // NOTE: If db is null (in external hosting mode), handleToggle is disabled.
  const handleToggle = useCallback(async () => {
    if (isExternalHost) {
        alert("Rota is in Offline/UI-Only Mode. Cannot connect to database.");
        return;
    }
    if (!userId || !userName || !db) {
        console.warn("Cannot toggle slot: User not authenticated or name not set.");
        return;
    }

    const docRef = doc(db, collectionPath, docId);
    try {
      if (isMine) {
        await setDoc(docRef, { claimedBy: null, name: null, color: null }, { merge: true });
        console.log(`Slot ${docId} unclaimed.`);
      } else if (!isClaimed) {
        await setDoc(docRef, {
          claimedBy: userId,
          name: userName,
          color: userColor,
          timestamp: Date.now()
        }, { merge: true });
        console.log(`Slot ${docId} claimed by ${userName}.`);
      }
    } catch (error) {
      console.error("Error toggling shift status:", error);
    }
  }, [userId, userName, userColor, isClaimed, isMine, db, collectionPath, docId]);

  return (
    <div
      onClick={handleToggle}
      className={`
        rota-cell flex-1 p-2 h-16 sm:h-20
        text-center flex items-center justify-center font-semibold text-xs sm:text-sm
        border-r border-gray-200 last:border-r-0 cursor-pointer transition duration-200 ease-in-out
        ${isClaimed ? 'shadow-inner' : (isExternalHost ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-100 hover:bg-indigo-50')}
        ${isMine ? 'ring-2 ring-offset-2 ring-indigo-400' : ''}
      `}
      style={{ backgroundColor: isClaimed ? cellColor : 'inherit', color: isClaimed ? 'white' : 'currentColor' }}
    >
      {isClaimed ? (
        <span className='scale-105 font-bold p-1 rounded-sm shadow-md' style={{backgroundColor: isMine ? 'rgba(0,0,0,0.2)' : 'transparent'}}>
            {displayClaimant}
        </span>
      ) : (
        <span className="text-gray-400 font-normal italic">
            {isExternalHost ? 'OFFLINE' : 'Tap to Claim'}
        </span>
      )}
    </div>
  );
});

// --- User Name Configuration Component (omitted for brevity) ---
const UserNameInput = React.memo(({ userName, setUserName, userColor }) => {
  const [inputName, setInputName] = useState(userName);
  const [isEditing, setIsEditing] = useState(!userName); 

  const handleSave = (e) => {
    e.preventDefault();
    if (inputName.trim()) {
      const trimmedName = inputName.trim();
      setUserName(trimmedName);
      localStorage.setItem('rotaUserName', trimmedName);
      setIsEditing(false); 
    }
  };
  
  if (userName && !isEditing) {
    return (
      <div className="p-4 bg-white shadow-xl rounded-xl mb-4 max-w-lg mx-auto flex justify-between items-center border-t-4 border-indigo-500">
        <h2 className="text-lg font-bold text-indigo-700 flex items-center">
          Signed in as: 
          <span className="ml-2 font-extrabold text-xl" style={{ color: userColor }}>{userName}</span>
        </h2>
        <button
          onClick={() => {
            setInputName(userName); 
            setIsEditing(true);
          }}
          className="px-2 py-1 bg-gray-200 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-300 transition duration-150 shadow-sm"
        >
          Edit Name
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white shadow-xl rounded-xl mb-4 max-w-lg mx-auto border-t-4 border-indigo-500">
      <h2 className="text-lg font-bold mb-2 text-indigo-700">Set Your Rota Identity</h2>
      <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          placeholder="Enter your Name or Initials"
          className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
        <button
          type="submit"
          className="px-4 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition duration-150 shadow-md"
        >
          {userName ? 'Update Name' : 'Set Name'}
        </button>
      </form>
      {userName && isEditing && (
        <button 
            onClick={() => {
              setInputName(userName); 
              setIsEditing(false);
            }} 
            className="mt-2 text-sm text-gray-500 hover:text-gray-700"
        >
            Cancel Edit
        </button>
      )}
    </div>
  );
});


// --- Main Application Component ---
const App = () => {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [rotaData, setRotaData] = useState({});
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState(() => localStorage.getItem('rotaUserName') || '');
  
  const userColor = useMemo(() => stringToHslColor(userName), [userName]);
  
  // --- 1. Firebase Initialization and Authentication ---
  useEffect(() => {
    // If hosted externally (Netlify), skip all Firebase setup, use mock data, and set loading to false.
    if (isExternalHost) {
      console.warn("External host detected. Running in UI-only (Offline) mode.");
      setLoading(false);
      setUserId('UI_USER'); // Mock user ID for local features
      return; 
    }

    try {
      const { initializeApp } = window.firebase || {}; // Use window.firebase if available (optional)
      if (!initializeApp) throw new Error("Firebase SDK not properly imported or installed.");

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const auth = getAuth(app);
      setLogLevel('debug');

      const authenticate = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Auth Error:", error);
          setLoading(false);
        }
      };

      authenticate();

      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserId(user.uid);
          setDb(firestore);
        } else {
          setUserId(null);
          setLoading(false);
        }
      });

      return () => unsubscribeAuth();
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      // Set to load anyway, but with no DB connection.
      setLoading(false);
      setUserId('INITIALIZATION_FAILED');
    }
  }, []);

  // --- 2. Real-time Firestore Listener (Runs only after Auth is complete) ---
  useEffect(() => {
    if (isExternalHost || !db || !userId) return;

    setLoading(false);
    
    const collectionRef = collection(db, ROTA_COLLECTION_PATH);
    const unsubscribeSnapshot = onSnapshot(query(collectionRef), (snapshot) => {
      const newRotaData = {};
      snapshot.forEach((doc) => {
        if (doc.data().claimedBy) {
          newRotaData[doc.id] = doc.data();
        }
      });
      setRotaData(newRotaData);
      console.log(`FIREBASE: Received snapshot with ${snapshot.size} documents.`);
    }, (error) => {
      console.error("Firestore Listener Error:", error);
    });

    return () => unsubscribeSnapshot();
  }, [db, userId]);


  // --- 3. Rota Generation (Weeks) ---
  const rotaWeeks = useMemo(() => {
    const today = new Date();
    const startOfCurrentWeek = getMondayOfWeek(today);
    const weeks = [];


    for (let w = 0; w < weeksToDisplay; w++) {
      const weekStart = new Date(startOfCurrentWeek);
      weekStart.setDate(startOfCurrentWeek.getDate() + (w * 7));
      
      const weekDates = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        weekDates.push(date);
      }
      
      const weekEnd = weekDates[6]; 

      weeks.push({
        id: formatDate(weekStart),
        dates: weekDates,
        weekRangeLabel: `Week ${getUKShortDate(weekStart)} - ${getUKShortDate(weekEnd)}`,
      });
    }
    return weeks;
  }, []);

  // Handle loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        <p className="mt-4 text-gray-600">Connecting to shared schedule...</p>
      </div>
    );
  }

  const canClaim = !!userName && !!userId && !isExternalHost;

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      
      <header className="text-center py-4 mb-4">
        <h1 className="text-3xl font-extrabold text-indigo-700">Family Care Rota</h1>
        {isExternalHost ? (
            <p className="text-sm mt-1 text-red-600 font-bold">
                OFFLINE MODE: Database connection unavailable on this host. ({APP_VERSION})
            </p>
        ) : (
            <p className={`text-xs mt-1 ${canClaim ? 'text-green-600' : 'text-red-500 font-semibold'}`}>
                {canClaim ? 'Ready to Claim' : 'Please Set Your Name to Claim Slots'} ({APP_VERSION})
            </p>
        )}
      </header>

      <UserNameInput 
        userName={userName} 
        setUserName={setUserName} 
        userColor={userColor} 
      />

      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        
        {/* Sticky Task Header Block (omitted for brevity) */}
        <div className="sticky top-0 z-20 bg-indigo-600 text-white shadow-md">
            <div className="flex font-bold text-center">
              <div className="w-1/4 p-2 text-sm sm:text-base border-r border-indigo-700">Day</div>
              {TASKS.map(task => (
                <div key={task} className="flex-1 p-2 text-xs sm:text-sm border-r border-indigo-700 last:border-r-0">
                  {task}
                </div>
              ))}
            </div>
        </div>

        {/* Scrolling Week/Day Content (Vertical) */}
        <div className="overflow-y-auto max-h-[80vh] rota-scroll-container">
          {rotaWeeks.map((week) => (
            <div key={week.id} className="mb-0">
              
              <h3 
                className="p-2 bg-indigo-100 text-indigo-800 font-bold text-base border-b border-t border-indigo-300 shadow-sm text-center"
              >
                {week.weekRangeLabel}
              </h3>
              
              {week.dates.map((date, dIndex) => {
                const dayName = DAYS[dIndex];
                const ukDateString = getUKShortDate(date);
                const isToday = formatDate(date) === formatDate(new Date());

                return (
                  <div 
                    key={formatDate(date)} 
                    className={`flex border-b ${isToday ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50 transition'}`}
                  >
                    {/* Day Column (Vertical) */}
                    <div className="w-1/4 p-2 flex flex-col justify-center text-xs sm:text-sm font-bold border-r border-gray-200 bg-gray-50">
                      <span>{dayName}</span>
                      <span className="text-gray-500 font-normal text-xs">{ukDateString}</span>
                    </div>
                    
                    {/* Task Cells (Horizontal) */}
                    {TASKS.map(task => (
                      <RotaCell
                        key={task}
                        date={date}
                        task={task}
                        data={rotaData}
                        userId={userId}
                        userName={userName}
                        userColor={userColor}
                        db={db}
                        collectionPath={ROTA_COLLECTION_PATH}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;

