// --- ADMIN AUTHENTICATION SYSTEM ---
const BASE_ADMIN_EMAIL = "avigyan.kishordas.ece29@heritageit.edu.in";
const BASE_ADMIN_PW = "123@Puni";

// Initialize Sub-Admins in Local Storage if empty
if (!localStorage.getItem('hultAdmins')) {
    localStorage.setItem('hultAdmins', JSON.stringify([]));
}

function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pw = document.getElementById('loginPassword').value.trim();
    const errorMsg = document.getElementById('loginError');
    
    // Fetch registered sub-admins
    const subAdmins = JSON.parse(localStorage.getItem('hultAdmins'));
    
    // Validate Base Admin OR Sub Admin
    const isBaseAdmin = (email === BASE_ADMIN_EMAIL && pw === BASE_ADMIN_PW);
    const isSubAdmin = subAdmins.find(admin => admin.email === email && admin.password === pw);

    if (isBaseAdmin || isSubAdmin) {
        sessionStorage.setItem('loggedInUser', email);
        checkAuth(); // Switch screens
    } else {
        errorMsg.innerText = "Invalid credentials. Access denied.";
    }
}

function handleLogout() {
    sessionStorage.removeItem('loggedInUser');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').innerText = '';
    checkAuth();
}

function checkAuth() {
    const activeUser = sessionStorage.getItem('loggedInUser');
    const loginScreen = document.getElementById('loginScreen');
    const appScreen = document.getElementById('appScreen');
    const adminPanel = document.getElementById('adminCreationPanel');
    
    if (activeUser) {
        // Authenticated
        loginScreen.style.display = "none";
        appScreen.style.display = "block";
        
        // Silently reveal creation tools if user is the base admin
        if (activeUser === BASE_ADMIN_EMAIL) {
            adminPanel.style.display = "block";
        } else {
            adminPanel.style.display = "none";
        }
    } else {
        // Not Authenticated
        loginScreen.style.display = "flex";
        appScreen.style.display = "none";
    }
}

function createAdmin() {
    const newEmail = document.getElementById('newAdminEmail').value.trim();
    const newPw = document.getElementById('newAdminPassword').value.trim();
    const msg = document.getElementById('adminCreationMsg');

    if(!newEmail || !newPw) {
        msg.style.color = "var(--accent)";
        msg.innerText = "Fields cannot be empty.";
        return;
    }

    let subAdmins = JSON.parse(localStorage.getItem('hultAdmins'));
    
    // Prevent duplicates
    if(subAdmins.some(a => a.email === newEmail) || newEmail === BASE_ADMIN_EMAIL) {
        msg.style.color = "var(--accent)";
        msg.innerText = "Admin email already exists.";
        return;
    }

    subAdmins.push({ email: newEmail, password: newPw });
    localStorage.setItem('hultAdmins', JSON.stringify(subAdmins));

    document.getElementById('newAdminEmail').value = '';
    document.getElementById('newAdminPassword').value = '';
    msg.style.color = "var(--success)";
    msg.innerText = "Sub-admin successfully created!";
    setTimeout(() => msg.innerText = "", 3000);
}


// --- DASHBOARD SYSTEM CORE LOGIC ---
const baseBudget = 200;
const threshold = 35;

const feasibility = {
    "West Bengal": { "Cultural Heritage": 90, "Tea & Coffee Estates": 90, "Handicraft & Textile": 75, "River Cruise Tourism": 75, "Beach & Coastal": 60 },
    "Rajasthan": { "Cultural Heritage": 90, "Luxury Resorts": 90, "Wildlife & Safari": 75, "Culinary & Food": 75, "MICE Infrastructure": 60 },
    "Kerala": { "Wellness & Ayurveda": 90, "Eco-Tourism": 90, "Beach & Coastal": 75, "Tea & Coffee Estates": 75, "Medical Tourism": 60 },
    "Goa": { "Beach & Coastal": 90, "Luxury Resorts": 90, "Culinary & Food": 75, "Adventure Sports": 75, "Cinematic & Film": 60 },
    "Gujarat": { "Handicraft & Textile": 90, "MICE Infrastructure": 90, "Cultural Heritage": 75, "Wildlife & Safari": 75, "Medical Tourism": 60 },
    "Uttar Pradesh": { "Pilgrimage & Spiritual": 90, "Cultural Heritage": 90, "Culinary & Food": 75, "River Cruise Tourism": 75, "Agro-Tourism": 60 },
    "Himachal Pradesh": { "Adventure Sports": 90, "Eco-Tourism": 90, "Luxury Resorts": 75, "Pilgrimage & Spiritual": 75, "Wellness & Ayurveda": 60 },
    "Sikkim": { "Eco-Tourism": 90, "Agro-Tourism": 90, "Adventure Sports": 75, "Wellness & Ayurveda": 75, "Cinematic & Film": 60 },
    "Tamil Nadu": { "Medical Tourism": 90, "Pilgrimage & Spiritual": 90, "Handicraft & Textile": 75, "MICE Infrastructure": 75, "Cinematic & Film": 60 },
    "Assam": { "Tea & Coffee Estates": 90, "Wildlife & Safari": 90, "River Cruise Tourism": 75, "Eco-Tourism": 75, "Agro-Tourism": 60 }
};

const inventory = {
    industry: {
        "Cultural Heritage": 35, "Eco-Tourism": 35, "Tea & Coffee Estates": 35, "Luxury Resorts": 35, "Pilgrimage & Spiritual": 35,
        "Wildlife & Safari": 30, "Handicraft & Textile": 30, "Adventure Sports": 30, "Beach & Coastal": 30, "MICE Infrastructure": 30,
        "Wellness & Ayurveda": 30, "River Cruise Tourism": 30, "Culinary & Food": 30,
        "Agro-Tourism": 25, "Medical Tourism": 25, "Cinematic & Film": 25
    },
    state: {
        "West Bengal": 30, "Rajasthan": 30, "Kerala": 30, "Goa": 30, "Gujarat": 30,
        "Uttar Pradesh": 30, "Himachal Pradesh": 30, "Sikkim": 30, "Tamil Nadu": 30, "Assam": 30
    }
};

let teams = [];
let currentBidAmount = 0;
let currentHighestBidderId = null;

// Initialize System on load
window.onload = () => {
    checkAuth();
    populateItems();
    updateScoreboard();
    buildTeamBiddingBoard();
};

function addTeam() {
    const nameInput = document.getElementById('teamName');
    if(!nameInput.value.trim()) return alert("Enter a team name.");
    
    teams.push({ id: Date.now(), name: nameInput.value.trim(), industry: null, state: null, budget: baseBudget, matchPoints: 0, totalScore: 0 });
    nameInput.value = '';
    updateScoreboard();
    buildTeamBiddingBoard();
}

function removeTeam(id) {
    teams = teams.filter(t => t.id !== id);
    if(currentHighestBidderId === id) setBasePrice();
    updateScoreboard();
    buildTeamBiddingBoard();
}

function populateItems() {
    const round = document.getElementById('auctionRound').value;
    const itemSelect = document.getElementById('auctionItem');
    itemSelect.innerHTML = '';
    
    for (let item in inventory[round]) {
        let opt = document.createElement('option');
        opt.value = item;
        opt.innerHTML = `${item} (Base: ₹${inventory[round][item]} Cr)`;
        itemSelect.appendChild(opt);
    }
    setBasePrice();
}

function setBasePrice() {
    const round = document.getElementById('auctionRound').value;
    const item = document.getElementById('auctionItem').value;
    
    currentBidAmount = inventory[round][item];
    currentHighestBidderId = null;
    
    document.getElementById('currentBidValue').innerText = currentBidAmount;
    const highestBidderText = document.getElementById('highestBidderName');
    highestBidderText.innerText = "Awaiting Opening Bid...";
    highestBidderText.style.color = "#7F8C8D";
}

function buildTeamBiddingBoard() {
    const board = document.getElementById('teamBiddingBoard');
    board.innerHTML = '';

    if (teams.length === 0) {
        board.innerHTML = '<div style="padding:15px; color:#7F8C8D; font-style: italic;">No teams registered yet.</div>';
        return;
    }

    teams.forEach(t => {
        let row = document.createElement('div');
        row.className = 'team-bid-row';
        row.innerHTML = `
            <div class="team-bid-name">${t.name} <br><span style="font-size:11px; font-weight:normal; color:#7F8C8D;">(₹${t.budget} Cr left)</span></div>
            <div class="team-bid-actions">
                <button class="base-open" onclick="placeBid(0, ${t.id})">Open</button>
                <button onclick="placeBid(5, ${t.id})">+ 5</button>
                <button onclick="placeBid(7, ${t.id})">+ 7</button>
                <button onclick="placeBid(10, ${t.id})">+ 10</button>
            </div>
        `;
        board.appendChild(row);
    });
}

function placeBid(incrementAmount, teamId) {
    let team = teams.find(t => t.id === teamId);
    if (!team) return;

    currentBidAmount += incrementAmount;
    currentHighestBidderId = team.id;
    document.getElementById('currentBidValue').innerText = currentBidAmount;
    
    const highestBidderText = document.getElementById('highestBidderName');
    highestBidderText.innerText = `Highest Bidder: ${team.name}`;
    highestBidderText.style.color = "var(--primary)";
}

function confirmPurchase() {
    if (!currentHighestBidderId) return alert("Cannot confirm. No team has opened the bidding yet!");

    const round = document.getElementById('auctionRound').value;
    const itemName = document.getElementById('auctionItem').value;
    let team = teams.find(t => t.id === currentHighestBidderId);
    
    if (team.budget - currentBidAmount < 0) return alert(`Transaction Failed: ${team.name} has insufficient funds.`);

    team.budget -= currentBidAmount;
    if(round === 'industry') team.industry = itemName;
    if(round === 'state') team.state = itemName;

    team.matchPoints = 0;
    if(team.industry && team.state) {
        team.matchPoints = feasibility[team.state][team.industry] || 0;
    }

    if(team.budget >= threshold) {
        team.totalScore = team.matchPoints + (team.budget / 10);
    } else {
        team.totalScore = 0; 
    }

    updateScoreboard();
    buildTeamBiddingBoard();
    setBasePrice(); 
}

function updateScoreboard() {
    const tbody = document.getElementById('scoreboardBody');
    tbody.innerHTML = '';
    
    let sortedTeams = [...teams].sort((a, b) => b.totalScore - a.totalScore);

    sortedTeams.forEach(t => {
        let status = `<span class="qual-status">Qualified</span>`;
        if (t.budget < threshold && (t.industry || t.state)) {
            status = `<span class="dq-status">DQ (< ₹${threshold} Cr)</span>`;
        } else if (!t.industry || !t.state) {
            status = `<span style="color:#7F8C8D">Incomplete</span>`;
        }

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold;">${t.name}</td>
            <td>${t.industry || '-'}</td>
            <td>${t.state || '-'}</td>
            <td>${t.matchPoints > 0 ? t.matchPoints + ' Pts' : '-'}</td>
            <td style="${t.budget < threshold ? 'color: var(--accent); font-weight: bold;' : ''}">₹${t.budget} Cr</td>
            <td style="font-weight: bold; font-size: 16px;">${t.totalScore.toFixed(1)}</td>
            <td>${status}</td>
            <td><button class="btn btn-red" style="padding: 5px 10px; font-size: 12px;" onclick="removeTeam(${t.id})">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}