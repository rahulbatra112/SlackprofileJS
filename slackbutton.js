;(function(){
  const API_BASE = window.location.origin + '/api';
  let scanHandle  = null;
  let lastProfile = null;

  function makeSlackButton(phoneBtn, teamId, userId) {
    const btn = phoneBtn.cloneNode(true);
    btn.dataset.btn = 'slack';
    btn.textContent = 'Slack';
    btn.style.marginTop = '8px';
    const icon = document.createElement('img');
    icon.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/1200px-Slack_icon_2019.svg.png';
    icon.style.cssText = 'width:16px;height:16px;margin-right:8px;vertical-align:middle;';
    btn.prepend(icon);

    const appLink = `slack://user?team=${encodeURIComponent(teamId)}&id=${encodeURIComponent(userId)}`;
    const webLink = `https://slack.com/app_redirect?team=${encodeURIComponent(teamId)}&channel=${encodeURIComponent(userId)}`;

    btn.addEventListener('click', () => {
      window.location.href = appLink;
      setTimeout(() => window.open(webLink, '_blank'), 500);
    });
    return btn;
  }

  async function checkAndInsert() {
    // if already inserted, stop polling
    if (document.querySelector('button[data-btn="slack"]')) {
      clearInterval(scanHandle);
      scanHandle = null;
      return;
    }
    // find the Phone button
    const phoneBtn = Array.from(document.querySelectorAll('button'))
                          .find(b => b.textContent.trim() === 'Phone');
    if (!phoneBtn) return; // keep polling

    // extract GUID from URL
    const m    = location.pathname.match(/^\/profile\/([0-9a-fA-F\-]+)$/);
    if (!m) return;
    const sbId = m[1];

    let user;
    try {
      const res  = await fetch(`${API_BASE}/users/${sbId}`, { headers:{ 'Accept':'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      user       = Array.isArray(json.data) ? json.data[0] : json;
    } catch (e) {
      console.error('Profile fetch failed', e);
      clearInterval(scanHandle);
      scanHandle = null;
      return;
    }

    const prof      = user.profile || {};
    const slackTeam = prof.groupid;
    const slackUser = prof.userid;
    if (!slackTeam || !slackUser) {
      console.warn('Missing profile.groupid or profile.userid');
      clearInterval(scanHandle);
      scanHandle = null;
      return;
    }

    // insert the button
    const btn = makeSlackButton(phoneBtn, slackTeam, slackUser);
    phoneBtn.parentNode.insertBefore(btn, phoneBtn.nextSibling);
    console.log('Slack button inserted', { slackTeam, slackUser });

    clearInterval(scanHandle);
    scanHandle = null;
  }

  function startScan() {
    const m    = location.pathname.match(/^\/profile\/([0-9a-fA-F\-]+)$/);
    const sbId = m ? m[1] : null;
    if (!sbId || sbId === lastProfile) return;
    lastProfile = sbId;
    // remove any stray buttons
    document.querySelectorAll('button[data-btn="slack"]').forEach(b=>b.remove());
    scanHandle = setInterval(checkAndInsert, 300);
  }

  function stopScan() {
    if (scanHandle) clearInterval(scanHandle);
    scanHandle = null;
    lastProfile = null;
    document.querySelectorAll('button[data-btn="slack"]').forEach(b=>b.remove());
  }

  function onNav() {
    if (location.pathname.startsWith('/profile/')) startScan();
    else stopScan();
  }

  // hook SPA navigation
  history.pushState    = new Proxy(history.pushState,    { apply(t, th, a){ const r=t.apply(th,a); onNav(); return r; } });
  history.replaceState = new Proxy(history.replaceState, { apply(t, th, a){ const r=t.apply(th,a); onNav(); return r; } });
  window.addEventListener('popstate', onNav);

  // initial run
  onNav();
})();
