/**
 * database.js - Firebase Firestore Database
 * מערכת ניהול פרויקטים - חטיבת ביטוחי בריאות וסיעוד
 */

// ============================================
// Database Class - Firebase Firestore
// ============================================

class Database {
    constructor() {
        this.db = null;
        this.utils = null;
        this.employees = [];
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

        // מאזין לעובדים
        const employeesQuery = query(collection(this.db, 'employees'));
        onSnapshot(employeesQuery, (snapshot) => {
            this.employees = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.notifyListeners('employees');
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
    // פעולות עובדים (Firebase)
    // ============================================

    getEmployees() {
        return this.employees;
    }

    getManagers() {
        // מנהלי מחלקות (כפופים למנהל חטיבה)
        // בהנחה שמנהל חטיבה הוא המנהל העליון ומזהה אותו ידוע או שהוא היחיד בלי הורה
        // כאן נניח שמי שיש לו isManager=true הוא מנהל
        const divisionHead = this.employees.find(e => !e.parentId);
        if (!divisionHead) return this.employees.filter(e => e.isManager);

        return this.employees.filter(e => e.isManager && e.parentId === divisionHead.id);
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
        // מחזיר את כולם חוץ ממנהל החטיבה (אם רוצים לסנן אותו)
        // או פשוט את כולם
        return this.employees;
    }

    async addEmployee(employee) {
        const { collection, addDoc } = this.utils;
        employee.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(this.db, 'employees'), employee);
        return { id: docRef.id, ...employee };
    }

    async updateEmployee(id, updates) {
        const { doc, updateDoc } = this.utils;
        const empRef = doc(this.db, 'employees', id);
        await updateDoc(empRef, updates);
        return { id, ...updates };
    }

    async deleteEmployee(id) {
        const { doc, deleteDoc, collection, getDocs, query, where, updateDoc } = this.utils;

        // 1. עדכון עובדים שכפופים לעובד שנמחק (הסרת המנהל שלהם)
        const teamQuery = query(collection(this.db, 'employees'), where('parentId', '==', id));
        const teamSnapshot = await getDocs(teamQuery);
        const updatepromises = teamSnapshot.docs.map(empDoc =>
            updateDoc(doc(this.db, 'employees', empDoc.id), { parentId: null })
        );
        await Promise.all(updatepromises);

        // 2. עדכון פרויקטים שהעובד מנהל (הסרת המנהל)
        const projectsQuery = query(collection(this.db, 'projects'), where('managerId', '==', id));
        const projectsSnapshot = await getDocs(projectsQuery);
        const projectPromises = projectsSnapshot.docs.map(pDoc =>
            updateDoc(doc(this.db, 'projects', pDoc.id), { managerId: null })
        );
        await Promise.all(projectPromises);

        // 3. עדכון משימות שהעובד אחראי עליהן (הסרת האחראי)
        const tasksQuery = query(collection(this.db, 'tasks'), where('assigneeId', '==', id));
        const tasksSnapshot = await getDocs(tasksQuery);
        const taskPromises = tasksSnapshot.docs.map(tDoc =>
            updateDoc(doc(this.db, 'tasks', tDoc.id), { assigneeId: null })
        );
        await Promise.all(taskPromises);

        // 4. מחיקת העובד
        await deleteDoc(doc(this.db, 'employees', id));
        return true;
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
