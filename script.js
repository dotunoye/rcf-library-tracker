// 1. Changed variable name to 'sb' to prevent global namespace collisions
const SUPABASE_URL = "https://bkabrmuknzvqtghcnlmt.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYWJybXVrbnp2cXRnaGNubG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ1OTgsImV4cCI6MjA5NjA4MDU5OH0.5V2pwbZpMYtkEDDkW63d9rR0-AG1lQsUSQFLSztyxVM";

const churchDb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const PORTAL_PASSWORD = "church"; 

let transactions = [];
let currentFilter = 'all';

// 2. Authentication Gatekeeping Logic
window.onload = function() {
    if (sessionStorage.getItem('library_authenticated') === 'true') {
        showDashboard();
    }
};

function handleLogin(e) {
    e.preventDefault();
    const enteredPassword = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginError');

    if (enteredPassword === PORTAL_PASSWORD) {
        sessionStorage.setItem('library_authenticated', 'true');
        errorEl.textContent = "";
        showDashboard();
    } else {
        errorEl.textContent = "Invalid administrative password. Try again.";
        document.getElementById('adminPassword').value = "";
    }
}

async function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appDashboard').style.display = 'block';
    await initApp(); 
}

function handleLogout() {
    sessionStorage.removeItem('library_authenticated');
    window.location.reload();
}

// 3. Application Core Pipeline
async function initApp() {
    await fetchFromCloud();
    renderCards();
}

async function fetchFromCloud() {
    try {
        let { data, error } = await churchDb
            .from('transactions')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;
        
        transactions = data || [];
        evaluateOverdueStatus();
    } catch (err) {
        console.error("Cloud Fetch Error:", err.message);
        alert("Failed to load records from cloud database.");
    }
}

function evaluateOverdueStatus() {
    const todayStr = new Date().toISOString().split('T')[0];
    transactions.forEach(t => {
        if (t.status === 'Active' && t.due_date < todayStr) {
            t.status = 'Overdue';
        }
    });
}

function toggleModal(show) {
    const modal = document.getElementById('formModal');
    if(show) {
        modal.classList.add('open');
        // Automatically pre-fill the date selector with today's date for standard check-ins
        document.getElementById('customBorrowDate').value = new Date().toISOString().split('T')[0];
    } else {
        modal.classList.remove('open');
    }
}

// 4. Database Write Operationsasync 
    async function handleFormSubmit(e) {
    e.preventDefault();
    
    // 1. Determine the Borrow Date (Use manual input if selected, otherwise default to today)
    const manualDateInput = document.getElementById('customBorrowDate').value;
    let today = new Date();
    
    if (manualDateInput) {
        // Parse the backdated entry correctly
        today = new Date(manualDateInput);
    }
    
    const borrowDateStr = today.toISOString().split('T')[0];
    
    // 2. Extrapolate the deadline exactly 30 days forward from the selected borrow date
    const dueOffset = new Date(today);
    dueOffset.setDate(today.getDate() + 30);
    const dueDateStr = dueOffset.toISOString().split('T')[0];

    const newLoan = {
        id: Date.now(), // Temporary local ID
        book_title: document.getElementById('bookTitle').value,
        author: document.getElementById('author').value,
        borrower_name: document.getElementById('borrowerName').value,
        borrower_phone: document.getElementById('borrowerPhone').value,
        borrow_date: borrowDateStr,
        due_date: dueDateStr,
        renewals_count: 0,
        amount_paid: 300,
        status: "Active"
    };

    // Update screen instantly
    transactions.unshift(newLoan);
    renderCards();
    
    document.getElementById('loanForm').reset();
    toggleModal(false);

    try {
        const { error } = await churchDb.from('transactions').insert([{
            book_title: newLoan.book_title,
            author: newLoan.author,
            borrower_name: newLoan.borrower_name,
            borrower_phone: newLoan.borrower_phone,
            borrow_date: newLoan.borrow_date,
            due_date: newLoan.due_date,
            renewals_count: newLoan.renewals_count,
            amount_paid: newLoan.amount_paid,
            status: newLoan.status
        }]);
        if (error) throw error;
        await fetchFromCloud(); 
    } catch (err) {
        alert("Cloud sync failed. Error: " + err.message);
    }
}

async function markAsReturned(id) {
    // snappy move: update UI immediately
    transactions = transactions.map(t => {
        if (t.id === id) t.status = 'Returned';
        return t;
    });
    renderCards();

    try {
        const { error } = await churchDb
            .from('transactions')
            .update({ status: 'Returned' })
            .eq('id', id);
        if (error) throw error;
    } catch (err) {
        alert("Return sync error: " + err.message);
    }
}

async function renewLoan(id, currentDueDate, currentCount, currentPayment) {
    const nextDue = new Date(currentDueDate);
    nextDue.setDate(nextDue.getDate() + 30);
    const nextDueStr = nextDue.toISOString().split('T')[0];

    // snappy move: update UI immediately
    transactions = transactions.map(t => {
        if (t.id === id) {
            t.due_date = nextDueStr;
            t.renewals_count = currentCount + 1;
            t.amount_paid = currentPayment + 300;
            t.status = 'Active';
        }
        return t;
    });
    renderCards();

    try {
        const { error } = await churchDb
            .from('transactions')
            .update({ 
                due_date: nextDueStr,
                renewals_count: currentCount + 1,
                amount_paid: currentPayment + 300,
                status: 'Active'
            })
            .eq('id', id);
        if (error) throw error;
    } catch (err) {
        alert("Renewal sync error: " + err.message);
    }
}

// 5. Interface UI Rendering Engine
function renderCards() {
    const container = document.getElementById('cardList');
    const searchQuery = document.getElementById('searchBar').value.toLowerCase();
    container.innerHTML = '';

    const filtered = transactions.filter(t => {
        const matchesSearch = t.book_title.toLowerCase().includes(searchQuery) || t.borrower_name.toLowerCase().includes(searchQuery);
        if (!matchesSearch) return false;
        
        if (currentFilter === 'all') return true;
        return t.status.toLowerCase() === currentFilter;
    });

    if(filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center;color:var(--text-muted);margin-top:40px;">No records found.</p>`;
        return;
    }

    const today = new Date();

    filtered.forEach(t => {
        const card = document.createElement('div');
        card.className = `card status-${t.status.toLowerCase()}`;
        
        let badgeClass = 'badge-active';
        if(t.status === 'Overdue') badgeClass = 'badge-overdue';
        if(t.status === 'Returned') badgeClass = 'badge-returned';

        const dueDateObj = new Date(t.due_date);
        const timeDiff = dueDateObj.getTime() - today.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        const showAlertCommButtons = (t.status === 'Overdue' || (daysRemaining <= 6 && daysRemaining >= 0)) && t.status !== 'Returned';

        const formattedMessage = encodeURIComponent(
            `Hi ${t.borrower_name}, this is a reminder from the Church Library. The book "${t.book_title}" you borrowed is due on ${t.due_date}. Please plan to return or renew it. Thank you!`
        );

        let rawPhone = t.borrower_phone.trim();
        if (rawPhone.startsWith('0')) {
            rawPhone = '234' + rawPhone.slice(1); 
        }

        card.innerHTML = `
            <span class="status-badge ${badgeClass}">${t.status}</span>
            <h3>${t.book_title}</h3>
            <div class="author">by ${t.author}</div>
            <div class="info-line"><span>${t.borrower_name}</span></div>
            <div class="info-line" style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">${t.borrower_phone}</div>
            <div class="info-line">Issued: <span>${t.borrow_date}</span></div>
            <div class="info-line">Due: <span style="color:${t.status === 'Overdue' ? 'var(--danger)' : 'inherit'}">${t.due_date}</span></div>
            <div class="info-line" style="margin-top: 8px; border-top: 1px dashed #e5e7eb; padding-top: 8px; font-size: 13px; color: var(--text-muted);">
                Renewals: <span>${t.renewals_count}</span> | Total Paid: <span>₦${t.amount_paid}</span>
            </div>

            ${showAlertCommButtons ? `
                <div class="contact-actions">
                    <a href="https://wa.me/${rawPhone}?text=${formattedMessage}" target="_blank" class="circle-btn btn-whatsapp" title="Send WhatsApp Reminder">💬</a>
                    <a href="tel:${t.borrower_phone}" class="circle-btn btn-call" title="Call Borrower">📞</a>
                </div>
            ` : ''}
            
            ${t.status !== 'Returned' ? `
                <div class="card-actions">
                    <button class="btn btn-return" onclick="markAsReturned(${t.id})">Return</button>
                    <button class="btn btn-renew" onclick="renewLoan(${t.id}, '${t.due_date}', ${t.renewals_count}, ${t.amount_paid})">Renew (+₦300)</button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

function switchTab(status, element) {
    currentFilter = status;
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    renderCards();
}

document.getElementById('searchBar').addEventListener('input', renderCards);

// 6. Data Exporter Engine
function exportToCSV() {
    if (transactions.length === 0) return alert('No library data files available to export.');

    // 1. Establish data row parameters
    let csvContent = "ID,Book Title,Author,Borrower Name,Phone,Borrow Date,Due Date,Renewals Count,Amount Paid (NGN),Status\r\n";

    transactions.forEach(t => {
        const titleEscaped = `"${t.book_title.replace(/"/g, '""')}"`;
        const authorEscaped = `"${t.author.replace(/"/g, '""')}"`;
        const nameEscaped = `"${t.borrower_name.replace(/"/g, '""')}"`;

        const row = [
            t.id, 
            titleEscaped, 
            authorEscaped, 
            nameEscaped, 
            `="${t.borrower_phone}"`, // Forces spreadsheet apps to retain leading zeros on numbers
            t.borrow_date, 
            t.due_date, 
            t.renewals_count, 
            t.amount_paid, 
            t.status
        ];
        csvContent += row.join(",") + "\r\n";
    });

  try {
        // 1. Add the Byte Order Mark (BOM) to fix character encoding
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        
        // 2. FORCE SYSTEM MIME-TYPE TO MS-EXCEL: This tells your phone's OS to launch WPS Office natively
        const blob = new Blob([bom, csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = url;
        
        // 3. Keep the extension as .csv or change to .xls if WPS is still stubborn. Let's try .csv first:
        link.download = `RCF_Library_Report_${new Date().toISOString().split('T')[0]}.csv`;
        
        // Append to DOM layout so mobile systems recognize the click event pipeline
        document.body.appendChild(link);
        link.click();
        
        // Clean up allocation memory paths
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

    } catch (err) {
        alert("Spreadsheet compilation failed.");
        console.error(err);
    }
}