(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const form = $('#form'), receipt = $('#receipt');
  const FIELDS = ['pNama','pHp','pAlamat','rNama','rHp','rAlamat'];
  const USAHA = { nama:'STRUK PENGIRIMAN', tagline:'Bukti Data Pengiriman Paket' };

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(msg){
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(()=>t.classList.remove('show'), 2400);
  }

  function showView(name){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+name));
    document.querySelectorAll('.bottomnav button').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  document.querySelectorAll('.bottomnav button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

  // Normalisasi nomor HP: 628xx / +628xx -> 08xx, buang karakter non-angka
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
  function validate(){
    let ok = true;
    FIELDS.forEach(id=>{
      const el = $('#'+id); let v = el.value.trim(), msg='';
      if(!v) msg = 'Wajib diisi';
      else if(id.endsWith('Hp') && !hpValid(normHp(v))) msg = 'Nomor HP tidak valid (contoh 081234567890)';
      else if(id.endsWith('Alamat') && v.length < 8) msg = 'Alamat terlalu pendek';
      setErr(id, msg); if(msg) ok = false;
    });
    return ok;
  }
  FIELDS.forEach(id=>$('#'+id).addEventListener('input',()=>setErr(id,'')));

  function noResi(){
    const d = new Date(), p = n => String(n).padStart(2,'0');
    return 'KRM' + d.getFullYear().toString().slice(2) + p(d.getMonth()+1) + p(d.getDate()) +
           '-' + Math.floor(1000 + Math.random()*9000);
  }
  function tanggal(){
    return new Date().toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function renderReceipt(d){
    receipt.innerHTML =
      '<div class="c t">'+esc(USAHA.nama)+'</div>'+
      '<div class="c i">'+esc(USAHA.tagline)+'</div>'+
      '<div class="ln"></div>'+
      '<div class="row"><span>No</span><span>'+esc(d.resi)+'</span></div>'+
      '<div class="row"><span>Tgl</span><span>'+esc(d.tgl)+'</span></div>'+
      '<div class="ln"></div>'+
      '<div class="sec">PENGIRIM</div>'+
      '<div class="row"><span>Nama</span><span>'+esc(d.pNama)+'</span></div>'+
      '<div class="row"><span>HP</span><span>'+esc(d.pHp)+'</span></div>'+
      '<div class="addr">Alamat: '+esc(d.pAlamat)+'</div>'+
      '<div class="ln"></div>'+
      '<div class="sec">PENERIMA</div>'+
      '<div class="row"><span>Nama</span><span>'+esc(d.rNama)+'</span></div>'+
      '<div class="row"><span>HP</span><span>'+esc(d.rHp)+'</span></div>'+
      '<div class="addr">Alamat: '+esc(d.rAlamat)+'</div>'+
      '<div class="ln"></div>'+
      '<div class="c">Terima kasih</div>';
    receipt.hidden = false; $('#actions').hidden = false; $('#empty').hidden = true;
  }

  form.addEventListener('submit', e=>{
    e.preventDefault();
    if(!validate()){ toast('Periksa kembali isian yang merah'); return; }
    const d = { resi:noResi(), tgl:tanggal() };
    FIELDS.forEach(id=>{
      let v = $('#'+id).value.trim().replace(/\s+/g,' ');
      d[id] = id.endsWith('Hp') ? normHp(v) : v;
    });
    renderReceipt(d); showView('struk'); toast('Struk dibuat');
  });

  $('#btnReset').addEventListener('click', ()=>{
    form.reset(); FIELDS.forEach(id=>setErr(id,''));
    receipt.hidden = true; $('#actions').hidden = true; $('#empty').hidden = false;
    toast('Formulir dikosongkan');
  });
  $('#btnPrint').addEventListener('click', ()=>window.print());
  $('#btnBack').addEventListener('click', ()=>showView('form'));
})();
