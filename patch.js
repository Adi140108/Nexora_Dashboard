const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/NexoraDashboard.jsx', 'utf-8');

const str1 = `  const toggleFullTeamAttendance = async (teamName, membersString) => {
    const members = membersString.split(',').map(m => m.trim());
    const isAllPresent = attendance[teamName]?.length === members.length;
    const newIsPresent = !isAllPresent;`;

const rep1 = `  const getValidAttendance = (teamName, membersString) => {
    const presentList = attendance[teamName] || [];
    if (!membersString) return presentList;
    const expectedMembers = membersString.split(',').map(m => m.trim());
    return presentList.filter(m => expectedMembers.includes(m));
  };

  const toggleFullTeamAttendance = async (teamName, membersString) => {
    const members = membersString.split(',').map(m => m.trim());
    const validPresent = getValidAttendance(teamName, membersString);
    const isAllPresent = validPresent.length === members.length;
    const newIsPresent = !isAllPresent;`;

const str2 = `                      {attendance[team.teamName]?.length > 0 && (
                        <span className={\`attendance-badge \${attendance[team.teamName].length === (team.detailedMembers?.length || 1) ? 'all' : 'partial'}\`}>
                          {attendance[team.teamName].length}/{team.detailedMembers?.length || 1} Present
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="card-footer">
                    <button
                      className={\`btn-attendance \${attendance[team.teamName]?.length === team.members.split(',').length ? 'all' : ''}\`}
                      onClick={(e) => { e.stopPropagation(); toggleFullTeamAttendance(team.teamName, team.members); }}
                    >
                      {attendance[team.teamName]?.length > 0 ? <CheckCircle size={14} /> : <Users size={14} />}
                      {attendance[team.teamName]?.length === team.members.split(',').length ? 'All Present' : 'Mark Present'}
                    </button>`;

const rep2 = `                      {(() => {
                        const validPresent = getValidAttendance(team.teamName, team.members).length;
                        const expectedTotal = team.members ? team.members.split(',').length : (team.detailedMembers?.length || 1);
                        return validPresent > 0 ? (
                          <span className={\`attendance-badge \${validPresent === expectedTotal ? 'all' : 'partial'}\`}>
                            {validPresent}/{expectedTotal} Present
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="card-footer">
                    <button
                      className={\`btn-attendance \${getValidAttendance(team.teamName, team.members).length === (team.members ? team.members.split(',').length : 1) ? 'all' : ''}\`}
                      onClick={(e) => { e.stopPropagation(); toggleFullTeamAttendance(team.teamName, team.members); }}
                    >
                      {getValidAttendance(team.teamName, team.members).length > 0 ? <CheckCircle size={14} /> : <Users size={14} />}
                      {getValidAttendance(team.teamName, team.members).length === (team.members ? team.members.split(',').length : 1) ? 'All Present' : 'Mark Present'}
                    </button>`;

let changed = false;

if (content.includes(str1)) {
  content = content.replace(str1, rep1);
  changed = true;
} else if (content.includes(str1.replace(/\n/g, '\r\n'))) {
  content = content.replace(str1.replace(/\n/g, '\r\n'), rep1.replace(/\n/g, '\r\n'));
  changed = true;
} else {
  console.log('STR1 NOT FOUND');
}

if (content.includes(str2)) {
  content = content.replace(str2, rep2);
  changed = true;
} else if (content.includes(str2.replace(/\n/g, '\r\n'))) {
  content = content.replace(str2.replace(/\n/g, '\r\n'), rep2.replace(/\n/g, '\r\n'));
  changed = true;
} else {
  console.log('STR2 NOT FOUND');
}

if (changed) {
  fs.writeFileSync('frontend/src/components/NexoraDashboard.jsx', content);
  console.log('PATCHED successfully');
}
