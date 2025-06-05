import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    setDoc,
    deleteDoc,
    Timestamp,
    onSnapshot,
    writeBatch
} from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

// --- Firebase Configuration ---
// NOTE: Replace with your actual Firebase config
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "YOUR_API_KEY", // Replace if not using __firebase_config
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'bdfb-labourtrack-dev';

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// --- Auth Context ---
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null); // { id, role, name }
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [firebaseUser, setFirebaseUser] = useState(null);


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setFirebaseUser(user);
                // If you were using custom claims for roles, you'd get them here.
                // For this demo, role is set upon manual login.
            } else {
                setFirebaseUser(null);
                // Attempt anonymous sign-in if no initial token and no user
                if (typeof __initial_auth_token === 'undefined') {
                    try {
                        await signInAnonymously(auth);
                    } catch (error) {
                        console.error("Anonymous sign-in failed:", error);
                    }
                }
            }
            setIsAuthReady(true);
        });

        // Handle initial custom token if provided
        const attemptInitialAuth = async () => {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                try {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } catch (error) {
                    console.error("Custom token sign-in failed:", error);
                    // Fallback to anonymous if custom token fails
                    await signInAnonymously(auth);
                }
            } else if (!auth.currentUser) {
                 // Ensure anonymous sign-in if no token and no current user after initial check
                await signInAnonymously(auth);
            }
            setIsAuthReady(true); // Ensure auth ready is set after attempts
        };

        attemptInitialAuth();
        return () => unsubscribe();
    }, []);


    // Hardcoded credentials for demo
    const ADMIN_USERS = [{ id: 'admin', password: 'adminpassword', name: 'Admin User' }];
    const GUARD_USERS = [{ id: 'guard1', password: 'guardpassword', name: 'Guard One' }];

    const login = (role, id, password) => {
        let user = null;
        if (role === 'ADMIN') {
            user = ADMIN_USERS.find(u => u.id === id && u.password === password);
        } else if (role === 'GUARD') {
            user = GUARD_USERS.find(u => u.id === id && u.password === password);
        }

        if (user) {
            setCurrentUser({ id: user.id, role, name: user.name });
            return true;
        }
        alert('Invalid credentials. Please try again.');
        return false;
    };

    const logout = () => {
        setCurrentUser(null);
    };

    if (!isAuthReady) {
        return <div className="flex justify-center items-center h-screen"><div className="text-xl font-semibold">Initializing App...</div></div>;
    }

    return (
<AuthContext.Provider value={{ currentUser, login, logout, firebaseUser, db, appId }}>
    {children}
</AuthContext.Provider>
    );
};

const useAuth = () => useContext(AuthContext);

// --- Helper Functions ---
const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString();
};

const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleTimeString();
};

// --- Firestore Paths ---
// Private data: /artifacts/{appId}/users/{userId}/{collection_name}
// Public data: /artifacts/{appId}/public/data/{collection_name}
// For this app, most data could be considered "public" within the organization,
// but worker personal data might be private. Attendance logs are central.
// We'll use a common path for simplicity, assuming rules handle fine-grained access.

const getCollectionPath = (collectionName) => `artifacts/${appId}/public/data/${collectionName}`;
const getWorkerDocPath = (workerId) => `artifacts/${appId}/public/data/workers/${workerId}`;
const getContractorDocPath = (contractorId) => `artifacts/${appId}/public/data/contractors/${contractorId}`;
const getAttendanceLogDocPath = (logId) => `artifacts/${appId}/public/data/attendance_logs/${logId}`;


// --- Components ---

const Footer = () => (
<footer className="bg-gray-800 text-white text-center p-4 mt-auto">
    Developed by Swarnim Mishra
</footer>
);

const CompanyLogo = () => (
<div className="text-blue-600 text-4xl font-bold mb-2">
    {/* Placeholder for a real logo SVG or img tag */}
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a4 4 0 00-5.656 0M14 10l-2 2m0 0l-2-2m2 2v7.5a2.5 2.5 0 01-5 0V12a2.5 2.5 0 015 0V10z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15.5A2.5 2.5 0 009.5 13H7.5a5 5 0 004.5 4.95V19a1 1 0 002 0v-1.05A5 5 0 0016.5 13h-2a2.5 2.5 0 00-2.5 2.5z" />
    </svg>
</div>
);

const HomeScreen = ({ setPage, setLoginRole }) => {
    const handleRoleSelect = (event) => {
        const role = event.target.value;
        if (role) {
            setLoginRole(role);
            setPage('LOGIN');
        }
    };

    return (
<div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white p-6">
    <div className="bg-white/10 backdrop-blur-md p-8 md:p-12 rounded-xl shadow-2xl text-center w-full max-w-md">
        <CompanyLogo />
        <h1 className="text-4xl font-extrabold my-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">BDFB LabourTrack</h1>
        <div className="mt-8">
            <label htmlFor="loginAs" className="block text-lg font-medium mb-2 text-gray-300">Login As:</label>
            <select id="loginAs"
                    onChange={handleRoleSelect}
                    defaultValue=""
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150">
                <option value="" disabled>Select Role...</option>
                <option value="ADMIN">ADMIN</option>
                <option value="GUARD">GUARD</option>
            </select>
        </div>
    </div>
    <Footer />
</div>
    );
};

const LoginScreen = ({ setPage, loginRole }) => {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();

    const handleLogin = (e) => {
        e.preventDefault();
        if (!id || !password) {
            alert("Please enter both ID and Password.");
            return;
        }
        if (login(loginRole, id, password)) {
            setPage(loginRole === 'ADMIN' ? 'ADMIN_DASHBOARD' : 'GUARD_DASHBOARD');
        }
    };

    return (
<div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-800 to-slate-600 text-white p-6">
    <div className="bg-white/10 backdrop-blur-md p-8 md:p-12 rounded-xl shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">{loginRole} Login</h2>
        <form onSubmit={handleLogin} className="space-y-6">
            <div>
                <label htmlFor="id" className="block text-sm font-medium text-gray-300">ID:</label>
                <input type="text"
                       id="id"
                       value={id}
                       onChange={(e) => setId(e.target.value)}
                className="mt-1 block w-full p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                required
                />
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">Password:</label>
                <input type="password"
                       id="password"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                required
                />
            </div>
            <button type="submit"
                    className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150">
                Login
            </button>
        </form>
    </div>
    <Footer />
</div>
    );
};

// --- Admin Components ---
const ManageWorkers = () => {
    const { db, firebaseUser } = useAuth();
    const [workers, setWorkers] = useState([]);
    const [workerName, setWorkerName] = useState('');
    const [workerBarcode, setWorkerBarcode] = useState('');
    const [contractorId, setContractorId] = useState(''); // Assuming you have contractors
    const [contractors, setContractors] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const workersCollectionPath = getCollectionPath('workers');
    const contractorsCollectionPath = getCollectionPath('contractors');

    useEffect(() => {
        if (!db || !firebaseUser) return;
        setIsLoading(true);
        const unsubscribeWorkers = onSnapshot(query(collection(db, workersCollectionPath)), (snapshot) => {
            const workerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWorkers(workerList);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching workers:", error);
            setIsLoading(false);
        });

        const unsubscribeContractors = onSnapshot(query(collection(db, contractorsCollectionPath)), (snapshot) => {
            const contractorList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setContractors(contractorList);
        }, (error) => console.error("Error fetching contractors:", error));

        return () => {
            unsubscribeWorkers();
            unsubscribeContractors();
        };
    }, [db, firebaseUser, workersCollectionPath, contractorsCollectionPath]);

    const handleAddWorker = async (e) => {
        e.preventDefault();
        if (!workerName || !workerBarcode || !contractorId) {
            alert("Please fill all worker fields.");
            return;
        }
        if (!db || !firebaseUser) {
            alert("Database not ready or user not authenticated.");
            return;
        }
        try {
            // The document ID will be the barcode for easy lookup
            const workerRef = doc(db, getWorkerDocPath(workerBarcode));
            await setDoc(workerRef, {
                name: workerName,
                barcode: workerBarcode, // Storing barcode also in the document
                contractorId: contractorId,
                addedAt: Timestamp.now()
            });
            setWorkerName('');
            setWorkerBarcode('');
            setContractorId('');
            alert('Worker added successfully!');
        } catch (error) {
            console.error("Error adding worker: ", error);
            alert('Failed to add worker. See console for details.');
        }
    };

    const handleDeleteWorker = async (barcode) => {
        if (!db || !firebaseUser) return;
        if (window.confirm("Are you sure you want to delete this worker? This action cannot be undone.")) {
            try {
                await deleteDoc(doc(db, getWorkerDocPath(barcode)));
                alert('Worker deleted successfully!');
            } catch (error) {
                console.error("Error deleting worker: ", error);
                alert('Failed to delete worker.');
            }
        }
    };


    if (isLoading) return <div className="text-center p-4">Loading workers...</div>;

    return (
<div className="p-6 bg-gray-800 rounded-lg shadow-md">
    <h3 className="text-2xl font-semibold mb-6 text-sky-300">Manage Workers</h3>
    <form onSubmit={handleAddWorker} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <input type="text"
               placeholder="Worker Name"
               value={workerName}
               onChange={(e) => setWorkerName(e.target.value)}
        className="p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-sky-500 focus:border-sky-500"
        required
        />
        <input type="text"
               placeholder="Unique Barcode ID"
               value={workerBarcode}
               onChange={(e) => setWorkerBarcode(e.target.value)}
        className="p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-sky-500 focus:border-sky-500"
        required
        />
        <select value={contractorId}
                onChange={(e) =>
            setContractorId(e.target.value)}
            className="p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-sky-500 focus:border-sky-500 md:col-span-2"
            required
            >
            <option value="">Select Contractor</option>
            {contractors.map(c =>
            <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="submit" className="md:col-span-2 py-3 px-6 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold rounded-md shadow-md transition duration-150">
            Add Worker
        </button>
    </form>

    <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-700 rounded-md">
            <thead className="bg-gray-600">
                <tr>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Name</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Barcode</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Contractor ID</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Actions</th>
                </tr>
            </thead>
            <tbody>
                {workers.length === 0 && !isLoading && (
                <tr><td colSpan="4" className="p-4 text-center text-gray-400">No workers found.</td></tr>
                )}
                {workers.map(worker => (
                <tr key={worker.id} className="border-b border-gray-600 hover:bg-gray-600/50 transition-colors">
                    <td className="p-3 text-sm text-white">{worker.name}</td>
                    <td className="p-3 text-sm text-white">{worker.barcode}</td>
                    <td className="p-3 text-sm text-white">{contractors.find(c => c.id === worker.contractorId)?.name || worker.contractorId}</td>
                    <td className="p-3 text-sm">
                        <button onClick={() => handleDeleteWorker(worker.barcode)} className="text-red-400 hover:text-red-300 font-medium">Delete</button>
                    </td>
                </tr>
                ))}
            </tbody>
        </table>
    </div>
</div>
    );
};

const ManageContractors = () => {
    const { db, firebaseUser } = useAuth();
    const [contractors, setContractors] = useState([]);
    const [contractorName, setContractorName] = useState('');
    const [editingContractor, setEditingContractor] = useState(null); // { id, name }
    const [isLoading, setIsLoading] = useState(false);

    const contractorsCollectionPath = getCollectionPath('contractors');

    useEffect(() => {
        if (!db || !firebaseUser) return;
        setIsLoading(true);
        const unsubscribe = onSnapshot(query(collection(db, contractorsCollectionPath)), (snapshot) => {
            const contractorList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setContractors(contractorList);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching contractors:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, firebaseUser, contractorsCollectionPath]);

    const handleAddOrUpdateContractor = async (e) => {
        e.preventDefault();
        if (!contractorName) {
            alert("Please enter contractor name.");
            return;
        }
        if (!db || !firebaseUser) {
             alert("Database not ready or user not authenticated.");
            return;
        }

        try {
            if (editingContractor) {
                const contractorRef = doc(db, getContractorDocPath(editingContractor.id));
                await setDoc(contractorRef, { name: contractorName }, { merge: true });
                alert('Contractor updated successfully!');
            } else {
                await addDoc(collection(db, contractorsCollectionPath), { name: contractorName, addedAt: Timestamp.now() });
                alert('Contractor added successfully!');
            }
            setContractorName('');
            setEditingContractor(null);
        } catch (error) {
            console.error("Error saving contractor: ", error);
            alert('Failed to save contractor. See console for details.');
        }
    };

    const handleEdit = (contractor) => {
        setEditingContractor(contractor);
        setContractorName(contractor.name);
    };

    const handleDeleteContractor = async (contractorId) => {
        if (!db || !firebaseUser) return;
        if (window.confirm("Are you sure you want to delete this contractor? This may affect workers assigned to them.")) {
            try {
                // Check if any workers are assigned to this contractor
                const workersRef = collection(db, getCollectionPath('workers'));
                const q = query(workersRef, where("contractorId", "==", contractorId));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    alert(`Cannot delete contractor. ${querySnapshot.size} worker(s) are currently assigned to them. Please reassign workers first.`);
                    return;
                }
                await deleteDoc(doc(db, getContractorDocPath(contractorId)));
                alert('Contractor deleted successfully!');
            } catch (error) {
                console.error("Error deleting contractor: ", error);
                alert('Failed to delete contractor.');
            }
        }
    };


    if (isLoading) return <div className="text-center p-4">Loading contractors...</div>;

    return (
<div className="p-6 bg-gray-800 rounded-lg shadow-md">
    <h3 className="text-2xl font-semibold mb-6 text-teal-300">{editingContractor ? 'Edit' : 'Add'} Contractor</h3>
    <form onSubmit={handleAddOrUpdateContractor} className="flex flex-col sm:flex-row gap-4 mb-8">
        <input type="text"
               placeholder="Contractor Name"
               value={contractorName}
               onChange={(e) => setContractorName(e.target.value)}
        className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-teal-500 focus:border-teal-500"
        required
        />
        <button type="submit" className="py-3 px-6 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-semibold rounded-md shadow-md transition duration-150">
            {editingContractor ? 'Update' : 'Add'} Contractor
        </button>
        {editingContractor && (
        <button type="button" onClick={() =>
            { setEditingContractor(null); setContractorName(''); }} className="py-3 px-6 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-md shadow-md transition duration-150">
            Cancel Edit
        </button>
        )}
    </form>

    <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-700 rounded-md">
            <thead className="bg-gray-600">
                <tr>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Name</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Actions</th>
                </tr>
            </thead>
            <tbody>
                {contractors.length === 0 && !isLoading && (
                <tr><td colSpan="2" className="p-4 text-center text-gray-400">No contractors found.</td></tr>
                )}
                {contractors.map(contractor => (
                <tr key={contractor.id} className="border-b border-gray-600 hover:bg-gray-600/50 transition-colors">
                    <td className="p-3 text-sm text-white">{contractor.name}</td>
                    <td className="p-3 text-sm space-x-2">
                        <button onClick={() => handleEdit(contractor)} className="text-yellow-400 hover:text-yellow-300 font-medium">Edit</button>
                        <button onClick={() => handleDeleteContractor(contractor.id)} className="text-red-400 hover:text-red-300 font-medium">Delete</button>
                    </td>
                </tr>
                ))}
            </tbody>
        </table>
    </div>
</div>
    );
};

const ViewAttendanceAdmin = () => {
    const { db, firebaseUser } = useAuth();
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', contractorId: '', workerId: '' });
    const [contractors, setContractors] = useState([]);
    const [workers, setWorkers] = useState([]); // For filtering by worker

    const attendanceCollectionPath = getCollectionPath('attendance_logs');
    const contractorsCollectionPath = getCollectionPath('contractors');
    const workersCollectionPath = getCollectionPath('workers');

    useEffect(() => {
        if (!db || !firebaseUser) return;
        setIsLoading(true);

        const unsubscribeAttendance = onSnapshot(query(collection(db, attendanceCollectionPath)), (snapshot) => {
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAttendanceRecords(records);
            setFilteredRecords(records); // Initially show all
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching attendance:", error);
            setIsLoading(false);
        });

        const unsubscribeContractors = onSnapshot(query(collection(db, contractorsCollectionPath)), (snapshot) => {
            setContractors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeWorkers = onSnapshot(query(collection(db, workersCollectionPath)), (snapshot) => {
            setWorkers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeAttendance();
            unsubscribeContractors();
            unsubscribeWorkers();
        };
    }, [db, firebaseUser, attendanceCollectionPath, contractorsCollectionPath, workersCollectionPath]);

    useEffect(() => {
        let tempRecords = [...attendanceRecords];
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            fromDate.setHours(0,0,0,0);
            tempRecords = tempRecords.filter(r => r.timestamp.toDate() >= fromDate);
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23,59,59,999);
            tempRecords = tempRecords.filter(r => r.timestamp.toDate() <= toDate);
        }
        if (filters.contractorId) {
            tempRecords = tempRecords.filter(r => r.contractorId === filters.contractorId);
        }
        if (filters.workerId) { // workerId is barcode
            tempRecords = tempRecords.filter(r => r.workerId === filters.workerId);
        }
        setFilteredRecords(tempRecords);
    }, [filters, attendanceRecords]);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const exportToCSV = () => {
        if (filteredRecords.length === 0) {
            alert("No data to export.");
            return;
        }
        const headers = "Worker Name,Worker Barcode,Contractor,Date,Entry Time,Exit Time,Scanned In By,Scanned Out By,Status\n";
        // This simplified CSV export doesn't calculate total hours or pair entry/exit for single row.
        // It lists each event. A more complex logic would be needed for paired reports.
        const csvRows = filteredRecords.map(r => {
            const worker = workers.find(w => w.barcode === r.workerId);
            const contractor = contractors.find(c => c.id === r.contractorId);
            return [
                `"${worker ? worker.name : r.workerId}"`,
                `"${r.workerId}"`,
                `"${contractor ? contractor.name : r.contractorId || 'N/A'}"`,
                formatDate(r.timestamp),
                r.type === 'entry' ? formatTime(r.timestamp) : 'N/A',
                r.type === 'exit' ? formatTime(r.timestamp) : 'N/A',
                r.type === 'entry' ? r.guardName || r.guardId : 'N/A',
                r.type === 'exit' ? r.guardName || r.guardId : 'N/A',
                r.type.toUpperCase()
            ].join(',');
        }).join('\n');

        const csvString = `${headers}${csvRows}`;
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'attendance_report.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (isLoading) return <div className="text-center p-4">Loading attendance records...</div>;

    return (
<div className="p-6 bg-gray-800 rounded-lg shadow-md">
    <h3 className="text-2xl font-semibold mb-6 text-purple-300">View Attendance Records</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-700 rounded-md">
        <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className="p-2 bg-gray-600 border border-gray-500 rounded-md text-white" />
        <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} className="p-2 bg-gray-600 border border-gray-500 rounded-md text-white" />
        <select name="contractorId" value={filters.contractorId} onChange={handleFilterChange} className="p-2 bg-gray-600 border border-gray-500 rounded-md text-white">
            <option value="">All Contractors</option>
            {contractors.map(c =>
            <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="workerId" value={filters.workerId} onChange={handleFilterChange} className="p-2 bg-gray-600 border border-gray-500 rounded-md text-white">
            <option value="">All Workers</option>
            {workers.map(w =>
            <option key={w.id} value={w.barcode}>{w.name} ({w.barcode})</option>)}
        </select>
    </div>
    <button onClick={exportToCSV} className="mb-6 py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md shadow-md transition duration-150">Export to CSV</button>

    <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-700 rounded-md">
            <thead className="bg-gray-600">
                <tr>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Worker Name</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Barcode</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Contractor</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Date</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Time</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Type</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Scanned By (Guard)</th>
                </tr>
            </thead>
            <tbody>
                {filteredRecords.length === 0 && !isLoading && (
                <tr><td colSpan="7" className="p-4 text-center text-gray-400">No attendance records found for current filters.</td></tr>
                )}
                {filteredRecords.map(record => {
                const worker = workers.find(w => w.barcode === record.workerId);
                const contractor = contractors.find(c => c.id === record.contractorId);
                return (
                <tr key={record.id} className="border-b border-gray-600 hover:bg-gray-600/50 transition-colors">
                    <td className="p-3 text-sm text-white">{worker ? worker.name : record.workerId}</td>
                    <td className="p-3 text-sm text-white">{record.workerId}</td>
                    <td className="p-3 text-sm text-white">{contractor ? contractor.name : record.contractorId || 'N/A'}</td>
                    <td className="p-3 text-sm text-white">{formatDate(record.timestamp)}</td>
                    <td className="p-3 text-sm text-white">{formatTime(record.timestamp)}</td>
                    <td className={`p-3 text-sm font-medium ${record.type= = ='entry' ? 'text-green-400' : 'text-red-400' }`}>{record.type.toUpperCase()}</td>
                    <td className="p-3 text-sm text-white">{record.guardName || record.guardId}</td>
                </tr>
                );
                })}
            </tbody>
        </table>
    </div>
</div>
    );
};


const AdminDashboard = ({ setPage }) => {
    const { logout, currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('viewAttendance');

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'viewAttendance': return
<ViewAttendanceAdmin />;
            case 'manageWorkers': return
<ManageWorkers />;
            case 'manageContractors': return
<ManageContractors />;
            default: return
<ViewAttendanceAdmin />;
        }
    };

    return (
<div className="min-h-screen bg-slate-900 text-white flex flex-col">
    <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-bold text-sky-400">Admin Dashboard</h1>
        <div>
            <span className="mr-4 text-gray-300">Welcome, {currentUser.name}</span>
            <button onClick={() => { logout(); setPage('HOME'); }} className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md transition duration-150">Logout</button>
        </div>
    </header>
    <nav className="bg-gray-700 p-2">
        <ul className="flex space-x-2 justify-center">
            <li><button onClick={() => setActiveTab('viewAttendance')} className={`py-2 px-4 rounded-md ${activeTab === 'viewAttendance' ? 'bg-sky-500' : 'bg-gray-600 hover:bg-sky-600/70'} transition-colors`}>View Attendance</button></li>
            <li><button onClick={() => setActiveTab('manageWorkers')} className={`py-2 px-4 rounded-md ${activeTab === 'manageWorkers' ? 'bg-sky-500' : 'bg-gray-600 hover:bg-sky-600/70'} transition-colors`}>Manage Workers</button></li>
            <li><button onClick={() => setActiveTab('manageContractors')} className={`py-2 px-4 rounded-md ${activeTab === 'manageContractors' ? 'bg-sky-500' : 'bg-gray-600 hover:bg-sky-600/70'} transition-colors`}>Manage Contractors</button></li>
        </ul>
    </nav>
    <main className="flex-grow p-6">
        {renderActiveTab()}
    </main>
    <Footer />
</div>
    );
};


// --- Guard Components ---
const ScanAttendance = () => {
    const { db, currentUser, firebaseUser } = useAuth(); // currentUser from AuthContext, firebaseUser from Firebase Auth
    const [barcode, setBarcode] = useState('');
    const [workerDetails, setWorkerDetails] = useState(null); // { name, barcode, contractorId }
    const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' or 'error'
    const [isLoadingWorker, setIsLoadingWorker] = useState(false);

    const handleBarcodeSubmit = async (e) => {
        e.preventDefault();
        if (!barcode) {
            setMessage({ text: 'Please enter a barcode.', type: 'error' });
            return;
        }
        if (!db || !firebaseUser) {
            setMessage({ text: 'Database not ready or user not authenticated.', type: 'error' });
            return;
        }

        setIsLoadingWorker(true);
        setMessage({ text: '', type: '' });
        setWorkerDetails(null);

        try {
            const workerRef = doc(db, getWorkerDocPath(barcode));
            const workerSnap = await getDoc(workerRef);

            if (workerSnap.exists()) {
                setWorkerDetails({ id: workerSnap.id, ...workerSnap.data() });
            } else {
                setMessage({ text: `Worker with barcode ${barcode} not found.`, type: 'error' });
            }
        } catch (error) {
            console.error("Error fetching worker:", error);
            setMessage({ text: 'Error fetching worker details. Check console.', type: 'error' });
        } finally {
            setIsLoadingWorker(false);
        }
    };

    const recordAttendance = async (type) => { // type: 'entry' or 'exit'
        if (!workerDetails || !currentUser || !db || !firebaseUser) {
            setMessage({ text: 'Cannot record attendance. Worker details or user session missing.', type: 'error' });
            return;
        }

        try {
            const attendanceCollectionRef = collection(db, getCollectionPath('attendance_logs'));
            await addDoc(attendanceCollectionRef, {
                workerId: workerDetails.barcode, // workerDetails.id is barcode
                workerName: workerDetails.name, // Denormalized
                contractorId: workerDetails.contractorId, // Denormalized
                timestamp: Timestamp.now(),
                date: new Date().toISOString().split('T')[0], // YYYY-MM-DD for easier querying
                type: type,
                guardId: currentUser.id,
                guardName: currentUser.name // Denormalized
            });
            setMessage({ text: `Attendance ${type} recorded for ${workerDetails.name}.`, type: 'success' });
            setWorkerDetails(null); // Clear after recording
            setBarcode(''); // Clear barcode input
        } catch (error) {
            console.error("Error recording attendance: ", error);
            setMessage({ text: 'Failed to record attendance. Check console.', type: 'error' });
        }
    };

    return (
<div className="p-6 bg-gray-800 rounded-lg shadow-md">
    <h3 className="text-2xl font-semibold mb-6 text-green-300">Scan & Record Attendance</h3>
    {/* Barcode Scan Simulation */}
    <form onSubmit={handleBarcodeSubmit} className="flex flex-col sm:flex-row gap-4 mb-6">
        <input type="text"
               placeholder="Enter Barcode ID"
               value={barcode}
               onChange={(e) => setBarcode(e.target.value)}
        className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-green-500 focus:border-green-500"
        />
        <button type="submit" disabled={isLoadingWorker} className="py-3 px-6 bg-gradient-to-r from-green-500 to-lime-500 hover:from-green-600 hover:to-lime-600 text-white font-semibold rounded-md shadow-md transition duration-150 disabled:opacity-50">
            {isLoadingWorker ? 'Searching...' : 'Find Worker'}
        </button>
    </form>

    {message.text && (
    <div className={`p-3 mb-4 rounded-md text-sm ${message.type= = ='success' ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100' }`}>
        {message.text}
    </div>
    )}

    {workerDetails && (
    <div className="p-4 bg-gray-700 rounded-md mb-6">
        <h4 className="text-xl font-medium text-green-200">{workerDetails.name}</h4>
        <p className="text-gray-300">Barcode: {workerDetails.barcode}</p>
        {/* <p className="text-gray-300">Contractor ID: {workerDetails.contractorId}</p> */}
        <div className="mt-4 flex gap-4">
            <button onClick={() => recordAttendance('entry')} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md transition duration-150">Mark Entry</button>
            <button onClick={() => recordAttendance('exit')} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md transition duration-150">Mark Exit</button>
        </div>
    </div>
    )}
    <p className="text-sm text-gray-400 mt-4">Note: Barcode scanning is simulated with text input. Offline mode is not implemented in this version.</p>
</div>
    );
};

const ViewTodaysAttendanceGuard = () => {
    const { db, currentUser, firebaseUser } = useAuth();
    const [todaysRecords, setTodaysRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const attendanceCollectionPath = getCollectionPath('attendance_logs');

    useEffect(() => {
        if (!db || !currentUser || !firebaseUser) return;
        setIsLoading(true);
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        const q = query(
            collection(db, attendanceCollectionPath),
            where("guardId", "==", currentUser.id),
            where("date", "==", todayStr)
            // orderBy("timestamp", "desc") // Requires composite index, remove if causing issues
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Manual sort if orderBy is removed
            records.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
            setTodaysRecords(records);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching today's attendance:", error);
            setIsLoading(false);
            if (error.code === 'failed-precondition') {
                alert("Query requires an index. Please check Firestore console or remove ordering for now. Error: " + error.message);
            }
        });

        return () => unsubscribe();
    }, [db, currentUser, firebaseUser, attendanceCollectionPath]);

    if (isLoading) return <div className="text-center p-4">Loading today's attendance...</div>;

    return (
<div className="p-6 bg-gray-800 rounded-lg shadow-md">
    <h3 className="text-2xl font-semibold mb-6 text-yellow-300">Today's Attendance (Scanned by You)</h3>
    {todaysRecords.length === 0 && !isLoading && (
    <p className="text-gray-400 text-center">No attendance records scanned by you today.</p>
    )}
    <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-700 rounded-md">
            <thead className="bg-gray-600">
                <tr>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Worker Name</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Barcode</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Time</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-300">Type</th>
                </tr>
            </thead>
            <tbody>
                {todaysRecords.map(record => (
                <tr key={record.id} className="border-b border-gray-600 hover:bg-gray-600/50 transition-colors">
                    <td className="p-3 text-sm text-white">{record.workerName || record.workerId}</td>
                    <td className="p-3 text-sm text-white">{record.workerId}</td>
                    <td className="p-3 text-sm text-white">{formatTime(record.timestamp)}</td>
                    <td className={`p-3 text-sm font-medium ${record.type= = ='entry' ? 'text-green-400' : 'text-red-400' }`}>{record.type.toUpperCase()}</td>
                </tr>
                ))}
            </tbody>
        </table>
    </div>
    <p className="text-sm text-gray-400 mt-4">Basic error correction: Not implemented. For errors, please contact Admin.</p>
</div>
    );
};

const LimitedSearchGuard = () => {
    const { db, firebaseUser } = useAuth();
    const [barcodeSearch, setBarcodeSearch] = useState('');
    const [foundWorker, setFoundWorker] = useState(null);
    const [searchMessage, setSearchMessage] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!barcodeSearch) {
            setSearchMessage('Please enter a barcode to search.');
            return;
        }
        if (!db || !firebaseUser) {
            setSearchMessage('Database not ready or user not authenticated.');
            return;
        }

        setIsSearching(true);
        setFoundWorker(null);
        setSearchMessage('');

        try {
            const workerRef = doc(db, getWorkerDocPath(barcodeSearch));
            const workerSnap = await getDoc(workerRef);

            if (workerSnap.exists()) {
                setFoundWorker({ id: workerSnap.id, ...workerSnap.data() });
            } else {
                setSearchMessage(`Worker with barcode ${barcodeSearch} not found.`);
            }
        } catch (error) {
            console.error("Error searching worker:", error);
            setSearchMessage('Error searching worker. Check console.');
        } finally {
            setIsSearching(false);
        }
    };

    return (
<div className="p-6 bg-gray-800 rounded-lg shadow-md">
    <h3 className="text-2xl font-semibold mb-6 text-indigo-300">Limited Worker Search (by Barcode)</h3>
    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-6">
        <input type="text"
               placeholder="Enter Barcode ID to Search"
               value={barcodeSearch}
               onChange={(e) => setBarcodeSearch(e.target.value)}
        className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button type="submit" disabled={isSearching} className="py-3 px-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-md shadow-md transition duration-150 disabled:opacity-50">
            {isSearching ? 'Searching...' : 'Search Worker'}
        </button>
    </form>

    {searchMessage && <p className="p-3 mb-4 rounded-md text-sm bg-yellow-700 text-yellow-100">{searchMessage}</p>}

    {foundWorker && (
    <div className="p-4 bg-gray-700 rounded-md">
        <h4 className="text-xl font-medium text-indigo-200">Worker Found:</h4>
        <p className="text-gray-300">Name: {foundWorker.name}</p>
        <p className="text-gray-300">Barcode: {foundWorker.barcode}</p>
        {/* <p className="text-gray-300">Contractor ID: {foundWorker.contractorId}</p> */}
    </div>
    )}
</div>
    );
};


const GuardDashboard = ({ setPage }) => {
    const { logout, currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('scanAttendance');

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'scanAttendance': return
<ScanAttendance />;
            case 'todaysAttendance': return
<ViewTodaysAttendanceGuard />;
            case 'limitedSearch': return
<LimitedSearchGuard />;
            default: return
<ScanAttendance />;
        }
    };

    return (
<div className="min-h-screen bg-slate-900 text-white flex flex-col">
    <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-bold text-green-400">Guard Dashboard</h1>
        <div>
            <span className="mr-4 text-gray-300">Welcome, {currentUser.name} (ID: {currentUser.id})</span>
            <button onClick={() => { logout(); setPage('HOME'); }} className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md transition duration-150">Logout</button>
        </div>
    </header>
    <nav className="bg-gray-700 p-2">
        <ul className="flex space-x-2 justify-center">
            <li><button onClick={() => setActiveTab('scanAttendance')} className={`py-2 px-4 rounded-md ${activeTab === 'scanAttendance' ? 'bg-green-500' : 'bg-gray-600 hover:bg-green-600/70'} transition-colors`}>Scan Attendance</button></li>
            <li><button onClick={() => setActiveTab('todaysAttendance')} className={`py-2 px-4 rounded-md ${activeTab === 'todaysAttendance' ? 'bg-green-500' : 'bg-gray-600 hover:bg-green-600/70'} transition-colors`}>View Today's Scans</button></li>
            <li><button onClick={() => setActiveTab('limitedSearch')} className={`py-2 px-4 rounded-md ${activeTab === 'limitedSearch' ? 'bg-green-500' : 'bg-gray-600 hover:bg-green-600/70'} transition-colors`}>Search Worker</button></li>
        </ul>
    </nav>
    <main className="flex-grow p-6">
        {renderActiveTab()}
    </main>
    <Footer />
</div>
    );
};


// --- Main App Component ---
function App() {
    const [page, setPage] = useState('HOME'); // HOME, LOGIN, ADMIN_DASHBOARD, GUARD_DASHBOARD
    const [loginRole, setLoginRole] = useState(null); // ADMIN, GUARD
    const { currentUser, isAuthReady } = useAuth(); // Use isAuthReady if needed from AuthProvider

    // If user is already logged in (e.g. from a previous session, though this demo doesn't persist login),
    // redirect them. For this demo, currentUser is cleared on refresh.
    // This effect is more for a scenario where login state IS persisted.
    useEffect(() => {
        if (currentUser && page === 'LOGIN') { // If logged in and somehow on login page, redirect
            setPage(currentUser.role === 'ADMIN' ? 'ADMIN_DASHBOARD' : 'GUARD_DASHBOARD');
        }
    }, [currentUser, page, setPage]);


    const renderPage = () => {
        if (!currentUser) { // If no user is logged in via app's logic
            if (page === 'LOGIN') {
                return
<LoginScreen setPage={setPage} loginRole={loginRole} />;
            }
            return
<HomeScreen setPage={setPage} setLoginRole={setLoginRole} />;
        }

        // If user is logged in
        if (currentUser.role === 'ADMIN') {
            return
<AdminDashboard setPage={setPage} />;
        }
        if (currentUser.role === 'GUARD') {
            return
<GuardDashboard setPage={setPage} />;
        }
        // Fallback to home if something is wrong with role or page state
        return
<HomeScreen setPage={setPage} setLoginRole={setLoginRole} />;
    };

    // Display a global loading indicator until Firebase Auth is ready
    // This is handled inside AuthProvider now.

    return (
<div className="font-sans">
    {renderPage()}
</div>
    );
}

// Wrap App with AuthProvider
const AppWrapper = () => (
<AuthProvider>
    <App />
</AuthProvider>
);

export default AppWrapper;