const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatMessages = document.getElementById("chat-messages");
const sendBtn = document.getElementById("send-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const clearChatBtn = document.getElementById("clear-chat-btn");
const welcomePanel = document.getElementById("welcome-panel");
const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
const historyList = document.getElementById("history-list");
const voiceBtn = document.getElementById("voice-btn");
const speakBtn = document.getElementById("speak-btn");
const webSearchToggle = document.getElementById("web-search-toggle");
const STORAGE_KEY = "zulfiqar-ai-conversations-v1";
let isSending = false;
let conversations = loadConversations();
let currentId = null;
let recognition = null;
let latestAssistantReply = "";

function loadConversations() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function saveConversations() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 40))); } catch (e) { console.warn("Could not save chat history", e); } }
function currentConversation() { return conversations.find(c => c.id === currentId); }
function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function createConversation() { const c = { id: makeId(), title: "New conversation", messages: [], updatedAt: Date.now() }; conversations.unshift(c); currentId = c.id; saveConversations(); renderHistory(); return c; }
function scrollToLatest() { chatMessages.scrollTop = chatMessages.scrollHeight; }
function addMessage(message, sender, persist = true) {
  const messageDiv = document.createElement("div"); messageDiv.className = `message ${sender}`; messageDiv.textContent = message; chatMessages.appendChild(messageDiv); scrollToLatest();
  if (persist) { const c = currentConversation(); if (c) { c.messages.push({ role: sender === "user" ? "user" : "assistant", content: message }); c.updatedAt = Date.now(); if (c.title === "New conversation" && sender === "user") c.title = message.slice(0, 34) + (message.length > 34 ? "…" : ""); saveConversations(); renderHistory(); } }
  if (sender === "bot") latestAssistantReply = message;
  return messageDiv;
}
function showWelcome() { chatMessages.innerHTML = ""; chatMessages.appendChild(welcomePanel); welcomePanel.hidden = false; latestAssistantReply = ""; }
function renderConversation(c) { chatMessages.innerHTML = ""; if (!c || !c.messages.length) { chatMessages.appendChild(welcomePanel); welcomePanel.hidden = false; return; } welcomePanel.hidden = true; c.messages.forEach(m => { const el = document.createElement("div"); el.className = `message ${m.role === "user" ? "user" : "bot"}`; el.textContent = m.content; chatMessages.appendChild(el); if (m.role === "assistant") latestAssistantReply = m.content; }); scrollToLatest(); }
function renderHistory() { if (!historyList) return; historyList.innerHTML = ""; conversations.slice(0, 20).forEach(c => { const b = document.createElement("button"); b.type = "button"; b.className = `history-item${c.id === currentId ? " active" : ""}`; b.textContent = c.title || "Conversation"; b.title = c.title || "Conversation"; b.addEventListener("click", () => { if (isSending) return; currentId = c.id; renderConversation(c); renderHistory(); }); historyList.appendChild(b); }); }
function startNewChat() { if (isSending) return; createConversation(); showWelcome(); userInput.value = ""; resizeInput(); userInput.focus(); }
function resizeInput() { userInput.style.height = "auto"; userInput.style.height = `${Math.min(userInput.scrollHeight, 110)}px`; }
function showTyping() { const typing = document.createElement("div"); typing.className = "message bot typing"; typing.textContent = "Zulfiqar AI is thinking…"; chatMessages.appendChild(typing); scrollToLatest(); return typing; }
async function sendMessage(message) {
  if (!message || isSending) return;
  if (!currentConversation()) createConversation();
  if (welcomePanel.isConnected) welcomePanel.remove();
  addMessage(message, "user"); userInput.value = ""; resizeInput();
  isSending = true; sendBtn.disabled = true; sendBtn.querySelector("span").textContent = "Sending";
  const typing = showTyping();
  try {
    const c = currentConversation();
    const history = (c?.messages || []).slice(0, -1).slice(-12);
    const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history, webSearch: Boolean(webSearchToggle?.checked) }) });
    const data = await response.json(); typing.remove();
    if (!response.ok) throw new Error(data.error || "AI service error");
    if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("The AI returned an empty response.");
    addMessage(data.reply, "bot");
  } catch (error) { typing.remove(); addMessage(`Sorry! ${error.message || "Something went wrong. Please try again."}`, "bot"); console.error("Chat error:", error); }
  finally { isSending = false; sendBtn.disabled = false; sendBtn.querySelector("span").textContent = "Send"; userInput.focus(); }
}
chatForm.addEventListener("submit", e => { e.preventDefault(); sendMessage(userInput.value.trim()); });
userInput.addEventListener("input", resizeInput);
userInput.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatForm.requestSubmit(); } });
document.querySelectorAll(".suggestion").forEach(b => b.addEventListener("click", () => sendMessage(b.dataset.prompt || "")));
newChatBtn.addEventListener("click", startNewChat);
clearChatBtn.addEventListener("click", () => { if (isSending) return; const c = currentConversation(); if (c) { c.messages = []; c.title = "New conversation"; c.updatedAt = Date.now(); saveConversations(); } showWelcome(); renderHistory(); });
menuToggle.addEventListener("click", () => { const open = navLinks.classList.toggle("open"); menuToggle.setAttribute("aria-expanded", String(open)); });
navLinks.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { navLinks.classList.remove("open"); menuToggle.setAttribute("aria-expanded", "false"); }));
// Browser speech recognition: microphone permission is requested only after the user clicks Voice.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition(); recognition.lang = "ur-PK"; recognition.continuous = false; recognition.interimResults = false;
  recognition.onstart = () => { voiceBtn.classList.add("recording"); voiceBtn.innerHTML = "🔴 <span>Listening…</span>"; };
  recognition.onresult = e => { userInput.value = e.results[0][0].transcript; resizeInput(); userInput.focus(); };
  recognition.onerror = e => { console.warn("Speech recognition:", e.error); voiceBtn.title = `Voice input: ${e.error}`; };
  recognition.onend = () => { voiceBtn.classList.remove("recording"); voiceBtn.innerHTML = "🎤 <span>Voice</span>"; };
  voiceBtn.addEventListener("click", () => { try { recognition.start(); } catch { recognition.stop(); } });
} else { voiceBtn.addEventListener("click", () => alert("Voice input is not supported in this browser. Please try the latest Chrome or Edge.")); }
speakBtn.addEventListener("click", () => { if (!latestAssistantReply) { alert("There is no AI answer to read yet."); return; } if (!("speechSynthesis" in window)) { alert("Text-to-speech is not supported in this browser."); return; } window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(latestAssistantReply); utterance.lang = /[\u0600-\u06FF]/.test(latestAssistantReply) ? "ur-PK" : "en-US"; window.speechSynthesis.speak(utterance); });
// Restore saved sessions on page refresh.
if (conversations.length) { conversations.sort((a,b) => b.updatedAt - a.updatedAt); currentId = conversations[0].id; renderConversation(currentConversation()); }
else { createConversation(); showWelcome(); }
renderHistory();
