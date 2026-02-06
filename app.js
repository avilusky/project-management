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

// ============================================
// אתחול האפליקציה
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // המתנה לאתחול Firebase
        await db.init();

        // רישום למאזין שינויים
        db.onDataChange((type) => {
            refreshCurrentPage();
        });

        initNavigation();
        initModals();
        initForms();
        initFilters();
        updateDate();
        loadDashboard();
        loadEmployees();

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
        'dashboard': 'דשבורד',
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

    // טעינת פרויקטים
    loadProjectsSelect('task-project');

    // טעינת עובדים
    loadEmployeesSelect('task-assignee');

    if (taskId) {
        // עריכת משימה קיימת
        const task = db.getTaskById(taskId);
        title.textContent = 'עריכת משימה';
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-name').value = task.name;
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-project').value = task.projectId;
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
    }

    openModal('task-modal');
}

function openDeleteModal(type, id, name) {
    currentDeleteType = type;
    currentDeleteTarget = id;

    const message = type === 'project'
        ? `האם אתה בטוח שברצונך למחוק את הפרויקט "${name}"? כל המשימות הקשורות אליו יימחקו גם כן.`
        : `האם אתה בטוח שברצונך למחוק את המשימה "${name}"?`;

    document.getElementById('delete-message').textContent = message;
    openModal('delete-modal');
}

async function confirmDelete() {
    try {
        if (currentDeleteType === 'project') {
            await db.deleteProject(currentDeleteTarget);
        } else if (currentDeleteType === 'task') {
            await db.deleteTask(currentDeleteTarget);
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
}

async function saveProject() {
    const id = document.getElementById('project-id').value;
    const project = {
        name: document.getElementById('project-name').value,
        description: document.getElementById('project-description').value,
        managerId: document.getElementById('project-manager').value,
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

// ============================================
// פילטרים
// ============================================

function initFilters() {
    // פילטרי פרויקטים
    document.getElementById('project-status-filter').addEventListener('change', loadProjects);
    document.getElementById('project-manager-filter').addEventListener('change', loadProjects);

    // פילטרי משימות
    document.getElementById('task-project-filter').addEventListener('change', loadTasks);
    document.getElementById('task-status-filter').addEventListener('change', loadTasks);
    document.getElementById('task-employee-filter').addEventListener('change', loadTasks);
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

function loadProjectsSelect(selectId) {
    const select = document.getElementById(selectId);
    const projects = db.getActiveProjects();

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
            <div class="mini-task-item">
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

        return `
            <div class="mini-project-item">
                <div class="project-mini-info">
                    <span class="project-mini-name">${project.name}</span>
                    <span class="project-mini-manager">${manager ? manager.name : 'ללא מנהל'}</span>
                </div>
                <span class="project-mini-status status-badge status-${project.status}">${getStatusText(project.status)}</span>
            </div>
        `;
    }).join('');
}

// ============================================
// פרויקטים
// ============================================

function loadProjects() {
    // טעינת מנהלים לפילטר
    const managerFilter = document.getElementById('project-manager-filter');
    if (managerFilter.options.length <= 1) {
        const managers = db.getManagers();
        managers.forEach(manager => {
            managerFilter.innerHTML += `<option value="${manager.id}">${manager.name}</option>`;
        });
    }

    // קבלת ערכי פילטר
    const statusFilter = document.getElementById('project-status-filter').value;
    const selectedManager = document.getElementById('project-manager-filter').value;

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

    container.innerHTML = projects.map(project => {
        const manager = db.getEmployeeById(project.managerId);
        const taskCount = db.getTasksByProject(project.id).length;
        const daysInfo = getDaysRemaining(project.endDate);

        return `
            <div class="project-card">
                <div class="project-card-header">
                    <div class="project-card-title">
                        <h4>${project.name}</h4>
                        <span class="project-card-manager">👤 ${manager ? manager.name : 'ללא מנהל'}</span>
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
    // טעינת פרויקטים לפילטר
    const projectFilter = document.getElementById('task-project-filter');
    if (projectFilter.options.length <= 1) {
        const projects = db.getProjects();
        projects.forEach(project => {
            projectFilter.innerHTML += `<option value="${project.id}">${project.name}</option>`;
        });
    }

    // טעינת עובדים לפילטר
    const employeeFilter = document.getElementById('task-employee-filter');
    if (employeeFilter.options.length <= 1) {
        const employees = db.getAllWorkersAndManagers();
        employees.forEach(emp => {
            employeeFilter.innerHTML += `<option value="${emp.id}">${emp.name}</option>`;
        });
    }

    // קבלת ערכי פילטר
    const selectedProject = document.getElementById('task-project-filter').value;
    const selectedStatus = document.getElementById('task-status-filter').value;
    const selectedEmployee = document.getElementById('task-employee-filter').value;

    // סינון משימות
    let tasks = db.getTasks();
    if (selectedProject !== 'all') {
        tasks = tasks.filter(t => t.projectId === selectedProject);
    }
    if (selectedStatus !== 'all') {
        tasks = tasks.filter(t => t.status === selectedStatus);
    }
    if (selectedEmployee !== 'all') {
        tasks = tasks.filter(t => t.assigneeId === selectedEmployee);
    }

    const container = document.getElementById('tasks-list');

    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-message">אין משימות להצגה. לחץ על "משימה חדשה" להוספת משימה.</p>';
        return;
    }

    container.innerHTML = `
        <table class="tasks-table">
            <thead>
                <tr>
                    <th>שם המשימה</th>
                    <th>פרויקט</th>
                    <th>עובד אחראי</th>
                    <th>עדיפות</th>
                    <th>תאריך יעד</th>
                    <th>ימים נותרים</th>
                    <th>סטטוס</th>
                    <th>פעולות</th>
                </tr>
            </thead>
            <tbody>
                ${tasks.map(task => {
        const project = db.getProjectById(task.projectId);
        const assignee = db.getEmployeeById(task.assigneeId);
        const daysInfo = task.status === 'completed' ? { text: 'הושלם ✓', className: 'normal' } : getDaysRemaining(task.dueDate);

        return `
                        <tr>
                            <td class="task-name-cell">${task.name}</td>
                            <td class="task-project-cell">${project ? project.name : 'ללא פרויקט'}</td>
                            <td class="task-assignee-cell">
                                <span class="task-assignee-avatar">👤</span>
                                ${assignee ? assignee.name : 'לא הוקצה'}
                            </td>
                            <td><span class="priority-badge priority-${task.priority}">${getPriorityText(task.priority)}</span></td>
                            <td class="task-date-cell">${formatDate(task.dueDate)}</td>
                            <td><span class="days-remaining ${daysInfo.className}">${daysInfo.text}</span></td>
                            <td><span class="status-badge status-${task.status}">${getTaskStatusText(task.status)}</span></td>
                            <td class="task-actions">
                                <button class="btn btn-secondary btn-icon" onclick="openTaskModal('${task.id}')" title="ערוך">✏️</button>
                                <button class="btn btn-secondary btn-icon" onclick="openDeleteModal('task', '${task.id}', '${task.name}')" title="מחק">🗑️</button>
                            </td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

// ============================================
// עובדים
// ============================================

function loadEmployees() {
    const container = document.getElementById('departments-container');
    const managers = db.getManagers();

    container.innerHTML = managers.map(manager => {
        const team = db.getTeamByManager(manager.id);

        return `
            <div class="department-card">
                <div class="org-card">
                    <div class="org-avatar">👔</div>
                    <h3>${manager.name}</h3>
                    <p>${manager.role}</p>
                    
                    <div class="team-members">
                        ${team.map(member => `
                            <div class="team-member">
                                👤 ${member.name}
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
