(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const form = $('#form'), receipt = $('#receipt');
  const PREFIX = ['p','r'];                       // p = pengirim, r = penerima
  const USAHA = {
    nama:'HeyGoldfish',
    sub:'BANYUWANGI GOLDFISH CENTER',
    tagline:'Pusat Ikan Goldfish Berkualitas di Banyuwangi',
    footer1:'Goldfish Quality \u2022 Care \u2022 Passion',
    footer2:'Terima kasih atas kepercayaan anda.'
  };

  /* ================= UTIL ================= */
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(msg){
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(()=>t.classList.remove('show'), 2400);
  }
  const TITLES = {
    form:  ['Formulir Pengiriman', 'Isi data pengirim dan penerima'],
    struk: ['Struk Pengiriman',    'Ukuran kertas thermal 58mm']
  };
  function showView(name){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+name));
    document.querySelectorAll('.bottomnav button').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
    $('#ttl').textContent = TITLES[name][0]; $('#sub').textContent = TITLES[name][1];
    $('#btnTopBack').hidden = (name === 'form');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  document.querySelectorAll('.bottomnav button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

  function normHp(v){
    let d = String(v).replace(/[^\d+]/g,'').replace(/^\+/,'');
    if(d.startsWith('62')) d = '0' + d.slice(2);
    return d;
  }
  const hpValid = v => /^08\d{8,12}$/.test(v);

  function setErr(id, msg){
    const f = $('#'+id).closest('.field');
    f.classList.toggle('bad', !!msg);
    f.querySelector('.err').textContent = msg || '';
  }

  /* ================= DATA WILAYAH ================= */
  // API statis data wilayah Indonesia. Dicoba berurutan; yang pertama berhasil
  // dipakai untuk semua level (ID antar-versi berbeda, jadi tidak boleh dicampur).
  const BASES = [
    'https://www.emsifa.com/api-wilayah-indonesia/v2',
    'https://emsifa.github.io/api-wilayah-indonesia/api'
  ];
  let activeBase = null;
  const cache = new Map();

  const nice = s => s === s.toUpperCase()
    ? s.toLowerCase().replace(/(^|[\s.\-\/(])(\p{L})/gu, (m,a,b)=>a+b.toUpperCase()) : s;

  async function getJson(url){
    const ctrl = new AbortController(), t = setTimeout(()=>ctrl.abort(), 20000);
    try{
      const r = await fetch(url, {signal:ctrl.signal});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      const arr = Array.isArray(j) ? j : j.data;
      if(!Array.isArray(arr)) throw new Error('format');
      return arr.map(x=>({ id:String(x.id), name:nice(String(x.name).trim()) }))
                .sort((a,b)=>a.name.localeCompare(b.name,'id'));
    } finally { clearTimeout(t); }
  }
  async function fetchList(kind, parentId){
    const path = kind === 'provinces' ? '/provinces.json' : '/'+kind+'/'+parentId+'.json';
    if(!activeBase){
      let lastErr;
      for(const b of BASES){
        try{ const d = await getJson(b+path); activeBase = b; return d; }
        catch(e){ lastErr = e; }
      }
      throw lastErr || new Error('gagal');
    }
    return getJson(activeBase+path);
  }
  function loadList(kind, parentId){
    const key = kind+':'+(parentId||'');
    if(!cache.has(key)){
      const p = fetchList(kind, parentId).catch(e=>{ cache.delete(key); throw e; });
      cache.set(key, p);
    }
    return cache.get(key);
  }

  /* ================= PENCARIAN MENDEKATI (fuzzy) ================= */
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  function lev(a,b){
    const m=a.length,n=b.length; if(!m) return n; if(!n) return m;
    let prev=Array.from({length:n+1},(_,i)=>i);
    for(let i=1;i<=m;i++){
      const cur=[i];
      for(let j=1;j<=n;j++)
        cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=cur;
    }
    return prev[n];
  }
  // Tiap kata yang diketik dicocokkan ke kata pada nama: persis / awalan / mengandung / salah ketik.
  function score(name, q){
    const qt = norm(q).split(' ').filter(Boolean);
    if(!qt.length) return 1;
    const nn = norm(name), nt = nn.split(' ');
    let total = 0;
    for(const t of qt){
      let best = 0;
      for(const w of nt){
        if(w === t) best = Math.max(best,100);
        else if(w.startsWith(t)) best = Math.max(best,85);
        else if(t.length>=3 && w.includes(t)) best = Math.max(best,60);
        else if(t.length>=3){
          const d = Math.min(lev(w,t), lev(w.slice(0,t.length),t));
          const ok = t.length<=4 ? 1 : t.length<=7 ? 2 : 3;
          if(d<=ok) best = Math.max(best, 50-d*10);
        }
      }
      if(!best) return 0;
      total += best;
    }
    return total/qt.length + (nn.startsWith(norm(q)) ? 10 : 0);
  }
  function search(items, q){
    if(!norm(q)) return items;
    return items.map(it=>({it, s:score(it.name,q)})).filter(x=>x.s>0)
      .sort((a,b)=>b.s-a.s || a.it.name.localeCompare(b.it.name,'id')).map(x=>x.it);
  }

  /* ================= KOMPONEN ALAMAT BERANTAI ================= */
  const LEVELS = [
    {k:'Prov', kind:'provinces', label:'Provinsi',          ph:'Ketik provinsi...',          parent:null},
    {k:'Kab',  kind:'regencies', label:'Kabupaten / Kota',  ph:'Ketik kabupaten / kota...',  parent:'Provinsi'},
    {k:'Kec',  kind:'districts', label:'Kecamatan',         ph:'Ketik kecamatan...',         parent:'Kabupaten / Kota'},
    {k:'Desa', kind:'villages',  label:'Desa / Kelurahan',  ph:'Ketik desa / kelurahan...',  parent:'Kecamatan'}
  ];
  const instances = {};

  function buildAddress(p){
    const host = document.querySelector('.addr-block[data-prefix="'+p+'"]');
    host.innerHTML =
      '<div class="sublabel">Alamat</div>' +
      LEVELS.map((L,i)=>
        '<div class="field"><label for="'+p+L.k+'">'+L.label+'</label>'+
        '<div class="combo"><input id="'+p+L.k+'" autocomplete="off" autocapitalize="words" enterkeyhint="next" '+
        'role="combobox" aria-autocomplete="list" aria-expanded="false" placeholder="'+L.ph+'"'+(i?' disabled':'')+'>'+
        '<ul class="suggest" role="listbox" hidden></ul></div>'+
        '<em class="err" data-for="'+p+L.k+'"></em></div>'
      ).join('') +
      '<div class="field"><label for="'+p+'Detail">Alamat Lengkap</label>'+
      '<textarea id="'+p+'Detail" rows="3" autocapitalize="sentences" '+
      'placeholder="Nama jalan, no. rumah, RT/RW, patokan"></textarea>'+
      '<em class="err" data-for="'+p+'Detail"></em></div>';

    const st = LEVELS.map((L,i)=>({
      L, i, input:$('#'+p+L.k), list:$('#'+p+L.k).nextElementSibling,
      items:[], sel:null, shown:[], active:-1, loading:false
    }));
    instances[p] = st;

    st.forEach(S=>{
      const {input,list} = S;
      const close = ()=>{ list.hidden = true; input.setAttribute('aria-expanded','false'); S.active=-1; };
      const render = ()=>{
        let html = '';
        if(S.loading) html = '<li class="msg">Memuat data...</li>';
        else if(S.failed) html = '<li class="msg">Gagal memuat. Periksa internet, lalu ketuk kolom ini lagi.</li>';
        else {
          S.shown = search(S.items, input.value);
          if(!S.shown.length) html = '<li class="msg">Tidak ditemukan</li>';
          else html = S.shown.map((it,n)=>'<li role="option" data-n="'+n+'" class="'+(n===S.active?'on':'')+'">'+esc(it.name)+'</li>').join('');
        }
        list.innerHTML = html; list.hidden = false; input.setAttribute('aria-expanded','true');
      };
      const open = ()=>{ if(!input.disabled) render(); };
      const clearFrom = (j)=>{                       // kosongkan semua kolom di bawah level j
        for(let x=j+1; x<st.length; x++){
          const C = st[x];
          C.sel = null; C.items = []; C.failed = false; C.loading = false;
          C.input.value = ''; C.input.disabled = true; C.input.placeholder = LEVELS[x].ph;
          C.list.hidden = true; setErr(p+LEVELS[x].k,'');
        }
      };
      const loadNext = async (focusNext)=>{
        const C = st[S.i+1]; if(!C) return;
        C.loading = true; C.failed = false; C.input.disabled = true; C.input.placeholder = 'Memuat...';
        try{
          C.items = await loadList(C.L.kind, S.sel && S.sel.id);
          if(!S.sel) return;                          // pilihan berubah selagi memuat
          C.loading = false; C.input.disabled = false; C.input.placeholder = C.L.ph;
          if(focusNext){ C.input.focus(); }
        }catch(e){
          C.loading = false; C.failed = true; C.items = []; C.input.disabled = false; C.input.placeholder = 'Gagal memuat';
        }
      };
      const choose = (item, byUser)=>{
        S.sel = item; input.value = item.name; close(); setErr(p+S.L.k,'');
        clearFrom(S.i); loadNext(byUser);
      };
      S.choose = choose;

      input.addEventListener('focus', ()=>{
        if(S.failed && S.i>0 && st[S.i-1].sel){ S.failed=false; st[S.i-1].choose(st[S.i-1].sel,false); return; }
        open(); setTimeout(()=>input.scrollIntoView({block:'center',behavior:'smooth'}),250);
      });
      input.addEventListener('input', ()=>{
        if(S.sel && input.value !== S.sel.name){ S.sel = null; clearFrom(S.i); }
        setErr(p+S.L.k,''); S.active = -1; open();
      });
      input.addEventListener('keydown', e=>{
        if(list.hidden && (e.key==='ArrowDown')){ open(); return; }
        if(list.hidden) return;
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){
          e.preventDefault();
          const n = S.shown.length; if(!n) return;
          S.active = e.key==='ArrowDown' ? (S.active+1)%n : (S.active-1+n)%n; render();
          const on = list.querySelector('.on'); if(on) on.scrollIntoView({block:'nearest'});
        } else if(e.key==='Enter'){
          const it = S.shown[S.active>=0 ? S.active : 0];
          if(it){ e.preventDefault(); choose(it,true); }
        } else if(e.key==='Escape'){ close(); }
      });
      input.addEventListener('blur', ()=>{
        setTimeout(()=>{
          close();
          if(!S.sel && input.value.trim()){            // nama persis sama -> otomatis terpilih
            const q = norm(input.value);
            const hit = S.items.find(it=>norm(it.name)===q);
            if(hit) choose(hit,false);
          }
        },150);
      });
      // pointerdown agar kolom tidak kehilangan fokus sebelum item terpilih
      list.addEventListener('pointerdown', e=>{
        const li = e.target.closest('li[data-n]'); e.preventDefault();
        if(li) choose(S.shown[+li.dataset.n], true);
      });
    });

    // Provinsi dimuat sekali di awal
    const P = st[0]; P.loading = true; P.input.placeholder = 'Memuat provinsi...';
    loadList('provinces').then(items=>{
      P.items = items; P.loading = false; P.input.placeholder = LEVELS[0].ph;
    }).catch(()=>{
      P.loading = false; P.failed = true; P.input.placeholder = 'Gagal memuat provinsi';
    });
    P.input.addEventListener('focus', ()=>{                 // coba ulang bila gagal
      if(P.failed){
        P.failed = false; P.loading = true; P.input.placeholder = 'Memuat provinsi...';
        loadList('provinces').then(items=>{ P.items=items; P.loading=false; P.input.placeholder=LEVELS[0].ph; })
          .catch(()=>{ P.loading=false; P.failed=true; P.input.placeholder='Gagal memuat provinsi'; });
      }
    });
  }
  PREFIX.forEach(buildAddress);

  function resetAddress(p){
    const st = instances[p];
    st.forEach((S,i)=>{
      S.sel = null; S.failed = false; S.input.value = '';
      if(i){ S.items = []; S.input.disabled = true; S.input.placeholder = LEVELS[i].ph; }
      S.list.hidden = true;
    });
  }

  /* ================= VALIDASI ================= */
  const FIELDS = [];
  PREFIX.forEach(p=>['Nama','Hp','Prov','Kab','Kec','Desa','Detail'].forEach(k=>FIELDS.push(p+k)));

  function validate(){
    let ok = true;
    FIELDS.forEach(id=>{
      const el = $('#'+id), v = el.value.trim(); let msg = '';
      const p = id[0], k = id.slice(1);
      if(k==='Nama' && !v) msg = 'Wajib diisi';
      else if(k==='Hp'){
        if(!v) msg = 'Wajib diisi';
        else if(!hpValid(normHp(v))) msg = 'Nomor HP tidak valid (contoh 081234567890)';
      } else if(['Prov','Kab','Kec','Desa'].includes(k)){
        const i = LEVELS.findIndex(L=>L.k===k), S = instances[p][i];
        if(!S.sel){
          if(i && !instances[p][i-1].sel) msg = 'Isi ' + LEVELS[i].parent + ' dulu';
          else msg = v ? 'Pilih dari daftar yang muncul' : 'Wajib diisi';
        }
      } else if(k==='Detail'){
        if(!v) msg = 'Wajib diisi';
        else if(v.length < 5) msg = 'Alamat terlalu pendek';
      }
      setErr(id, msg); if(msg) ok = false;
    });
    return ok;
  }
  ['pNama','pHp','pDetail','rNama','rHp','rDetail'].forEach(id=>$('#'+id).addEventListener('input',()=>setErr(id,'')));

  /* ================= STRUK ================= */
  function noResi(){
    const d = new Date(), p = n => String(n).padStart(2,'0');
    return 'KRM' + d.getFullYear().toString().slice(2) + p(d.getMonth()+1) + p(d.getDate()) +
           '-' + Math.floor(1000 + Math.random()*9000);
  }
  function tanggal(){
    return new Date().toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  const alamatHtml = (d,p) =>
    '<div class="addr">'+esc(d[p+'Detail'])+'</div>'+
    '<div class="addr">'+esc(d[p+'Desa'])+', Kec. '+esc(d[p+'Kec'])+'</div>'+
    '<div class="addr">'+esc(d[p+'Kab'])+', '+esc(d[p+'Prov'])+'</div>';

  function renderReceipt(d){
    const blok = (judul,p)=>
      '<div class="sec">'+judul+'</div>'+
      '<div class="row"><span>Nama</span><span>'+esc(d[p+'Nama'])+'</span></div>'+
      '<div class="row"><span>HP</span><span>'+esc(d[p+'Hp'])+'</span></div>'+
      '<div class="sec">Alamat</div>'+alamatHtml(d,p);
    receipt.innerHTML =
      '<div class="c t">'+esc(USAHA.nama)+'</div>'+
      '<div class="c bold">'+esc(USAHA.sub)+'</div>'+
      '<div class="c i">'+esc(USAHA.tagline)+'</div>'+
      '<div class="ln"></div>'+
      '<div class="row"><span>No</span><span>'+esc(d.resi)+'</span></div>'+
      '<div class="row"><span>Tgl</span><span>'+esc(d.tgl)+'</span></div>'+
      '<div class="ln"></div>'+ blok('PENGIRIM','p') +
      '<div class="ln"></div>'+ blok('PENERIMA','r') +
      '<div class="ln"></div>'+
      '<div class="c bold">'+esc(USAHA.footer1)+'</div>'+
      '<div class="c">'+esc(USAHA.footer2)+'</div>';
    receipt.hidden = false; $('#actions').hidden = false; $('#empty').hidden = true;
  }

  form.addEventListener('submit', e=>{
    e.preventDefault();
    if(!validate()){
      toast('Periksa kembali isian yang ditandai');
      if(navigator.vibrate) navigator.vibrate(60);
      const bad = document.querySelector('.field.bad input, .field.bad textarea');
      if(bad){ bad.scrollIntoView({behavior:'smooth',block:'center'}); }
      return;
    }
    const d = { resi:noResi(), tgl:tanggal() };
    PREFIX.forEach(p=>{
      d[p+'Nama']   = $('#'+p+'Nama').value.trim().replace(/\s+/g,' ');
      d[p+'Hp']     = normHp($('#'+p+'Hp').value);
      d[p+'Detail'] = $('#'+p+'Detail').value.trim().replace(/\s+/g,' ');
      LEVELS.forEach((L,i)=>{ d[p+L.k] = instances[p][i].sel.name; });
    });
    renderReceipt(d); showView('struk'); toast('Struk dibuat');
  });

  $('#btnReset').addEventListener('click', ()=>{
    form.reset(); PREFIX.forEach(resetAddress);
    FIELDS.forEach(id=>setErr(id,''));
    receipt.hidden = true; $('#actions').hidden = true; $('#empty').hidden = false;
    toast('Formulir dikosongkan');
  });
  $('#btnPrint').addEventListener('click', ()=>window.print());
  $('#btnBack').addEventListener('click', ()=>showView('form'));
  $('#btnTopBack').addEventListener('click', ()=>showView('form'));
})();
