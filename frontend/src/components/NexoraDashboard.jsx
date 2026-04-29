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
  AlertCircle,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NexoraDashboard = () => {
  const [teamData, setTeamData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [mergedData, setMergedData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('nexora_recent_searches');
    return saved ? JSON.parse(saved) : [];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Cloud Sync States
  const [sheetIdTeam, setSheetIdTeam] = useState(import.meta.env.VITE_TEAM_SHEET_ID || localStorage.getItem('nexora_sheet_team') || '');
  const [sheetIdPayment, setSheetIdPayment] = useState(import.meta.env.VITE_PAYMENT_SHEET_ID || localStorage.getItem('nexora_sheet_payment') || '');
  const [sheetIdMaster, setSheetIdMaster] = useState(import.meta.env.VITE_MASTER_SHEET_ID || localStorage.getItem('nexora_sheet_master') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [masterData, setMasterData] = useState([]);

  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const cleanPhone = (p) => String(p || '').replace(/[^0-9]/g, '').slice(-10);

  const apiUrl = useMemo(() => {
    let url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    if (url.endsWith('/')) url = url.slice(0, -1);
    return url;
  }, []);

  // Fetch initial attendance from backend
  React.useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/attendance`);
        if (res.ok) {
          const data = await res.json();
          setAttendance(data);
        }
      } catch (e) {
        console.error("Failed to fetch shared attendance", e);
      }
    };
    fetchAttendance();
  }, [apiUrl]);

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
      } else if (type === 'payment') {
        setPaymentData(data);
      } else {
        setMasterData(data);
      }
    };
    reader.readAsBinaryString(file);
  };

  const deleteTeam = (teamName) => {
    if (window.confirm(`Remove "${teamName}" from the dashboard?`)) {
      setMergedData(prev => prev.filter(t => t.teamName !== teamName));
    }
  };

  const processAndMerge = () => {
    if (teamData.length === 0 || paymentData.length === 0) {
      alert("Please upload both Team and Payment files first!");
      return;
    }
    setIsProcessing(true);
    // Use a small timeout to allow UI to show loading state
    setTimeout(() => {
      processAndMergeWithData(teamData, paymentData, masterData);
    }, 100);
  };

  const fetchFromSheets = async () => {
    if (!sheetIdTeam || !sheetIdPayment) {
      alert("Please enter both Team and Payment Sheet IDs!");
      return;
    }

    setIsSyncing(true);
    localStorage.setItem('nexora_sheet_team', sheetIdTeam);
    localStorage.setItem('nexora_sheet_payment', sheetIdPayment);
    if (sheetIdMaster) localStorage.setItem('nexora_sheet_master', sheetIdMaster);

    try {
      let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      // Remove trailing slash if present
      if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
      
      const response = await fetch(`${apiUrl}/api/sync-sheets?teamId=${sheetIdTeam}&paymentId=${sheetIdPayment}&masterId=${sheetIdMaster}`);
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to sync sheets through backend");
      }

      const { teamData: tData, paymentData: pData, masterData: mData } = await response.json();

      setTeamData(tData);
      setPaymentData(pData);
      setMasterData(mData);
      
      // Auto-trigger merge after fetch
      setTimeout(() => {
         processAndMergeWithData(tData, pData, mData);
      }, 500);

    } catch (error) {
      console.error("Cloud Sync Error:", error);
      alert("Backend Sync Failed: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const processAndMergeWithData = (tData, pData, mData = []) => {
    try {
      const findVal = (obj, patterns) => {
        const keys = Object.keys(obj);
        const exactMatch = keys.find(k => {
          const nk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return patterns.includes(nk);
        });
        if (exactMatch) return obj[exactMatch];
        const fuzzyMatch = keys.find(k => {
          const nk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return patterns.some(p => nk.includes(p));
        });
        return fuzzyMatch ? obj[fuzzyMatch] : null;
      };
      const findAllVals = (obj, pattern) => {
        return Object.keys(obj)
          .filter(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(pattern))
          .map(k => obj[k])
          .filter(v => v && String(v).trim().toLowerCase() !== 'n/a');
      };
      const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const cleanPhone = (p) => String(p || '').replace(/[^0-9]/g, '').slice(-10);

      // PRIMARY SOURCE: Team Sheet (tData) — iterate over its rows
      const merged = tData.map(team => {
        try {
          const teamIdKey = findVal(team, ['teamname', 'groupname', 'organization']) || team['Team Name'] || 'Unnamed Team';
          const targetKey = clean(teamIdKey);
          const targetEmail = String(findVal(team, ['email', 'mail']) || '').toLowerCase().trim();
          const targetPhone = cleanPhone(findVal(team, ['leaderphone', 'phone', 'contact', 'mobile', 'whatsapp']));
          const targetLeader = clean(findVal(team, ['leader', 'captain', 'poc', 'representative']));

          // Get basic member info from Team Sheet
          let membersList = findAllVals(team, 'participant');
          if (membersList.length === 0) membersList = findAllVals(team, 'member');
          if (membersList.length === 0) membersList = [findVal(team, ['members', 'names', 'allnames']) || 'Not specified'];
          const memberString = Array.isArray(membersList) ? membersList.filter(m => m !== 'Not specified').join(', ') : String(membersList);

          let detailedMembers = [];
          let college = 'N/A';
          let city = 'N/A';
          let masterPhone = null;
          let masterEmail = null;

          if (mData && mData.length > 0) {
            let teamRows = mData.filter(r => clean(findVal(r, ['teamname', 'groupname'])) === targetKey);

            if (teamRows.length > 0) {
              const teamIds = [...new Set(teamRows.map(r => String(findVal(r, ['teamid', 'id']) || '')).filter(Boolean))];
              if (teamIds.length > 1) {
                const correctId = teamIds.find(tid => {
                  const idRows = teamRows.filter(r => String(findVal(r, ['teamid', 'id']) || '') === tid);
                  return idRows.some(r => {
                    const rEmail = String(findVal(r, ['candidatesemail', 'email', 'mail']) || '').toLowerCase().trim();
                    const rPhone = cleanPhone(findVal(r, ['candidatesmobile', 'phone', 'contact', 'mobile']));
                    return (targetEmail && rEmail === targetEmail) || (targetPhone && rPhone === targetPhone);
                  });
                });
                if (correctId) {
                  teamRows = teamRows.filter(r => String(findVal(r, ['teamid', 'id']) || '') === correctId);
                }
              }

              const leaderRow = teamRows.find(r => String(findVal(r, ['usertype', 'role', 'type']) || '').toLowerCase().includes('leader')) || teamRows[0];
              if (leaderRow) {
                masterPhone = String(findVal(leaderRow, ['candidatesmobile', 'phone', 'contact', 'mobile']) || '');
                masterEmail = String(findVal(leaderRow, ['candidatesemail', 'email', 'mail']) || '').toLowerCase().trim();
              }

              detailedMembers = teamRows.map(r => {
                const candidateName = String(
                  findVal(r, ['candidatesname', 'participantname', 'membername', 'candidatename']) ||
                  findVal(r, ['name']) || ''
                );
                const userType = String(findVal(r, ['usertype', 'role', 'type']) || '').toLowerCase();
                return {
                  name: candidateName,
                  email: String(findVal(r, ['candidatesemail', 'email', 'mail']) || '').toLowerCase().trim(),
                  phone: cleanPhone(findVal(r, ['candidatesmobile', 'phone', 'contact', 'mobile'])),
                  college: String(findVal(r, ['candidatesorganisation', 'organisation', 'college', 'university', 'institute', 'organization']) || 'N/A'),
                  city: String(findVal(r, ['candidateslocation', 'location', 'city', 'address', 'place']) || 'N/A'),
                  isLeader: userType.includes('leader') || userType.includes('captain'),
                };
              }).filter(m => m.name && clean(m.name) !== targetKey);

              college = detailedMembers[0]?.college || 'N/A';
              city = detailedMembers[0]?.city || 'N/A';
            }
          }

          // Fallback: if no master data, use Team Sheet member names
          if (detailedMembers.length === 0) {
            detailedMembers = memberString.split(',').map(m => ({
              name: m.trim(),
              college: 'N/A',
              city: 'N/A',
              isLeader: false,
            })).filter(m => m.name && m.name !== 'Not specified');
          }

          // Find matching payment from Payment Sheet (now using master fallbacks if needed)
          const finalEmail = targetEmail || masterEmail;
          const finalPhone = targetPhone || (masterPhone ? cleanPhone(masterPhone) : '');

          const payment = pData.find(p => {
            const pName = findVal(p, ['teamname', 'groupname']) || p['Team Name'];
            const cleanedPName = clean(pName);
            if (cleanedPName && targetKey && (cleanedPName === targetKey || (cleanedPName.length > 4 && targetKey.includes(cleanedPName)) || (targetKey.length > 4 && cleanedPName.includes(targetKey)))) return true;

            const pEmail = String(findVal(p, ['email', 'mail']) || '').toLowerCase().trim();
            const pPhone = cleanPhone(findVal(p, ['phone', 'contact', 'mobile', 'whatsapp']));
            const pLeader = clean(findVal(p, ['name', 'participant', 'leader', 'payer', 'firstname', 'lastname', 'fullname']));

            // Check primary targets
            if (finalEmail && pEmail === finalEmail) return true;
            if (finalPhone && pPhone === finalPhone) return true;
            if (targetLeader && pLeader === targetLeader) return true;

            // Exhaustive check across all detailed members' emails, phones, and names
            if (detailedMembers.length > 0) {
              for (const member of detailedMembers) {
                if (member.email && pEmail && member.email === pEmail) return true;
                if (member.phone && pPhone && member.phone === pPhone) return true;
                if (member.name && pLeader && clean(member.name) === pLeader) return true;
              }
            }

            // SUPER EXHAUSTIVE: Check ALL cells in the payment row, regardless of column headers
            const pValues = Object.values(p).map(v => String(v).toLowerCase().trim());
            const pValuesCleaned = pValues.map(v => clean(v));
            const pValuesPhones = pValues.map(v => cleanPhone(v));

            if (targetLeader && targetLeader.length > 3) {
              if (pValuesCleaned.some(v => v === targetLeader || (v.length > 5 && targetLeader.includes(v)) || (targetLeader.length > 5 && v.includes(targetLeader)))) return true;
            }
            if (finalEmail && pValues.some(v => v === finalEmail || v.includes(finalEmail))) return true;
            if (finalPhone && finalPhone.length >= 10 && pValuesPhones.some(v => v === finalPhone)) return true;

            // Also check detailed members against ALL cells
            if (detailedMembers.length > 0) {
              for (const member of detailedMembers) {
                const cName = clean(member.name);
                if (cName && cName.length > 3 && pValuesCleaned.some(v => v === cName || (v.length > 5 && cName.includes(v)) || (cName.length > 5 && v.includes(cName)))) return true;
                if (member.email && pValues.some(v => v === member.email || v.includes(member.email))) return true;
                if (member.phone && member.phone.length >= 10 && pValuesPhones.some(v => v === member.phone)) return true;
              }
            }

            return false;
          });

          const finalMembers = detailedMembers.map(m => m.name).join(', ');
          const leader = detailedMembers.find(m => m.isLeader) || detailedMembers[0] || {};

          return {
            teamName: String(teamIdKey),
            members: finalMembers || memberString || 'Not specified',
            detailedMembers: detailedMembers,
            leader: leader.name || String(findVal(team, ['leader', 'captain', 'poc', 'representative']) || membersList[0] || 'N/A'),
            phone: targetPhone || masterPhone || String(findVal(team, ['leaderphone', 'phone', 'contact', 'mobile', 'whatsapp']) || 'N/A'),
            email: targetEmail || masterEmail || String(findVal(team, ['email', 'mail']) || 'N/A').toLowerCase(),
            project: findVal(team, ['project', 'title', 'idea', 'problem']) || 'N/A',
            domain: findVal(team, ['domain', 'track', 'category', 'theme']) || 'N/A',
            status: findVal(team, ['status', 'qualified', 'shortlist']) || 'Applied',
            college: String(college),
            city: String(city),
            paymentStatus: payment ? (findVal(payment, ['status', 'paymentstatus', 'state']) || 'Paid') : 'Pending',
            transactionId: payment ? (findVal(payment, ['transactionid', 'utr', 'txid', 'referenceid', 'transid', 'upiref', 'refno', 'receipt', 'orderid', 'paymentid']) || 'N/A') : 'N/A',
            amount: payment ? String(findVal(payment, ['amountpaid', 'fees', 'paidamt', 'amount', 'paid']) || 0).replace(/[^0-9]/g, '') : 0,
            paymentMode: payment ? (findVal(payment, ['mode', 'method', 'type']) || 'N/A') : 'N/A',
          };
        } catch (e) {
          console.error("Row Merge Error:", e);
          return team;
        }
      });

      console.log("Merge Success. Teams:", merged.length);
      setMergedData(merged);
    } catch (err) {
      console.error("Merge Data Error:", err);
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    if (val.length > 2 && !recentSearches.includes(val)) {
      const newSearches = [val, ...recentSearches.slice(0, 4)];
      setRecentSearches(newSearches);
      localStorage.setItem('nexora_recent_searches', JSON.stringify(newSearches));
    }
  };

      newAttendance[teamName] = [];
    } else {
      newAttendance[teamName] = members;
    }

    setAttendance(newAttendance);
    localStorage.setItem('nexora_attendance', JSON.stringify(newAttendance));
  };

  const stats = useMemo(() => {
    if (mergedData.length === 0) return null;
    const presentCount = mergedData.filter(t => attendance[t.teamName] && attendance[t.teamName].length > 0).length;
    return {
      total: mergedData.length,
      present: presentCount,
      absent: mergedData.length - presentCount,
      paid: mergedData.filter(t => t.paymentStatus?.toLowerCase() === 'paid' || t.paymentStatus?.toLowerCase() === 'success').length,
    };
  }, [mergedData, attendance]);

  const filteredData = useMemo(() => {
    let data = mergedData.filter(team => {
      const name = String(team.teamName || '').toLowerCase();
      const members = String(team.members || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || members.includes(search);
    });

    if (activeTab === 'paid') data = data.filter(t => String(t.paymentStatus || '').toLowerCase() === 'paid' || String(t.paymentStatus || '').toLowerCase() === 'success');
    if (activeTab === 'pending') data = data.filter(t => String(t.paymentStatus || '').toLowerCase() === 'pending');
    if (activeTab === 'present') data = data.filter(t => attendance[t.teamName] && attendance[t.teamName].length > 0);
    if (activeTab === 'absent') data = data.filter(t => !attendance[t.teamName] || attendance[t.teamName].length === 0);

    return data;
  }, [mergedData, searchTerm, activeTab, attendance]);

  const handleRefresh = () => {
    if (sheetIdTeam || import.meta.env.VITE_TEAM_SHEET_ID) {
      fetchFromSheets();
    } else if (teamData.length > 0) {
      processAndMerge();
    }
  };

  const exportMerged = () => {
    const ws = XLSX.utils.json_to_sheet(mergedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Merged_Data");
    XLSX.writeFile(wb, "Nexora_Merged_Report.xlsx");
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-titles">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            NEXORA DASHBOARD
          </motion.h1>
        </div>
        <button className="btn-refresh" onClick={handleRefresh} disabled={isSyncing || isProcessing}>
          <RefreshCw className={(isSyncing || isProcessing) ? 'spin' : ''} size={18} />
          {(isSyncing || isProcessing) ? 'Updating...' : 'Refresh Data'}
        </button>
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
            <div className="sync-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
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
              <div className="input-group">
                <label>Master Sheet ID (Optional)</label>
                <input
                  type="text"
                  placeholder="For member details..."
                  value={sheetIdMaster}
                  onChange={(e) => setSheetIdMaster(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                className="btn-primary" 
                onClick={fetchFromSheets} 
                disabled={isSyncing || isProcessing}
                style={{ minWidth: '200px' }}
              >
                <RefreshCw className={(isSyncing || isProcessing) ? 'spin' : ''} size={18} />
                {(isSyncing || isProcessing) ? 'Syncing...' : 'Sync Cloud Data'}
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
                  <span>{teamData.length > 0 ? `${teamData.length} Teams` : 'Team Excel'}</span>
                </div>
              </div>
            </div>

            <div className="upload-box">
              <label>Payment Details Excel</label>
              <div className={`file-drop ${paymentData.length > 0 ? 'success' : ''}`}>
                <input type="file" accept=".xlsx, .xls, .csv" onChange={(e) => handleFileUpload(e, 'payment')} />
                <div className="inner">
                  {paymentData.length > 0 ? <CheckCircle className="status-icon" /> : <CreditCard />}
                  <span>{paymentData.length > 0 ? `${paymentData.length} Records` : 'Payment Excel'}</span>
                </div>
              </div>
            </div>

            <div className="upload-box">
              <label>Master Details (Optional)</label>
              <div className={`file-drop ${masterData.length > 0 ? 'success' : ''}`}>
                <input type="file" accept=".xlsx, .xls, .csv" onChange={(e) => handleFileUpload(e, 'master')} />
                <div className="inner">
                  {masterData.length > 0 ? <CheckCircle className="status-icon" /> : <Users />}
                  <span>{masterData.length > 0 ? `${masterData.length} Details` : 'Master Excel'}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            className="btn-primary merge-btn"
            onClick={processAndMerge}
            disabled={isProcessing || !teamData.length || !paymentData.length}
          >
            {isProcessing ? 'Synchronizing Systems...' : 'Process & Launch Dashboard'}
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
            <div className="stat-card glass present">
              <div className="stat-info">
                <CheckCircle className="stat-icon" />
                <div>
                  <span className="label">Teams Present</span>
                  <span className="value">{stats.present}</span>
                </div>
              </div>
            </div>
            <div className="stat-card glass absent">
              <div className="stat-info">
                <AlertCircle className="stat-icon" />
                <div>
                  <span className="label">Teams Absent</span>
                  <span className="value">{stats.absent}</span>
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

              <button className={activeTab === 'paid' ? 'active' : ''} onClick={() => setActiveTab('paid')}>Paid</button>
              <button className={activeTab === 'pending' ? 'active' : ''} onClick={() => setActiveTab('pending')}>Pending</button>
              <button className={activeTab === 'present' ? 'active' : ''} onClick={() => setActiveTab('present')}>
                <CheckCircle size={14} style={{ marginRight: '4px' }} /> Present
              </button>
              <button className={activeTab === 'absent' ? 'active' : ''} onClick={() => setActiveTab('absent')}>
                <AlertCircle size={14} style={{ marginRight: '4px' }} /> Absent
              </button>
            </div>

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
                    <div className="header-actions">
                      <button
                        className="btn-delete-icon"
                        onClick={(e) => { e.stopPropagation(); deleteTeam(team.teamName); }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="project-preview">
                      <span className="domain-tag">{team.domain}</span>
                      <p className="project-name">{team.project}</p>
                    </div>
                    <div className="payment-preview">
                      <div className={`status-dot ${String(team.paymentStatus || 'pending').toLowerCase()}`}></div>
                      <span className="payment-label">{team.paymentStatus}</span>
                      {team.paymentStatus?.toLowerCase() === 'paid' && team.amount > 0 && (
                        <span className="amount-tag">₹{team.amount}</span>
                      )}
                      {team.transactionId && team.transactionId !== 'N/A' && (
                        <span className="utr-tag">{team.transactionId}</span>
                      )}
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

          <button className="btn-ghost reset-btn" onClick={() => { setMergedData([]); setTeamData([]); setPaymentData([]); }}>
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
                  <div className="table-responsive">
                    <table className="members-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>College</th>
                          <th className="text-center">Attendance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTeam.detailedMembers && selectedTeam.detailedMembers.length > 0 ?
                          [...selectedTeam.detailedMembers]
                            .sort((a, b) => {
                              if (a.name === selectedTeam.leader) return -1;
                              if (b.name === selectedTeam.leader) return 1;
                              return 0;
                            })
                            .map((member, i) => {
                              const isPresent = attendance[selectedTeam.teamName]?.includes(member.name);
                              return (
                                <tr key={i} className={isPresent ? 'is-present' : ''} onClick={() => toggleAttendance(selectedTeam.teamName, member.name)}>
                                  <td>
                                    <div className="member-name-cell">
                                      <div className="avatar small">{member.name.charAt(0)}</div>
                                      <span className="m-name">{member.name}</span>
                                    </div>
                                  </td>
                                  <td>
                                    {member.name === selectedTeam.leader ? (
                                      <span className="leader-label">Leader</span>
                                    ) : (
                                      <span className="member-label">Member</span>
                                    )}
                                  </td>
                                  <td>
                                    {member.college && member.college !== 'N/A' ? (
                                      <span className="m-college">
                                        <Database size={10} /> {member.college}
                                      </span>
                                    ) : <span className="muted">-</span>}
                                  </td>
                                  <td className="text-center">
                                    <div className={`attendance-toggle ${isPresent ? 'active' : ''}`} style={{ margin: '0 auto' }}>
                                      {isPresent ? <CheckCircle size={16} /> : <div className="circle" />}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          : (
                            <tr><td colSpan="4" className="muted text-center" style={{ padding: '2rem' }}>No member details available</td></tr>
                          )}
                      </tbody>
                    </table>
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
                  <div className="detail-row">
                    <span className="label">Mode:</span>
                    <span className="val">{selectedTeam.paymentMode}</span>
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
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .btn-refresh {
          background: rgba(139, 92, 246, 0.2);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #a78bfa;
          padding: 8px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-refresh:hover {
          background: rgba(139, 92, 246, 0.3);
          transform: translateY(-2px);
        }
        .btn-refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .header-titles h1 {
          font-size: 2.5rem;
          background: linear-gradient(135deg, #fff 0%, #a78bfa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
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
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
          grid-template-columns: repeat(4, 1fr);
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
        .stat-card.present .stat-icon { color: #10b981; background: rgba(16, 185, 129, 0.1); }
        .stat-card.absent .stat-icon { color: #f43f5e; background: rgba(244, 63, 94, 0.1); }
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
          grid-template-columns: repeat(3, 350px);
          gap: 1.5rem;
          margin-bottom: 3rem;
        }
        .team-data-card {
          padding: 1.5rem;
          box-sizing: border-box;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
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
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .btn-delete-icon {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
          border: none;
          padding: 6px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .btn-delete-icon:hover {
          background: rgba(239, 68, 68, 0.25);
          transform: translateY(-1px);
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
        .table-responsive { width: 100%; overflow-x: auto; border-radius: 12px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.02); }
        .members-table { width: 100%; border-collapse: collapse; text-align: left; }
        .members-table th { padding: 1rem; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid var(--glass-border); }
        .members-table td { padding: 1rem; vertical-align: middle; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .members-table tr:last-child td { border-bottom: none; }
        .members-table tr { cursor: pointer; transition: all 0.2s; }
        .members-table tr:hover { background: rgba(255,255,255,0.05); }
        .members-table tr.is-present { background: rgba(6, 182, 212, 0.05); }
        .members-table tr.is-present td { border-color: rgba(6, 182, 212, 0.1); }
        .member-name-cell { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 32px; height: 32px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; }
        .avatar.small { width: 28px; height: 28px; font-size: 0.75rem; }
        .m-name { font-weight: 600; color: white; }
        .m-college { font-size: 0.7rem; color: #a78bfa; background: rgba(139, 92, 246, 0.1); padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(139, 92, 246, 0.2); }
        .leader-label { font-size: 0.7rem; color: var(--secondary); text-transform: uppercase; font-weight: 800; background: rgba(6, 182, 212, 0.1); padding: 2px 8px; border-radius: 4px; display: inline-block; }
        .member-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
        .attendance-toggle { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; }
        .attendance-toggle.active { background: var(--secondary); border-color: var(--secondary); color: white; }
        .text-center { text-align: center; }
        
        .modal-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        .full-width { grid-column: 1 / -1; }
        .low-case { text-transform: lowercase; }
        .attendance-badge { margin-left: auto; font-size: 0.75rem; background: rgba(6, 182, 212, 0.1); color: var(--secondary); padding: 2px 8px; border-radius: 10px; }
        .project-name { font-weight: 600; font-size: 0.95rem; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .location-meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 8px 0; }
        .college-tag, .city-tag { font-size: 0.65rem; color: var(--text-muted); background: rgba(255, 255, 255, 0.05); padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(255, 255, 255, 0.05); }
        .domain-tag { font-size: 0.7rem; color: var(--primary); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; }
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
        .team-data-card:hover {
          border-color: var(--primary);
          transform: translateY(-5px) scale(1.02);
          box-shadow: 0 15px 30px rgba(139, 92, 246, 0.2);
        }
        .card-body {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }
        .team-meta h3 {
          margin-bottom: 0.2rem;
        }
        .compact { margin-bottom: 0; font-size: 0.8rem; }
        .project-preview {
          margin-bottom: 1rem;
        }
        .payment-preview {
          margin-top: auto;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.6rem;
          font-size: 0.9rem;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f43f5e;
        }
        .status-dot.paid, .status-dot.success { background: #06b6d4; }
        .amount-tag {
          font-size: 0.75rem;
          background: rgba(6, 182, 212, 0.1);
          color: var(--secondary);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
        }
        .utr-tag {
          font-size: 0.7rem;
          color: var(--text-muted);
          background: rgba(255,255,255,0.05);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .last-sync {
          font-size: 0.75rem;
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 600;
          margin-left: 10px;
        }
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
          margin-top: 1.5rem;
          padding-top: 1.2rem;
          border-top: 1px solid var(--glass-border);
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
