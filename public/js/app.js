/* GreenAction — komponen JS bersama (header/footer/auth helper) */
window.GA = (function(){
  const TOKEN_KEY='ga_token', USER_KEY='ga_user';
  function getToken(){ return localStorage.getItem(TOKEN_KEY); }
  function getUser(){ try{ return JSON.parse(localStorage.getItem(USER_KEY)||'null'); }catch(e){ return null; } }
  function setSession(token,user){ localStorage.setItem(TOKEN_KEY,token); localStorage.setItem(USER_KEY,JSON.stringify(user)); }
  function clearSession(){ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
  async function api(path, opts={}){
    const headers = Object.assign({'Content-Type':'application/json'}, opts.headers||{});
    if(getToken()) headers['Authorization']='Bearer '+getToken();
    const r = await fetch('/api'+path, {...opts, headers});
    return r.json();
  }
  function toast(msg){
    let el=document.getElementById('toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
    el.textContent=msg; el.classList.add('show');
    clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),2600);
  }
  function requireLogin(){ if(!getToken()){ toast('Silakan login dulu'); setTimeout(()=>location.href='/masuk',600); return false;} return true; }
  function fmt(n){ return (Number(n)||0).toLocaleString('id-ID'); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function headerHTML(active){
    const u=getUser();
    const dash = u ? (u.role==='admin' ? '/admin' : '/dashboard') : '/login';
    return `
    <header class="site-header">
      <div class="container">
        <a href="/" class="brand">
          <span class="logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22c5-2 8-6 8-11V5l-8-3-8 3v6c0 5 3 9 8 11z" fill="#65A77B"/><path d="M12 7v9M12 12c-2 0-3-1.5-3-3M12 14c2.5 0 4-2 4-4" stroke="#123C2B" stroke-width="1.6" stroke-linecap="round"/></svg></span>
          <span>GreenAction<small>Small Actions. Greater Impact.</small></span>
        </a>
        <nav class="main-nav" id="mainNav">
          <a href="/kampanye" class="${active==='kampanye'?'active':''}">Kampanye</a>
          <a href="/kegiatan" class="${active==='kegiatan'?'active':''}">Kegiatan</a>
          <a href="/komunitas" class="${active==='komunitas'?'active':''}">Komunitas</a>
          <a href="/green-map" class="${active==='map'?'active':''}">Green Map</a>
          <a href="/dampak" class="${active==='dampak'?'active':''}">Dampak</a>
          <a href="/edukasi" class="${active==='edukasi'?'active':''}">Edukasi</a>
          <a href="/papan-peringkat" class="${active==='leaderboard'?'active':''}">Leaderboard</a>
          <a href="/tentang" class="${active==='tentang'?'active':''}">Tentang</a>
        </nav>
        <div class="nav-actions">
          ${u ? `<a class="btn btn-ghost btn-sm" href="${dash}">Dashboard</a>
                 <button class="btn btn-outline btn-sm" onclick="GA.logout()">Keluar</button>`
             : `<a class="btn btn-outline btn-sm" href="/login">Masuk</a>
                <a class="btn btn-primary btn-sm" href="/daftar">Jadi Relawan</a>`}
          <button class="nav-burger" onclick="document.getElementById('mainNav').classList.toggle('open')" aria-label="Menu">☰</button>
        </div>
      </div>
    </header>`;
  }
  function footerHTML(){
    return `
    <footer class="site-footer">
      <div class="container">
        <div class="top">
          <div class="brandline">
            <a href="/" class="brand" style="color:#fff"><span class="logo" style="background:#1E5A40">🌿</span><span>GreenAction</span></a>
            <p>Platform inovasi & keberlanjutan lingkungan nasional. Temukan aksi nyata, bangun komunitas, dan ukur dampaknya.</p>
            <p style="margin-top:18px;font-size:.78rem;color:#8FB49C">Data statistik & konten kegiatan di situs ini adalah data demo yang ditandai jelas untuk keperluan kompetisi.</p>
          </div>
          <div>
            <h4>Platform</h4>
            <a href="/kampanye">Kampanye</a><a href="/kegiatan">Kegiatan</a><a href="/green-map">Green Map</a><a href="/dampak">Dampak Lingkungan</a><a href="/papan-peringkat">Leaderboard</a>
          </div>
          <div>
            <h4>Komunitas</h4>
            <a href="/komunitas">Direktori Komunitas</a><a href="/tantangan">Eco Challenge</a><a href="/lapor">Laporkan Isu</a><a href="/edukasi">Edukasi</a>
          </div>
          <div>
            <h4>Informasi</h4>
            <a href="/tentang">Tentang Kami</a><a href="/kontak">Kontak</a><a href="/privasi">Kebijakan Privasi</a><a href="/ketentuan">Ketentuan Layanan</a>
          </div>
        </div>
        <div class="bottom">
          <span>© 2026 GreenAction. Dibuat untuk kompetisi web design nasional.</span>
          <span class="creator-tag">Created & Developed By: Dika X Dev</span>
        </div>
      </div>
    </footer>`;
  }
  function logout(){ api('/auth/logout',{method:'POST'}).finally(()=>{ clearSession(); location.href='/'; }); }
  function initReveal(){
    const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} }),{threshold:.12});
    document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  }
  return {api,toast,requireLogin,getUser,getToken,setSession,clearSession,headerHTML,footerHTML,logout,initReveal,fmt,esc};
})();
