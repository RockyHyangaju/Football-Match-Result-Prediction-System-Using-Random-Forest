let teamsData = [];
let predictionsData = {};
let draggedTeam = null;

/* Fetch COMPLETE JSON with Teams & Predictions */
fetch('2026_worldcup_COMPLETE.json')
  .then(res => res.json())
  .then(data => {
    teamsData = data.teams;
    predictionsData = data.predictions;
    renderTeamsList();
  })
  .catch(err => console.error(err));

/* Render Teams Grid */
function renderTeamsList() {
  const teamsGrid = document.getElementById('teamsGrid');
  teamsGrid.innerHTML = '';
  teamsData.forEach(team => {
    const div = document.createElement('div');
    div.className = 'team-item';
    div.textContent = team.Team;
    teamsGrid.appendChild(div);
  });
}

/* Get Performance Score for Group Qualification */
function getPerformanceScore(teamName) {
  const team = teamsData.find(t => t.Team === teamName);
  return team ? team.Performance_Score : 2.5;
}

/* ML Prediction - Uses Pre-generated Predictions with Confidence */
function getMatchPrediction(team1, team2) {
  const key1 = `${team1}_vs_${team2}`;
  const key2 = `${team2}_vs_${team1}`;
  
  let prediction = predictionsData[key1];
  let reversed = false;
  
  if (!prediction) {
    prediction = predictionsData[key2];
    reversed = true;
  }
  
  if (!prediction) {
    console.warn(`No prediction found for ${team1} vs ${team2}`);
    // Fallback
    const perf1 = getPerformanceScore(team1);
    const perf2 = getPerformanceScore(team2);
    const winner = perf1 >= perf2 ? team1 : team2;
    
    return {
      winner: winner,
      confidence: 0.5,
      probabilities: { team1_win: 0.5, team2_win: 0.5 }
    };
  }
  
  // If we used the reversed key, we need to swap the probabilities
  if (reversed) {
    return {
      winner: prediction.winner,
      confidence: prediction.confidence,
      probabilities: {
        team1_win: prediction.probabilities.team2_win, // SWAP!
        team2_win: prediction.probabilities.team1_win  // SWAP!
      }
    };
  }
  
  return prediction;
}

/* Button Events - Show Teams */
document.getElementById('showTeamsBtn').addEventListener('click', () => {
  document.getElementById('teamsSection').scrollIntoView({ behavior: 'smooth' });
});

/* Button Events - Create Groups */
document.getElementById('createGroupsBtn').addEventListener('click', () => {
  document.getElementById('groupsSection').style.display = 'block';
  createGroupSlots();
  populateAvailableTeams();
  document.getElementById('groupsSection').scrollIntoView({ behavior: 'smooth' });
});

/* Populate Available Teams Panel */
function populateAvailableTeams() {
  const teamsScroll = document.getElementById('teamsScroll');
  teamsScroll.innerHTML = '<h3>Available Teams</h3>';
  const teamsGridDrag = document.createElement('div');
  teamsGridDrag.className = 'teams-grid';

  const usedTeams = [...document.querySelectorAll('.group-slot')]
    .map(slot => slot.textContent)
    .filter(t => t);

  teamsData.forEach(team => {
    if (!usedTeams.includes(team.Team)) {
      const div = document.createElement('div');
      div.className = 'team-item';
      div.textContent = team.Team;
      div.draggable = true;

      div.addEventListener('dragstart', () => {
        draggedTeam = team.Team;
      });
      div.addEventListener('dragend', () => {
        draggedTeam = null;
        populateAvailableTeams();
      });

      teamsGridDrag.appendChild(div);
    }
  });

  teamsScroll.appendChild(teamsGridDrag);
}

/* Create 4 Slots per Group */
function createGroupSlots() {
  const groups = document.querySelectorAll('.group-table');
  groups.forEach(group => {
    group.innerHTML = `<h4>${group.id.replace('group', 'Group ')}</h4>`;
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div');
      slot.className = 'group-slot';
      slot.addEventListener('dragover', e => e.preventDefault());
      slot.addEventListener('drop', () => {
        if (!slot.classList.contains('filled') && draggedTeam) {
          slot.textContent = draggedTeam;
          slot.classList.add('filled');
          populateAvailableTeams();
        }
      });
      group.appendChild(slot);
    }
  });
}

/* Random Select Teams */
document.getElementById('randomSelectBtn').addEventListener('click', () => {
  const allSlots = document.querySelectorAll('.group-slot');
  const remainingTeams = teamsData.map(t => t.Team)
    .filter(t => ![...allSlots].map(s => s.textContent).includes(t));

  const shuffledTeams = [...remainingTeams].sort(() => Math.random() - 0.5);

  allSlots.forEach(slot => {
    if (!slot.classList.contains('filled') && shuffledTeams.length > 0) {
      slot.textContent = shuffledTeams.shift();
      slot.classList.add('filled');
    }
  });

  populateAvailableTeams();
});

/* Reset Group Selection */
document.getElementById('resetGroupsBtn').addEventListener('click', () => {
  document.querySelectorAll('.group-slot').forEach(slot => {
    slot.textContent = '';
    slot.classList.remove('filled');
  });
  populateAvailableTeams();
});

/* Start Tournament Simulation */
document.getElementById('startTournamentBtn').addEventListener('click', () => {
  const allGroups = document.querySelectorAll('.group-table');
  
  // Check for empty slots
  const emptySlots = [...document.querySelectorAll('.group-slot')].some(slot => !slot.textContent);
  if (emptySlots) {
    alert("Some group slots are still empty! Please complete all groups before starting the tournament.");
    return;
  }

  // Select top 2 + best 8 third-placed using PERFORMANCE SCORES
  let top2Teams = [];
  let thirdPlaceCandidates = [];

  allGroups.forEach((group, idx) => {
    let teams = [...group.querySelectorAll('.group-slot')]
      .map(s => s.textContent)
      .filter(t => t);

    // Sort teams by PERFORMANCE SCORE (CORRECT)
    teams.sort((a, b) => getPerformanceScore(b) - getPerformanceScore(a));

    top2Teams.push({ team: teams[0], group: idx, performance: getPerformanceScore(teams[0]) });
    top2Teams.push({ team: teams[1], group: idx, performance: getPerformanceScore(teams[1]) });
    if (teams[2]) thirdPlaceCandidates.push({ 
      team: teams[2], 
      group: idx, 
      performance: getPerformanceScore(teams[2]) 
    });
  });

  thirdPlaceCandidates.sort((a, b) => b.performance - a.performance);
  let bestThird = thirdPlaceCandidates.slice(0, 8).map(t => ({ team: t.team, group: t.group }));

  // Display Top 32 Table
  const results = document.getElementById('resultsSection');
  let displayHTML = `<h2 class="bracket-title" style="text-align:center;">Top 32 Qualified Teams</h2>`;

  // Top 2 teams from each group
  displayHTML += `<h3 style="text-align:center;">Top 2 Teams from Each Group (by Performance Score)</h3>`;
  displayHTML += `<table border="1" style="margin:auto; border-collapse:collapse; width:80%;">
  <tr style="background:#667eea; color:white;">
    <th>S.N.</th>
    <th>Team</th>
    <th>Group</th>
    <th>Performance Score</th>
  </tr>`;
  top2Teams.forEach((t, index) => {
    displayHTML += `<tr>
      <td>${index + 1}</td>
      <td>${t.team}</td>
      <td>Group ${String.fromCharCode(65 + t.group)}</td>
      <td>${t.performance.toFixed(3)}</td>
    </tr>`;
  });
  displayHTML += `</table>`;

  // Best 8 third-placed teams
  displayHTML += `<h3 style="text-align:center; margin-top:1rem;">8 Best Third-Placed Teams (by Performance Score)</h3>`;
  displayHTML += `<table border="1" style="margin:auto; border-collapse:collapse; width:80%;">
  <tr style="background:#667eea; color:white;">
    <th>S.N.</th>
    <th>Team</th>
    <th>Group</th>
    <th>Performance Score</th>
  </tr>`;
  bestThird.forEach((t, index) => {
    const perfScore = getPerformanceScore(t.team);
    displayHTML += `<tr>
      <td>${index + 1}</td>
      <td>${t.team}</td>
      <td>Group ${String.fromCharCode(65 + t.group)}</td>
      <td>${perfScore.toFixed(3)}</td>
    </tr>`;
  });
  displayHTML += `</table>`;

  results.innerHTML = displayHTML;
  results.style.display = 'block';
  results.scrollIntoView({ behavior: 'smooth' });

  // Start Round of 32
  let qualifiedTeams = [...top2Teams, ...bestThird];
  setTimeout(() => startRound32(qualifiedTeams), 100);
});

/* Round of 32 Logic */
function startRound32(qualifiedTeams) {
  const results = document.getElementById('resultsSection');
  let remainingTeams = [...qualifiedTeams];
  let round32Matches = [];

  while (remainingTeams.length > 0) {
    let t1 = remainingTeams.shift();
    let possibleOpponents = remainingTeams.filter(t => t.group !== t1.group);
    if (possibleOpponents.length === 0) possibleOpponents = remainingTeams;
    let t2 = possibleOpponents[Math.floor(Math.random() * possibleOpponents.length)];
    round32Matches.push({ team1: t1.team, team2: t2.team });
    remainingTeams = remainingTeams.filter(t => t.team !== t2.team);
  }

  // Use ML predictions for Round of 32
  round32Matches = round32Matches.map(match => {
    const prediction = getMatchPrediction(match.team1, match.team2);
    return { 
      ...match, 
      winner: prediction.winner,
      confidence: prediction.confidence,
      probabilities: prediction.probabilities
    };
  });

  let displayHTML = `<h2 class="bracket-title" style="text-align:center; margin-top:2rem;">Round of 32 Matches</h2>`;
  round32Matches.forEach(m => {
    const confidencePercent = (m.confidence * 100).toFixed(1);
    
    // FIXED: Get the correct probabilities based on actual team order
    const team1Prob = m.probabilities.team1_win;
    const team2Prob = m.probabilities.team2_win;
    
    displayHTML += `
      <div style="text-align:center; margin:0.5rem 0; padding:0.5rem; background:#f8f9fa; border-radius:8px;">
        <strong>${m.team1}</strong> vs <strong>${m.team2}</strong> 
        <br> Winner: <strong style="color:#667eea;">${m.winner}</strong>
        <br> Confidence: ${confidencePercent}%
        <br> ${m.team1} Win: ${(team1Prob * 100).toFixed(1)}% | ${m.team2} Win: ${(team2Prob * 100).toFixed(1)}%
      </div>`;
  });
  results.innerHTML += displayHTML;

  startKnockouts(round32Matches.map(m => m.winner), 'Round of 16');
}

/* Knockout Logic */
function startKnockouts(teamsArray, roundName) {
  if (teamsArray.length <= 1) return;

  let matches = [];
  for (let i = 0; i < teamsArray.length; i += 2) {
    let t1 = teamsArray[i];
    let t2 = teamsArray[i + 1];
    const prediction = getMatchPrediction(t1, t2);
    matches.push({ 
      team1: t1, 
      team2: t2, 
      winner: prediction.winner,
      confidence: prediction.confidence,
      probabilities: prediction.probabilities
    });
  }

  const results = document.getElementById('resultsSection');
  let displayHTML = `<h3 style="text-align:center; margin-top:2rem;">${roundName}</h3>`;
  matches.forEach(m => {
    const confidencePercent = (m.confidence * 100).toFixed(1);
    
    // FIXED: Get the correct probabilities based on actual team order
    const team1Prob = m.probabilities.team1_win;
    const team2Prob = m.probabilities.team2_win;
    
    displayHTML += `
      <div style="text-align:center; margin:0.5rem 0; padding:0.5rem; background:#f8f9fa; border-radius:8px;">
        <strong>${m.team1}</strong> vs <strong>${m.team2}</strong>
        <br> Winner: <strong style="color:#667eea;">${m.winner}</strong>
        <br> Confidence: ${confidencePercent}%
        <br> ${m.team1} Win: ${(team1Prob * 100).toFixed(1)}% | ${m.team2} Win: ${(team2Prob * 100).toFixed(1)}%
      </div>`;
  });
  results.innerHTML += displayHTML;

  // Semifinals → Third Place → Final
  if (matches.length === 2) {
    const semiWinners = matches.map(m => m.winner);
    const semiLosers = matches.map(m => [m.team1, m.team2].filter(t => t !== m.winner)[0]);

    // Third Place Match
    const thirdPlacePrediction = getMatchPrediction(semiLosers[0], semiLosers[1]);
    const thirdPlaceWinner = thirdPlacePrediction.winner;

    results.innerHTML += `<h3 style="text-align:center; margin-top:2rem;">Third Place Match</h3>`;
    results.innerHTML += `
      <div style="text-align:center; margin:0.5rem 0; padding:0.5rem; background:#f8f9fa; border-radius:8px;">
        <strong>${semiLosers[0]}</strong> vs <strong>${semiLosers[1]}</strong>
        <br> Winner: <strong style="color:#667eea;">${thirdPlaceWinner}</strong>
        <br> Confidence: ${(thirdPlacePrediction.confidence * 100).toFixed(1)}%
        <br> ${semiLosers[0]} Win: ${(thirdPlacePrediction.probabilities.team1_win * 100).toFixed(1)}% | ${semiLosers[1]} Win: ${(thirdPlacePrediction.probabilities.team2_win * 100).toFixed(1)}%
      </div>`;

    // Final Match
    const finalPrediction = getMatchPrediction(semiWinners[0], semiWinners[1]);
    const finalWinner = finalPrediction.winner;
    const runnerUp = semiWinners.find(t => t !== finalWinner);

    results.innerHTML += `<h3 style="text-align:center; margin-top:2rem;">Final Match</h3>`;
    results.innerHTML += `
      <div style="text-align:center; margin:0.5rem 0; padding:0.5rem; background:#f8f9fa; border-radius:8px;">
        <strong>${semiWinners[0]}</strong> vs <strong>${semiWinners[1]}</strong>
        <br>Winner: <strong style="color:#667eea;">${finalWinner}</strong>
        <br>Confidence: ${(finalPrediction.confidence * 100).toFixed(1)}%
        <br>${semiWinners[0]} Win: ${(finalPrediction.probabilities.team1_win * 100).toFixed(1)}% | ${semiWinners[1]} Win: ${(finalPrediction.probabilities.team2_win * 100).toFixed(1)}%
      </div>`;

    // Tournament Results
    results.innerHTML += `
      <div style="text-align:center; margin-top:3rem; padding:2rem; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; border-radius:12px;">
        <h2 style="margin:0 0 1rem 0; font-size:2rem;">**** Tournament Results ****</h2>
        <div style="font-size:2.5rem; font-weight:bold; margin:1rem 0;"> Champion: ${finalWinner}</div>
        <div style="font-size:1.8rem; font-weight:bold; margin:0.5rem 0;"> RunnerUp: ${runnerUp}</div>
        <div style="font-size:1.5rem; font-weight:bold; margin:0.5rem 0;"> ThirdPlace: ${thirdPlaceWinner}</div>
      </div>`;

    // Return Button
    const returnBtnHTML = `<div style="text-align:center; margin-top:2rem;">
        <button id="returnToGroupsBtn" class="btn btn-secondary">Return to Group Stage</button>
      </div>`;
    results.innerHTML += returnBtnHTML;

    document.getElementById('returnToGroupsBtn').addEventListener('click', () => {
      results.style.display = 'none';
      document.getElementById('groupsSection').style.display = 'block';
      window.scrollTo({ top: document.getElementById('groupsSection').offsetTop, behavior: 'smooth' });
    });

    return;
  }

  // Next round
  let nextRound = '';
  switch (matches.length) {
    case 8: nextRound = 'Quarterfinals'; break;
    case 4: nextRound = 'Semifinals'; break;
    default: nextRound = 'Next Round'; break;
  }
  startKnockouts(matches.map(m => m.winner), nextRound);
}