/**
 * app.js - לוגיקה ראשית של האפליקציה
 * מערכת ניהול פרויקטים - חטיבת ביטוחי בריאות וסיעוד
 * גרסת Firebase
 */

// ============================================
// משתנים גלובליים
// ============================================

let currentDeleteTarget = null;
let currentDeleteType = null;

// מיון טבלת משימות
let taskSortColumn = null;
let taskSortDirection = 'asc'; // 'asc' או 'desc'

// ============================================
// אתחול האפליקציה
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // המתנה לאתחול Firebase
        await db.init();

        // המתנה לסנכרון נתונים ראשוני
        await new Promise(resolve => setTimeout(resolve, 800));

        initNavigation();
        initModals();
        initForms();
        initFilters();
        updateDate();
        loadDashboard();
        loadEmployees();

        // חשיפת פונקציות גלובליות
        window.viewProjectTasks = viewProjectTasks;
        window.viewTask = viewTask;

        // רישום למאזין שינויים רק אחרי שהכל מוכן, עם debounce
        let refreshTimer = null;
        db.onDataChange((type) => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                refreshCurrentPage();
                if (type === 'employees') {
                    loadEmployees();
                }
            }, 300);
        });

        // הסתרת מסך טעינה
        hideLoading();

        // עדכון כל 60 שניות
        setInterval(updateDate, 60000);

    } catch (error) {
        console.error('Error initializing app:', error);
        document.getElementById('sync-status').textContent = '🔴 שגיאה בחיבור';
        hideLoading();
    }
});

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }
}

function refreshCurrentPage() {
    const activePage = document.querySelector('.nav-item.active');
    if (activePage) {
        const page = activePage.dataset.page;
        switch (page) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'projects':
                loadProjects();
                break;
            case 'tasks':
                loadTasks();
                break;
        }
    }
}

// ============================================
// ניווט
// ============================================

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('page-title');

    const pageTitles = {
        'dashboard': 'ראשי',
        'projects': 'פרויקטים',
        'tasks': 'משימות',
        'employees': 'עובדים'
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetPage = item.dataset.page;

            // עדכון תפריט
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // עדכון עמוד
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(`${targetPage}-page`).classList.add('active');

            // עדכון כותרת
            pageTitle.textContent = pageTitles[targetPage];

            // טעינת תוכן
            switch (targetPage) {
                case 'dashboard':
                    loadDashboard();
                    break;
                case 'projects':
                    loadProjects();
                    break;
                case 'tasks':
                    loadTasks();
                    break;
                case 'employees':
                    loadEmployees();
                    break;
            }
        });
    });
}

// ============================================
// מודלים
// ============================================

function initModals() {
    // כפתורי סגירה
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            closeModal(modalId);
        });
    });

    // סגירה בלחיצה על הרקע
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // כפתור הוספת פרויקט
    document.getElementById('add-project-btn').addEventListener('click', () => {
        openProjectModal();
    });

    // כפתור הוספת משימה
    document.getElementById('add-task-btn').addEventListener('click', () => {
        openTaskModal();
    });

    // כפתור אישור מחיקה
    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        confirmDelete();
    });

    // כפתור הוספת עובד (אם קיים)
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    if (addEmployeeBtn) {
        addEmployeeBtn.addEventListener('click', () => {
            openEmployeeModal();
        });
    }

    // כפתור עריכה במודל תצוגת משימה
    document.getElementById('task-view-edit-btn').addEventListener('click', () => {
        const taskId = document.getElementById('task-view-edit-btn').dataset.taskId;
        closeModal('task-view-modal');
        openTaskModal(taskId);
    });

    // כפתור מחיקה במודל תצוגת משימה
    document.getElementById('task-view-delete-btn').addEventListener('click', () => {
        const taskId = document.getElementById('task-view-edit-btn').dataset.taskId;
        const task = db.getTaskById(taskId);
        closeModal('task-view-modal');
        openDeleteModal('task', taskId, task ? task.name : '');
    });
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function openProjectModal(projectId = null) {
    const modal = document.getElementById('project-modal');
    const title = document.getElementById('project-modal-title');
    const form = document.getElementById('project-form');

    // טעינת מנהלים
    loadManagersSelect('project-manager');

    if (projectId) {
        // עריכת פרויקט קיים
        const project = db.getProjectById(projectId);
        title.textContent = 'עריכת פרויקט';
        document.getElementById('project-id').value = project.id;
        document.getElementById('project-name').value = project.name;
        document.getElementById('project-description').value = project.description || '';
        document.getElementById('project-manager').value = project.managerId;
        document.getElementById('project-status').value = project.status;
        document.getElementById('project-start-date').value = project.startDate;
        document.getElementById('project-end-date').value = project.endDate;
    } else {
        // פרויקט חדש
        title.textContent = 'פרויקט חדש';
        form.reset();
        document.getElementById('project-id').value = '';
        document.getElementById('project-start-date').value = new Date().toISOString().split('T')[0];
    }

    openModal('project-modal');
}

function openTaskModal(taskId = null) {
    const modal = document.getElementById('task-modal');
    const title = document.getElementById('task-modal-title');
    const form = document.getElementById('task-form');
    const departmentSelect = document.getElementById('task-department');

    // הגדרת מאזין לשינוי מחלקה - סינון פרויקטים
    departmentSelect.onchange = function () {
        const selectedDept = departmentSelect.value;
        const currentProjectValue = document.getElementById('task-project').value;
        loadProjectsSelect('task-project', selectedDept);
        // נסיון לשמר את הפרויקט הנבחר אם עדיין קיים ברשימה
        document.getElementById('task-project').value = currentProjectValue;
        if (!document.getElementById('task-project').value) {
            document.getElementById('task-project').value = '';
        }
    };

    if (taskId) {
        // עריכת משימה קיימת
        const task = db.getTaskById(taskId);
        title.textContent = 'עריכת משימה';
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-name').value = task.name;
        document.getElementById('task-description').value = task.description || '';

        // בעריכה - נקבע את המחלקה לפי הפרויקט הנוכחי
        const project = db.getProjectById(task.projectId);
        if (project && project.department) {
            departmentSelect.value = project.department;
            loadProjectsSelect('task-project', project.department);
        } else {
            departmentSelect.value = '';
            loadProjectsSelect('task-project');
        }

        document.getElementById('task-project').value = task.projectId;

        // טעינת עובדים
        loadEmployeesSelect('task-assignee');
        document.getElementById('task-assignee').value = task.assigneeId;
        document.getElementById('task-start-date').value = task.startDate;
        document.getElementById('task-due-date').value = task.dueDate;
        document.getElementById('task-priority').value = task.priority;
        document.getElementById('task-status').value = task.status;
    } else {
        // משימה חדשה
        title.textContent = 'משימה חדשה';
        form.reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-start-date').value = new Date().toISOString().split('T')[0];
        departmentSelect.value = '';

        // טעינת כל הפרויקטים (בלי סינון מחלקה)
        loadProjectsSelect('task-project');

        // טעינת עובדים
        loadEmployeesSelect('task-assignee');
    }

    openModal('task-modal');
}

function openEmployeeModal(employeeId = null) {
    const modal = document.getElementById('employee-modal');
    const title = document.getElementById('employee-modal-title');
    const form = document.getElementById('employee-form');

    // טעינת מנהלים (חוץ מהעובד עצמו אם בעריכה)
    const select = document.getElementById('employee-manager');
    const managers = db.getAllManagers();

    select.innerHTML = '<option value="">ללא מנהל (מנהל חטיבה)</option>';
    managers.forEach(manager => {
        if (employeeId && manager.id === employeeId) return; // לא יכול להיות מנהל של עצמו
        select.innerHTML += `<option value="${manager.id}">${manager.name}</option>`;
    });

    if (employeeId) {
        // עריכה
        const emp = db.getEmployeeById(employeeId);
        title.textContent = 'עריכת עובד';
        document.getElementById('employee-id').value = emp.id;
        document.getElementById('employee-name').value = emp.name;
        document.getElementById('employee-role').value = emp.role;
        document.getElementById('employee-department').value = emp.department;
        document.getElementById('employee-manager').value = emp.parentId || '';
        document.getElementById('employee-is-manager').checked = emp.isManager;
    } else {
        // חדש
        title.textContent = 'עובד חדש';
        form.reset();
        document.getElementById('employee-id').value = '';
    }

    openModal('employee-modal');
}

function viewTask(taskId) {
    const task = db.getTaskById(taskId);
    if (!task) return;

    const project = db.getProjectById(task.projectId);
    const projectManager = project ? db.getEmployeeById(project.managerId) : null;
    const assignee = db.getEmployeeById(task.assigneeId);
    const daysInfo = task.status === 'completed' ? { text: 'הושלם ✓', className: 'normal' } : getDaysRemaining(task.dueDate);

    document.getElementById('task-view-title').textContent = task.name;
    document.getElementById('task-view-description').textContent = task.description || 'ללא תיאור';
    document.getElementById('task-view-description').style.display = task.description ? 'block' : 'none';
    document.getElementById('task-view-project').textContent = project ? project.name : 'ללא פרויקט';
    document.getElementById('task-view-manager').textContent = projectManager ? projectManager.name : '-';
    document.getElementById('task-view-assignee').textContent = assignee ? assignee.name : 'לא הוקצה';
    document.getElementById('task-view-start-date').textContent = formatDate(task.startDate);
    document.getElementById('task-view-due-date').textContent = formatDate(task.dueDate);
    document.getElementById('task-view-priority').innerHTML = `<span class="priority-badge priority-${task.priority}">${getPriorityText(task.priority)}</span>`;
    document.getElementById('task-view-status').innerHTML = `<span class="status-badge status-${task.status}">${getTaskStatusText(task.status)}</span>`;
    document.getElementById('task-view-days').innerHTML = `<span class="days-remaining ${daysInfo.className}">${daysInfo.text}</span>`;

    // שמירת ID לכפתור עריכה
    document.getElementById('task-view-edit-btn').dataset.taskId = taskId;

    openModal('task-view-modal');
}

function openDeleteModal(type, id, name) {
    currentDeleteType = type;
    currentDeleteTarget = id;

    let message = '';
    if (type === 'project') {
        message = `האם אתה בטוח שברצונך למחוק את הפרויקט "${name}"? כל המשימות הקשורות אליו יימחקו גם כן.`;
    } else if (type === 'task') {
        message = `האם אתה בטוח שברצונך למחוק את המשימה "${name}"?`;
    } else if (type === 'employee') {
        message = `האם אתה בטוח שברצונך למחוק את העובד "${name}"?`;
    }

    document.getElementById('delete-message').textContent = message;
    openModal('delete-modal');
}

async function confirmDelete() {
    try {
        if (currentDeleteType === 'project') {
            await db.deleteProject(currentDeleteTarget);
        } else if (currentDeleteType === 'task') {
            await db.deleteTask(currentDeleteTarget);
        } else if (currentDeleteType === 'employee') {
            await db.deleteEmployee(currentDeleteTarget);
        }

    } catch (error) {
        console.error('Error deleting:', error);
        alert('שגיאה במחיקה. נסה שוב.');
    }

    closeModal('delete-modal');
    currentDeleteType = null;
    currentDeleteTarget = null;
}

// ============================================
// טפסים
// ============================================

function initForms() {
    // טופס פרויקט
    document.getElementById('project-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProject();
    });

    // טופס משימה
    document.getElementById('task-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTask();
    });

    // טופס עובד
    document.getElementById('employee-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveEmployee();
    });
}


async function saveProject() {
    const id = document.getElementById('project-id').value;
    const managerId = document.getElementById('project-manager').value;

    // שיוך מחלקה אוטומטי לפי המנהל שנבחר
    let department = '';
    if (managerId) {
        const manager = db.getEmployeeById(managerId);
        if (manager) {
            department = manager.department;
        }
    }

    const project = {
        name: document.getElementById('project-name').value,
        description: document.getElementById('project-description').value,
        managerId: managerId,
        department: department,
        status: document.getElementById('project-status').value,
        startDate: document.getElementById('project-start-date').value,
        endDate: document.getElementById('project-end-date').value
    };

    try {
        if (id) {
            await db.updateProject(id, project);
        } else {
            await db.addProject(project);
        }
        closeModal('project-modal');
    } catch (error) {
        console.error('Error saving project:', error);
        alert('שגיאה בשמירה. נסה שוב.');
    }
}

async function saveTask() {
    const id = document.getElementById('task-id').value;
    const task = {
        name: document.getElementById('task-name').value,
        description: document.getElementById('task-description').value,
        projectId: document.getElementById('task-project').value,
        assigneeId: document.getElementById('task-assignee').value,
        startDate: document.getElementById('task-start-date').value,
        dueDate: document.getElementById('task-due-date').value,
        priority: document.getElementById('task-priority').value,
        status: document.getElementById('task-status').value
    };

    try {
        if (id) {
            await db.updateTask(id, task);
        } else {
            await db.addTask(task);
        }
        closeModal('task-modal');
    } catch (error) {
        console.error('Error saving task:', error);
        alert('שגיאה בשמירה. נסה שוב.');
    }
}

async function saveEmployee() {
    const id = document.getElementById('employee-id').value;
    const employee = {
        name: document.getElementById('employee-name').value,
        role: document.getElementById('employee-role').value,
        department: document.getElementById('employee-department').value,
        parentId: document.getElementById('employee-manager').value || null,
        isManager: document.getElementById('employee-is-manager').checked
    };

    try {
        if (id) {
            await db.updateEmployee(id, employee);
        } else {
            await db.addEmployee(employee);
        }
        closeModal('employee-modal');
    } catch (error) {
        console.error('Error saving employee:', error);
        alert('שגיאה בשמירה. נסה שוב.');
    }
}


// ============================================
// פילטרים
// ============================================

let isUpdatingFilters = false;

function initFilters() {
    // פילטרי פרויקטים
    document.getElementById('project-status-filter').addEventListener('change', () => {
        if (!isUpdatingFilters) loadProjects();
    });
    document.getElementById('project-manager-filter').addEventListener('change', () => {
        if (!isUpdatingFilters) loadProjects();
    });

    // פילטרי משימות - כולם מפעילים את אותה פונקציה שמעדכנת הכל
    document.getElementById('task-manager-filter').addEventListener('change', () => {
        if (!isUpdatingFilters) {
            // כשמשנים מנהל - איפוס פרויקט ועובד
            document.getElementById('task-project-filter').value = 'all';
            document.getElementById('task-employee-filter').value = 'all';
            loadTasks();
        }
    });
    document.getElementById('task-project-filter').addEventListener('change', () => {
        if (!isUpdatingFilters) loadTasks();
    });
    document.getElementById('task-status-filter').addEventListener('change', () => {
        if (!isUpdatingFilters) loadTasks();
    });
    document.getElementById('task-employee-filter').addEventListener('change', () => {
        if (!isUpdatingFilters) loadTasks();
    });
}

// ============================================
// טעינת נתונים לסלקטים
// ============================================

function loadManagersSelect(selectId) {
    const select = document.getElementById(selectId);
    const managers = db.getManagers();

    select.innerHTML = '<option value="">בחר מנהל</option>';
    managers.forEach(manager => {
        select.innerHTML += `<option value="${manager.id}">${manager.name}</option>`;
    });
}

function loadProjectsSelect(selectId, department = '') {
    const select = document.getElementById(selectId);
    let projects = db.getActiveProjects();

    // סינון לפי מחלקה אם נבחרה
    if (department) {
        projects = projects.filter(p => p.department === department);
    }

    select.innerHTML = '<option value="">בחר פרויקט</option>';
    projects.forEach(project => {
        select.innerHTML += `<option value="${project.id}">${project.name}</option>`;
    });
}

function loadEmployeesSelect(selectId) {
    const select = document.getElementById(selectId);
    const employees = db.getAllWorkersAndManagers();

    select.innerHTML = '<option value="">בחר עובד</option>';
    employees.forEach(emp => {
        select.innerHTML += `<option value="${emp.id}">${emp.name}</option>`;
    });
}

// ============================================
// דשבורד
// ============================================

function loadDashboard() {
    const stats = db.getStats();

    // עדכון סטטיסטיקות
    document.getElementById('total-projects').textContent = stats.totalProjects;
    document.getElementById('total-tasks').textContent = stats.totalTasks;
    document.getElementById('in-progress-tasks').textContent = stats.inProgressTasks;
    document.getElementById('overdue-tasks').textContent = stats.overdueTasks;

    // טעינת משימות קרובות
    loadUpcomingTasks();

    // טעינת פרויקטים אחרונים
    loadRecentProjects();
}

function loadUpcomingTasks() {
    const container = document.getElementById('upcoming-tasks-list');
    const tasks = db.getUpcomingTasks(14);

    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-message">אין משימות קרובות</p>';
        return;
    }

    container.innerHTML = tasks.slice(0, 5).map(task => {
        const project = db.getProjectById(task.projectId);
        const daysInfo = getDaysRemaining(task.dueDate);

        return `
            <div class="mini-task-item clickable-card" onclick="goToTask('${task.id}')">
                <div class="task-mini-info">
                    <span class="task-mini-name">${task.name}</span>
                    <span class="task-mini-project">${project ? project.name : 'ללא פרויקט'}</span>
                </div>
                <span class="days-remaining ${daysInfo.className}">${daysInfo.text}</span>
            </div>
        `;
    }).join('');
}

function loadRecentProjects() {
    const container = document.getElementById('recent-projects-list');
    const projects = db.getActiveProjects();

    if (projects.length === 0) {
        container.innerHTML = '<p class="empty-message">אין פרויקטים פעילים</p>';
        return;
    }

    container.innerHTML = projects.slice(0, 5).map(project => {
        const manager = db.getEmployeeById(project.managerId);

        // הוספת onclick לניווט למשימות הפרויקט
        return `
            <div class="mini-project-item clickable-card" onclick="viewProjectTasks('${project.id}')">
                <div class="project-mini-info">
                    <span class="project-mini-name">${project.name}</span>
                    <span class="project-mini-manager">${manager ? manager.name : 'ללא מנהל'}</span>
                </div>
                <span class="project-mini-status status-badge status-${project.status}">${getStatusText(project.status)}</span>
            </div>
        `;
    }).join('');
}

function viewProjectTasks(projectId) {
    // 1. עדכון הפילטר
    const projectFilter = document.getElementById('task-project-filter');

    // אם הפילטר עדיין לא נטען, נטען אותו
    if (projectFilter.options.length <= 1) {
        const projects = db.getProjects();
        projects.forEach(project => {
            projectFilter.innerHTML += `<option value="${project.id}">${project.name}</option>`;
        });
    }

    projectFilter.value = projectId;

    // 2. איפוס שאר הפילטרים
    document.getElementById('task-status-filter').value = 'all';
    document.getElementById('task-employee-filter').value = 'all';

    // 3. מעבר לטאב משימות
    document.querySelector('.nav-item[data-page="tasks"]').click();

    // 4. טעינת המשימות (הלחיצה על הטאב אמורה לעשות זאת, אבל ליתר ביטחון)
    loadTasks();
}

function goToTask(taskId) {
    // מעבר לטאב משימות ופתיחת דיאלוג המשימה
    document.querySelector('.nav-item[data-page="tasks"]').click();
    loadTasks();
    // פתיחת דיאלוג המשימה
    setTimeout(() => {
        viewTask(taskId);
    }, 100);
}
window.goToTask = goToTask;

// ============================================
// פרויקטים
// ============================================

function loadProjects() {
    // טעינת מנהלים לפילטר (תמיד מרענן)
    isUpdatingFilters = true;
    const managerFilter = document.getElementById('project-manager-filter');
    const selectedManagerValue = managerFilter.value;
    managerFilter.innerHTML = '<option value="all">הכל</option>';
    const managers = db.getManagers();
    managers.forEach(manager => {
        managerFilter.innerHTML += `<option value="${manager.id}">${manager.name}</option>`;
    });
    managerFilter.value = selectedManagerValue;
    if (!managerFilter.value) managerFilter.value = 'all';
    isUpdatingFilters = false;

    // קבלת ערכי פילטר
    const statusFilter = document.getElementById('project-status-filter').value;
    const selectedManager = managerFilter.value;

    // סינון פרויקטים
    let projects = db.getProjectsByStatus(statusFilter);
    if (selectedManager !== 'all') {
        projects = projects.filter(p => p.managerId === selectedManager);
    }

    const container = document.getElementById('projects-list');

    if (projects.length === 0) {
        container.innerHTML = '<p class="empty-message">אין פרויקטים להצגה. לחץ על "פרויקט חדש" להוספת פרויקט.</p>';
        return;
    }

    // קיבוץ פרויקטים לפי מנהל
    const grouped = {};
    const noManager = [];

    projects.forEach(project => {
        if (project.managerId) {
            if (!grouped[project.managerId]) {
                grouped[project.managerId] = [];
            }
            grouped[project.managerId].push(project);
        } else {
            noManager.push(project);
        }
    });

    // בניית ה-HTML לפי קבוצות
    let html = '';

    // סדר מנהלים קבוע: אבי לוסקי, שירה עמיאור, בנג'י רוזמן, השאר לפי שם
    const managerOrder = ['e2', 'e3', 'e4'];
    const managerIds = Object.keys(grouped);
    managerIds.sort((a, b) => {
        const indexA = managerOrder.indexOf(a);
        const indexB = managerOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        const mA = db.getEmployeeById(a);
        const mB = db.getEmployeeById(b);
        return (mA ? mA.name : '').localeCompare(mB ? mB.name : '', 'he');
    });

    managerIds.forEach(managerId => {
        const manager = db.getEmployeeById(managerId);
        const managerProjects = grouped[managerId];
        const managerName = manager ? manager.name : 'לא ידוע';

        html += `
            <div class="project-group">
                <div class="project-group-header">
                    <span class="project-group-icon">👤</span>
                    <span class="project-group-name">${managerName}</span>
                    <span class="project-group-count">${managerProjects.length} פרויקטים</span>
                </div>
                <div class="project-group-cards">
                    ${renderProjectCards(managerProjects)}
                </div>
            </div>
        `;
    });

    // פרויקטים ללא מנהל
    if (noManager.length > 0) {
        html += `
            <div class="project-group">
                <div class="project-group-header">
                    <span class="project-group-icon">📁</span>
                    <span class="project-group-name">ללא מנהל</span>
                    <span class="project-group-count">${noManager.length} פרויקטים</span>
                </div>
                <div class="project-group-cards">
                    ${renderProjectCards(noManager)}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderProjectCards(projects) {
    return projects.map(project => {
        const manager = db.getEmployeeById(project.managerId);
        const taskCount = db.getTasksByProject(project.id).length;
        const daysInfo = getDaysRemaining(project.endDate);

        return `
            <div class="project-card">
                <div class="project-card-header clickable-header" onclick="viewProjectTasks('${project.id}')" title="לחץ לצפייה במשימות">
                    <div class="project-card-title">
                        <h4>${project.name}</h4>
                    </div>
                    <span class="status-badge status-${project.status}">${getStatusText(project.status)}</span>
                </div>
                <div class="project-card-body">
                    <p class="project-description">${project.description || 'ללא תיאור'}</p>
                    <div class="project-meta">
                        <div class="project-meta-item">
                            <span>📅</span>
                            <span>התחלה: ${formatDate(project.startDate)}</span>
                        </div>
                        <div class="project-meta-item">
                            <span>🎯</span>
                            <span>יעד: ${formatDate(project.endDate)}</span>
                        </div>
                        <div class="project-meta-item">
                            <span>✅</span>
                            <span>${taskCount} משימות</span>
                        </div>
                    </div>
                </div>
                <div class="project-card-footer">
                    <div class="project-days-info">
                        <span class="days-remaining ${daysInfo.className}">${daysInfo.text}</span>
                    </div>
                    <div class="project-actions">
                        <button class="btn btn-secondary btn-icon" onclick="openProjectModal('${project.id}')" title="ערוך">✏️</button>
                        <button class="btn btn-secondary btn-icon" onclick="openDeleteModal('project', '${project.id}', '${project.name}')" title="מחק">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// משימות
// ============================================

function loadTasks() {
    isUpdatingFilters = true;

    // קריאת ערכים נוכחיים מהפילטרים
    const managerFilter = document.getElementById('task-manager-filter');
    const projectFilter = document.getElementById('task-project-filter');
    const statusFilter = document.getElementById('task-status-filter');
    const employeeFilter = document.getElementById('task-employee-filter');

    const selectedManager = managerFilter.value;
    const selectedProject = projectFilter.value;
    const selectedStatus = statusFilter.value;
    const selectedEmployee = employeeFilter.value;

    // === שלב 1: סינון משימות לפי כל הפילטרים ===
    let allTasks = db.getTasks();
    let filteredTasks = [...allTasks];

    // סינון לפי מנהל אחראי - דרך הפרויקט של המשימה
    if (selectedManager !== 'all') {
        const managerProjectIds = db.getProjects()
            .filter(p => p.managerId === selectedManager)
            .map(p => p.id);
        filteredTasks = filteredTasks.filter(t => managerProjectIds.includes(t.projectId));
    }

    if (selectedProject !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.projectId === selectedProject);
    }
    if (selectedStatus !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.status === selectedStatus);
    }
    if (selectedEmployee !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.assigneeId === selectedEmployee);
    }

    // === שלב 2: עדכון אפשרויות הפילטרים (cascading) ===

    // מנהלים - תמיד מרענן
    const managers = db.getManagers();
    managerFilter.innerHTML = '<option value="all">הכל</option>';
    managers.forEach(manager => {
        managerFilter.innerHTML += `<option value="${manager.id}">${manager.name}</option>`;
    });
    managerFilter.value = selectedManager;
    if (!managerFilter.value) managerFilter.value = 'all';

    // פרויקטים - מסוננים לפי מנהל
    let availableProjects = db.getProjects();
    if (selectedManager !== 'all') {
        availableProjects = availableProjects.filter(p => p.managerId === selectedManager);
    }

    projectFilter.innerHTML = '<option value="all">הכל</option>';
    availableProjects.forEach(project => {
        projectFilter.innerHTML += `<option value="${project.id}">${project.name}</option>`;
    });
    projectFilter.value = selectedProject;
    if (!projectFilter.value) projectFilter.value = 'all';

    // עובדים - מסוננים לפי מנהל ופרויקט (מציג רק עובדים שיש להם משימות במסננים הנוכחיים)
    let relevantTasksForEmployees = [...allTasks];
    if (selectedManager !== 'all') {
        const managerProjectIds = db.getProjects()
            .filter(p => p.managerId === selectedManager)
            .map(p => p.id);
        relevantTasksForEmployees = relevantTasksForEmployees.filter(t => managerProjectIds.includes(t.projectId));
    }
    if (selectedProject !== 'all') {
        relevantTasksForEmployees = relevantTasksForEmployees.filter(t => t.projectId === selectedProject);
    }
    if (selectedStatus !== 'all') {
        relevantTasksForEmployees = relevantTasksForEmployees.filter(t => t.status === selectedStatus);
    }

    const relevantEmployeeIds = [...new Set(relevantTasksForEmployees.map(t => t.assigneeId).filter(Boolean))];
    const allEmployees = db.getAllWorkersAndManagers();
    const availableEmployees = allEmployees.filter(emp => relevantEmployeeIds.includes(emp.id));

    employeeFilter.innerHTML = '<option value="all">הכל</option>';
    if (allTasks.length === 0) {
        allEmployees.forEach(emp => {
            employeeFilter.innerHTML += `<option value="${emp.id}">${emp.name}</option>`;
        });
    } else {
        availableEmployees.forEach(emp => {
            employeeFilter.innerHTML += `<option value="${emp.id}">${emp.name}</option>`;
        });
    }
    employeeFilter.value = selectedEmployee;
    if (!employeeFilter.value) employeeFilter.value = 'all';

    isUpdatingFilters = false;

    // === שלב 3: מיון המשימות המסוננות ===
    let tasks = filteredTasks;

    if (taskSortColumn) {
        tasks = sortTasks(tasks, taskSortColumn, taskSortDirection);
    }

    // === שלב 4: הצגת המשימות ===
    const container = document.getElementById('tasks-list');

    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-message">אין משימות להצגה. לחץ על "משימה חדשה" להוספת משימה.</p>';
        return;
    }

    const sortIcon = (col) => {
        if (taskSortColumn !== col) return '<span class="sort-icon">⇅</span>';
        return taskSortDirection === 'asc'
            ? '<span class="sort-icon active">▲</span>'
            : '<span class="sort-icon active">▼</span>';
    };

    container.innerHTML = `
        <table class="tasks-table">
            <thead>
                <tr>
                    <th class="sortable-th" onclick="sortTasksBy('name')">שם המשימה ${sortIcon('name')}</th>
                    <th class="sortable-th" onclick="sortTasksBy('project')">פרויקט ${sortIcon('project')}</th>
                    <th class="sortable-th" onclick="sortTasksBy('manager')">מנהל ${sortIcon('manager')}</th>
                    <th class="sortable-th" onclick="sortTasksBy('assignee')">עובד ${sortIcon('assignee')}</th>
                    <th class="sortable-th" onclick="sortTasksBy('priority')">עדיפות ${sortIcon('priority')}</th>
                    <th class="sortable-th" onclick="sortTasksBy('dueDate')">תאריך יעד ${sortIcon('dueDate')}</th>
                    <th class="sortable-th" onclick="sortTasksBy('daysRemaining')">ימים נותרים ${sortIcon('daysRemaining')}</th>
                    <th class="sortable-th" onclick="sortTasksBy('status')">סטטוס ${sortIcon('status')}</th>
                </tr>
            </thead>
            <tbody>
                ${tasks.map(task => {
        const project = db.getProjectById(task.projectId);
        const projectManager = project ? db.getEmployeeById(project.managerId) : null;
        const assignee = db.getEmployeeById(task.assigneeId);
        const daysInfo = task.status === 'completed' ? { text: 'הושלם ✓', className: 'normal' } : getDaysRemaining(task.dueDate);

        return `
                        <tr class="task-row-clickable" onclick="viewTask('${task.id}')">
                            <td class="task-name-cell">${task.name}</td>
                            <td class="task-project-cell">${project ? project.name : 'ללא פרויקט'}</td>
                            <td class="task-manager-cell">${projectManager ? projectManager.name : '-'}</td>
                            <td class="task-assignee-cell">
                                ${assignee ? assignee.name : 'לא הוקצה'}
                            </td>
                            <td><span class="priority-badge priority-${task.priority}">${getPriorityText(task.priority)}</span></td>
                            <td class="task-date-cell">${formatDate(task.dueDate)}</td>
                            <td><span class="days-remaining ${daysInfo.className}">${daysInfo.text}</span></td>
                            <td><span class="status-badge status-${task.status}">${getTaskStatusText(task.status)}</span></td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

// מיון משימות לפי עמודה
function sortTasksBy(column) {
    if (taskSortColumn === column) {
        // אם כבר ממוין לפי עמודה זו - שנה כיוון
        taskSortDirection = taskSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        taskSortColumn = column;
        taskSortDirection = 'asc';
    }
    loadTasks();
}
window.sortTasksBy = sortTasksBy;

function sortTasks(tasks, column, direction) {
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    const statusOrder = { 'in-progress': 1, 'pending': 2, 'completed': 3 };

    return [...tasks].sort((a, b) => {
        let valA, valB;

        switch (column) {
            case 'name':
                valA = a.name || '';
                valB = b.name || '';
                break;
            case 'project': {
                const pA = db.getProjectById(a.projectId);
                const pB = db.getProjectById(b.projectId);
                valA = pA ? pA.name : '';
                valB = pB ? pB.name : '';
                break;
            }
            case 'manager': {
                const prjA = db.getProjectById(a.projectId);
                const prjB = db.getProjectById(b.projectId);
                const mA = prjA ? db.getEmployeeById(prjA.managerId) : null;
                const mB = prjB ? db.getEmployeeById(prjB.managerId) : null;
                valA = mA ? mA.name : '';
                valB = mB ? mB.name : '';
                break;
            }
            case 'assignee': {
                const eA = db.getEmployeeById(a.assigneeId);
                const eB = db.getEmployeeById(b.assigneeId);
                valA = eA ? eA.name : '';
                valB = eB ? eB.name : '';
                break;
            }
            case 'priority':
                valA = priorityOrder[a.priority] || 99;
                valB = priorityOrder[b.priority] || 99;
                return direction === 'asc' ? valA - valB : valB - valA;
            case 'dueDate':
                valA = a.dueDate || '';
                valB = b.dueDate || '';
                break;
            case 'daysRemaining': {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dA = a.dueDate ? Math.ceil((new Date(a.dueDate) - today) / (1000 * 60 * 60 * 24)) : 9999;
                const dB = b.dueDate ? Math.ceil((new Date(b.dueDate) - today) / (1000 * 60 * 60 * 24)) : 9999;
                return direction === 'asc' ? dA - dB : dB - dA;
            }
            case 'status':
                valA = statusOrder[a.status] || 99;
                valB = statusOrder[b.status] || 99;
                return direction === 'asc' ? valA - valB : valB - valA;
            default:
                return 0;
        }

        // מיון טקסט (עברית)
        if (typeof valA === 'string') {
            const cmp = valA.localeCompare(valB, 'he');
            return direction === 'asc' ? cmp : -cmp;
        }
        return direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
}

// ============================================
// עובדים
// ============================================

function loadEmployees() {
    const container = document.getElementById('departments-container');
    const managers = db.getManagers();

    if (managers.length === 0) {
        // אם אין מנהלים, נציג את כל העובדים שאין להם מנהל (או שכולם טרם נטענו)
        const allEmployees = db.getAllWorkersAndManagers();
        if (allEmployees.length === 0) {
            container.innerHTML = '<p class="empty-message">אין עובדים להצגה</p>';
            return;
        }
    }

    container.innerHTML = managers.map(manager => {
        const team = db.getTeamByManager(manager.id);

        // מנהלים בכירים (כמו e1, e2, e3, e4) לא ניתנים למחיקה.
        // נבדוק אם יש להם parentId או אם הם מסומנים כמנהלים קבועים
        // הנחה: המנהלים הראשוניים הם e1-e4. נגן על אלו.
        const protectedIds = ['e1', 'e2', 'e3', 'e4'];
        // או פשוט נגן על כל מי שהוא מנהל שיש לו צוות? לא, המשתמש אמר "אל תיגע במנהלים".
        // נניח שרק מנהלים שנוצרו ידנית (חדשים) אפשר למחוק? המשתמש אמר "להסיר עובדים קיימים... אל תיגע במנהלים".
        // נפרש זאת: אל תאפשר מחיקת מנהלים בכלל.
        const canDeleteManager = false;

        return `
            <div class="department-card">
                <div class="org-card">
                    <div class="org-avatar">👔</div>
                    <h3>${manager.name}</h3>
                    <p>${manager.role}</p>
                    
                    <div class="team-members">
                        ${team.map(member => `
                            <div class="team-member">
                                <span>👤 ${member.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// פונקציות עזר
// ============================================

function updateDate() {
    const dateElement = document.getElementById('current-date');
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = now.toLocaleDateString('he-IL', options);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getStatusText(status) {
    const statuses = {
        'active': 'פעיל',
        'completed': 'הושלם',
        'paused': 'מושהה'
    };
    return statuses[status] || status;
}

function getTaskStatusText(status) {
    const statuses = {
        'pending': 'ממתין',
        'in-progress': 'בביצוע',
        'completed': 'הושלם'
    };
    return statuses[status] || status;
}

function getPriorityText(priority) {
    const priorities = {
        'high': 'גבוהה',
        'medium': 'בינונית',
        'low': 'נמוכה'
    };
    return priorities[priority] || priority;
}

// חישוב ימים נותרים
function getDaysRemaining(dateStr) {
    if (!dateStr) return { text: 'לא נקבע', className: 'normal' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        const daysLate = Math.abs(diffDays);
        return {
            text: `⚠️ איחור של ${daysLate} ${daysLate === 1 ? 'יום' : 'ימים'}`,
            className: 'overdue'
        };
    } else if (diffDays === 0) {
        return {
            text: '⏰ היום!',
            className: 'urgent'
        };
    } else if (diffDays === 1) {
        return {
            text: '⏰ מחר',
            className: 'urgent'
        };
    } else if (diffDays <= 3) {
        return {
            text: `⏰ עוד ${diffDays} ימים`,
            className: 'urgent'
        };
    } else if (diffDays <= 7) {
        return {
            text: `⚡ עוד ${diffDays} ימים`,
            className: 'warning'
        };
    } else {
        return {
            text: `✓ עוד ${diffDays} ימים`,
            className: 'normal'
        };
    }
}
