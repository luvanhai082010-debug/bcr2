const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const logic = require('./GameLogic'); 

const app = express();
const server = http.createServer(app);

// CẤU HÌNH CHO DEPLOY: Cho phép Cross-Origin Resource Sharing (CORS) 
// để Frontend (Netlify) có thể kết nối tới Backend (Render).
const io = socketIo(server, {
    cors: {
        origin: "*", // Cho phép mọi nguồn. Trong môi trường production, bạn nên thay bằng domain Netlify của mình.
        methods: ["GET", "POST"]
    }
});

// Định nghĩa thư mục public chứa HTML, CSS, JS frontend (Chỉ cần cho chạy Local)
app.use(express.static(path.join(__dirname, '..', 'public')));

// CÁC HẰNG SỐ VÀ BIẾN TRẠNG THÁI GAME
const BETTING_TIME = 10;     
const OPENING_TIME = 10;     

let currentGameState = 'BETTING'; 
let timeRemaining = BETTING_TIME;
let gameTimer = null; 
let currentBets = {}; 
let lastRoundResult = null; 
let gameHistory = []; 

const BOT_GREETINGS = [
    "🤖 Xin chào, tôi là Robot phục vụ bàn. Chúc quý khách may mắn!",
    "🤖 Đã có cược lớn vào cửa Banker! Hãy cân nhắc cẩn thận.",
    "🤖 Cửa Player đang có dấu hiệu tốt, nhưng đừng vội vàng!",
    "🤖 Chỉ còn 5 giây đặt cược! Nhanh tay lên!",
    "🤖 Giao dịch thành công, chúng ta chuẩn bị mở bài."
];

function getWinnerText(winner) {
    if (winner === 'player') return 'CON (Player)';
    if (winner === 'banker') return 'CÁI (Banker)';
    return 'HÒA (Tie)';
}

// --- LOGIC XỬ LÝ GAME CỐT LÕI ---

function announceCardsSequentially(result) {
    const sequence = [];
    
    const p1 = logic.getCardDisplay(result.playerHand[0]);
    const b1 = logic.getCardDisplay(result.bankerHand[0]);
    const p2 = logic.getCardDisplay(result.playerHand[1]);
    const b2 = logic.getCardDisplay(result.bankerHand[1]);
    
    sequence.push({ message: `🤖 Player (CON) rút lá 1: ${p1}`, delay: 1000 });
    sequence.push({ message: `🤖 Banker (CÁI) rút lá 1: ${b1}`, delay: 2000 });
    sequence.push({ message: `🤖 Player (CON) rút lá 2: ${p2}.`, delay: 3000 });
    sequence.push({ message: `🤖 Banker (CÁI) rút lá 2: ${b2}.`, delay: 4000 });
    
    if (result.playerHand.length === 3) {
        const p3 = logic.getCardDisplay(result.playerHand[2]);
        sequence.push({ message: `🤖 Player (CON) rút lá 3: ${p3}.`, delay: 5500 });
    }

    if (result.bankerHand.length === 3) {
        const b3 = logic.getCardDisplay(result.bankerHand[result.bankerHand.length - 1]);
        sequence.push({ message: `🤖 Banker (CÁI) rút lá 3: ${b3}.`, delay: 7000 });
    }
    
    const finalMessage = `
        <span style="color: #FFD700; font-weight: bold;">
            🏆 KẾT QUẢ CUỐI CÙNG: ${getWinnerText(result.winner)} THẮNG! 
            (CON: ${result.playerScore} - CÁI: ${result.bankerScore})
        </span>
    `;
    sequence.push({ 
        message: finalMessage, 
        delay: 8500,
        isFinal: true 
    });

    sequence.forEach(item => {
        setTimeout(() => {
            io.emit('bot_chat', { message: item.message, isFinal: item.isFinal });
        }, item.delay);
    });
}

function calculateAndDistributeWinnings() {
    if (!lastRoundResult || !currentBets) return;

    const winner = lastRoundResult.winner;
    // Tỷ lệ cược (1:1 cho Player, 0.95:1 cho Banker, 8:1 cho Tie)
    const payouts = {
        player: 2, // 1 (vốn) + 1 (thắng)
        banker: 1.95, // 1 (vốn) + 0.95 (thắng)
        tie: 8 // Tỷ lệ cao, trả cả vốn (không triển khai Pair/Dragon/Tiger ở đây)
    };

    for (const userId in currentBets) {
        const userBets = currentBets[userId];
        let totalWinnings = 0;
        let totalRefund = 0; 

        // Giả sử chỉ cược Player/Banker/Tie
        const betType = Object.keys(userBets)[0]; 
        const amount = userBets[betType];

        if (betType === winner) {
            totalWinnings += amount * payouts[betType];
        } else if (winner === 'tie' && (betType === 'player' || betType === 'banker')) {
            totalRefund += amount; // Hoàn tiền cược Player/Banker khi hòa
        } 
        
        logic.MOCK_USERS[userId].balance += totalWinnings + totalRefund;

        io.to(userId).emit('balance_update', { 
            userId: userId, 
            balance: logic.MOCK_USERS[userId].balance 
        });
    }

    currentBets = {}; 
}


function runGameCycle() {
    clearInterval(gameTimer); 

    gameTimer = setInterval(() => {
        timeRemaining--;

        if (timeRemaining <= 0) {
            if (currentGameState === 'BETTING') {
                currentGameState = 'OPENING';
                timeRemaining = OPENING_TIME;
                
                const result = logic.dealCards();
                lastRoundResult = result;
                
                const resultSymbol = result.winner.toUpperCase().charAt(0);
                gameHistory.unshift(resultSymbol); 
                if (gameHistory.length > 20) {
                    gameHistory.pop();
                }

                io.emit('game_result', { 
                    status: 'OPENING', 
                    result: result, 
                    time: timeRemaining,
                    history: gameHistory 
                });
                
                announceCardsSequentially(result); 
                calculateAndDistributeWinnings(); 

            } else if (currentGameState === 'OPENING') {
                currentGameState = 'BETTING';
                timeRemaining = BETTING_TIME;
                lastRoundResult = null; 
                currentBets = {};
                
                io.emit('new_round', { status: 'BETTING', time: timeRemaining });
            }
        }
        
        if (currentGameState === 'BETTING' && timeRemaining % 5 === 0 && timeRemaining > 0) {
            const randomIndex = Math.floor(Math.random() * BOT_GREETINGS.length);
            io.emit('bot_chat', { message: BOT_GREETINGS[randomIndex] });
        }
        
        io.emit('timer_update', { 
            status: currentGameState, 
            time: timeRemaining 
        });
        
    }, 1000);
}


// --- XỬ LÝ KẾT NỐI SOCKET.IO ---

io.on('connection', (socket) => {
    let currentUserId = null; 

    // 1. Xử lý ĐĂNG NHẬP
    socket.on('login', (data) => {
        const user = logic.authenticate(data.userId, data.password);
        if (user) {
            currentUserId = data.userId;
            socket.join(currentUserId); 
            
            socket.emit('bot_chat', { 
                message: `🤖 Chào mừng ${currentUserId}! Bàn chơi đã sẵn sàng, chúc bạn may mắn.`,
                isFinal: false 
            });

            socket.emit('login_success', {
                userId: currentUserId,
                balance: user.balance,
                role: user.role,
                cheatToolEnabled: user.cheat_tool_enabled,
                gameState: currentGameState,
                timeRemaining: timeRemaining,
                history: gameHistory
            });

        } else {
            socket.emit('login_failure', { message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
        }
    });

    // 2. Xử lý ĐẶT CƯỢC
    socket.on('place_bet', (data) => {
        if (!currentUserId) return socket.emit('game_error', { message: 'Vui lòng đăng nhập.' });
        if (currentGameState !== 'BETTING') {
            return socket.emit('game_error', { message: 'Hiện không phải lúc đặt cược.' });
        }
        
        // Giả sử chỉ cược 1 loại mỗi lần
        const betType = Object.keys(data.bets)[0];
        const betAmount = data.bets[betType];

        const userBalance = logic.MOCK_USERS[currentUserId].balance;
        if (userBalance < betAmount) {
             return socket.emit('game_error', { message: 'Số dư không đủ để đặt cược.' });
        }

        // Ghi nhận cược mới
        currentBets[currentUserId] = currentBets[currentUserId] || {};
        currentBets[currentUserId][betType] = (currentBets[currentUserId][betType] || 0) + betAmount;

        logic.MOCK_USERS[currentUserId].balance -= betAmount; 

        socket.emit('balance_update', { 
            userId: currentUserId, 
            balance: logic.MOCK_USERS[currentUserId].balance 
        });
        
        io.emit('bet_received', { userId: currentUserId, bets: data.bets });
    });

    // 3. Xử lý ADMIN TOOL
    socket.on('admin_update_balance', (data) => {
        if (currentUserId !== 'admin') return; 

        if (logic.updateBalance(data.targetUserId, data.newBalance)) {
            io.to(data.targetUserId).emit('balance_update', { 
                userId: data.targetUserId, 
                balance: logic.MOCK_USERS[data.targetUserId].balance 
            });
            socket.emit('admin_message', { message: `Đã cập nhật số dư ${data.targetUserId}.` });
        } else {
            socket.emit('admin_message', { message: 'Không tìm thấy người dùng.' });
        }
    });
    
    // 4. Xử lý ĐĂNG XUẤT
    socket.on('logout', () => {
        if (currentUserId) {
            socket.leave(currentUserId);
            currentUserId = null;
        }
    });
});

runGameCycle(); 

// Render sẽ cung cấp biến môi trường PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
