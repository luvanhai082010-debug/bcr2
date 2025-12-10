// Khởi tạo Socket.IO
// ĐỊA CHỈ NÀY ĐÃ ĐƯỢC THAY THẾ BẰNG URL SERVER THỰC TẾ BẠN CUNG CẤP
const BACKEND_URL = 'https://bcr2.onrender.com'; 
const socket = io(BACKEND_URL); 

// CÁC BIẾN TRẠNG THÁI GAME
let currentUserId = null;
let userBalance = 0;
let selectedChipValue = 0;
let selectedBetArea = 'player';
let userCurrentBets = { player: 0, banker: 0, tie: 0, player_pair: 0, banker_pair: 0, dragon: 0 }; 
let gameStatus = 'DISCONNECTED';

// --- HÀM HỖ TRỢ CHUNG ---

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', '').trim();
}

function showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('admin-form').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function showAdminLogin() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('admin-form').style.display = 'block';
}

// --- LOGIC XÁC THỰC VÀ QUẢN LÝ TÀI KHOẢN ---

function login() {
    const userId = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    document.getElementById('login-message').textContent = 'Đang đăng nhập...';
    socket.emit('login', { userId, password });
}

function logout() {
    socket.emit('logout');
    currentUserId = null;
    userBalance = 0;
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('login-message').textContent = 'Đã đăng xuất.';
    showLoginForm();
}

function adminUpdateBalance() {
    const targetUserId = document.getElementById('admin-target-user').value;
    const newBalance = parseInt(document.getElementById('admin-new-balance').value);
    if (!targetUserId || isNaN(newBalance)) {
        return document.getElementById('admin-message').textContent = 'Vui lòng nhập đủ thông tin.';
    }
    socket.emit('admin_update_balance', { targetUserId, newBalance });
}

// --- LOGIC ĐẶT CƯỢC VÀ CHIP ---

function selectChip(value) {
    selectedChipValue = value;
    document.getElementById('current-chip-value').textContent = formatCurrency(value);

    document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('selected'));
    if (value > 0) {
        document.querySelector(`.chip[data-value="${value}"]`).classList.add('selected');
    }
}

function setChipValue(betType) {
    selectedBetArea = betType;
    document.getElementById('selected-bet-type').value = betType;
}

function updateBetDisplay() {
    document.querySelectorAll('.current-bet-display').forEach(el => {
        const betType = el.id.replace('bet-', '');
        if (['player', 'banker', 'tie'].includes(betType)) {
             el.textContent = formatCurrency(userCurrentBets[betType] || 0);
        }
    });
}

function placeBet(betType, amount) {
    socket.emit('place_bet', { 
        bets: { [betType]: amount } 
    });
}

function placeBetOnSelectedArea() {
    if (gameStatus !== 'BETTING') {
        return alert("Chỉ có thể đặt cược khi đang trong trạng thái ĐẶT CƯỢC.");
    }
    if (selectedChipValue <= 0) {
        return alert("Vui lòng chọn giá trị chip trước khi đặt cược.");
    }
    
    if (userBalance < selectedChipValue) {
        return alert("Số dư không đủ.");
    }

    userCurrentBets[selectedBetArea] += selectedChipValue;
    placeBet(selectedBetArea, selectedChipValue);
    
    userBalance -= selectedChipValue;
    document.getElementById('user-balance').textContent = formatCurrency(userBalance);

    updateBetDisplay();
    
    selectChip(0);
    selectChip(5); 
}

function clearAllBets() {
    if (gameStatus !== 'BETTING') {
        return alert("Chỉ có thể hủy cược khi đang trong trạng thái ĐẶT CƯỢC.");
    }
    alert("Tính năng Hủy cược cần được phát triển logic hoàn tiền trên server.");
    userCurrentBets = { player: 0, banker: 0, tie: 0, player_pair: 0, banker_pair: 0, dragon: 0 };
    updateBetDisplay();
}

// --- LOGIC HIỂN THỊ GAME ---

function createCardElement(card) {
    const suitIndex = card.suit; 
    const suitSymbols = ['♥', '♦', '♣', '♠'];
    const suitColors = ['red-suit', 'red-suit', 'black-suit', 'black-suit'];
    
    const cardName = card.value >= 11 ? (card.value === 11 ? 'J' : card.value === 12 ? 'Q' : 'K') : (card.value === 1 ? 'A' : card.value.toString());

    const cardEl = document.createElement('div');
    cardEl.classList.add('card', 'card-face');
    cardEl.style.transform = 'rotateY(0deg)'; 

    cardEl.innerHTML = `
        <span class="card-value-top ${suitColors[suitIndex]}">${cardName}</span>
        <span class="card-suit ${suitColors[suitIndex]}">${suitSymbols[suitIndex]}</span>
        <span class="card-value-bottom ${suitColors[suitIndex]}" style="transform: rotate(180deg);">${cardName}</span>
    `;

    return cardEl;
}

function updateHistoryDisplay(history) {
    const historyContainer = document.getElementById('history-display');
    historyContainer.innerHTML = ''; 
    
    history.forEach(resultSymbol => {
        const item = document.createElement('div');
        item.classList.add('history-item', resultSymbol);
        item.textContent = resultSymbol;
        historyContainer.appendChild(item);
    });
}

// --- LOGIC TẢI DỮ LIỆU BAN ĐẦU ---

async function fetchInitialHistory() {
    // API GET Endpoint mà chúng ta đã đề xuất thêm vào server/index.js
    const historyUrl = `${BACKEND_URL}/api/history`; 
    
    try {
        const response = await fetch(historyUrl);
        if (!response.ok) {
            throw new Error('Lỗi khi tải lịch sử.');
        }
        const data = await response.json();
        updateHistoryDisplay(data.history || []);
    } catch (error) {
        console.error("Không thể tải lịch sử game:", error);
    }
}


// --- SOCKET LISTENERS (KHỞI TẠO GAME) ---

function initGame() {
    selectChip(5);
    updateBetDisplay(); 
    
    // Tải lịch sử game ngay khi trang load (nếu server có API này)
    fetchInitialHistory();
    
    socket.on('login_success', (data) => {
        currentUserId = data.userId;
        userBalance = data.balance;
        gameStatus = data.gameState;

        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        document.getElementById('welcome-message').textContent = `Chào mừng, ${currentUserId}!`;
        document.getElementById('user-balance').textContent = formatCurrency(userBalance);
        document.getElementById('tool-activation-area').style.display = data.cheatToolEnabled ? 'block' : 'none';
        
        document.getElementById('game-timer').textContent = `${data.gameState === 'BETTING' ? 'ĐẶT CƯỢC' : 'MỞ BÀI'} - ${data.timeRemaining}s`;
        
        // Cập nhật lại lịch sử nếu có, hoặc dùng lịch sử từ API đã tải
        if (data.history && data.history.length > 0) {
            updateHistoryDisplay(data.history);
        }
    });

    socket.on('login_failure', (data) => {
        document.getElementById('login-message').textContent = data.message;
    });

    socket.on('balance_update', (data) => {
        if (data.userId === currentUserId) {
            userBalance = data.balance;
            document.getElementById('user-balance').textContent = formatCurrency(userBalance);
        }
    });

    socket.on('timer_update', (data) => {
        gameStatus = data.status;
        let statusText = gameStatus === 'BETTING' ? 'ĐẶT CƯỢC' : 'MỞ BÀI';
        document.getElementById('game-timer').textContent = `${statusText} - ${data.time}s`;
    });

    socket.on('game_result', (data) => {
        const result = data.result;
        
        document.getElementById('player-hand').innerHTML = '';
        document.getElementById('banker-hand').innerHTML = '';

        result.playerHand.forEach((card, index) => {
            const cardEl = createCardElement(card);
            cardEl.style.transform = `translateX(${index * 5}px) rotate(${index * 5 - 5}deg)`; 
            document.getElementById('player-hand').appendChild(cardEl);
        });

        result.bankerHand.forEach((card, index) => {
            const cardEl = createCardElement(card);
            cardEl.style.transform = `translateX(${index * -5}px) rotate(${index * -5 + 5}deg)`; 
            document.getElementById('banker-hand').appendChild(cardEl);
        });
        
        document.querySelector('.player-slot p').textContent = `CON (${result.playerScore})`;
        document.querySelector('.banker-slot p').textContent = `CÁI (${result.bankerScore})`;
        updateHistoryDisplay(data.history);
        
        document.getElementById('result-area').innerHTML = `
            <h3>Vòng trước: ${result.winner.toUpperCase()} THẮNG!</h3>
        `;
    });
    
    socket.on('new_round', (data) => {
        userCurrentBets = { player: 0, banker: 0, tie: 0, player_pair: 0, banker_pair: 0, dragon: 0 };
        updateBetDisplay();
        
        document.getElementById('player-hand').innerHTML = '';
        document.getElementById('banker-hand').innerHTML = '';
        document.querySelector('.player-slot p').textContent = `CON (0)`;
        document.querySelector('.banker-slot p').textContent = `CÁI (0)`;
        
        document.getElementById('result-area').innerHTML = 'Kết quả: Đặt cược cho vòng mới!';
    });
    
    const botChatbox = document.getElementById('bot-chatbox');
    socket.on('bot_chat', (data) => {
        const messageEl = document.createElement('p');
        
        if (data.isFinal) {
            messageEl.innerHTML = data.message; 
            messageEl.style.fontWeight = 'bold'; 
        } else {
            messageEl.classList.add('bot-message-system'); 
            messageEl.textContent = data.message;
        }
        
        botChatbox.appendChild(messageEl);
        botChatbox.scrollTop = botChatbox.scrollHeight;
    });

    socket.on('game_error', (data) => {
        alert("Lỗi: " + data.message);
    });
}

document.addEventListener('DOMContentLoaded', initGame);
