const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const CACHE_FILE = path.join(__dirname, 'lotto_cache.json');

app.use(express.static(path.join(__dirname, 'public')));

// 현재 회차 계산 (1회: 2002-12-07)
function getCurrentRound() {
  const firstDraw = new Date('2002-12-07');
  const now = new Date();
  const diffMs = now - firstDraw;
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
}

// 단일 회차 데이터 가져오기
async function fetchRound(round) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 8000
  });
  const data = await res.json();
  if (data.returnValue !== 'success') return null;
  return {
    round: data.drwNo,
    date: data.drwNoDate,
    numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6],
    bonus: data.bnusNo
  };
}

// 캐시 로드
function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }
  return { lastRound: 0, draws: [] };
}

// 캐시 저장
function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
}

// 누락된 회차 업데이트
async function updateCache() {
  const cache = loadCache();
  const currentRound = getCurrentRound();
  const startRound = cache.lastRound + 1;

  if (startRound > currentRound) return cache;

  console.log(`[캐시 업데이트] ${startRound}회 ~ ${currentRound}회 가져오는 중...`);

  const BATCH = 10;
  for (let i = startRound; i <= currentRound; i += BATCH) {
    const batch = [];
    for (let j = i; j < Math.min(i + BATCH, currentRound + 1); j++) {
      batch.push(fetchRound(j));
    }
    const results = await Promise.allSettled(batch);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        cache.draws.push(r.value);
        cache.lastRound = r.value.round;
      }
    }
    process.stdout.write(`\r  ${cache.lastRound}/${currentRound}회 완료...`);
  }

  cache.draws.sort((a, b) => a.round - b.round);
  saveCache(cache);
  console.log('\n[캐시 업데이트 완료]');
  return cache;
}

// API: 전체 통계 데이터
app.get('/api/stats', async (req, res) => {
  try {
    const cache = await updateCache();
    const freq = {};
    const bonusFreq = {};
    for (let n = 1; n <= 45; n++) { freq[n] = 0; bonusFreq[n] = 0; }

    for (const draw of cache.draws) {
      for (const n of draw.numbers) freq[n]++;
      bonusFreq[draw.bonus]++;
    }

    const sorted = Object.entries(freq)
      .map(([num, count]) => ({ num: parseInt(num), count, bonus: bonusFreq[num] }))
      .sort((a, b) => b.count - a.count);

    res.json({
      totalRounds: cache.draws.length,
      lastRound: cache.lastRound,
      lastDate: cache.draws[cache.draws.length - 1]?.date,
      frequency: sorted,
      recentDraws: cache.draws.slice(-20).reverse()
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// API: 캐시 강제 초기화 후 재수집
app.get('/api/refresh', async (req, res) => {
  if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
  res.json({ ok: true, message: '캐시 초기화됨. /api/stats 재요청하세요.' });
});

app.listen(PORT, () => {
  console.log(`로또 통계 서버 실행 중: http://localhost:${PORT}`);
  console.log('최초 실행 시 데이터 수집에 수 분이 걸릴 수 있습니다.');
});
