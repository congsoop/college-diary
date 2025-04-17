const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

let users = [];
try {
    users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8'));
} catch (err) {
    console.error('Error loading users.json:', err);
    users = [];
}

let notifications = [];
try {
    notifications = JSON.parse(fs.readFileSync(path.join(__dirname, 'notifications.json'), 'utf8'));
} catch (err) {
    console.error('Error loading notifications.json:', err);
    notifications = [];
}

let grades = [];
try {
    grades = JSON.parse(fs.readFileSync(path.join(__dirname, 'grades.json'), 'utf8'));
} catch (err) {
    console.error('Error loading grades.json:', err);
    grades = [];
}

let schedule = [];
try {
    schedule = JSON.parse(fs.readFileSync(path.join(__dirname, 'schedule.json'), 'utf8'));
} catch (err) {
    console.error('Error loading schedule.json:', err);
    schedule = [];
}

let attendance = [];
try {
    attendance = JSON.parse(fs.readFileSync(path.join(__dirname, 'attendance.json'), 'utf8'));
} catch (err) {
    console.error('Error loading attendance.json:', err);
    attendance = [];
}

let remarks = [];
try {
    remarks = JSON.parse(fs.readFileSync(path.join(__dirname, 'remarks.json'), 'utf8'));
} catch (err) {
    console.error('Error loading remarks.json:', err);
    remarks = [];
}

let parents = [];
try {
    parents = JSON.parse(fs.readFileSync(path.join(__dirname, 'parents.json'), 'utf8'));
} catch (err) {
    console.error('Error loading parents.json:', err);
    parents = [];
}

const saveFile = (filename, data) => {
    fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(data, null, 2));
};

const addNotification = (userId, message) => {
    notifications.push({
        id: notifications.length + 1,
        userId,
        message,
        timestamp: new Date().toISOString(),
        read: false
    });
    saveFile('notifications.json', notifications);
};

const renderTemplate = (html, user) => {
    const fullName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username;
    html = html.replace(/<!-- FULLNAME -->/g, fullName);
    html = html.replace(/<!-- USERNAME -->/g, user.username);
    if (user.role === 'teacher') {
        html = html.replace(/<!-- IF_TEACHER -->/g, '').replace(/<!-- END_IF_TEACHER -->/g, '');
    } else {
        html = html.replace(/<!-- IF_TEACHER -->[\s\S]*?<!-- END_IF_TEACHER -->/g, '');
    }
    const userNotifications = notifications.filter(n => n.userId === user.id && !n.read);
    let notificationHtml = userNotifications.length > 0 ? `
        <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" id="notificationsDropdown" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fas fa-bell fa-fw"></i>
                <span class="badge bg-danger">${userNotifications.length}</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="notificationsDropdown">
                ${userNotifications.map(n => `
                    <li><a class="dropdown-item" href="/mark-notification-read?id=${n.id}">${n.message} (${new Date(n.timestamp).toLocaleString('ru-RU')})</a></li>
                `).join('')}
            </ul>
        </li>
    ` : '';
    html = html.replace('<!-- NOTIFICATIONS -->', notificationHtml);
    return html;
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    const cookies = req.headers.cookie ? querystring.parse(req.headers.cookie, '; ') : {};
    const user = cookies.edmsid ? users.find(u => u.id === parseInt(cookies.edmsid)) : null;

    console.log(`Request: ${req.method} ${pathname}`);

    if (pathname === '/login' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(path.join(__dirname, 'views', 'login.html')).pipe(res);
    } else if (pathname === '/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { username, password } = querystring.parse(body);
            const user = users.find(u => u.username === username && u.password === password);
            if (user) {
                res.writeHead(302, {
                    'Set-Cookie': `edmsid=${user.id}; Path=/`,
                    'Location': '/dashboard'
                });
                res.end();
            } else {
                let html = fs.readFileSync(path.join(__dirname, 'views', 'login.html'), 'utf8');
                html = html.replace('<!-- ERROR -->', '<p class="text-danger">Неверный логин или пароль</p>');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            }
        });
    } else if (pathname === '/register' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { firstName, lastName, username, password, role } = querystring.parse(body);
            if (users.find(u => u.username === username)) {
                let html = fs.readFileSync(path.join(__dirname, 'views', 'login.html'), 'utf8');
                html = html.replace('<!-- REG_ERROR -->', '<p class="text-danger">Пользователь с таким логином уже существует</p>');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            } else {
                const newUser = {
                    id: users.length + 1,
                    firstName,
                    lastName,
                    username,
                    password,
                    role
                };
                users.push(newUser);
                saveFile('users.json', users);
                res.writeHead(302, {
                    'Set-Cookie': `edmsid=${newUser.id}; Path=/`,
                    'Location': '/dashboard'
                });
                res.end();
            }
        });
    } else if (pathname === '/dashboard') {
        if (!user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'dashboard.html'), 'utf8');
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/change-password' && req.method === 'GET') {
        if (!user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'change-password.html'), 'utf8');
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/change-password' && req.method === 'POST') {
        if (!user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { newPassword } = querystring.parse(body);
            user.password = newPassword;
            saveFile('users.json', users);
            res.writeHead(302, { 'Location': '/dashboard' });
            res.end();
        });
    } else if (pathname === '/profile') {
        if (!user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'profile.html'), 'utf8');
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/add-grades' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять оценки</p>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'add-grades.html'), 'utf8');
        let studentOptions = users
            .filter(u => u.role === 'student')
            .map(u => `<option value="${u.username}">${u.firstName} ${u.lastName}</option>`)
            .join('');
        html = html.replace('<!-- STUDENT_OPTIONS -->', studentOptions);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/add-grades' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять оценки</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { student, subject, grade } = querystring.parse(body);
            grades.push({ id: grades.length + 1, student, subject, grade, addedBy: user.id });
            saveFile('grades.json', grades);
            const studentUser = users.find(u => u.username === student);
            if (studentUser) {
                addNotification(studentUser.id, `Вам поставили оценку ${grade} по предмету ${subject}`);
            }
            res.writeHead(302, { 'Location': '/manage-grades' });
            res.end();
        });
    } else if (pathname === '/edit-grade' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать оценки</p>');
            return;
        }
        const gradeId = parseInt(query.id);
        const grade = grades.find(g => g.id === gradeId);
        if (!grade) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Оценка не найдена</h1>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'edit-grade.html'), 'utf8');
        let studentOptions = users
            .filter(u => u.role === 'student')
            .map(u => `<option value="${u.username}" ${u.username === grade.student ? 'selected' : ''}>${u.firstName} ${u.lastName}</option>`)
            .join('');
        html = html.replace('<!-- STUDENT_OPTIONS -->', studentOptions);
        html = html.replace('<!-- SUBJECT -->', grade.subject);
        html = html.replace('<!-- GRADE -->', grade.grade);
        html = html.replace('<!-- GRADE_ID -->', grade.id);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/edit-grade' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать оценки</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { id, student, subject, grade } = querystring.parse(body);
            const gradeIndex = grades.findIndex(g => g.id === parseInt(id));
            if (gradeIndex !== -1) {
                const oldGrade = grades[gradeIndex];
                grades[gradeIndex] = { id: parseInt(id), student, subject, grade, addedBy: user.id };
                saveFile('grades.json', grades);
                const studentUser = users.find(u => u.username === student);
                if (studentUser) {
                    addNotification(studentUser.id, `Ваша оценка по предмету ${subject} изменена с ${oldGrade.grade} на ${grade}`);
                }
            }
            res.writeHead(302, { 'Location': '/manage-grades' });
            res.end();
        });
    } else if (pathname === '/delete-grade' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут удалять оценки</p>');
            return;
        }
        const gradeId = parseInt(query.id);
        const grade = grades.find(g => g.id === gradeId);
        if (grade) {
            const studentUser = users.find(u => u.username === grade.student);
            if (studentUser) {
                addNotification(studentUser.id, `Ваша оценка ${grade.grade} по предмету ${grade.subject} была удалена`);
            }
        }
        grades = grades.filter(g => g.id !== gradeId);
        saveFile('grades.json', grades);
        res.writeHead(302, { 'Location': '/manage-grades' });
        res.end();
    } else if (pathname === '/manage-grades') {
        if (!user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'manage-grades.html'), 'utf8');
        let tableRows = '';
        if (user.role === 'teacher') {
            grades.forEach(g => {
                const student = users.find(u => u.username === g.student);
                const studentName = student ? `${student.firstName} ${student.lastName}` : g.student;
                tableRows += `<tr><td>${studentName}</td><td>${g.subject}</td><td>${g.grade}</td><td><a href="/edit-grade?id=${g.id}" class="btn btn-warning btn-sm">Редактировать</a> <a href="/delete-grade?id=${g.id}" class="btn btn-danger btn-sm">Удалить</a></td></tr>`;
            });
        } else {
            grades.filter(g => g.student === user.username).forEach(g => {
                const student = users.find(u => u.username === g.student);
                const studentName = student ? `${student.firstName} ${student.lastName}` : g.student;
                tableRows += `<tr><td>${studentName}</td><td>${g.subject}</td><td>${g.grade}</td></tr>`;
            });
        }
        html = renderTemplate(html, user);
        html = html.replace('<!-- GRADES -->', tableRows);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/add-schedule' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять расписание</p>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'add-schedule.html'), 'utf8');
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/add-schedule' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять расписание</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { day, time, subject } = querystring.parse(body);
            schedule.push({ id: schedule.length + 1, day, time, subject, addedBy: user.id });
            saveFile('schedule.json', schedule);
            users.filter(u => u.role === 'student').forEach(student => {
                addNotification(student.id, `Расписание обновлено: ${subject} в ${day} с ${time}`);
            });
            res.writeHead(302, { 'Location': '/manage-schedule' });
            res.end();
        });
    } else if (pathname === '/edit-schedule' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать расписание</p>');
            return;
        }
        const scheduleId = parseInt(query.id);
        const entry = schedule.find(s => s.id === scheduleId);
        if (!entry) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Запись не найдена</h1>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'edit-schedule.html'), 'utf8');
        html = html.replace('<!-- DAY -->', entry.day);
        html = html.replace('<!-- TIME -->', entry.time);
        html = html.replace('<!-- SUBJECT -->', entry.subject);
        html = html.replace('<!-- SCHEDULE_ID -->', entry.id);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/edit-schedule' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать расписание</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { id, day, time, subject } = querystring.parse(body);
            const scheduleIndex = schedule.findIndex(s => s.id === parseInt(id));
            if (scheduleIndex !== -1) {
                const oldEntry = schedule[scheduleIndex];
                schedule[scheduleIndex] = { id: parseInt(id), day, time, subject, addedBy: user.id };
                saveFile('schedule.json', schedule);
                users.filter(u => u.role === 'student').forEach(student => {
                    addNotification(student.id, `Расписание изменено: ${oldEntry.subject} в ${oldEntry.day} с ${oldEntry.time} на ${subject} в ${day} с ${time}`);
                });
            }
            res.writeHead(302, { 'Location': '/manage-schedule' });
            res.end();
        });
    } else if (pathname === '/delete-schedule' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут удалять расписание</p>');
            return;
        }
        const scheduleId = parseInt(query.id);
        const entry = schedule.find(s => s.id === scheduleId);
        if (entry) {
            users.filter(u => u.role === 'student').forEach(student => {
                addNotification(student.id, `Запись в расписании удалена: ${entry.subject} в ${entry.day} с ${entry.time}`);
            });
        }
        schedule = schedule.filter(s => s.id !== scheduleId);
        saveFile('schedule.json', schedule);
        res.writeHead(302, { 'Location': '/manage-schedule' });
        res.end();
    } else if (pathname === '/manage-schedule') {
        if (!user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'manage-schedule.html'), 'utf8');
        const timeSlots = ["08:00-09:30", "09:40-11:10", "11:20-12:50", "13:00-14:30", "14:40-16:10", "16:20-17:50"];
        const days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
        let tableRows = '';
        timeSlots.forEach(time => {
            tableRows += '<tr>';
            tableRows += `<td>${time}</td>`;
            days.forEach(day => {
                const entry = schedule.find(s => s.day === day && s.time === time);
                if (entry && user.role === 'teacher') {
                    tableRows += `<td>${entry.subject} <br><a href="/edit-schedule?id=${entry.id}" class="btn btn-warning btn-sm mt-1">Редактировать</a> <a href="/delete-schedule?id=${entry.id}" class="btn btn-danger btn-sm mt-1">Удалить</a></td>`;
                } else {
                    tableRows += `<td>${entry ? entry.subject : ''}</td>`;
                }
            });
            tableRows += '</tr>';
        });
        html = renderTemplate(html, user);
        html = html.replace('<!-- SCHEDULE_TABLE -->', tableRows);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/add-attendance' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять посещаемость</p>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'add-attendance.html'), 'utf8');
        let studentOptions = users
            .filter(u => u.role === 'student')
            .map(u => `<option value="${u.username}">${u.firstName} ${u.lastName}</option>`)
            .join('');
        html = html.replace('<!-- STUDENT_OPTIONS -->', studentOptions);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/add-attendance' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять посещаемость</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { student, date, status } = querystring.parse(body);
            attendance.push({ id: attendance.length + 1, student, date, status, addedBy: user.id });
            saveFile('attendance.json', attendance);
            const studentUser = users.find(u => u.username === student);
            if (studentUser) {
                addNotification(studentUser.id, `Ваша посещаемость отмечена: ${status} на ${date}`);
                const parent = parents.find(p => p.studentUsername === student);
                if (parent) {
                    addNotification(studentUser.id, `Родителю отправлено уведомление о вашей посещаемости: ${status} на ${date}`);
                }
            }
            res.writeHead(302, { 'Location': '/manage-attendance' });
            res.end();
        });
    } else if (pathname === '/manage-attendance') {
        if (!user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'manage-attendance.html'), 'utf8');
        let tableRows = '';
        if (user.role === 'teacher') {
            attendance.forEach(a => {
                const student = users.find(u => u.username === a.student);
                const studentName = student ? `${student.firstName} ${student.lastName}` : a.student;
                tableRows += `<tr><td>${studentName}</td><td>${a.date}</td><td>${a.status}</td><td><a href="/edit-attendance?id=${a.id}" class="btn btn-warning btn-sm">Редактировать</a> <a href="/delete-attendance?id=${a.id}" class="btn btn-danger btn-sm">Удалить</a></td></tr>`;
            });
        } else {
            attendance.filter(a => a.student === user.username).forEach(a => {
                const student = users.find(u => u.username === a.student);
                const studentName = student ? `${student.firstName} ${student.lastName}` : a.student;
                tableRows += `<tr><td>${studentName}</td><td>${a.date}</td><td>${a.status}</td></tr>`;
            });
        }
        html = renderTemplate(html, user);
        html = html.replace('<!-- ATTENDANCE -->', tableRows);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/edit-attendance' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать посещаемость</p>');
            return;
        }
        const attendanceId = parseInt(query.id);
        const record = attendance.find(a => a.id === attendanceId);
        if (!record) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Запись не найдена</h1>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'edit-attendance.html'), 'utf8');
        let studentOptions = users
            .filter(u => u.role === 'student')
            .map(u => `<option value="${u.username}" ${u.username === record.student ? 'selected' : ''}>${u.firstName} ${u.lastName}</option>`)
            .join('');
        html = html.replace('<!-- STUDENT_OPTIONS -->', studentOptions);
        html = html.replace('<!-- DATE -->', record.date);
        html = html.replace('<!-- STATUS -->', record.status);
        html = html.replace('<!-- ATTENDANCE_ID -->', record.id);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/edit-attendance' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать посещаемость</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { id, student, date, status } = querystring.parse(body);
            const attendanceIndex = attendance.findIndex(a => a.id === parseInt(id));
            if (attendanceIndex !== -1) {
                const oldRecord = attendance[attendanceIndex];
                attendance[attendanceIndex] = { id: parseInt(id), student, date, status, addedBy: user.id };
                saveFile('attendance.json', attendance);
                const studentUser = users.find(u => u.username === student);
                if (studentUser) {
                    addNotification(studentUser.id, `Ваша посещаемость изменена: с ${oldRecord.status} на ${status} за ${date}`);
                    const parent = parents.find(p => p.studentUsername === student);
                    if (parent) {
                        addNotification(studentUser.id, `Родителю отправлено уведомление об изменении посещаемости: ${status} на ${date}`);
                    }
                }
            }
            res.writeHead(302, { 'Location': '/manage-attendance' });
            res.end();
        });
    } else if (pathname === '/delete-attendance' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут удалять посещаемость</p>');
            return;
        }
        const attendanceId = parseInt(query.id);
        const record = attendance.find(a => a.id === attendanceId);
        if (record) {
            const studentUser = users.find(u => u.username === record.student);
            if (studentUser) {
                addNotification(studentUser.id, `Запись о вашей посещаемости за ${record.date} удалена`);
            }
        }
        attendance = attendance.filter(a => a.id !== attendanceId);
        saveFile('attendance.json', attendance);
        res.writeHead(302, { 'Location': '/manage-attendance' });
        res.end();
    } else if (pathname === '/add-remark' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять замечания</p>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'add-remark.html'), 'utf8');
        let studentOptions = users
            .filter(u => u.role === 'student')
            .map(u => `<option value="${u.username}">${u.firstName} ${u.lastName}</option>`)
            .join('');
        html = html.replace('<!-- STUDENT_OPTIONS -->', studentOptions);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/add-remark' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять замечания</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { student, date, remark } = querystring.parse(body);
            remarks.push({ id: remarks.length + 1, student, date, remark, addedBy: user.id });
            saveFile('remarks.json', remarks);
            const studentUser = users.find(u => u.username === student);
            if (studentUser) {
                addNotification(studentUser.id, `Вам добавлено замечание: ${remark} за ${date}`);
                const parent = parents.find(p => p.studentUsername === student);
                if (parent) {
                    addNotification(studentUser.id, `Родителю отправлено уведомление о вашем замечании: ${remark} за ${date}`);
                }
            }
            res.writeHead(302, { 'Location': '/manage-remarks' });
            res.end();
        });
    } else if (pathname === '/manage-remarks') {
        if (!user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'manage-remarks.html'), 'utf8');
        let tableRows = '';
        if (user.role === 'teacher') {
            remarks.forEach(r => {
                const student = users.find(u => u.username === r.student);
                const studentName = student ? `${student.firstName} ${student.lastName}` : r.student;
                tableRows += `<tr><td>${studentName}</td><td>${r.date}</td><td>${r.remark}</td><td><a href="/edit-remark?id=${r.id}" class="btn btn-warning btn-sm">Редактировать</a> <a href="/delete-remark?id=${r.id}" class="btn btn-danger btn-sm">Удалить</a></td></tr>`;
            });
        } else {
            remarks.filter(r => r.student === user.username).forEach(r => {
                const student = users.find(u => u.username === r.student);
                const studentName = student ? `${student.firstName} ${student.lastName}` : r.student;
                tableRows += `<tr><td>${studentName}</td><td>${r.date}</td><td>${r.remark}</td></tr>`;
            });
        }
        html = renderTemplate(html, user);
        html = html.replace('<!-- REMARKS -->', tableRows);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/edit-remark' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать замечания</p>');
            return;
        }
        const remarkId = parseInt(query.id);
        const remark = remarks.find(r => r.id === remarkId);
        if (!remark) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Замечание не найдено</h1>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'edit-remark.html'), 'utf8');
        let studentOptions = users
            .filter(u => u.role === 'student')
            .map(u => `<option value="${u.username}" ${u.username === remark.student ? 'selected' : ''}>${u.firstName} ${u.lastName}</option>`)
            .join('');
        html = html.replace('<!-- STUDENT_OPTIONS -->', studentOptions);
        html = html.replace('<!-- DATE -->', remark.date);
        html = html.replace('<!-- REMARK -->', remark.remark);
        html = html.replace('<!-- REMARK_ID -->', remark.id);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/edit-remark' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать замечания</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { id, student, date, remark } = querystring.parse(body);
            const remarkIndex = remarks.findIndex(r => r.id === parseInt(id));
            if (remarkIndex !== -1) {
                const oldRemark = remarks[remarkIndex];
                remarks[remarkIndex] = { id: parseInt(id), student, date, remark, addedBy: user.id };
                saveFile('remarks.json', remarks);
                const studentUser = users.find(u => u.username === student);
                if (studentUser) {
                    addNotification(studentUser.id, `Ваше замечание изменено: с "${oldRemark.remark}" на "${remark}" за ${date}`);
                    const parent = parents.find(p => p.studentUsername === student);
                    if (parent) {
                        addNotification(studentUser.id, `Родителю отправлено уведомление об изменении замечания: ${remark} за ${date}`);
                    }
                }
            }
            res.writeHead(302, { 'Location': '/manage-remarks' });
            res.end();
        });
    } else if (pathname === '/delete-remark' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут удалять замечания</p>');
            return;
        }
        const remarkId = parseInt(query.id);
        const remark = remarks.find(r => r.id === remarkId);
        if (remark) {
            const studentUser = users.find(u => u.username === remark.student);
            if (studentUser) {
                addNotification(studentUser.id, `Замечание "${remark.remark}" за ${remark.date} удалено`);
            }
        }
        remarks = remarks.filter(r => r.id !== remarkId);
        saveFile('remarks.json', remarks);
        res.writeHead(302, { 'Location': '/manage-remarks' });
        res.end();
    } else if (pathname === '/manage-parents' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут управлять родителями</p>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'manage-parents.html'), 'utf8');
        let tableRows = '';
        parents.forEach(p => {
            const student = users.find(u => u.username === p.studentUsername);
            const studentName = student ? `${student.firstName} ${student.lastName}` : p.studentUsername;
            tableRows += `<tr><td>${studentName}</td><td>${p.parentName}</td><td>${p.contact}</td><td><a href="/edit-parent?id=${p.id}" class="btn btn-warning btn-sm">Редактировать</a> <a href="/delete-parent?id=${p.id}" class="btn btn-danger btn-sm">Удалить</a></td></tr>`;
        });
        html = html.replace('<!-- PARENTS -->', tableRows);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/add-parent' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять родителей</p>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'add-parent.html'), 'utf8');
        let studentOptions = users
            .filter(u => u.role === 'student')
            .map(u => `<option value="${u.username}">${u.firstName} ${u.lastName}</option>`)
            .join('');
        html = html.replace('<!-- STUDENT_OPTIONS -->', studentOptions);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/add-parent' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут добавлять родителей</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { studentUsername, parentName, contact } = querystring.parse(body);
            parents.push({ id: parents.length + 1, studentUsername, parentName, contact, addedBy: user.id });
            saveFile('parents.json', parents);
            const studentUser = users.find(u => u.username === studentUsername);
            if (studentUser) {
                addNotification(studentUser.id, `Добавлена информация о родителе: ${parentName}`);
            }
            res.writeHead(302, { 'Location': '/manage-parents' });
            res.end();
        });
    } else if (pathname === '/edit-parent' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать родителей</p>');
            return;
        }
        const parentId = parseInt(query.id);
        const parent = parents.find(p => p.id === parentId);
        if (!parent) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Родитель не найден</h1>');
            return;
        }
        let html = fs.readFileSync(path.join(__dirname, 'views', 'edit-parent.html'), 'utf8');
        let studentOptions = users
            .filter(u => u.role === 'student')
            .map(u => `<option value="${u.username}" ${u.username === parent.studentUsername ? 'selected' : ''}>${u.firstName} ${u.lastName}</option>`)
            .join('');
        html = html.replace('<!-- STUDENT_OPTIONS -->', studentOptions);
        html = html.replace('<!-- PARENT_NAME -->', parent.parentName);
        html = html.replace('<!-- CONTACT -->', parent.contact);
        html = html.replace('<!-- PARENT_ID -->', parent.id);
        html = renderTemplate(html, user);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (pathname === '/edit-parent' && req.method === 'POST') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут редактировать родителей</p>');
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { id, studentUsername, parentName, contact } = querystring.parse(body);
            const parentIndex = parents.findIndex(p => p.id === parseInt(id));
            if (parentIndex !== -1) {
                parents[parentIndex] = { id: parseInt(id), studentUsername, parentName, contact, addedBy: user.id };
                saveFile('parents.json', parents);
                const studentUser = users.find(u => u.username === studentUsername);
                if (studentUser) {
                    addNotification(studentUser.id, `Информация о родителе обновлена: ${parentName}`);
                }
            }
            res.writeHead(302, { 'Location': '/manage-parents' });
            res.end();
        });
    } else if (pathname === '/delete-parent' && req.method === 'GET') {
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>Доступ запрещен</h1><p>Только учителя могут удалять родителей</p>');
            return;
        }
        const parentId = parseInt(query.id);
        const parent = parents.find(p => p.id === parentId);
        if (parent) {
            const studentUser = users.find(u => u.username === parent.studentUsername);
            if (studentUser) {
                addNotification(studentUser.id, `Информация о родителе ${parent.parentName} удалена`);
            }
        }
        parents = parents.filter(p => p.id !== parentId);
        saveFile('parents.json', parents);
        res.writeHead(302, { 'Location': '/manage-parents' });
        res.end();
    } else if (pathname === '/mark-notification-read' && req.method === 'GET') {
        if (!user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        const notificationId = parseInt(query.id);
        const notification = notifications.find(n => n.id === notificationId && n.userId === user.id);
        if (notification) {
            notification.read = true;
            saveFile('notifications.json', notifications);
        }
        res.writeHead(302, { 'Location': req.headers.referer || '/dashboard' });
        res.end();
    } else if (pathname.startsWith('/css/')) {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        fs.createReadStream(path.join(__dirname, 'public', pathname)).pipe(res);
    } else if (pathname === '/logout') {
        res.writeHead(302, {
            'Set-Cookie': 'edmsid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
            'Location': '/login'
        });
        res.end();
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});