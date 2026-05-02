const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/NexoraDashboard.jsx', 'utf-8');

content = content.replace(
  '  const getValidAttendance = (teamName, membersString) => {',
  '  function getValidAttendance(teamName, membersString) {'
);

content = content.replace(
  /const presentTeams = mergedData\.filter\(team => \(attendance\[team\.teamName\] \|\| \[\]\)\.length > 0\);/g,
  "const presentTeams = mergedData.filter(team => getValidAttendance(team.teamName, team.members).length > 0);"
);

content = content.replace(
  /const teamAttendance = attendance\[team\.teamName\] \|\| \[\];/g,
  "const teamAttendance = getValidAttendance(team.teamName, team.members);"
);

content = content.replace(
  /const presentMembers = \(attendance\[t\.teamName\] \|\| \[\]\)\.length;/g,
  "const presentMembers = getValidAttendance(t.teamName, t.members).length;"
);

content = content.replace(
  /const count = \(attendance\[t\.teamName\] \|\| \[\]\)\.length;/g,
  "const count = getValidAttendance(t.teamName, t.members).length;"
);

content = content.replace(
  /if \(activeTab === 'absent'\) data = data\.filter\(t => !attendance\[t\.teamName\] \|\| attendance\[t\.teamName\]\.length === 0\);/g,
  "if (activeTab === 'absent') data = data.filter(t => getValidAttendance(t.teamName, t.members).length === 0);"
);

fs.writeFileSync('frontend/src/components/NexoraDashboard.jsx', content);
console.log('PATCHED globally!');
