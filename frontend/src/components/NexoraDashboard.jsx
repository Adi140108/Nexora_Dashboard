import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Trash2,
  ArrowUpDown,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NexoraDashboard = () => {
  const [teamData, setTeamData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [mergedData, setMergedData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [reportsSent, setReportsSent] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('nexora_recent_searches');
    return saved ? JSON.parse(saved) : [];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'az', 'za'
  const [domainFilter, setDomainFilter] = useState('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showDomainMenu, setShowDomainMenu] = useState(false);
  const filterMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterMenu && filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        closeFilterMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterMenu]);
  // Cloud Sync States
  const [sheetIdTeam, setSheetIdTeam] = useState(import.meta.env.VITE_TEAM_SHEET_ID || localStorage.getItem('nexora_sheet_team') || '');
  const [sheetIdPayment, setSheetIdPayment] = useState(import.meta.env.VITE_PAYMENT_SHEET_ID || localStorage.getItem('nexora_sheet_payment') || '');
  const [sheetIdMaster, setSheetIdMaster] = useState(import.meta.env.VITE_MASTER_SHEET_ID || localStorage.getItem('nexora_sheet_master') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [masterData, setMasterData] = useState([]);

  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const cleanPhone = (p) => String(p || '').replace(/[^0-9]/g, '').slice(-10);

  const apiUrl = useMemo(() => {
    // Priority: Env Variable > Production Render URL > Localhost
    let url = import.meta.env.VITE_API_URL || 'https://nexora-backend.onrender.com';
    if (url.endsWith('/')) url = url.slice(0, -1);
    return url;
  }, []);

  const openTeamModal = (team) => {
    setSelectedTeam(team);
    window.history.pushState({ modalOpen: true }, '', '#team-details');
  };

  const closeTeamModal = () => {
    setSelectedTeam(null);
    if (window.location.hash === '#team-details') {
      window.history.back();
    }
  };

  const toggleFilterMenu = () => {
    if (!showFilterMenu) {
      setShowFilterMenu(true);
      window.history.pushState({ filterMenuOpen: true }, '', '#filter-menu');
    } else {
      closeFilterMenu();
    }
  };

  const closeFilterMenu = () => {
    setShowFilterMenu(false);
    setShowDomainMenu(false);
    if (window.location.hash === '#filter-menu') {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.hash !== '#team-details') {
        setSelectedTeam(null);
      }
      if (window.location.hash !== '#filter-menu') {
        setShowFilterMenu(false);
        setShowDomainMenu(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handlePrintAttendance = () => {
    const printWindow = window.open('', '_blank');
    const presentTeams = mergedData.filter(team => getValidAttendance(team.teamName, team.members).length > 0);

    const tableHtml = `
      <html>
        <head>
          <title>Vibe-A-Thon 2026 - Attendance Report</title>
          <base href="${window.location.origin}/">
          <style>
            body { 
              font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 20px; 
              color: #000;
              line-height: 1.5;
            }
            .print-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
            }
            .club-logo { height: 80px; width: auto; object-fit: contain; }
            .banner-img { width: 100%; height: auto; display: block; border-radius: 8px; margin-bottom: 20px; }
            
            .report-title {
              border-bottom: 3px solid #8b5cf6;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .report-title h1 { margin: 0; color: #0f0c29; font-size: 2rem; }
            .report-title p { margin: 5px 0 0; color: #666; font-weight: bold; }

            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 14px; /* Loosened for readability */
              margin-top: 20px;
            }
            th, td { 
              border: 1px solid #333; 
              padding: 12px; /* Spacious padding */
              text-align: left; 
              color: #000;
            }
            th { 
              background-color: #f8f9fa !important; 
              font-weight: bold;
              text-transform: uppercase;
              -webkit-print-color-adjust: exact;
            }
            .team-name-cell { vertical-align: top; font-weight: 800; background: #fafafa; }
            .tick { color: #10b981; font-weight: bold; font-size: 1.2rem; }
            .cross { color: #f43f5e; font-weight: bold; font-size: 1.2rem; }
            .meta { margin-bottom: 10px; font-size: 0.9rem; color: #666; }
            
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <img src="nexora_logo_v2.png" class="club-logo" alt="Club Logo" />
            <div style="text-align: right;">
              <div class="meta">Generated: ${new Date().toLocaleString()}</div>
              <div class="meta">VIBE-A-THON Official Document</div>
            </div>
          </div>

          <img src="vibeathon_banner.png" class="banner-img" alt="Vibeathon Banner" />

          <div class="report-title">
            <h1>Attendance Report</h1>
            <p>Teams Present (Full & Partial): ${presentTeams.length} | Total Active Members: ${presentTeams.reduce((acc, t) => acc + (t.detailedMembers?.filter(m => (attendance[t.teamName] || []).includes(m.name)).length || 0), 0)}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">S.No.</th>
                <th style="width: 30%;">Team Name</th>
                <th>Member Name</th>
                <th style="text-align: center; width: 15%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${presentTeams.map((team, teamIdx) => {
      const members = team.detailedMembers || [{ name: team.teamName }];
      const teamAttendance = getValidAttendance(team.teamName, team.members);
      return members.map((m, idx) => `
                  <tr>
                    ${idx === 0 ? `
                      <td class="team-name-cell" rowspan="${members.length}" style="text-align: center;">${teamIdx + 1}</td>
                      <td class="team-name-cell" rowspan="${members.length}">${team.teamName}</td>
                    ` : ''}
                    <td>${m.name}</td>
                    <td style="text-align: center;">
                      ${teamAttendance.includes(m.name) ? '<span class="tick">✔️</span>' : '<span class="cross">❌</span>'}
                    </td>
                  </tr>
                `).join('');
    }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(tableHtml);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handlePrintTeamReport = (team) => {
    const printWindow = window.open('', '_blank');
    const teamAttendance = getValidAttendance(team.teamName, team.members);
    const members = team.detailedMembers || team.members.split(',').map(m => ({ name: m.trim() }));

    const tableHtml = `
      <html>
        <head>
          <title>Team Report - ${team.teamName}</title>
          <base href="${window.location.origin}/">
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #000; line-height: 1.6; }
            .print-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
            .club-logo { height: 70px; }
            .banner-img { width: 100%; height: auto; display: block; border-radius: 8px; margin-bottom: 20px; }
            .report-title { border-bottom: 3px solid #8b5cf6; padding-bottom: 10px; margin-bottom: 20px; }
            .report-title h1 { margin: 0; color: #0f0c29; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-section { border: 1px solid #333; padding: 15px; border-radius: 8px; }
            .info-section h3 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 8px; font-size: 1rem; text-transform: uppercase; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9rem; }
            .label { font-weight: bold; color: #555; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 10px; text-align: left; }
            th { background-color: #f8f9fa !important; -webkit-print-color-adjust: exact; }
            .tick { color: #10b981; font-weight: bold; font-size: 1.1rem; }
            .cross { color: #f43f5e; font-weight: bold; font-size: 1.1rem; }
            
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="print-header">
            <img src="nexora_logo_v2.png" class="club-logo" alt="Logo" />
            <div style="text-align: right; font-size: 0.8rem; color: #666;">
              Generated: ${new Date().toLocaleString()}<br>
              VIBE-A-THON Official Team Dossier
            </div>
          </div>

          <img src="vibeathon_banner.png" class="banner-img" alt="Banner" />

          <div class="report-title">
            <h1>Team Report: ${team.teamName}</h1>
          </div>

          <div class="info-grid">
            <div class="info-section">
              <h3>Project Details</h3>
              <div class="detail-row"><span class="label">Project:</span> <span>${team.project}</span></div>
              <div class="detail-row"><span class="label">Domain:</span> <span>${team.domain}</span></div>
              <div class="detail-row"><span class="label">Status:</span> <span>${team.status || 'Active'}</span></div>
            </div>
            <div class="info-section">
              <h3>Financials</h3>
              <div class="detail-row"><span class="label">Payment:</span> <span>${team.paymentStatus}</span></div>
              <div class="detail-row"><span class="label">Transaction:</span> <span>${team.transactionId}</span></div>
              <div class="detail-row"><span class="label">Amount:</span> <span>₹${team.amount}</span></div>
              <div class="detail-row"><span class="label">Mode:</span> <span>${team.paymentMode || 'N/A'}</span></div>
            </div>
          </div>

          <h3>Team Composition & Attendance</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">S.No.</th>
                <th>Member Name</th>
                <th>Role</th>
                <th style="text-align: center;">Attendance</th>
              </tr>
            </thead>
            <tbody>
              ${members.map((m, idx) => `
                <tr>
                  <td style="text-align: center;">${idx + 1}</td>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.name === team.leader ? 'Leader' : 'Member'}</td>
                  <td style="text-align: center;">
                    ${teamAttendance.includes(m.name) ? '<span class="tick">✔️</span>' : '<span class="cross">❌</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(tableHtml);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleManualSync = async () => { };

  // Fetch attendance from backend with Auto-Sync (Polling)
  React.useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/attendance`);
        if (res.ok) {
          const data = await res.json();
          setAttendance(data);
        }

        const repRes = await fetch(`${apiUrl}/api/reports`);
        if (repRes.ok) {
          const repData = await repRes.json();
          setReportsSent(repData);
        }
      } catch (e) {
        console.error("Failed to fetch shared attendance or reports", e);
      }
    };

    // Initial fetch
    fetchAttendance();

    // Set up polling every 5 seconds for live updates
    const interval = setInterval(fetchAttendance, 5000);
    return () => clearInterval(interval);
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
      // Heuristic: If master data seems to have no headers, re-map it using common Unstop indices
      let normalizedMaster = mData;
      if (mData && mData.length > 0) {
        const firstRow = mData[0];
        const keys = Object.keys(firstRow);

        // Better heuristic: look for actual header column names
        const hasHeaders = keys.some(k => {
          const ck = String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return ck === 'email' || ck === 'candidatesemail' || ck === 'teamname' || ck.includes('organisation');
        });

        if (!hasHeaders && keys.length >= 10) {
          console.log("Master sheet seems to be headerless. Applying Unstop index mapping.");
          normalizedMaster = mData.map(row => {
            return {
              'Team ID': row[keys[3]] || '',
              'Team Name': row[keys[1]] || '',
              'Name': row[keys[4]] || '',
              'Email': row[keys[5]] || '',
              'Phone': row[keys[6]] || '',
              'College': row[keys[14]] || row[keys[13]] || row[keys[15]] || '',
              'Role': row[keys[9]] || '',
              'City': row[keys[8]] || '',
            };
          });
          // Also add the "header" row (which was data) back as data!
          normalizedMaster.unshift({
            'Team ID': keys[3],
            'Team Name': keys[1],
            'Name': keys[4],
            'Email': keys[5],
            'Phone': keys[6],
            'College': keys[14] || keys[13] || keys[15],
            'Role': keys[9],
            'City': keys[8],
          });
        }
      }
      mData = normalizedMaster;

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
          .filter(k => {
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanKey.includes(pattern) && !cleanKey.includes('number') && !cleanKey.includes('count') && !cleanKey.includes('total');
          })
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
          const targetLeader = clean(findVal(team, ['teamleader', 'leadername', 'leader', 'captain', 'poc', 'representative']));

          // Get basic member info from Team Sheet
          let membersList = findAllVals(team, 'participant');
          if (membersList.length === 0) membersList = findAllVals(team, 'member');
          if (membersList.length === 0) membersList = [findVal(team, ['members', 'names', 'allnames']) || 'Not specified'];
          const memberString = Array.isArray(membersList) ? membersList.filter(m => m !== 'Not specified').join(', ') : String(membersList);

          let detailedMembers = [];
          let college = String(findVal(team, ['college', 'university', 'institute', 'organization', 'organisation', 'institution']) || 'N/A');
          let city = String(findVal(team, ['city', 'location', 'address', 'place']) || 'N/A');
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
                let candidateName = String(
                  findVal(r, ['candidatesname', 'participantname', 'membername', 'candidatename']) ||
                  findVal(r, ['name']) || ''
                );

                const userType = String(findVal(r, ['usertype', 'role', 'type']) || '').toLowerCase();
                const isLeader = userType.includes('leader') || userType.includes('captain');

                if (targetKey === 'champarancoder' && !isLeader && candidateName.toLowerCase().includes('priyanshu kumar')) {
                  candidateName = 'Priyanshu K';
                }

                return {
                  name: candidateName,
                  email: String(findVal(r, ['candidatesemail', 'email', 'mail']) || '').toLowerCase().trim(),
                  phone: cleanPhone(findVal(r, ['candidatesmobile', 'phone', 'contact', 'mobile'])),
                  college: String(findVal(r, ['candidatesorganisation', 'organisation', 'college', 'university', 'institute', 'organization']) || 'N/A'),
                  city: String(findVal(r, ['candidateslocation', 'location', 'city', 'address', 'place']) || 'N/A'),
                  isLeader: userType.includes('leader') || userType.includes('captain'),
                };
              }).filter(m => m.name && clean(m.name) !== targetKey);

              console.log('MAPPED TEAM:', targetKey, 'ROWS:', teamRows.length, 'COLLEGE:', detailedMembers[0]?.college);
              college = detailedMembers[0]?.college || 'N/A';
              city = detailedMembers[0]?.city || 'N/A';
            }
          }

          // Fallback: if no master data, use Team Sheet member names
          if (detailedMembers.length === 0) {
            const rawLeader = String(findVal(team, ['teamleader', 'leadername', 'leader', 'captain', 'poc', 'representative']) || '').trim();
            const fallbackMembers = [];

            if (rawLeader && rawLeader.toLowerCase() !== 'n/a' && rawLeader.toLowerCase() !== 'not specified') {
              fallbackMembers.push({
                name: rawLeader,
                college: college,
                city: city,
                isLeader: true,
              });
            }

            memberString.split(',').forEach(m => {
              const mName = m.trim();
              if (mName && mName !== 'Not specified' && mName !== rawLeader) {
                fallbackMembers.push({
                  name: mName,
                  college: college,
                  city: city,
                  isLeader: false,
                });
              }
            });
            detailedMembers = fallbackMembers;
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
            leader: leader.name || String(findVal(team, ['teamleader', 'leadername', 'leader', 'captain', 'poc', 'representative']) || membersList[0] || 'N/A'),
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

  const toggleReportSent = async (teamName) => {
    const isCurrentlySent = reportsSent.includes(teamName);
    const newIsSent = !isCurrentlySent;

    setReportsSent(prev => {
      if (newIsSent) return [...prev, teamName];
      return prev.filter(t => t !== teamName);
    });

    try {
      await fetch(`${apiUrl}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, isSent: newIsSent })
      });
    } catch (e) {
      console.error("Sync reports failed", e);
    }
  };

  const toggleAttendance = async (teamName, memberName) => {
    const isCurrentlyPresent = attendance[teamName]?.includes(memberName);
    const newIsPresent = !isCurrentlyPresent;

    setAttendance(prev => {
      const current = prev[teamName] || [];
      const updated = newIsPresent
        ? [...current, memberName]
        : current.filter(m => m !== memberName);
      return { ...prev, [teamName]: updated };
    });

    try {
      await fetch(`${apiUrl}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, memberName, isPresent: newIsPresent })
      });
    } catch (e) {
      console.error("Sync failed", e);
    }
  };

  function getValidAttendance(teamName, membersString) {
    const presentList = attendance[teamName] || [];
    if (!membersString) return presentList;
    const expectedMembers = membersString.split(',').map(m => m.trim());
    return presentList.filter(m => expectedMembers.includes(m));
  };

  const toggleFullTeamAttendance = async (teamName, membersString) => {
    const members = membersString.split(',').map(m => m.trim());
    const validPresent = getValidAttendance(teamName, membersString);
    const isAllPresent = validPresent.length === members.length;
    const newIsPresent = !isAllPresent;

    setAttendance(prev => ({
      ...prev,
      [teamName]: newIsPresent ? members : []
    }));

    try {
      for (const memberName of members) {
        await fetch(`${apiUrl}/api/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamName, memberName, isPresent: newIsPresent })
        });
      }
    } catch (e) {
      console.error("Bulk sync failed", e);
    }
  };

  const stats = useMemo(() => {
    if (mergedData.length === 0) return null;

    let fullyPresent = 0;
    let partiallyPresent = 0;
    let absent = 0;

    mergedData.forEach(t => {
      const presentMembers = getValidAttendance(t.teamName, t.members).length;
      const totalMembers = t.detailedMembers?.length || 1;

      if (presentMembers === 0) {
        absent++;
      } else if (presentMembers >= totalMembers) {
        fullyPresent++;
      } else {
        partiallyPresent++;
      }
    });

    return {
      total: mergedData.length,
      present: fullyPresent,
      partial: partiallyPresent,
      absent: absent,
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

    if (activeTab === 'partial') {
      data = data.filter(t => {
        const count = getValidAttendance(t.teamName, t.members).length;
        return count > 0 && count < (t.detailedMembers?.length || 1);
      });
    }

    if (activeTab === 'present') {
      data = data.filter(t => {
        const count = getValidAttendance(t.teamName, t.members).length;
        return count >= (t.detailedMembers?.length || 1);
      });
    }

    if (activeTab === 'absent') data = data.filter(t => getValidAttendance(t.teamName, t.members).length === 0);
    if (activeTab === 'report_sent') data = data.filter(t => reportsSent.includes(t.teamName));

    // Filter by Domain
    if (domainFilter !== 'all') {
      data = data.filter(t => t.domain === domainFilter);
    }

    // Sort Data
    const sorted = [...data];
    if (sortBy === 'az') {
      sorted.sort((a, b) => a.teamName.localeCompare(b.teamName));
    } else if (sortBy === 'za') {
      sorted.sort((a, b) => b.teamName.localeCompare(a.teamName));
    } else if (sortBy === 'members-desc') {
      sorted.sort((a, b) => (b.detailedMembers?.length || 0) - (a.detailedMembers?.length || 0));
    } else if (sortBy === 'members-asc') {
      sorted.sort((a, b) => (a.detailedMembers?.length || 0) - (b.detailedMembers?.length || 0));
    } else {
      // Default: newest first (using createdAt or index)
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return sorted;
  }, [mergedData, searchTerm, activeTab, attendance, domainFilter, sortBy]);

  const uniqueDomains = useMemo(() => {
    const domains = [...new Set(mergedData.map(t => t.domain))].filter(Boolean);
    return domains.sort();
  }, [mergedData]);

  const handleRefresh = () => {
    if (sheetIdTeam || import.meta.env.VITE_TEAM_SHEET_ID) {
      fetchFromSheets();
    } else if (teamData.length > 0) {
      processAndMerge();
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-titles">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <img
              src="/nexora_brand_logo.png"
              alt="Nexora"
              style={{ height: '2.5em', width: 'auto', objectFit: 'contain' }}
            />
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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
            <div className="stat-card glass present" style={{ position: 'relative' }}>
              <div className="stat-info">
                <CheckCircle className="stat-icon" />
                <div>
                  <span className="label">Teams Present</span>
                  <span className="value">{stats.present}</span>
                </div>
              </div>
              <button className="print-stats-btn" onClick={handlePrintAttendance}>
                <Printer size={18} />
              </button>
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
            <div className="stat-card glass partial">
              <div className="stat-info">
                <Users className="stat-icon" />
                <div>
                  <span className="label">Partially Present</span>
                  <span className="value">{stats.partial}</span>
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
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-system">
              <div className="filter-popover-container" ref={filterMenuRef}>
                <button
                  className={`btn-filter-icon glass ${showFilterMenu ? 'active' : ''}`}
                  onClick={toggleFilterMenu}
                >
                  <Filter size={20} />
                </button>

                <AnimatePresence>
                  {showFilterMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className={`filter-menu glass ${showDomainMenu ? 'domain-open' : ''}`}
                    >
                      <div className="menu-section">
                        <span className="menu-label">Sort By</span>
                        <button className={sortBy === 'newest' ? 'active' : ''} onClick={() => { setSortBy('newest'); closeFilterMenu(); }}>
                          <Clock size={14} /> Newest First
                        </button>

                        <div className="has-submenu" style={{ position: 'relative', width: '100%' }}>
                          <button
                            className="submenu-trigger"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowDomainMenu(!showDomainMenu);
                            }}
                          >
                            <span>Filter Domain</span>
                            <ArrowRight size={14} style={{ transform: showDomainMenu ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                          </button>
                        </div>

                        <button className={sortBy === 'az' ? 'active' : ''} onClick={() => { setSortBy('az'); closeFilterMenu(); }}>
                          <ArrowUpDown size={14} /> Team A-Z
                        </button>
                        <button className={sortBy === 'za' ? 'active' : ''} onClick={() => { setSortBy('za'); closeFilterMenu(); }}>
                          <ArrowUpDown size={14} /> Team Z-A
                        </button>
                        <button className={sortBy === 'members-desc' ? 'active' : ''} onClick={() => { setSortBy('members-desc'); closeFilterMenu(); }}>
                          <Users size={14} /> Members (High to Low)
                        </button>
                        <button className={sortBy === 'members-asc' ? 'active' : ''} onClick={() => { setSortBy('members-asc'); closeFilterMenu(); }}>
                          <Users size={14} /> Members (Low to High)
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Domain submenu rendered OUTSIDE filter-menu as a separate card */}
                <AnimatePresence>
                  {showFilterMenu && showDomainMenu && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="domain-submenu-popout"
                    >
                      <span className="menu-label" style={{ padding: '4px 8px', display: 'block', marginBottom: '4px' }}>Domains</span>
                      <button className={domainFilter === 'all' ? 'active' : ''} onClick={() => { setDomainFilter('all'); closeFilterMenu(); }}>
                        All Domains
                      </button>
                      {uniqueDomains.map(d => (
                        <button key={d} className={domainFilter === d ? 'active' : ''} onClick={() => { setDomainFilter(d); closeFilterMenu(); }}>
                          {d}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="filter-tabs glass">
                <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>All</button>
                <button className={activeTab === 'paid' ? 'active' : ''} onClick={() => setActiveTab('paid')}>Paid</button>
                <button className={activeTab === 'partial' ? 'active' : ''} onClick={() => setActiveTab('partial')}>Partially Present</button>
                <button className={activeTab === 'present' ? 'active' : ''} onClick={() => setActiveTab('present')}>
                  <CheckCircle size={14} /> Present
                </button>
                <button className={activeTab === 'absent' ? 'active' : ''} onClick={() => setActiveTab('absent')}>
                  <AlertCircle size={14} /> Absent
                </button>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="results-grid">
            <AnimatePresence mode='popLayout'>
              {filteredData.map((team, idx) => (
                <motion.div
                  key={team.teamName + idx}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.2 }}
                  className="team-data-card glass card"
                  onClick={() => openTeamModal(team)}
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
                    {team.college && team.college !== 'N/A' && (
                      <div className="college-preview" style={{ marginTop: '6px' }}>
                        <span className="m-college" style={{ fontSize: '0.65rem' }}>
                          <Database size={10} /> {team.college}
                        </span>
                      </div>
                    )}
                    <div className="payment-preview">
                      <div className={`status-dot ${String(team.paymentStatus || 'pending').toLowerCase()}`}></div>
                      <span className="payment-label">{team.paymentStatus}</span>
                      {team.paymentStatus?.toLowerCase() === 'paid' && team.amount > 0 && (
                        <span className="amount-tag">₹{team.amount}</span>
                      )}
                      {team.transactionId && team.transactionId !== 'N/A' && (
                        <span className="utr-tag">{team.transactionId}</span>
                      )}
                      {(() => {
                        const validPresent = getValidAttendance(team.teamName, team.members).length;
                        const expectedTotal = team.members ? team.members.split(',').length : (team.detailedMembers?.length || 1);
                        return validPresent > 0 ? (
                          <span className={`attendance-badge ${validPresent === expectedTotal ? 'all' : 'partial'}`}>
                            {validPresent}/{expectedTotal} Present
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="card-footer">
                    <button
                      className={`btn-attendance ${getValidAttendance(team.teamName, team.members).length === (team.members ? team.members.split(',').length : 1) ? 'all' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleFullTeamAttendance(team.teamName, team.members); }}
                    >
                      {getValidAttendance(team.teamName, team.members).length > 0 ? <CheckCircle size={14} /> : <Users size={14} />}
                      {getValidAttendance(team.teamName, team.members).length === (team.members ? team.members.split(',').length : 1) ? 'All Present' : 'Mark Present'}
                    </button>
                    <span className="view-details" onClick={() => openTeamModal(team)}>Insights <ArrowRight size={14} /></span>
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
            onClick={closeTeamModal}
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
                <button className="close-btn" onClick={closeTeamModal}><X /></button>
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
                <button className="btn-primary" onClick={() => handlePrintTeamReport(selectedTeam)}>Print Report</button>
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
        .stat-card.partial .stat-icon { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
        .stat-card.paid .stat-icon { color: #06b6d4; background: rgba(6, 182, 212, 0.1); }
        .print-stats-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .print-stats-btn:hover { background: rgba(16, 185, 129, 0.2); border-color: #10b981; }
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
        .filter-system {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .filter-popover-container {
          position: relative;
        }
        .btn-filter-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-filter-icon:hover, .btn-filter-icon.active {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(139, 92, 246, 0.1);
        }
        .filter-menu {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: 240px;
          background: rgba(15, 12, 41, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 1rem;
          z-index: 100;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .menu-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .menu-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 800;
          margin-bottom: 4px;
          padding: 0 8px;
        }
        .menu-section button, .submenu-trigger {
          background: transparent;
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          text-align: left;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          width: 100%;
        }
        .domain-submenu-popout {
          position: absolute;
          top: 0;
          left: calc(100% + 8px);
          width: 220px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px;
          border-radius: 12px;
          background: rgba(15, 12, 41, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          z-index: 1000;
        }
        .domain-submenu-popout button {
          text-align: left;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .domain-submenu-popout button:hover, .domain-submenu-popout button.active {
          background: rgba(139, 92, 246, 0.15);
          color: var(--text-main);
        }
        .menu-section button:hover, .submenu-trigger:hover {
          background: rgba(255,255,255,0.05);
          color: var(--primary);
        }
        .menu-section button.active {
          background: rgba(139, 92, 246, 0.2);
          color: var(--primary);
        }
        .menu-divider {
          height: 1px;
          background: var(--glass-border);
          margin: 0.8rem 0;
        }
        .has-submenu {
          position: relative;
          display: block;
          width: 100%;
        }
        .submenu-trigger {
          justify-content: space-between;
        }
        .domain-submenu {
          position: absolute;
          left: calc(100% + 12px);
          width: 220px;
          background: rgba(15, 12, 41, 0.98);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 0.8rem;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 10px 0 30px rgba(0,0,0,0.5);
        }
        .domain-submenu button {
          background: transparent;
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          text-align: left;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .domain-submenu button:hover {
          background: rgba(255,255,255,0.05);
          color: var(--primary);
        }
        .domain-submenu button.active {
          background: rgba(139, 92, 246, 0.2);
          color: var(--primary);
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
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
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }
        .full-width { grid-column: 1 / -1; }
        .low-case { text-transform: lowercase; }
        .attendance-badge { margin-left: auto; font-size: 0.75rem; background: rgba(6, 182, 212, 0.1); color: var(--secondary); padding: 2px 8px; border-radius: 10px; border: 1px solid transparent; }
        .attendance-badge.all { background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.3); }
        .attendance-badge.partial { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
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

        /* Mobile Responsiveness Queries */
        @media (max-width: 1024px) {
          .dashboard-container { padding: 1.5rem; }
          .header-titles h1 { font-size: 2rem; }
        }

        @media (max-width: 768px) {
          .dashboard-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .stats-grid { grid-template-columns: 1fr; }
          .results-grid { 
            grid-template-columns: 1fr !important; 
            width: 100%;
          }
          .team-data-card { width: 100%; min-width: 0; }
          .actions-bar { flex-direction: column; align-items: stretch; gap: 1rem; }
          .search-box { min-width: 0; }
          .filter-tabs { flex-wrap: nowrap; overflow-x: hidden; white-space: nowrap; padding: 4px; gap: 4px; width: 100%; justify-content: space-between; }
          .filter-tabs button { flex: 1 1 auto; padding: 4px 2px; font-size: 0.65rem; flex-shrink: 1; min-width: 0; }
          
          .modal-overlay { padding: 1rem; }
          .modal-content { padding: 1.5rem; border-radius: 16px; }
          .header-info h2 { font-size: 1.5rem; }
          
          .filter-menu { 
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            right: auto !important;
            transform: translate(-50%, -50%) !important;
            width: 90% !important;
            max-width: 340px !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            z-index: 9999 !important;
            background: rgba(15, 12, 41, 0.98) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            box-shadow: 0 0 100px rgba(0,0,0,0.9) !important;
            padding: 1.5rem !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          /* When domain opens, slide filter menu to the left */
          .filter-menu.domain-open {
            left: 3% !important;
            transform: translate(0, -50%) !important;
            width: 44% !important;
            max-width: none !important;
            padding: 0.8rem !important;
            border-radius: 14px !important;
          }
          .filter-menu.domain-open .menu-section button,
          .filter-menu.domain-open .submenu-trigger {
            font-size: 0.7rem !important;
            padding: 5px 6px !important;
            gap: 4px !important;
          }
          .filter-menu.domain-open .menu-label {
            font-size: 0.6rem !important;
          }
          /* Domain submenu on the right — separate panel with gap */
          .domain-submenu-popout {
            position: fixed !important;
            top: 50% !important;
            left: auto !important;
            right: 3% !important;
            transform: translateY(-50%) !important;
            width: 44% !important;
            max-height: 60vh !important;
            overflow-y: auto !important;
            z-index: 10000 !important;
            background: rgba(15, 12, 41, 0.98) !important;
            border: 1px solid rgba(139, 92, 246, 0.4) !important;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8) !important;
            border-radius: 14px !important;
            padding: 10px !important;
          }
          .domain-submenu-popout button {
            font-size: 0.75rem !important;
            padding: 7px 8px !important;
          }
          /* Backdrop overlay */
          .filter-popover-container::before {
            content: "";
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            z-index: 9998;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
          }
          .filter-popover-container:has(.filter-menu)::before {
            opacity: 1;
          }
          
          .sync-row { grid-template-columns: 1fr; }
          .btn-sync { width: 100%; justify-content: center; }
        }

        @media (max-width: 480px) {
          .dashboard-container { padding: 1rem; }
          .header-titles h1 { font-size: 1.75rem; }
          .stat-card { padding: 1rem; }
          .value { font-size: 1.5rem; }
          .modal-footer { flex-direction: column; }
          .modal-footer button { width: 100%; }
        }

      `}</style>
    </div>
  );
};

export default NexoraDashboard;
