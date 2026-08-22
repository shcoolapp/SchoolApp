const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getSubjects: () => request('/subjects'),
  createSubject: (name, grade, classroomSection) =>
    request('/subjects', { method: 'POST', body: JSON.stringify({ name, grade, classroomSection }) }),
  importUsers: (formData) => {
    const token = localStorage.getItem('token');
    return fetch(`${BASE_URL}/users/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    });
  },
  downloadCredentials: async (grade, classroomSection) => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (grade) params.set('grade', grade);
    if (classroomSection) params.set('classroomSection', classroomSection);
    const res = await fetch(`${BASE_URL}/users/credentials?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to download credentials');
    return res.blob();
  },

  getTodos: (month) => request(`/todos/me${month ? `?month=${month}` : ''}`),
  createTodo: (payload) => request('/todos', { method: 'POST', body: JSON.stringify(payload) }),
  deleteTodo: (id) => request(`/todos/${id}`, { method: 'DELETE' }),

  getHolidays: (year) => request(`/holidays/${year}`),

  getMyMarks: () => request('/marks/me'),
  getSubjectMarks: (subjectId) => request(`/marks/subject/${subjectId}`),

  getSubjectHomework: (subjectId) => request(`/homework/subject/${subjectId}`),
  getSubjectExams: (subjectId) => request(`/exams/subject/${subjectId}`)
};

export function setToken(token) {
  localStorage.setItem('token', token);
}
export function clearToken() {
  localStorage.removeItem('token');
}
export function getStoredUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}
export function setStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}
