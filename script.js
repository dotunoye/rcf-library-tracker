// Seed Data utilizing LocalStorage cache management
let transactions = JSON.parse(localStorage.getItem('library_data')) || [
    {
        id: 1,
        bookTitle: "The Purpose Driven Life",
        author: "Rick Warren",
        borrowerName: "John Doe",
        borrowerPhone: "08031234567",
        borrowDate: "2026-05-15",
        dueDate: "2026-06-15",
        renewalsCount: 0,
        amountPaid: 300,
        status: "Active"
    },
    {
        id: 2,
        bookTitle: "Iman & Character",
        author: "Yasmin Mogahed",
        borrowerName: "Maryam Ali",
        borrowerPhone: "09055566677",
        borrowDate: "2026-04-01",
        dueDate: "2026-05-01", 
        renewalsCount: 0,
        amountPaid: 300,
        status: "Active" 
    },
    {
        id: 6,
        bookTitle: "Iman & Character",
        author: "Yasmin Mogahed",
        borrowerName: "Maryam Ali",
        borrowerPhone: "09055566677",
        borrowDate: "2026-04-01",
        dueDate: "2026-05-01", 
        renewalsCount: 0,
        amountPaid: 300,
        status: "Active" 
    }
];

let currentFilter = 'all';

// Application Bootstrapper
function initApp() {
    evaluateOverdueStatus();
    renderCards();
}

// Scans active dates to automatically flag overdue logs
function evaluateOverdueStatus() {
    const todayStr = new Date().toISOString().split('T')[0];
    transactions.forEach(t => {
        if (t.status === 'Active' && t.dueDate < todayStr) {
            t.status = 'Overdue';
        }
    });
    saveToStorage();
}

function saveToStorage() {
    localStorage.setItem('library_data', JSON.stringify(transactions));
}

// Controls Data Input Window View States
function toggleModal(show) {
    const modal = document.getElementById('formModal');
    if(show) modal.classList.add('open');
    else modal.classList.remove('open');
}

// Process Data Submission from Mobile Drawer Layout Form
function handleFormSubmit(e) {
    e.preventDefault();
    
    const today = new Date();
    const borrowDateStr = today.toISOString().split('T')[0];
    
    // Extrapolates exactly 30 days out 
    const dueOffset = new Date();
    dueOffset.setDate(today.getDate() + 30);
    const dueDateStr = dueOffset.toISOString().split('T')[0];

    const newLoan = {
        id: Date.now(),
        bookTitle: document.getElementById('bookTitle').value,
        author: document.getElementById('author').value,
        borrowerName: document.getElementById('borrowerName').value,
        borrowerPhone: document.getElementById('borrowerPhone').value,
        borrowDate: borrowDateStr,
        dueDate: dueDateStr,
        renewalsCount: 0,
        amountPaid: 300,
        status: "Active"
    };

    transactions.unshift(newLoan);
    saveToStorage();
    document.getElementById('loanForm').reset();
    toggleModal(false);
    renderCards();
}

// Updates State to Returned
function markAsReturned(id) {
    transactions = transactions.map(t => {
        if (t.id === id) t.status = 'Returned';
        return t;
    });
    saveToStorage();
    renderCards();
}

// Extends Timeline and Adjusts Accounting Logs
function renewLoan(id) {
    transactions = transactions.map(t => {
        if (t.id === id) {
            const currentDue = new Date(t.dueDate);
            currentDue.setDate(currentDue.getDate() + 30);
            
            t.dueDate = currentDue.toISOString().split('T')[0];
            t.renewalsCount += 1;
            t.amountPaid += 300;
            t.status = 'Active'; 
        }
        return t;
    });
    saveToStorage();
    renderCards();
}

// Card Renderer Function
function renderCards() {
    const container = document.getElementById('cardList');
    const searchQuery = document.getElementById('searchBar').value.toLowerCase();
    container.innerHTML = '';

    const filtered = transactions.filter(t => {
        const matchesSearch = t.bookTitle.toLowerCase().includes(searchQuery) || t.borrowerName.toLowerCase().includes(searchQuery);
        if (!matchesSearch) return false;
        
        if (currentFilter === 'all') return true;
        return t.status.toLowerCase() === currentFilter;
    });

    if(filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center;color:var(--text-muted);margin-top:40px;">No records found.</p>`;
        return;
    }

    filtered.forEach(t => {
        const card = document.createElement('div');
        card.className = `card status-${t.status.toLowerCase()}`;
        
        let badgeClass = 'badge-active';
        if(t.status === 'Overdue') badgeClass = 'badge-overdue';
        if(t.status === 'Returned') badgeClass = 'badge-returned';

        // Custom template: removed "Borrower:", "Borrowed:", format phone onto separate line
        card.innerHTML = `
            <span class="status-badge ${badgeClass}">${t.status}</span>
            <h3>${t.bookTitle}</h3>
            <div class="author">by ${t.author}</div>
            <div class="info-line"><span>${t.borrowerName}</span></div>
            <div class="info-line" style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">${t.borrowerPhone}</div>
            <div class="info-line">Issued: <span>${t.borrowDate}</span></div>
            <div class="info-line">Due: <span style="color:${t.status === 'Overdue' ? 'var(--danger)' : 'inherit'}">${t.dueDate}</span></div>
            <div class="info-line" style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">
                Renewals: <span>${t.renewalsCount}</span> | Total Paid: <span>₦${t.amountPaid}</span>
            </div>
            
            ${t.status !== 'Returned' ? `
                <div class="card-actions">
                    <button class="btn btn-return" onclick="markAsReturned(${t.id})">Return</button>
                    <button class="btn btn-renew" onclick="renewLoan(${t.id})">Renew (+₦300)</button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

// Swaps current Filter Context View
function switchTab(status, element) {
    currentFilter = status;
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    renderCards();
}

// Listen to key entries in Search bar
document.getElementById('searchBar').addEventListener('input', renderCards);

// Text compilation engine to dump database state to CSV formats
function exportToCSV() {
    if(transactions.length === 0) return alert('No data available to export.');

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Book Title,Author,Borrower Name,Phone,Borrow Date,Due Date,Renewals Count,Amount Paid (NGN),Status\r\n";

    transactions.forEach(t => {
        const titleEscaped = `"${t.bookTitle.replace(/"/g, '""')}"`;
        const authorEscaped = `"${t.author.replace(/"/g, '""')}"`;
        const nameEscaped = `"${t.borrowerName.replace(/"/g, '""')}"`;

        const row = [t.id, titleEscaped, authorEscaped, nameEscaped, t.borrowerPhone, t.borrowDate, t.dueDate, t.renewalsCount, t.amountPaid, t.status];
        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Church_Library_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Start executing application cycles when document finishes mounting
window.onload = initApp;