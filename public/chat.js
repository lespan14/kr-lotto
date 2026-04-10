import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA7kMR1nz1qxp0mRmfXYR8jGVnYLszd6zQ",
  authDomain: "kr-lotto.firebaseapp.com",
  projectId: "kr-lotto",
  storageBucket: "kr-lotto.firebasestorage.app",
  messagingSenderId: "475441794338",
  appId: "1:475441794338:web:0a236f0c120e871d7be97b",
  measurementId: "G-GFEL2078CC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messagesRef = collection(db, 'messages');

// 닉네임 (localStorage 저장)
let username = localStorage.getItem('lotto-nick');
if (!username) {
  username = '로또왕' + Math.floor(Math.random() * 9000 + 1000);
  localStorage.setItem('lotto-nick', username);
}
document.getElementById('chat-nick').value = username;

// 실시간 메시지 수신
const q = query(messagesRef, orderBy('ts', 'desc'), limit(100));
onSnapshot(q, snapshot => {
  const msgs = [];
  snapshot.forEach(doc => msgs.push(doc.data()));
  msgs.reverse();
  const el = document.getElementById('chat-messages');
  const isBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 60;
  el.innerHTML = msgs.map(m => {
    const time = m.ts?.toDate
      ? m.ts.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `<div class="chat-msg">
      <div class="chat-msg-header">
        <span class="chat-user">${esc(m.nick)}</span>
        <span class="chat-time">${time}</span>
      </div>
      <p class="chat-text">${esc(m.text)}</p>
    </div>`;
  }).join('');
  if (isBottom) el.scrollTop = el.scrollHeight;
});

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function send() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  const nick = document.getElementById('chat-nick').value.trim() || username;
  localStorage.setItem('lotto-nick', nick);
  username = nick;
  input.value = '';
  await addDoc(messagesRef, { nick, text, ts: serverTimestamp() });
}

document.getElementById('chat-send').addEventListener('click', send);
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
