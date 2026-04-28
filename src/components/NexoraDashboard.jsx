import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  Search, 
  Users, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  Filter,
  Download,
  Database,
  ArrowRight,
  TrendingUp,
  X,
  History,
  ShieldCheck,
  Cloud,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NexoraDashboard = () => {
  const [teamData, setTeamData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [mergedData, setMergedData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [attendance, setAttendance] = useState(() => {
    const saved = localStorage.getItem('nexora_attendance');
    return saved ? JSON.parse(saved) : {};
  });
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('nexora_recent_searches');
    return saved ? JSON.parse(saved) : [];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  // Cloud Sync States
  const [sheetIdTeam, setSheetIdTeam] = useState(localStorage.getItem('nexora_sheet_team') || '');
  const [sheetIdPayment, setSheetIdPayment] = useState(localStorage.getItem('nexora_sheet_payment') || '');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      if (type === 'team') {
        setTeamData(data);
      } else {
        setPaymentData(data);
      }
    };
    reader.readAsBinaryString(file);
  };

  const processAndMerge = () => {
    if (teamData.length === 0 || paymentData.length === 0) {
      alert("Please upload both Excel files first!");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Robust key finder helper
      const findVal = (obj, patterns) => {
        const key = Object.keys(obj).find(k => {
          const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return patterns.some(p => normalizedK.includes(p));
        });
        return key ? obj[key] : null;
      };

      // Helper to find ALL values matching a pattern (e.g. for multiple members)
      const findAllVals = (obj, pattern) => {
        return Object.keys(obj)
          .filter(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(pattern))
          .map(k => obj[k])
          .filter(v => v && String(v).trim().toLowerCase() !== 'n/a');
      };

      setTimeout(() => {
        const merged = teamData.map(team => {
          // 1. Identify Team Name
          const teamIdKey = findVal(team, ['teamname', 'name', 'group', 'organization']) || team['Team Name'] || 'Unnamed Team';
          
          // 2. Find Payment
          const payment = paymentData.find(p => {
            const pIdKey = findVal(p, ['teamname', 'name', 'group', 'team']) || p['Team Name'];
            return String(pIdKey || '').toLowerCase().trim() === String(teamIdKey || '').toLowerCase().trim();
          });

          // 3. Extract Members (could be one column or many)
          let membersList = findAllVals(team, 'participant');
          if (membersList.length === 0) membersList = findAllVals(team, 'member');
          if (membersList.length === 0) membersList = [findVal(team, ['members', 'names', 'allnames']) || 'Not specified'];
          
          const memberString = Array.isArray(membersList) ? membersList.filter(m => m !== 'Not specified').join(', ') : String(membersList);

          // 4. Extract Contact/Leader
          const leader = findVal(team, ['leader', 'captain', 'poc', 'representative']) || membersList[0] || 'N/A';
          const phone = findVal(team, ['phone', 'contact', 'mobile', 'whatsapp', 'number']) || 'N/A';
          const email = findVal(team, ['email', 'mail']) || 'N/A';

          return {
            ...team,
            paymentStatus: payment ? (findVal(payment, ['status', 'paymentstatus', 'state']) || 'Paid') : 'Pending',
            transactionId: payment ? (findVal(payment, ['transaction', 'txid', 'reference', 'utr']) || 'N/A') : 'N/A',
            amount: payment ? (findVal(payment, ['amount', 'fees', 'paid']) || 0) : 0,
            teamName: String(teamIdKey),
            members: memberString || 'Not specified',
            leader: String(leader),
            phone: String(phone),
            email: String(email).toLowerCase(),
            project: findVal(team, ['project', 'title', 'idea', 'problem']) || 'N/A',
            domain: findVal(team, ['domain', 'track', 'category', 'theme']) || 'N/A',
            status: findVal(team, ['status', 'qualified', 'shortlist', 'result']) || 'Applied'
          };
        });

        setMergedData(merged);
        setIsProcessing(false);
      }, 800);
    } catch (error) {
      console.error("Merging Error:", error);
      alert("Error processing Excel data. Please check if the columns 'Team Name' exist in both files.");
      setIsProcessing(false);
    }
  };

  const fetchFromSheets = async () => {
    if (!sheetIdTeam || !sheetIdPayment) {
      alert("Please enter both Google Sheet IDs first!");
      return;
    }

    setIsSyncing(true);
    localStorage.setItem('nexora_sheet_team', sheetIdTeam);
    localStorage.setItem('nexora_sheet_payment', sheetIdPayment);

    try {
      const fetchCSV = async (id) => {
        const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Could not fetch sheet. Ensure it is shared as 'Anyone with the link can view'.");
        const text = await res.text();
        const workbook = XLSX.read(text, { type: 'string' });
        return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      };

      const tData = await fetchCSV(sheetIdTeam);
      const pData = await fetchCSV(sheetIdPayment);

      setTeamData(tData);
      setPaymentData(pData);
      
      // Auto-trigger merge after fetch
      setTimeout(() => {
         processAndMergeWithData(tData, pData);
      }, 500);

    } catch (error) {
      console.error("Cloud Sync Error:", error);
      alert(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const processAndMergeWithData = (tData, pData) => {
    setIsProcessing(true);
    const findVal = (obj, patterns) => {
      const key = Object.keys(obj).find(k => {
        const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return patterns.some(p => normalizedK.includes(p));
      });
      return key ? obj[key] : null;
    };

    const findAllVals = (obj, pattern) => {
      return Object.keys(obj)
        .filter(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(pattern))
        .map(k => obj[k])
        .filter(v => v && String(v).trim().toLowerCase() !== 'n/a');
    };

    const merged = tData.map(team => {
      const teamIdKey = findVal(team, ['teamname', 'name', 'group', 'organization']) || team['Team Name'] || 'Unnamed Team';
      const payment = pData.find(p => {
        const pIdKey = findVal(p, ['teamname', 'name', 'group', 'team']) || p['Team Name'];
        return String(pIdKey || '').toLowerCase().trim() === String(teamIdKey || '').toLowerCase().trim();
      });

      let membersList = findAllVals(team, 'participant');
      if (membersList.length === 0) membersList = findAllVals(team, 'member');
      if (membersList.length === 0) membersList = [findVal(team, ['members', 'names', 'allnames']) || 'Not specified'];
      const memberString = Array.isArray(membersList) ? membersList.filter(m => m !== 'Not specified').join(', ') : String(membersList);

      return {
        ...team,
        paymentStatus: payment ? (findVal(payment, ['status', 'paymentstatus', 'state']) || 'Paid') : 'Pending',
        transactionId: payment ? (findVal(payment, ['transaction', 'txid', 'reference', 'utr']) || 'N/A') : 'N/A',
        amount: payment ? (findVal(payment, ['amount', 'fees', 'paid']) || 0) : 0,
        teamName: String(teamIdKey),
        members: memberString || 'Not specified',
        leader: String(findVal(team, ['leader', 'captain', 'poc', 'representative']) || membersList[0] || 'N/A'),
        phone: String(findVal(team, ['phone', 'contact', 'mobile', 'whatsapp', 'number']) || 'N/A'),
        email: String(findVal(team, ['email', 'mail']) || 'N/A').toLowerCase(),
        project: findVal(team, ['project', 'title', 'idea', 'problem']) || 'N/A',
        domain: findVal(team, ['domain', 'track', 'category', 'theme']) || 'N/A',
        status: findVal(team, ['status', 'qualified', 'shortlist', 'result']) || 'Applied'
      };
    });

    setMergedData(merged);
    setIsProcessing(false);
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    if (val.length > 2 && !recentSearches.includes(val)) {
      const newSearches = [val, ...recentSearches.slice(0, 4)];
      setRecentSearches(newSearches);
      localStorage.setItem('nexora_recent_searches', JSON.stringify(newSearches));
    }
  };

  const toggleAttendance = (teamName, memberName) => {
    const newAttendance = { ...attendance };
    if (!newAttendance[teamName]) newAttendance[teamName] = [];
    
    if (newAttendance[teamName].includes(memberName)) {
      newAttendance[teamName] = newAttendance[teamName].filter(m => m !== memberName);
    } else {
      newAttendance[teamName].push(memberName);
    }
    
    setAttendance(newAttendance);
    localStorage.setItem('nexora_attendance', JSON.stringify(newAttendance));
  };

  const toggleFullTeamAttendance = (teamName, memberString) => {
    const members = memberString.split(',').map(m => m.trim());
    const newAttendance = { ...attendance };
    
    // If some or all are missing, mark all present. If all are present, mark all absent.
    const allPresent = members.every(m => newAttendance[teamName]?.includes(m));
    
    if (allPresent) {
      newAttendance[teamName] = [];
    } else {
      newAttendance[teamName] = members;
    }
    
    setAttendance(newAttendance);
    localStorage.setItem('nexora_attendance', JSON.stringify(newAttendance));
  };

  const stats = useMemo(() => {
    if (mergedData.length === 0) return null;
    return {
      total: mergedData.length,
      qualified: mergedData.filter(t => t.status?.toLowerCase().includes('qualified')).length,
      shortlisted: mergedData.filter(t => t.status?.toLowerCase().includes('shortlisted')).length,
      paid: mergedData.filter(t => t.paymentStatus?.toLowerCase() === 'paid' || t.paymentStatus?.toLowerCase() === 'success').length,
    };
  }, [mergedData]);

  const filteredData = useMemo(() => {
    let data = mergedData.filter(team => {
      const name = String(team.teamName || '').toLowerCase();
      const members = String(team.members || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || members.includes(search);
    });

    if (activeTab === 'qualified') data = data.filter(t => String(t.status || '').toLowerCase().includes('qualified'));
    if (activeTab === 'shortlisted') data = data.filter(t => String(t.status || '').toLowerCase().includes('shortlisted'));
    if (activeTab === 'paid') data = data.filter(t => String(t.paymentStatus || '').toLowerCase() === 'paid' || String(t.paymentStatus || '').toLowerCase() === 'success');
    if (activeTab === 'pending') data = data.filter(t => String(t.paymentStatus || '').toLowerCase() === 'pending');
    if (activeTab === 'present') data = data.filter(t => attendance[t.teamName] && attendance[t.teamName].length > 0);
    if (activeTab === 'absent') data = data.filter(t => !attendance[t.teamName] || attendance[t.teamName].length === 0);

    return data;
  }, [mergedData, searchTerm, activeTab, attendance]);

  const exportMerged = () => {
    const ws = XLSX.utils.json_to_sheet(mergedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Merged_Data");
    XLSX.writeFile(wb, "Nexora_Merged_Report.xlsx");
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="logo"
        >
          NEXORA <span className="vibe">DASHBOARD</span>
        </motion.h1>
        <p className="subtitle">Enterprise Team Management & Payment Reconciliation</p>
      </header>

      {/* Upload Section */}
      {mergedData.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="upload-grid glass card"
        >
          <div className="upload-header">
            <Database className="icon" size={32} />
            <h2>Data Import Center</h2>
            <p>Sync from Google Sheets or upload local Excel files.</p>
          </div>

          <div className="cloud-sync-section">
            <div className="sync-row">
              <div className="input-group">
                <label>Team Sheet ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. 1aBC...xyZ" 
                  value={sheetIdTeam} 
                  onChange={(e) => setSheetIdTeam(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Payment Sheet ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. 1aBC...xyZ" 
                  value={sheetIdPayment} 
                  onChange={(e) => setSheetIdPayment(e.target.value)}
                />
              </div>
              <button 
                className={`btn-sync ${isSyncing ? 'loading' : ''}`} 
                onClick={fetchFromSheets}
                disabled={isSyncing}
              >
                <Cloud size={18} /> {isSyncing ? 'Syncing...' : 'Sync Cloud'}
              </button>
            </div>
            <p className="hint">Note: Sheets must be shared as "Anyone with link can view"</p>
          </div>

          <div className="divider"><span>OR</span></div>

          <div className="upload-controls">
            <div className="upload-box">
              <label>Team Details Excel</label>
              <div className={`file-drop ${teamData.length > 0 ? 'success' : ''}`}>
                <input type="file" accept=".xlsx, .xls, .csv" onChange={(e) => handleFileUpload(e, 'team')} />
                <div className="inner">
                  {teamData.length > 0 ? <CheckCircle className="status-icon" /> : <Upload />}
                  <span>{teamData.length > 0 ? `${teamData.length} Teams Loaded` : 'Drop Team Excel Here'}</span>
                </div>
              </div>
            </div>

            <div className="upload-box">
              <label>Payment Details Excel</label>
              <div className={`file-drop ${paymentData.length > 0 ? 'success' : ''}`}>
                <input type="file" accept=".xlsx, .xls, .csv" onChange={(e) => handleFileUpload(e, 'payment')} />
                <div className="inner">
                  {paymentData.length > 0 ? <CheckCircle className="status-icon" /> : <CreditCard />}
                  <span>{paymentData.length > 0 ? `${paymentData.length} Records Loaded` : 'Drop Payment Excel Here'}</span>
                </div>
              </div>
            </div>
          </div>

          <button 
            className="btn-primary merge-btn" 
            onClick={processAndMerge}
            disabled={isProcessing || !teamData.length || !paymentData.length}
          >
            {isProcessing ? 'Synchronizing Systems...' : 'Process & Merge Data'}
            {!isProcessing && <ArrowRight size={18} />}
          </button>
        </motion.div>
      ) : (
        <div className="dashboard-content">
          {/* Stats Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="stats-grid"
          >
            <div className="stat-card glass">
              <div className="stat-info">
                <Users className="stat-icon" />
                <div>
                  <span className="label">Total Teams</span>
                  <span className="value">{stats.total}</span>
                </div>
              </div>
              <div className="stat-trend"><TrendingUp size={12} /> Live</div>
            </div>
            <div className="stat-card glass qualified">
              <div className="stat-info">
                <CheckCircle className="stat-icon" />
                <div>
                  <span className="label">Qualified</span>
                  <span className="value">{stats.qualified}</span>
                </div>
              </div>
            </div>
            <div className="stat-card glass shortlisted">
              <div className="stat-info">
                <Clock className="stat-icon" />
                <div>
                  <span className="label">Shortlisted</span>
                  <span className="value">{stats.shortlisted}</span>
                </div>
              </div>
            </div>
            <div className="stat-card glass paid">
              <div className="stat-info">
                <CreditCard className="stat-icon" />
                <div>
                  <span className="label">Total Paid</span>
                  <span className="value">{stats.paid}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Controls & Search */}
          <div className="actions-bar">
            <div className="search-box glass">
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                placeholder="Search by Team Name or Member..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-tabs glass">
              <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>All</button>
              <button className={activeTab === 'qualified' ? 'active' : ''} onClick={() => setActiveTab('qualified')}>Qualified</button>
              <button className={activeTab === 'shortlisted' ? 'active' : ''} onClick={() => setActiveTab('shortlisted')}>Shortlisted</button>
              <button className={activeTab === 'paid' ? 'active' : ''} onClick={() => setActiveTab('paid')}>Paid</button>
              <button className={activeTab === 'pending' ? 'active' : ''} onClick={() => setActiveTab('pending')}>Pending</button>
              <button className={activeTab === 'present' ? 'active' : ''} onClick={() => setActiveTab('present')}>
                <CheckCircle size={14} style={{ marginRight: '4px' }} /> Present
              </button>
              <button className={activeTab === 'absent' ? 'active' : ''} onClick={() => setActiveTab('absent')}>
                <AlertCircle size={14} style={{ marginRight: '4px' }} /> Absent
              </button>
            </div>
            <button className="btn-secondary export-btn" onClick={exportMerged}>
              <Download size={18} /> Export Merged
            </button>
          </div>

          {/* Results Grid */}
          <div className="results-grid">
            <AnimatePresence mode='popLayout'>
              {filteredData.map((team, idx) => (
                <motion.div 
                  key={team.teamName + idx}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="team-data-card glass card"
                  onClick={() => setSelectedTeam(team)}
                >
                  <div className="card-header">
                    <div className="team-meta">
                      <h3>{team.teamName}</h3>
                      <div className="info-row compact">
                        <Users size={14} className="muted" />
                        <span className="member-count">{team.members ? team.members.split(',').length : 0} Members</span>
                      </div>
                    </div>
                    <span className={`badge ${String(team.status || 'applied').toLowerCase()}`}>{team.status || 'Applied'}</span>
                  </div>
                  <div className="card-body">
                    <div className="project-preview">
                       <span className="domain-tag">{team.domain}</span>
                       <p className="project-name">{team.project}</p>
                    </div>
                    <div className="payment-preview">
                       <div className={`status-dot ${String(team.paymentStatus || 'pending').toLowerCase()}`}></div>
                       <span className="payment-label">{team.paymentStatus}</span>
                       {attendance[team.teamName]?.length > 0 && (
                         <span className="attendance-badge">
                           {attendance[team.teamName].length}/{team.members.split(',').length} Present
                         </span>
                       )}
                    </div>
                  </div>
                  <div className="card-footer">
                     <button 
                       className={`btn-attendance ${attendance[team.teamName]?.length === team.members.split(',').length ? 'all' : ''}`}
                       onClick={(e) => { e.stopPropagation(); toggleFullTeamAttendance(team.teamName, team.members); }}
                     >
                       {attendance[team.teamName]?.length > 0 ? <CheckCircle size={14} /> : <Users size={14} />}
                       {attendance[team.teamName]?.length === team.members.split(',').length ? 'All Present' : 'Mark Present'}
                     </button>
                     <span className="view-details" onClick={() => setSelectedTeam(team)}>Insights <ArrowRight size={14} /></span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredData.length === 0 && (
              <div className="no-results glass card">
                <Search size={48} className="muted" />
                <p>No teams found matching your search.</p>
              </div>
            )}
          </div>
          
          <button className="btn-ghost reset-btn" onClick={() => {setMergedData([]); setTeamData([]); setPaymentData([]);}}>
            Upload New Files
          </button>
        </div>
      )}

      {/* Team Detail Modal */}
      <AnimatePresence>
        {selectedTeam && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setSelectedTeam(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="modal-content glass"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="header-info">
                  <h2>{selectedTeam.teamName}</h2>
                  <span className={`badge ${String(selectedTeam.status || 'applied').toLowerCase()}`}>{selectedTeam.status || 'Applied'}</span>
                </div>
                <button className="close-btn" onClick={() => setSelectedTeam(null)}><X /></button>
              </div>

              <div className="modal-body">
                <section className="modal-section">
                  <h4><Users size={18} /> Team Composition</h4>
                  <div className="members-list">
                    {selectedTeam.members && selectedTeam.members !== 'Not specified' ? selectedTeam.members.split(',').map((m, i) => {
                      const isPresent = attendance[selectedTeam.teamName]?.includes(m.trim());
                      return (
                        <div key={i} className={`member-item glass ${isPresent ? 'is-present' : ''}`} onClick={() => toggleAttendance(selectedTeam.teamName, m.trim())}>
                          <div className="avatar">{m.trim().charAt(0)}</div>
                          <div className="member-info">
                            <span>{m.trim()}</span>
                            {m.trim() === selectedTeam.leader && <span className="leader-label">Leader</span>}
                          </div>
                          <div className={`attendance-toggle ${isPresent ? 'active' : ''}`}>
                            {isPresent ? <CheckCircle size={16} /> : <div className="circle" />}
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="muted">No member details found in the team record.</p>
                    )}
                  </div>
                </section>

                <div className="modal-grid">
                  <section className="modal-section glass-box">
                    <h4><ShieldCheck size={18} /> Project & Domain</h4>
                    <div className="detail-row">
                      <span className="label">Title:</span>
                      <span className="val highlight">{selectedTeam.project}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Domain:</span>
                      <span className="val">{selectedTeam.domain}</span>
                    </div>
                  </section>

                  <section className="modal-section glass-box">
                    <h4><Users size={18} /> Contact Information</h4>
                    <div className="detail-row">
                      <span className="label">Leader:</span>
                      <span className="val">{selectedTeam.leader}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Phone:</span>
                      <span className="val">{selectedTeam.phone}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Email:</span>
                      <span className="val low-case">{selectedTeam.email}</span>
                    </div>
                  </section>
                </div>

                  <section className="modal-section glass-box full-width">
                    <h4><CreditCard size={18} /> Financial Status</h4>
                    <div className="detail-row">
                      <span className="label">Payment Status:</span>
                      <span className={`val payment-status ${String(selectedTeam.paymentStatus || 'pending').toLowerCase()}`}>
                        {selectedTeam.paymentStatus || 'Pending'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Transaction ID:</span>
                      <span className="val mono">{selectedTeam.transactionId}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Amount:</span>
                      <span className="val">₹{selectedTeam.amount}</span>
                    </div>
                  </section>
                </div>

                <div className="modal-footer">
                  <button className="btn-primary" onClick={() => window.print()}>Print Report</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      <style>{`
        .dashboard-container {
          max-width: 1300px;
          margin: 0 auto;
          padding: 2rem;
          color: white;
        }
        .dashboard-header {
          text-align: center;
          margin-bottom: 3rem;
        }
        .subtitle {
          color: var(--text-muted);
          margin-top: 0.5rem;
          font-size: 1.1rem;
        }
        .upload-grid {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          padding: 4rem;
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }
        .upload-controls {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          width: 100%;
        }
        .upload-box {
          text-align: left;
        }
        .file-drop {
          margin-top: 1rem;
          border: 2px dashed var(--glass-border);
          border-radius: 12px;
          padding: 2rem;
          position: relative;
          transition: all 0.3s ease;
          background: rgba(255,255,255,0.02);
        }
        .file-drop:hover {
          border-color: var(--primary);
          background: rgba(139, 92, 246, 0.05);
        }
        .file-drop.success {
          border-color: var(--secondary);
          background: rgba(6, 182, 212, 0.05);
        }
        .file-drop input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }
        .file-drop .inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: var(--text-muted);
        }
        .status-icon {
          color: var(--secondary);
        }
        .merge-btn {
          margin-top: 2rem;
          width: 100%;
          max-width: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.8rem;
          font-size: 1.1rem;
          padding: 1rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-radius: 16px;
        }
        .stat-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .stat-icon {
          color: var(--primary);
          background: rgba(139, 92, 246, 0.1);
          padding: 8px;
          border-radius: 10px;
          width: 40px;
          height: 40px;
        }
        .stat-card.qualified .stat-icon { color: #10b981; background: rgba(16, 185, 129, 0.1); }
        .stat-card.shortlisted .stat-icon { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
        .stat-card.paid .stat-icon { color: #06b6d4; background: rgba(6, 182, 212, 0.1); }
        .label {
          display: block;
          color: var(--text-muted);
          font-size: 0.85rem;
          text-transform: uppercase;
        }
        .value {
          display: block;
          font-size: 1.8rem;
          font-weight: 700;
        }
        .stat-trend {
          font-size: 0.75rem;
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          padding: 4px 8px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .actions-bar {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 2rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .search-box {
          flex: 1;
          min-width: 300px;
          display: flex;
          align-items: center;
          padding: 0 1rem;
        }
        .search-box input {
          background: transparent;
          border: none;
          margin: 0;
        }
        .filter-tabs {
          display: flex;
          padding: 4px;
          gap: 4px;
        }
        .filter-tabs button {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        .filter-tabs button.active {
          background: var(--primary);
          color: white;
        }
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }
        .team-data-card {
          padding: 1.5rem;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }
        .card-header h3 {
          font-size: 1.2rem;
          color: white;
        }
        .badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .badge.qualified { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge.shortlisted { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .info-row {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          font-size: 0.95rem;
          margin-bottom: 1rem;
        }
        .muted { color: var(--text-muted); }
        .info-divider {
          height: 1px;
          background: var(--glass-border);
          margin: 1.5rem 0;
        }
        .payment-status {
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.85rem;
        }
        .payment-status.paid, .payment-status.success { color: var(--secondary); }
        .payment-status.pending { color: #f43f5e; }
        .transaction-tag {
          font-family: monospace;
          font-size: 0.75rem;
          background: rgba(255,255,255,0.05);
          padding: 4px 8px;
          border-radius: 4px;
          color: var(--text-muted);
          display: inline-block;
          margin-top: 0.5rem;
        }
        .card-footer {
          margin-top: 1.5rem;
          display: flex;
          justify-content: flex-end;
        }
        .btn-details {
          background: transparent;
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .btn-details:hover {
          border-color: var(--primary);
          color: var(--primary);
        }
        .no-results {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4rem;
          gap: 1rem;
        }
        .reset-btn {
          margin: 2rem auto;
          display: block;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .modal-content {
          width: 100%;
          max-width: 800px;
          background: rgba(15, 12, 41, 0.95);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 2.5rem;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .header-info h2 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        .close-btn {
          background: rgba(255,255,255,0.05);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .modal-section {
          margin-bottom: 2rem;
        }
        .modal-section h4 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--primary);
          margin-bottom: 1rem;
          text-transform: uppercase;
          font-size: 0.9rem;
          letter-spacing: 0.05em;
        }
        .members-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }
        .member-item {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.8rem;
          border-radius: 12px;
        }
        .avatar {
          width: 32px;
          height: 32px;
          background: var(--primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.8rem;
          flex-shrink: 0;
        }
        .member-info { display: flex; flex-direction: column; flex: 1; }
        .leader-label { font-size: 0.65rem; color: var(--secondary); text-transform: uppercase; font-weight: 800; }
        .attendance-toggle { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; }
        .attendance-toggle.active { background: var(--secondary); border-color: var(--secondary); color: white; }
        .member-item { cursor: pointer; transition: all 0.2s; }
        .member-item:hover { background: rgba(255,255,255,0.08); }
        .member-item.is-present { border-color: var(--secondary); background: rgba(6, 182, 212, 0.1); }
        
        .modal-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        .full-width { grid-column: 1 / -1; }
        .low-case { text-transform: lowercase; }
        .attendance-badge { margin-left: auto; font-size: 0.75rem; background: rgba(6, 182, 212, 0.1); color: var(--secondary); padding: 2px 8px; border-radius: 10px; }
        .project-preview { margin-bottom: 1rem; }
        .domain-tag { font-size: 0.7rem; color: var(--primary); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; }
        .project-name { font-weight: 600; font-size: 0.95rem; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .glass-box {
          background: rgba(255,255,255,0.03);
          padding: 1.5rem;
          border-radius: 16px;
          border: 1px solid var(--glass-border);
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.8rem;
          font-size: 0.95rem;
        }
        .detail-row .label { color: var(--text-muted); }
        .detail-row .val.highlight { color: var(--primary); font-weight: 700; }
        .detail-row .val.mono { font-family: monospace; opacity: 0.8; }
        .val.success { color: #10b981; }
        .modal-footer {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--glass-border);
          display: flex;
          justify-content: flex-end;
        }

        /* Improved Card Styles */
        .team-data-card {
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .team-data-card:hover {
          border-color: var(--primary);
          transform: translateY(-5px) scale(1.02);
          box-shadow: 0 15px 30px rgba(139, 92, 246, 0.2);
        }
        .team-meta h3 {
          margin-bottom: 0.2rem;
        }
        .compact { margin-bottom: 0; font-size: 0.8rem; }
        .payment-preview {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f43f5e;
        }
        .status-dot.paid, .status-dot.success { background: #06b6d4; }
        .view-details {
          font-size: 0.8rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .btn-attendance {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-attendance:hover {
          background: rgba(6, 182, 212, 0.1);
          color: var(--secondary);
          border-color: var(--secondary);
        }
        .btn-attendance.all {
          background: var(--secondary);
          color: white;
          border-color: var(--secondary);
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .team-data-card:hover .view-details {
          color: var(--primary);
        }
        .hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.5rem;
        }
        .divider {
          display: flex;
          align-items: center;
          margin: 1.5rem 0;
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 800;
        }
        .divider::before, .divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--glass-border);
          margin: 0 1rem;
        }
        .cloud-sync-section {
          background: rgba(255,255,255,0.02);
          padding: 1.5rem;
          border-radius: 12px;
          border: 1px dashed var(--glass-border);
          margin-bottom: 1rem;
        }
        .sync-row {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 1rem;
          align-items: flex-end;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .input-group label {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .input-group input {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 10px 14px;
          color: white;
          font-size: 0.9rem;
          width: 100%;
        }
        .btn-sync {
          background: var(--primary);
          color: white;
          border: none;
          padding: 11px 20px;
          border-radius: 8px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-sync:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
        }
        .btn-sync:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .loading {
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default NexoraDashboard;
