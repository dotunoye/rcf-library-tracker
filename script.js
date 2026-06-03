// Replace these strings with your actual Supabase project credentials
const SUPABASE_URL = "https://bkabrmuknzvqtghcnlmt.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYWJybXVrbnp2cXRnaGNubG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ1OTgsImV4cCI6MjA5NjA4MDU5OH0.5V2pwbZpMYtkEDDkW63d9rR0-AG1lQsUSQFLSztyxVM";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let transactions = [];
let currentFilter = 'all';

// Initialize App lifecycle
async function initApp() {
    await fetchFromCloud();
    renderCards();
}

// Read Data from Supabase Cloud Database Pipeline
async function fetchFromCloud() {
    try {
        let { data, error } = await supabase
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

// Scans timestamps to process local overdue conversions
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
    if(show) modal.classList.add('open');
    else modal.classList.remove('open');
}

// Write New Loan Log to Cloud
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const today = new Date();
    const borrowDateStr = today.toISOString().split('T')[0];
    
    const dueOffset = new Date();
    dueOffset.setDate(today.getDate() + 30);
    const dueDateStr = dueOffset.toISOString().split('T')[0];

    const newLoan = {
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

    try {
        const { error } = await supabase.from('transactions').insert([newLoan]);
        if (error) throw error;

        document.getElementById('loanForm').reset();
        toggleModal(false);
        await initApp(); // Refresh records
    } catch (err) {
        alert("Error saving record: " + err.message);
    }
}

// Process Returns on Cloud
async function markAsReturned(id) {
    try {
        const { error } = await supabase
            .from('transactions')
            .update({ status: 'Returned' })
            .eq('id', id);

        if (error) throw error;
        await initApp();
    } catch (err) {
        alert("Return error: " + err.message);
    }
}

// Process Extensions on Cloud
async function renewLoan(id, currentDueDate, currentCount, currentPayment) {
    const nextDue = new Date(currentDueDate);
    nextDue.setDate(nextDue.getDate() + 30);
    const nextDueStr = nextDue.toISOString().split('T')[0];

    try {
        const { error } = await supabase
            .from('transactions')
            .update({ 
                due_date: nextDueStr,
                renewals_count: currentCount + 1,
                amount_paid: currentPayment + 300,
                status: 'Active'
            })
            .eq('id', id);

        if (error) throw error;
        await initApp();
    } catch (err) {
        alert("Renewal error: " + err.message);
    }
}

// Card Renderer Interface Processor
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

        // Calculate proximity alert window threshold logic (6 Days countdown)
        const dueDateObj = new Date(t.due_date);
        const timeDiff = dueDateObj.getTime() - today.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        // Show notification buttons if the book is overdue OR due in 6 days or less (and not returned yet)
        const showAlertCommButtons = (t.status === 'Overdue' || (daysRemaining <= 6 && daysRemaining >= 0)) && t.status !== 'Returned';

        // Automatic clean template generation parsing for message texts
        const formattedMessage = encodeURIComponent(
            `Hi ${t.borrower_name}, this is a reminder from the Church Library. The book "${t.book_title}" you borrowed is due on ${t.due_date}. Please plan to return or renew it. Thank you!`
        );

        // Sanitize Phone parameters 
        let rawPhone = t.borrower_phone.trim();
        if (rawPhone.startsWith('0')) {
            rawPhone = '234' + rawPhone.slice(1); // Standardize Nigerian phone formats for WhatsApp API link strings
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

// Blob-based CSV Downloader for cross-device support (Mobile + Laptop Fix)
function exportToCSV() {
    if(transactions.length === 0) return alert('No data available to export.');

    let csvContent = "ID,Book Title,Author,Borrower Name,Phone,Borrow Date,Due Date,Renewals Count,Amount Paid (NGN),Status\r\n";

    transactions.forEach(t => {
        const titleEscaped = `"${t.book_title.replace(/"/g, '""')}"`;
        const authorEscaped = `"${t.author.replace(/"/g, '""')}"`;
        const nameEscaped = `"${t.borrower_name.replace(/"/g, '""')}"`;

        const row = [t.id, titleEscaped, authorEscaped, nameEscaped, t.borrower_phone, t.borrow_date, t.due_date, t.renewals_count, t.amount_paid, t.status];
        csvContent += row.join(",") + "\r\n";
    });

    // Create a real blob container type
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Church_Library_Report_${new Date().toISOString().split('T')[0]}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean memory allocation trace references
}

window.onload = initApp;