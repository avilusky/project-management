/**
 * database.js - Firebase Firestore Database
 * מערכת ניהול פרויקטים - חטיבת ביטוחי בריאות וסיעוד
 */

// ============================================
// נתוני עובדים (קבועים - לא משתנים)
// ============================================

const employeesData = [
    // מנהל חטיבה
    { id: 'e1', name: 'אבי עובדיה', role: 'מנהל חטיבה', department: 'הנהלה', isManager: true, parentId: null },

    // מנהלי מחלקות
    { id: 'e2', name: 'אבי לוסקי', role: 'מנהל מחלקת ביטוח סיעודי', department: 'ביטוח סיעודי', isManager: true, parentId: 'e1' },
    { id: 'e3', name: 'שירה עמיאור', role: 'מנהלת מחלקת ביטוחי בריאות', department: 'ביטוחי בריאות', isManager: true, parentId: 'e1' },
    { id: 'e4', name: 'בנג\'י רוזמן', role: 'מנהל מחלקת ביקורת בריאות', department: 'ביקורת בריאות', isManager: true, parentId: 'e1' },

    // עובדי מחלקת ביטוח סיעודי
    { id: 'e5', name: 'עובד 1 - סיעודי', role: 'עובד', department: 'ביטוח סיעודי', isManager: false, parentId: 'e2' },
    { id: 'e6', name: 'עובד 2 - סיעודי', role: 'עובד', department: 'ביטוח סיעודי', isManager: false, parentId: 'e2' },
    { id: 'e7', name: 'עובד 3 - סיעודי', role: 'עובד', department: 'ביטוח סיעודי', isManager: false, parentId: 'e2' },

    // עובדי מחלקת ביטוחי בריאות
    { id: 'e8', name: 'עובד 4 - בריאות', role: 'עובד', department: 'ביטוחי בריאות', isManager: false, parentId: 'e3' },
    { id: 'e9', name: 'עובד 5 - בריאות', role: 'עובד', department: 'ביטוחי בריאות', isManager: false, parentId: 'e3' },
    { id: 'e10', name: 'עובד 6 - בריאות', role: 'עובד', department: 'ביטוחי בריאות', isManager: false, parentId: 'e3' },

    // עובדי מחלקת ביקורת בריאות
    { id: 'e11', name: 'עובד 7 - ביקורת', role: 'עובד', department: 'ביקורת בריאות', isManager: false, parentId: 'e4' },
    { id: 'e12', name: 'עובד 8 - ביקורת', role: 'עובד', department: 'ביקורת בריאות', isManager: false, parentId: 'e4' },
    { id: 'e13', name: 'עובד 9 - ביקורת', role: 'עובד', department: 'ביקורת בריאות', isManager: false, parentId: 'e4' }
];

// ============================================
// Database Class - Firebase Firestore
// ============================================

class Database {
    constructor() {
        this.db = null;
        this.utils = null;
        this.employees = employeesData;
        this.projects = [];
        this.tasks = [];
        this.initialized = false;
        this.listeners = [];
    }

    // אתחול החיבור ל-Firebase
    async init() {
        return new Promise((resolve) => {
            if (window.firebaseDB) {
                this.db = window.firebaseDB;
                this.utils = window.firebaseUtils;
                this.setupRealtimeListeners();
                this.initialized = true;
                resolve();
            } else {
                window.addEventListener('firebase-ready', () => {
                    this.db = window.firebaseDB;
                    this.utils = window.firebaseUtils;
                    this.setupRealtimeListeners();
                    this.initialized = true;
                    resolve();
                });
            }
        });
    }

    // הגדרת מאזינים בזמן אמת
    setupRealtimeListeners() {
        const { collection, onSnapshot, orderBy, query } = this.utils;

        // מאזין לפרויקטים
        const projectsQuery = query(collection(this.db, 'projects'));
        onSnapshot(projectsQuery, (snapshot) => {
            this.projects = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.notifyListeners('projects');
        });

        // מאזין למשימות
        const tasksQuery = query(collection(this.db, 'tasks'));
        onSnapshot(tasksQuery, (snapshot) => {
            this.tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.notifyListeners('tasks');
        });
    }

    // רישום מאזינים לשינויים
    onDataChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(type) {
        this.listeners.forEach(cb => cb(type));
    }

    // ============================================
    // פעולות עובדים (מקומי - לא ב-Firebase)
    // ============================================

    getEmployees() {
        return this.employees;
    }

    getManagers() {
        return this.employees.filter(e => e.isManager && e.parentId === 'e1');
    }

    getAllManagers() {
        return this.employees.filter(e => e.isManager);
    }

    getEmployeeById(id) {
        return this.employees.find(e => e.id === id);
    }

    getEmployeesByDepartment(department) {
        return this.employees.filter(e => e.department === department);
    }

    getTeamByManager(managerId) {
        return this.employees.filter(e => e.parentId === managerId);
    }

    getAllWorkersAndManagers() {
        return this.employees.filter(e => e.id !== 'e1');
    }

    // ============================================
    // פעולות פרויקטים (Firebase)
    // ============================================

    getProjects() {
        return this.projects;
    }

    getActiveProjects() {
        return this.projects.filter(p => p.status === 'active');
    }

    getProjectById(id) {
        return this.projects.find(p => p.id === id);
    }

    getProjectsByManager(managerId) {
        return this.projects.filter(p => p.managerId === managerId);
    }

    getProjectsByStatus(status) {
        if (status === 'all') return this.projects;
        return this.projects.filter(p => p.status === status);
    }

    async addProject(project) {
        const { collection, addDoc } = this.utils;
        project.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(this.db, 'projects'), project);
        return { id: docRef.id, ...project };
    }

    async updateProject(id, updates) {
        const { doc, updateDoc } = this.utils;
        const projectRef = doc(this.db, 'projects', id);
        await updateDoc(projectRef, updates);
        return { id, ...updates };
    }

    async deleteProject(id) {
        const { doc, deleteDoc, collection, getDocs, query, where } = this.utils;

        // מחיקת המשימות הקשורות לפרויקט
        const tasksQuery = query(collection(this.db, 'tasks'), where('projectId', '==', id));
        const tasksSnapshot = await getDocs(tasksQuery);
        const deletePromises = tasksSnapshot.docs.map(taskDoc =>
            deleteDoc(doc(this.db, 'tasks', taskDoc.id))
        );
        await Promise.all(deletePromises);

        // מחיקת הפרויקט
        await deleteDoc(doc(this.db, 'projects', id));
        return true;
    }

    // ============================================
    // פעולות משימות (Firebase)
    // ============================================

    getTasks() {
        return this.tasks;
    }

    getTaskById(id) {
        return this.tasks.find(t => t.id === id);
    }

    getTasksByProject(projectId) {
        if (projectId === 'all') return this.tasks;
        return this.tasks.filter(t => t.projectId === projectId);
    }

    getTasksByAssignee(assigneeId) {
        if (assigneeId === 'all') return this.tasks;
        return this.tasks.filter(t => t.assigneeId === assigneeId);
    }

    getTasksByStatus(status) {
        if (status === 'all') return this.tasks;
        return this.tasks.filter(t => t.status === status);
    }

    getInProgressTasks() {
        return this.tasks.filter(t => t.status === 'in-progress');
    }

    getOverdueTasks() {
        const today = new Date().toISOString().split('T')[0];
        return this.tasks.filter(t => t.dueDate < today && t.status !== 'completed');
    }

    getUpcomingTasks(days = 7) {
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + days);

        const todayStr = today.toISOString().split('T')[0];
        const futureDateStr = futureDate.toISOString().split('T')[0];

        return this.tasks.filter(t =>
            t.dueDate >= todayStr &&
            t.dueDate <= futureDateStr &&
            t.status !== 'completed'
        ).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }

    async addTask(task) {
        const { collection, addDoc } = this.utils;
        task.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(this.db, 'tasks'), task);
        return { id: docRef.id, ...task };
    }

    async updateTask(id, updates) {
        const { doc, updateDoc } = this.utils;
        const taskRef = doc(this.db, 'tasks', id);
        await updateDoc(taskRef, updates);
        return { id, ...updates };
    }

    async deleteTask(id) {
        const { doc, deleteDoc } = this.utils;
        await deleteDoc(doc(this.db, 'tasks', id));
        return true;
    }

    // ============================================
    // סטטיסטיקות
    // ============================================

    getStats() {
        return {
            totalProjects: this.getActiveProjects().length,
            totalTasks: this.tasks.length,
            inProgressTasks: this.getInProgressTasks().length,
            overdueTasks: this.getOverdueTasks().length
        };
    }
}

// יצירת מופע גלובלי של מסד הנתונים
const db = new Database();
