// Get DOM elements
const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const caseTitleInput = document.getElementById('caseTitle');
const renameCaseBtn = document.getElementById('renameCaseBtn');
const newTopicBtn = document.getElementById('newTopicBtn');

// Chat history management
let currentChatId = null;
let chatHistory = [];

// Load chat history from localStorage
function loadChatHistory() {
    const saved = localStorage.getItem('crimeInvestigatorChats');
    if (saved) {
        chatHistory = JSON.parse(saved);
        renderChatHistory();
    }
}

// Save chat history to localStorage
function saveChatHistory() {
    localStorage.setItem('crimeInvestigatorChats', JSON.stringify(chatHistory));
}

// Create new chat session
function createNewChat() {
    // Save current chat before creating new one
    if (currentChatId) {
        const currentChat = chatHistory.find(c => c.id === currentChatId);
        if (currentChat && currentChat.messages.length > 0) {
            // Current chat already saved, just create new
        }
    }
    
    currentChatId = Date.now();
    const newChat = {
        id: currentChatId,
        title: 'New Investigation',
        date: new Date().toLocaleString(),
        messages: []
    };
    chatHistory.unshift(newChat);
    
    // Keep only last 20 chats
    if (chatHistory.length > 20) {
        chatHistory = chatHistory.slice(0, 20);
    }
    
    saveChatHistory();
    renderChatHistory();
    clearChatBox();
    updateCaseTitle('New Investigation');
}

// Save message to current chat
function saveMessage(message, sender) {
    if (!currentChatId) {
        createNewChat();
    }
    
    const chat = chatHistory.find(c => c.id === currentChatId);
    if (chat) {
        chat.messages.push({ message, sender, timestamp: new Date().toISOString() });
        
        // Update chat title from first user message
        if (sender === 'user' && chat.title === 'New Investigation') {
            chat.title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
        }
        
        saveChatHistory();
        renderChatHistory();
    }
}

// Render chat history list
function renderChatHistory() {
    if (chatHistory.length === 0) {
        historyList.innerHTML = '<p class="no-history">No chat history yet</p>';
        return;
    }
    
    historyList.innerHTML = chatHistory.map(chat => `
        <div class="history-item ${chat.id === currentChatId ? 'active' : ''}" data-chat-id="${chat.id}">
            <div class="history-title">${escapeHtml(chat.title)}</div>
            <div class="history-date">${chat.date}</div>
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            loadChat(parseInt(item.dataset.chatId));
        });
    });
}

// Load a specific chat
function loadChat(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;
    
    currentChatId = chatId;
    clearChatBox();
    
    // Restore messages
    chat.messages.forEach(msg => {
        addMessageToUI(msg.message, msg.sender);
    });
    
    updateCaseTitle(chat.title);
    renderChatHistory();
}

// Update case title
function updateCaseTitle(title) {
    caseTitleInput.value = title;
}

// Rename case
function renameCase() {
    if (caseTitleInput.hasAttribute('readonly')) {
        caseTitleInput.removeAttribute('readonly');
        caseTitleInput.focus();
        caseTitleInput.select();
        renameCaseBtn.textContent = '✓';
    } else {
        caseTitleInput.setAttribute('readonly', 'true');
        renameCaseBtn.textContent = '✏️';
        
        // Save the new title
        const chat = chatHistory.find(c => c.id === currentChatId);
        if (chat) {
            chat.title = caseTitleInput.value || 'New Investigation';
            saveChatHistory();
            renderChatHistory();
        }
    }
}

// Start new investigation
function startNewTopic() {
    const chat = chatHistory.find(c => c.id === currentChatId);
    if (chat && chat.messages.length === 0) {
        // Current chat is empty, no need to create new
        return;
    }
    
    createNewChat();
}

// Clear chat box
function clearChatBox() {
    chatBox.innerHTML = `
        <div class="message bot-message">
            <div class="message-content">
                <div class="bot-header">
                    <img src="/static/images/ai_as.jpg" alt="AI" class="bot-avatar">
                    <strong>Investigator AI</strong>
                </div>
                <p>Welcome to the Crime Investigator AI system. I'm here to assist you with forensic procedures, investigation protocols, and crime scene analysis. How may I assist you today?</p>
            </div>
        </div>
    `;
}

// Clear all history
function clearAllHistory() {
    if (confirm('Are you sure you want to clear all case history?')) {
        chatHistory = [];
        currentChatId = null;
        localStorage.removeItem('crimeInvestigatorChats');
        renderChatHistory();
        clearChatBox();
        createNewChat();
    }
}

// Add event listeners
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
clearHistoryBtn.addEventListener('click', clearAllHistory);
renameCaseBtn.addEventListener('click', renameCase);
newTopicBtn.addEventListener('click', startNewTopic);
caseTitleInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        renameCase();
    }
});

// Load chat history on page load
loadChatHistory();

// Create new chat if none exists
if (chatHistory.length === 0) {
    createNewChat();
} else {
    // Load the most recent chat
    currentChatId = chatHistory[0].id;
    loadChat(currentChatId);
}

// Function to send message
async function sendMessage() {
    const message = userInput.value.trim();
    
    if (!message) {
        return;
    }
    
    // Disable input while processing
    userInput.disabled = true;
    sendBtn.disabled = true;
    
    // Add user message to chat
    addMessageToUI(message, 'user');
    saveMessage(message, 'user');
    
    // Clear input
    userInput.value = '';
    
    // Show typing indicator
    const typingIndicator = addTypingIndicator();
    
    try {
        // Send request to backend
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message })
        });
        
        // Remove typing indicator
        typingIndicator.remove();
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        // Add bot response to chat
        addMessageToUI(data.response, 'bot');
        saveMessage(data.response, 'bot');
        
    } catch (error) {
        // Remove typing indicator
        typingIndicator.remove();
        
        console.error('Error:', error);
        const errorMsg = '⚠️ An error occurred while processing your request. Please try again.';
        addMessageToUI(errorMsg, 'bot');
        saveMessage(errorMsg, 'bot');
    } finally {
        // Re-enable input
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

// Function to add message to UI
function addMessageToUI(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (sender === 'user') {
        messageContent.innerHTML = `<p>${escapeHtml(text)}</p>`;
    } else {
        messageContent.innerHTML = `
            <div class="bot-header">
                <img src="/static/images/ai_as.jpg" alt="AI" class="bot-avatar">
                <strong>Investigator AI</strong>
            </div>
            <p>${escapeHtml(text)}</p>
        `;
    }
    
    messageDiv.appendChild(messageContent);
    chatBox.appendChild(messageDiv);
    
    // Scroll to bottom
    chatBox.scrollTop = chatBox.scrollHeight;
    
    return messageDiv;
}

// Function to add typing indicator
function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message';
    typingDiv.id = 'typingIndicator';
    
    const typingContent = document.createElement('div');
    typingContent.className = 'typing-indicator';
    typingContent.innerHTML = '<span></span><span></span><span></span>';
    
    typingDiv.appendChild(typingContent);
    chatBox.appendChild(typingDiv);
    
    // Scroll to bottom
    chatBox.scrollTop = chatBox.scrollHeight;
    
    return typingDiv;
}

// Function to escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Focus on input when page loads
window.addEventListener('load', () => {
    userInput.focus();
});

// Add some ambient sound effects (optional)
function playSubmitSound() {
    // You can add sound effects here if needed
}

// Add enter key animation
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});
