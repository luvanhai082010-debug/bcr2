// --- CÁC HẰNG SỐ VÀ CẤU TRÚC BÀI ---

const CARD_NAMES = {
    1: 'A', 11: 'J', 12: 'Q', 13: 'K'
};
const SUITS = [
    { symbol: '♥', color: 'red' }, 
    { symbol: '♦', color: 'red' }, 
    { symbol: '♣', color: 'black' }, 
    { symbol: '♠', color: 'black' }  
];

// MOCK DATABASE - Dữ liệu người dùng (giả lập)
const MOCK_USERS = {
    'Bot999': { 
        password_hash: 'bot_hash', 
        balance: 500000, 
        last_checkin_date: null, 
        verification_code: 'BOT',
        role: 'player',
        cheat_tool_enabled: false 
    },
    'user123': { 
        password_hash: 'abc', 
        balance: 100000, 
        last_checkin_date: null, 
        verification_code: '1234',
        role: 'player',
        cheat_tool_enabled: false 
    },
    'admin': { 
        password_hash: 'admin', 
        balance: 9999999, 
        last_checkin_date: null, 
        verification_code: 'ADMIN',
        role: 'admin',
        cheat_tool_enabled: true 
    }
};

// --- HÀM HỖ TRỢ BÀI ---

function getCardDisplay(card) {
    const value = card.value;
    const suit = card.suit; 
    const name = CARD_NAMES[value] || value.toString();
    const suitInfo = SUITS[suit];
    return `<span style="color: ${suitInfo.color}; font-weight: bold;">${name}${suitInfo.symbol}</span>`;
}

function calculateScore(hand) {
    const total = hand.reduce((sum, card) => {
        const value = (card.value >= 10) ? 0 : card.value; 
        return sum + value;
    }, 0);
    return total % 10;
}

// --- LOGIC PHÁT BÀI VÀ LUẬT RÚT BÀI ---

function dealCards() {
    let deck = [];
    for (let s = 0; s < SUITS.length; s++) { 
        for (let v = 1; v <= 13; v++) { 
            deck.push({ value: v, suit: s });
        }
    }
    const drawCard = () => {
        const index = Math.floor(Math.random() * deck.length);
        return deck.splice(index, 1)[0];
    };
    
    const playerHand = [drawCard(), drawCard()];
    const bankerHand = [drawCard(), drawCard()];

    let pScore = calculateScore(playerHand);
    let bScore = calculateScore(bankerHand);
    let result = '';
    
    // Player draw rule
    if (pScore <= 5) {
        playerHand.push(drawCard());
        pScore = calculateScore(playerHand); 
    }
    
    // Banker draw rule
    let shouldBankerDraw = false;
    const pThirdCardValue = playerHand.length === 3 ? playerHand[2].value : null; 

    if (bScore <= 2) {
        shouldBankerDraw = true;
    } else if (bScore === 3 && pThirdCardValue !== 8) {
        shouldBankerDraw = true;
    } else if (bScore === 4 && pThirdCardValue >= 2 && pThirdCardValue <= 7) {
        shouldBankerDraw = true;
    } else if (bScore === 5 && pThirdCardValue >= 4 && pThirdCardValue <= 7) {
        shouldBankerDraw = true;
    } else if (bScore === 6 && (pThirdCardValue === 6 || pThirdCardValue === 7)) {
        shouldBankerDraw = true;
    }

    if (shouldBankerDraw) {
        bankerHand.push(drawCard());
        bScore = calculateScore(bankerHand);
    }

    // Determine winner
    if (pScore > bScore) {
        result = 'player';
    } else if (bScore > pScore) {
        result = 'banker';
    } else {
        result = 'tie';
    }
    
    return {
        playerHand,
        bankerHand,
        playerScore: pScore,
        bankerScore: bScore,
        winner: result
    };
}

// --- CÁC HÀM XỬ LÝ KHÁC ---

function authenticate(userId, password) {
    const user = MOCK_USERS[userId];
    if (user && user.password_hash === password) {
        return user;
    }
    return null;
}

function updateBalance(userId, amount) {
    if (MOCK_USERS[userId]) {
        MOCK_USERS[userId].balance = amount;
        return true;
    }
    return false;
}

module.exports = {
    MOCK_USERS,
    authenticate,
    updateBalance,
    dealCards,
    calculateScore,
    getCardDisplay
};
