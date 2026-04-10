const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

function getCurrentRound() {
  const firstDraw = new Date('2002-12-07');
  const now = new Date();
  return Math.floor((now - firstDraw) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

async function fetchRound(round, retries = 3) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      const data = await res.json();
      if (data.returnValue !== 'success') return null;
      return {
        round: data.drwNo,
        date: data.drwNoDate,
        numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6],
        bonus: data.bnusNo
      };
    } catch (e) {
      if (attempt === retries - 1) return null;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

async function main() {
  const currentRound = getCurrentRound();
  console.log(`총 ${currentRound}회차 데이터 수집 시작...`);

  const draws = [];
  const BATCH = 10;

  for (let i = 1; i <= currentRound; i += BATCH) {
    const promises = [];
    for (let j = i; j < Math.min(i + BATCH, currentRound + 1); j++) {
      promises.push(fetchRound(j));
    }
    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) draws.push(r.value);
    }
    process.stdout.write(`\r  ${draws.length}/${currentRound} 완료...`);
  }

  draws.sort((a, b) => a.round - b.round);

  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  fs.writeFileSync(
    path.join(publicDir, 'lotto-data.json'),
    JSON.stringify({
      lastRound: draws[draws.length - 1]?.round || 0,
      lastDate: draws[draws.length - 1]?.date,
      draws
    })
  );

  console.log(`\n완료: ${draws.length}회차 저장 → public/lotto-data.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
