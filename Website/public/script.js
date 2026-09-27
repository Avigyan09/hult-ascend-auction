// ==========================================
// 1. FIREBASE INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "hult-ascend-auction.firebaseapp.com",
    projectId: "hult-ascend-auction",
    storageBucket: "hult-ascend-auction.firebasestorage.app",
    messagingSenderId: "1028225355206",
    appId: "YOUR_APP_ID_HERE",
    measurementId: "G-7LWGLG3G9Y",
    databaseURL: "https://hult-ascend-auction-default-rtdb.asia-southeast1.firebasedatabase.app" 
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// 2. CORE LOGIC & PARAMETERS
// ==========================================
const BASE_ADMIN_EMAIL = "ADMIN_EMAIL_HIDDEN";
const BASE_ADMIN_PW = "ADMIN_PASSWORD_HIDDEN";
const baseBudget = 200;
const threshold = 35;
const round1MaxSpend = 135; 

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
    industry: { "Cultural Heritage": 35, "Eco-Tourism": 35, "Tea & Coffee Estates": 35, "Luxury Resorts": 35, "Pilgrimage & Spiritual": 35, "Wildlife & Safari": 30, "Handicraft & Textile": 30, "Adventure Sports": 30, "Beach & Coastal": 30, "MICE Infrastructure": 30, "Wellness & Ayurveda": 30, "River Cruise Tourism": 30, "Culinary & Food": 30, "Agro-Tourism": 25, "Medical Tourism": 25, "Cinematic & Film": 25 },
    state: { "West Bengal": 30, "Rajasthan": 30, "Kerala": 30, "Goa": 30, "Gujarat": 30, "Uttar Pradesh": 30, "Himachal Pradesh": 30, "Sikkim": 30, "Tamil Nadu": 30, "Assam": 30 }
};

let teams = [];
let registeredUsers = [];
let currentBidAmount = 0;
let currentHighestBidderId = null;
let hasOpened = false; 

// ==========================================
// 3. FIREBASE REAL-TIME LISTENERS
// ==========================================
window.onload = () => {
    checkAuth();
    populateItems(); 
    
    // Watch for team data
    db.ref('hultAuction/teams').on('value', (snapshot) => {
        const data = snapshot.val();
        
        let rawTeams = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
        
        teams = rawTeams
            .filter(t => t !== null && typeof t === 'object')
            .map(t => {
                if (!t.industry) t.industry = []; 
                if (!t.round1Spend) t.round1Spend = 0;
                return t;
            });
            
        updateScoreboard();
        buildTeamBiddingBoard();
        populateItems(); 
    });

    // Watch for users data
    db.ref('hultAuction/users').on('value', (snapshot) => {
        const data = snapshot.val();
        registeredUsers = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
        registeredUsers = registeredUsers.filter(u => u !== null);

        if(sessionStorage.getItem('hultRole') === 'base_admin') renderUserManagement();
        if(sessionStorage.getItem('hultRole') === 'admin') renderAdminRoster();
    });

    // Watch for live desk updates
    db.ref('hultAuction/liveDesk').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentBidAmount = data.currentBidAmount || 0;
            currentHighestBidderId = data.currentHighestBidderId || null;
            hasOpened = data.hasOpened || false;
            
            const roundSelect = document.getElementById('auctionRound');
            const itemSelect = document.getElementById('auctionItem');
            if(data.round) roundSelect.value = data.round;
            if(data.item) itemSelect.value = data.item;
            
            document.getElementById('viewerCurrentItem').innerText = data.item ? data.item : "Awaiting next item...";

            let text = "Awaiting Opening Bid...";
            let color = "#7F8C8D";
            
            if (currentHighestBidderId) {
                let winningTeam = teams.find(t => t.id === currentHighestBidderId);
                if(winningTeam) {
                    text = `Highest Bidder: ${winningTeam.name}`;
                    color = "var(--primary)";
                }
            }
            
            syncBidDisplay(text, color);
            buildTeamBiddingBoard(); 
        }
    });
};

// ==========================================
// 4. AUTHENTICATION & ROLE MANAGEMENT
// ==========================================
function toggleAuth(type) {
    document.getElementById('loginCard').style.display = type === 'login' ? 'block' : 'none';
    document.getElementById('registerCard').style.display = type === 'register' ? 'block' : 'none';
}

function handleRegister() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pw = document.getElementById('regPassword').value.trim();
    const msg = document.getElementById('regMsg');

    if(!name || !email || !pw) return msg.innerText = "All fields are required.";
    if(registeredUsers.some(u => u.email === email) || email === BASE_ADMIN_EMAIL) return msg.innerText = "Email already registered.";

    if (!Array.isArray(registeredUsers)) registeredUsers = [];
    registeredUsers.push({ name, email, password: pw, role: 'viewer' });
    
    db.ref('hultAuction/users').set(registeredUsers).then(() => {
        msg.style.color = "var(--success)";
        msg.innerText = "Account created! You can now log in.";
        setTimeout(() => toggleAuth('login'), 2000);
    }).catch(err => {
        msg.innerText = "Error creating account: " + err.message;
    });
}

function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pw = document.getElementById('loginPassword').value.trim();
    
    if (email === BASE_ADMIN_EMAIL && pw === BASE_ADMIN_PW) {
        sessionStorage.setItem('hultActiveUser', email);
        sessionStorage.setItem('hultRole', 'base_admin');
        checkAuth();
        return;
    }
    
    const user = registeredUsers.find(u => u.email === email && u.password === pw);
    if (user) {
        sessionStorage.setItem('hultActiveUser', user.email);
        sessionStorage.setItem('hultRole', user.role);
        checkAuth();
    } else {
        document.getElementById('loginError').innerText = "Invalid credentials.";
    }
}

function handleLogout() {
    sessionStorage.clear();
    location.reload(); 
}

function checkAuth() {
    const activeUser = sessionStorage.getItem('hultActiveUser');
    const role = sessionStorage.getItem('hultRole');
    
    if (activeUser) {
        document.getElementById('authScreen').style.display = "none";
        document.getElementById('appScreen').style.display = "block";
        document.getElementById('userRoleBadge').innerText = role === 'base_admin' ? 'BASE ADMIN' : role.toUpperCase();
        applyRolePermissions(role);
    } else {
        document.getElementById('authScreen').style.display = "flex";
        document.getElementById('appScreen').style.display = "none";
    }
}

function applyRolePermissions(role) {
    const controlPanel = document.getElementById('controlPanel');
    const paddlesPanel = document.getElementById('paddlesPanel');
    const viewerBidStatus = document.getElementById('viewerBidStatus');
    const userManagement = document.getElementById('userManagementPanel');
    const adminRoster = document.getElementById('adminRosterPanel');

    if (role === 'viewer') {
        controlPanel.style.display = 'none';
        paddlesPanel.style.display = 'none';
        viewerBidStatus.style.display = 'block';
    } else {
        // UI FIX: Sets control panel to match the flex-column rules in CSS
        controlPanel.style.display = 'flex'; 
        
        paddlesPanel.style.display = 'block';
        viewerBidStatus.style.display = 'none';
        buildTeamBiddingBoard();
        
        if (role === 'base_admin') {
            userManagement.style.display = 'block';
            adminRoster.style.display = 'none';
            renderUserManagement();
        } else if (role === 'admin') {
            userManagement.style.display = 'none';
            adminRoster.style.display = 'block';
            renderAdminRoster();
        }
    }
}

function renderUserManagement() {
    const container = document.getElementById('userListContainer');
    container.innerHTML = '';
    if(registeredUsers.length === 0) return container.innerHTML = '<span style="color:#7F8C8D">No users registered yet.</span>';

    registeredUsers.forEach(u => {
        let btn = u.role === 'viewer' 
            ? `<button class="btn btn-green" style="padding:4px 8px; font-size:11px;" onclick="changeRole('${u.email}', 'admin')">Make Admin</button>`
            : `<button class="btn btn-red" style="padding:4px 8px; font-size:11px;" onclick="changeRole('${u.email}', 'viewer')">Revoke Admin</button>`;
        
        container.innerHTML += `
            <div class="user-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
                <div><strong>${u.name}</strong> (${u.email}) - <span style="color:var(--primary); font-weight:bold;">${u.role.toUpperCase()}</span></div>
                ${btn}
            </div>
        `;
    });
}

function renderAdminRoster() {
    const container = document.getElementById('adminListContainer');
    container.innerHTML = `<div class="user-row"><strong>Avigyan</strong> (${BASE_ADMIN_EMAIL}) - BASE ADMIN</div>`;
    registeredUsers.filter(u => u.role === 'admin').forEach(u => {
        container.innerHTML += `<div class="user-row" style="margin-bottom: 5px; border-bottom: 1px solid #ccc; padding-bottom: 5px;"><strong>${u.name}</strong> (${u.email}) - ADMIN</div>`;
    });
}

function changeRole(email, newRole) {
    let user = registeredUsers.find(u => u.email === email);
    if(user) {
        user.role = newRole;
        db.ref('hultAuction/users').set(registeredUsers); 
    }
}

// ==========================================
// 5. AUCTION DESK LOGIC
// ==========================================
function addTeam() {
    const nameInput = document.getElementById('teamName');
    if(!nameInput.value.trim()) return alert("Enter a team name.");
    
    if (!Array.isArray(teams)) teams = [];

    teams.push({ 
        id: Date.now(), 
        name: nameInput.value.trim(), 
        industry: [], 
        state: null, 
        budget: baseBudget, 
        round1Spend: 0, 
        matchPoints: 0, 
        totalScore: 0,
        isDQ: false 
    });
    
    nameInput.value = '';

    db.ref('hultAuction/teams').set(teams).catch(error => {
        alert("Firebase Blocked the Save! Error: " + error.message);
    });
}

function removeTeam(id) {
    if (!Array.isArray(teams)) {
        teams = teams ? Object.values(teams) : [];
    }

    teams = teams.filter(t => t && t.id !== id);
    
    if(currentHighestBidderId === id) setBasePrice(); 
    
    db.ref('hultAuction/teams').set(teams).catch(error => {
        alert("Firebase Blocked the Delete! Error: " + error.message);
    });
}

function advanceToRound2() {
    document.getElementById('auctionRound').value = 'state';
    populateItems();
}

function populateItems() {
    const round = document.getElementById('auctionRound').value;
    const itemSelect = document.getElementById('auctionItem');
    const confirmBtn = document.getElementById('confirmPurchaseBtn');
    
    const previousSelection = itemSelect.value;
    itemSelect.innerHTML = '';
    
    let firstAvailable = null;

    for (let item in inventory[round]) {
        let owner = teams.find(t => t.industry.includes(item) || t.state === item);
        if (owner) {
            itemSelect.innerHTML += `<option disabled value="${item}">${item} [SOLD to ${owner.name}]</option>`;
        } else {
            itemSelect.innerHTML += `<option value="${item}">${item} (Base: ₹${inventory[round][item]} Cr)</option>`;
            if (!firstAvailable) firstAvailable = item;
        }
    }
    
    if (firstAvailable) {
        if (!previousSelection || !itemSelect.querySelector(`option[value="${previousSelection}"]`)) {
            itemSelect.value = firstAvailable;
            confirmBtn.disabled = false;
            setBasePrice();
        } else {
            itemSelect.value = previousSelection;
            confirmBtn.disabled = false;
        }
    } else {
        itemSelect.innerHTML = '<option disabled>All items sold.</option>';
        confirmBtn.disabled = true;
    }
}

function setBasePrice() {
    const round = document.getElementById('auctionRound').value;
    const item = document.getElementById('auctionItem').value;
    
    if(!item) return; 
    
    currentBidAmount = inventory[round][item];
    currentHighestBidderId = null;
    hasOpened = false; 
    
    syncLiveDeskToCloud(); 
}

function syncLiveDeskToCloud() {
    db.ref('hultAuction/liveDesk').set({
        currentBidAmount: currentBidAmount,
        currentHighestBidderId: currentHighestBidderId,
        hasOpened: hasOpened,
        round: document.getElementById('auctionRound').value,
        item: document.getElementById('auctionItem').value
    });
}

function buildTeamBiddingBoard() {
    const board = document.getElementById('teamBiddingBoard');
    board.innerHTML = '';

    if (teams.length === 0) return board.innerHTML = '<div style="padding:15px; color:#7F8C8D;">No teams registered.</div>';

    const round = document.getElementById('auctionRound').value;
    const currentItem = document.getElementById('auctionItem').value;

    teams.forEach(t => {
        if(t.isDQ) {
            board.innerHTML += `
                <div class="team-bid-row">
                    <div class="team-bid-name" style="color:var(--accent); text-decoration:line-through;">${t.name} <br><span style="font-size:11px; font-weight:normal;">(DISQUALIFIED)</span></div>
                    <div class="team-bid-actions"><button disabled>Open</button><button disabled>+ 5</button><button disabled>+ 7</button><button disabled>+ 10</button></div>
                </div>`;
            return;
        }

        let paddleDisabled = false;
        let disableReason = "";

        if (round === 'state' && currentItem) {
            if (t.state) {
                paddleDisabled = true;
                disableReason = "MAX 1 STATE REACHED";
            } else if (t.industry.length === 0) {
                paddleDisabled = true;
                disableReason = "NO INDUSTRY OWNED";
            } else {
                let isValid = t.industry.some(ind => feasibility[currentItem] && feasibility[currentItem][ind]);
                if (!isValid) {
                    paddleDisabled = true;
                    disableReason = "INCOMPATIBLE STATE";
                }
            }
        }

        const isCurrentBidder = (currentHighestBidderId === t.id);
        const disableRaise = isCurrentBidder || !hasOpened || paddleDisabled ? 'disabled' : '';
        const disableOpen = hasOpened || paddleDisabled ? 'disabled' : '';

        let nameDisplay = `${t.name} <br><span style="font-size:11px; font-weight:normal; color:#7F8C8D;">(₹${t.budget} Cr left)</span>`;
        if (paddleDisabled) nameDisplay += `<br><span class="paddle-warning">${disableReason}</span>`;

        board.innerHTML += `
            <div class="team-bid-row">
                <div class="team-bid-name">${nameDisplay}</div>
                <div class="team-bid-actions">
                    <button class="base-open" onclick="placeBid(0, ${t.id})" ${disableOpen}>Open</button>
                    <button onclick="placeBid(5, ${t.id})" ${disableRaise}>+ 5</button>
                    <button onclick="placeBid(7, ${t.id})" ${disableRaise}>+ 7</button>
                    <button onclick="placeBid(10, ${t.id})" ${disableRaise}>+ 10</button>
                </div>
            </div>`;
    });
}

function placeBid(incrementAmount, teamId) {
    let team = teams.find(t => t.id === teamId);
    if (!team || team.isDQ) return;

    if(incrementAmount === 0) hasOpened = true; 
    
    currentBidAmount += incrementAmount;
    currentHighestBidderId = team.id;
    
    syncLiveDeskToCloud(); 
}

function syncBidDisplay(text, color) {
    document.getElementById('currentBidValue').innerText = currentBidAmount;
    document.getElementById('viewerBidValue').innerText = currentBidAmount; 
    
    const h1 = document.getElementById('highestBidderName');
    const h2 = document.getElementById('viewerHighestBidder');
    
    h1.innerText = text; h1.style.color = color;
    h2.innerText = text; h2.style.color = color;
}

function confirmPurchase() {
    if (!currentHighestBidderId) return alert("No team has opened the bidding yet!");

    const round = document.getElementById('auctionRound').value;
    const itemName = document.getElementById('auctionItem').value;
    let team = teams.find(t => t.id === currentHighestBidderId);
    
    if (team.budget - currentBidAmount < 0) return alert(`Transaction Failed: ${team.name} has insufficient funds.`);

    let proposedBudget = team.budget - currentBidAmount;
    let proposedR1Spend = team.round1Spend + (round === 'industry' ? currentBidAmount : 0);

    let dqReason = null;
    if (round === 'industry' && proposedR1Spend > round1MaxSpend) {
        dqReason = "breached the ₹135 Cr limit in Round 1";
    } else if (proposedBudget < threshold) {
        dqReason = "dropped below the ₹35 Cr operational threshold";
    }

    if (dqReason) {
        alert(`🛑 DISQUALIFICATION TRIGGERED!\n${team.name} ${dqReason}.\nAll their previously locked items have been freed and returned to the auction pool.`);
        team.isDQ = true;
        team.industry = []; 
        team.state = null;  
        team.budget = 0;
        team.round1Spend = proposedR1Spend; 
        team.matchPoints = 0;
        team.totalScore = 0;
    } else {
        team.budget = proposedBudget;
        team.round1Spend = proposedR1Spend;
        if (round === 'industry') team.industry.push(itemName);
        else if (round === 'state') team.state = itemName;

        team.matchPoints = 0;
        if (team.state && team.industry.length > 0) {
            let highestMatch = 0;
            team.industry.forEach(ind => {
                let pts = feasibility[team.state]?.[ind] || 0;
                if(pts > highestMatch) highestMatch = pts;
            });
            team.matchPoints = highestMatch;
        }

        team.totalScore = team.matchPoints + (team.budget / 10);
    }

    db.ref('hultAuction/teams').set(teams).then(() => {
        setBasePrice(); 
    });
}

function updateScoreboard() {
    const tbody = document.getElementById('scoreboardBody');
    tbody.innerHTML = '';
    
    let sortedTeams = [...teams].sort((a, b) => b.totalScore - a.totalScore);

    sortedTeams.forEach(t => {
        let status = `<span class="qual-status">Qualified</span>`;
        if (t.isDQ) {
            status = `<span class="dq-status">DQ (> ₹135 Cr R1)</span>`;
        } else if (t.budget < threshold && (t.industry.length > 0 || t.state)) {
            status = `<span class="dq-status">DQ (< ₹${threshold} Cr)</span>`;
        } else if (t.industry.length === 0 || !t.state) {
            status = `<span style="color:#7F8C8D">Incomplete</span>`;
        }

        let indDisplay = t.industry.length > 0 ? t.industry.join('<br>') : '-';

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold;">${t.name}</td>
            <td>${indDisplay}</td>
            <td>${t.state || '-'}</td>
            <td>${t.matchPoints > 0 ? t.matchPoints + ' Pts' : '-'}</td>
            <td style="${t.round1Spend > round1MaxSpend ? 'color: var(--accent); font-weight:bold;' : ''}">₹${t.round1Spend} Cr</td>
            <td style="${t.budget < threshold ? 'color: var(--accent); font-weight: bold;' : ''}">₹${t.budget} Cr</td>
            <td style="font-weight: bold; font-size: 16px;">${t.totalScore.toFixed(1)}</td>
            <td>${status}</td>
        `;
        if(sessionStorage.getItem('hultRole') !== 'viewer') {
            tr.innerHTML += `<td><button class="btn btn-red" style="padding: 4px 8px; font-size: 11px;" onclick="removeTeam(${t.id})">Delete</button></td>`;
        } else {
            tr.innerHTML += `<td>-</td>`;
        }
        tbody.appendChild(tr);
    });
}

// ==========================================
// 6. UI & MODAL FUNCTIONS
// ==========================================
function openMappingModal() {
    const modal = document.getElementById('mappingModal');
    const content = document.getElementById('mappingContent');
    content.innerHTML = ''; 
    
    for (const state in feasibility) {
        let industries = Object.keys(feasibility[state]);
        let listItems = industries.map(ind => `<li>${ind} <strong>(${feasibility[state][ind]} pts)</strong></li>`).join('');
        
        content.innerHTML += `
            <div class="mapping-card">
                <h4>${state}</h4>
                <ul>${listItems}</ul>
            </div>
        `;
    }
    modal.style.display = 'block';
}

function closeMappingModal() {
    document.getElementById('mappingModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('mappingModal');
    if (event.target == modal) {
        closeMappingModal();
    }
}
