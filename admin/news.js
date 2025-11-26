// Admin Panel - News Module
// Управление новостями

// Local state
let currentEditingNewsId = null;

// Load news for admin panel
async function loadAdminNews() {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/news`);
        if (!response.ok) throw new Error('Failed to load news');

        const data = await response.json();
        const tbody = document.getElementById('news-tbody');
        const totalSpan = document.getElementById('news-total');

        tbody.innerHTML = '';
        totalSpan.textContent = data.pagination.total;

        data.news.forEach(item => {
            const row = document.createElement('tr');
            const createdDate = new Date(item.created_at).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            row.innerHTML = `
                <td>${createdDate}</td>
                <td>${item.title}</td>
                <td>${item.author}</td>
                <td>
                    <button class="btn btn--sm btn--outline" onclick="editNews(${item.id})">Редактировать</button>
                    <button class="btn btn--sm btn--danger" onclick="deleteNews(${item.id})">Удалить</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading news:', error);
    }
}

// Show news modal
function showNewsModal(newsId = null) {
    const modal = document.getElementById('newsModal');
    const modalTitle = document.getElementById('newsModalTitle');
    const form = document.getElementById('newsForm');

    currentEditingNewsId = newsId;

    if (newsId) {
        modalTitle.textContent = 'Редактировать новость';
        loadNewsData(newsId);
    } else {
        modalTitle.textContent = 'Добавить новость';
        form.reset();
        document.getElementById('newsId').value = '';
    }

    modal.classList.add('active');
}

// Load news data for editing
async function loadNewsData(newsId) {
    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/news/${newsId}`);
        if (!response.ok) throw new Error('Failed to load news');

        const news = await response.json();

        document.getElementById('newsId').value = news.id;
        document.getElementById('newsTitle').value = news.title;
        document.getElementById('newsDescription').value = news.description;
        document.getElementById('newsImage').value = news.image_url || '';
    } catch (error) {
        console.error('Error loading news data:', error);
        alert('Ошибка загрузки новости');
    }
}

// Edit news (called from onclick in table)
function editNews(newsId) {
    showNewsModal(newsId);
}

// Delete news (called from onclick in table)
async function deleteNews(newsId) {
    if (!confirm('Вы уверены, что хотите удалить эту новость?')) return;

    try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/news/${newsId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete news');

        loadAdminNews();
    } catch (error) {
        console.error('Error deleting news:', error);
        alert('Ошибка удаления новости');
    }
}

// Close news modal
function closeNewsModal() {
    const modal = document.getElementById('newsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Initialize news section event handlers
function initNewsSection() {
    const addNewsBtn = document.getElementById('add-news-btn');
    const closeNewsModalBtn = document.getElementById('closeNewsModal');
    const cancelNewsBtn = document.getElementById('cancelNewsBtn');
    const newsForm = document.getElementById('newsForm');

    if (addNewsBtn && !addNewsBtn.hasEventListener) {
        addNewsBtn.addEventListener('click', () => showNewsModal());
        addNewsBtn.hasEventListener = true;
    }

    if (closeNewsModalBtn && !closeNewsModalBtn.hasEventListener) {
        closeNewsModalBtn.addEventListener('click', closeNewsModal);
        closeNewsModalBtn.hasEventListener = true;
    }

    if (cancelNewsBtn && !cancelNewsBtn.hasEventListener) {
        cancelNewsBtn.addEventListener('click', closeNewsModal);
        cancelNewsBtn.hasEventListener = true;
    }

    if (newsForm && !newsForm.hasEventListener) {
        newsForm.addEventListener('submit', handleNewsSubmit);
        newsForm.hasEventListener = true;
    }
}

// Handle news form submission
async function handleNewsSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');

    const formData = {
        title: document.getElementById('newsTitle').value,
        description: document.getElementById('newsDescription').value,
        image_url: document.getElementById('newsImage').value || null
    };

    submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline-block';

    try {
        const newsId = document.getElementById('newsId').value;
        const url = newsId
            ? `${ADMIN_API_BASE_URL}/news/${newsId}`
            : `${ADMIN_API_BASE_URL}/news`;
        const method = newsId ? 'PUT' : 'POST';

        console.log('Sending news data:', formData);

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        closeNewsModal();
        loadAdminNews();
    } catch (error) {
        console.error('Error saving news:', error);
        alert('Ошибка сохранения новости');
    } finally {
        submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
    }
}

// Export to window for global access
window.loadAdminNews = loadAdminNews;
window.showNewsModal = showNewsModal;
window.loadNewsData = loadNewsData;
window.editNews = editNews;
window.deleteNews = deleteNews;
window.closeNewsModal = closeNewsModal;
window.initNewsSection = initNewsSection;
window.handleNewsSubmit = handleNewsSubmit;
