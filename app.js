(() => {
  "use strict";
  const MAX_BYTES = 30 * 1024 * 1024;
  const $ = (id) => document.getElementById(id);
  const ui = {
    dropzone:$("dropzone"), fileInput:$("fileInput"), editor:$("editor"), trackName:$("trackName"), trackMeta:$("trackMeta"),
    removeFile:$("removeFile"), waveform:$("waveform"), playhead:$("playhead"), durationLabel:$("durationLabel"), totalTime:$("totalTime"),\n    zoomIn:$("zoomIn"), zoomOut:$("zoomOut"), zoomFit:$("zoomFit"), zoomLevel:$("zoomLevel"), timelinePan:$("timelinePan"), visibleStart:$("visibleStart"), visibleEnd:$("visibleEnd"), themeToggle:$("themeToggle"), themeIcon:$("themeIcon"),
    startRange:$("startRange"), endRange:$("endRange"), rangeSelected:$("rangeSelected"), startTime:$("startTime"), endTime:$("endTime"),
    selectedDuration:$("selectedDuration"), resetSelection:$("resetSelection"), playButton:$("playButton"), playIcon:$("playIcon"),
    playLabel:$("playLabel"), playerNote:$("playerNote"), exportButton:$("exportButton"), exportLabel:$("exportLabel"),
    progressWrap:$("progressWrap"), progressBar:$("progressBar"), progressText:$("progressText"), toast:$("toast")
  };
  let file = null, audioBuffer = null, audioContext = null, source = null, raf = 0, startAt = 0, endAt = 0, playStartedAt = 0, playOffset = 0, toastTimer = 0, peaks = [], zoom = 1, viewStart = 0;\n  const viewDuration = () => audioBuffer ? audioBuffer.duration / zoom : 0;\n  const clampView = () => { if(!audioBuffer){viewStart=0;return} viewStart=Math.max(0,Math.min(audioBuffer.duration-viewDuration(),viewStart)); };\n  function updateZoomUI(){if(!audioBuffer)return;clampView();ui.zoomLevel.textContent=zoom+"×";ui.zoomOut.disabled=zoom<=1;ui.zoomIn.disabled=zoom>=24;ui.timelinePan.disabled=zoom<=1;ui.timelinePan.value=String(Math.round(viewStart/Math.max(.001,audioBuffer.duration-viewDuration())*1000));ui.visibleStart.textContent=fmt(viewStart,false);ui.visibleEnd.textContent=fmt(viewStart+viewDuration(),false);drawWaveform()}
  const fmt = (seconds, hundredths = true) => {
    seconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const mins = Math.floor(seconds / 60), secs = Math.floor(seconds % 60), cs = Math.floor((seconds % 1) * 100);
    return String(mins).padStart(2,"0") + ":" + String(secs).padStart(2,"0") + (hundredths ? "." + String(cs).padStart(2,"0") : "");
  };
  function parseTime(value) {
    const text = String(value).trim();
    if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
    const match = text.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/);
    if (!match) return NaN;
    return Number(match[1]) * 60 + Number(match[2]) + Number("0." + (match[3] || "0"));
  }
  function showToast(message) {
    ui.toast.textContent = message; ui.toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 3200);
  }
  function drawWaveform() {
    const canvas = ui.waveform, rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height || !audioBuffer) return;
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height);
    const width = rect.width, height = rect.height, mid = height / 2, count = Math.max(1,Math.floor(width / 3.2));
    const data = audioBuffer.getChannelData(0), viewStartSample=Math.floor(viewStart*audioBuffer.sampleRate), viewSamples=Math.max(1,Math.floor(viewDuration()*audioBuffer.sampleRate)), samplesPerBar=Math.max(1,Math.floor(viewSamples/count));
    const gradient = ctx.createLinearGradient(0,0,0,height); gradient.addColorStop(0,"#8bb6fb"); gradient.addColorStop(.5,"#347ff4"); gradient.addColorStop(1,"#a6c8ff");
    ctx.fillStyle = gradient;
    for(let i=0;i<count;i++){
      const from=Math.min(data.length-1,viewStartSample+i*samplesPerBar), to=Math.min(data.length,from+samplesPerBar); let peak=0;
      for(let j=from;j<to;j+=Math.max(1,Math.floor(samplesPerBar/45))) peak=Math.max(peak,Math.abs(data[j]));
      const envelope=.14+peak*.84, barH=Math.max(2,envelope*(height*.82)), x=i*width/count;
      const rounded=Math.min(1.4,(width/count)*.42);
      ctx.beginPath(); ctx.roundRect(x,mid-barH/2,Math.max(1.2,width/count-rounded),barH,rounded); ctx.fill();
    }
    updateRangeVisual();
  }
  function updateRangeVisual() {
    if(!audioBuffer)return;const span=viewDuration();
    const left=Math.max(0,Math.min(100,(startAt-viewStart)/span*100)),right=Math.max(0,Math.min(100,(endAt-viewStart)/span*100));
    ui.rangeSelected.style.left=left+"%";ui.rangeSelected.style.width=Math.max(0,right-left)+"%";
  }
  function syncTimes(fromRange) {
    if(!audioBuffer)return;
    const duration=audioBuffer.duration;
    if(fromRange){
      startAt=viewStart+Number(ui.startRange.value)/1000*viewDuration(); endAt=viewStart+Number(ui.endRange.value)/1000*viewDuration();
      if(startAt>=endAt){if(fromRange==="start"){startAt=Math.max(0,endAt-.05);ui.startRange.value=Math.round((startAt-viewStart)/viewDuration()*1000)}else{endAt=Math.min(duration,startAt+.05);ui.endRange.value=Math.round((endAt-viewStart)/viewDuration()*1000)}}
      ui.startTime.value=fmt(startAt);ui.endTime.value=fmt(endAt);
    } else {
      let s=parseTime(ui.startTime.value),e=parseTime(ui.endTime.value);
      if(!Number.isFinite(s)||!Number.isFinite(e)){showToast("Format waktu gunakan mm:ss atau detik, misalnya 01:23.50.");ui.startTime.value=fmt(startAt);ui.endTime.value=fmt(endAt);return}
      startAt=Math.max(0,Math.min(duration,s));endAt=Math.max(0,Math.min(duration,e));
      if(endAt<=startAt){showToast("Waktu akhir harus lebih besar dari waktu mulai.");ui.startTime.value=fmt(startAt);ui.endTime.value=fmt(endAt);return}
      ui.startRange.value=Math.round(startAt/duration*1000);ui.endRange.value=Math.round(endAt/duration*1000);
      ui.startTime.value=fmt(startAt);ui.endTime.value=fmt(endAt);
    }
    ui.selectedDuration.textContent=fmt(endAt-startAt);updateRangeVisual();
  }
  function stopPlayback() {
    cancelAnimationFrame(raf); raf=0;
    if(source){try{source.onended=null;source.stop()}catch{}try{source.disconnect()}catch{}source=null}
    ui.playIcon.innerHTML='<path d="m8 5 11 7-11 7z"/>';ui.playLabel.textContent="Preview selection";ui.playerNote.textContent="Dengarkan bagian pilihanmu";
  }
  function tickPlayhead() {
    if(!source||!audioContext)return;
    const current=playOffset+(audioContext.currentTime-playStartedAt);
    if(current>=endAt-startAt){stopPlayback();ui.playhead.style.left=((endAt-viewStart)/viewDuration()*100)+"%";return}
    ui.playhead.style.left=((startAt+current-viewStart)/viewDuration()*100)+"%";
    raf=requestAnimationFrame(tickPlayhead);
  }
  async function playSelection() {
    if(!audioBuffer)return;
    if(source){stopPlayback();return}
    try{
      audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audioContext.state==="suspended")await audioContext.resume();
      source=audioContext.createBufferSource();source.buffer=audioBuffer;source.connect(audioContext.destination);
      playStartedAt=audioContext.currentTime;playOffset=0;
      source.onended=()=>{if(source){stopPlayback();ui.playhead.style.left=((endAt-viewStart)/viewDuration()*100)+"%"}};
      source.start(0,startAt,endAt-startAt);
      ui.playIcon.innerHTML='<path d="M7 5h4v14H7zM15 5h4v14h-4z"/>';ui.playLabel.textContent="Stop preview";ui.playerNote.textContent="Memutar bagian pilihan";
      raf=requestAnimationFrame(tickPlayhead);
    }catch(error){showToast("Audio tidak bisa diputar di browser ini.");console.error(error)}
  }
  async function loadFile(candidate) {
    if(!candidate)return;
    if(!/\.mp3$/i.test(candidate.name)&&candidate.type!=="audio/mpeg"&&candidate.type!=="audio/mp3"){showToast("Pilih file MP3 ya. Format lain belum didukung.");return}
    if(candidate.size>MAX_BYTES){showToast("File terlalu besar. Maksimal ukuran MP3 adalah 30 MB.");return}
    if(candidate.size===0){showToast("File ini kosong, coba pilih MP3 lain.");return}
    stopPlayback();ui.dropzone.classList.add("hidden");ui.editor.classList.remove("hidden");
    ui.trackName.textContent=candidate.name;ui.trackMeta.textContent="MP3 · "+(candidate.size/1024/1024).toFixed(2)+" MB · Membaca audio…";
    ui.exportButton.disabled=true;ui.exportLabel.textContent="Memuat…";
    try{
      const buffer=await candidate.arrayBuffer();
      audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
      audioBuffer=await audioContext.decodeAudioData(buffer.slice(0));
      file=candidate;startAt=0;endAt=audioBuffer.duration;
      ui.trackMeta.textContent="MP3 · "+(candidate.size/1024/1024).toFixed(2)+" MB · "+audioBuffer.sampleRate.toLocaleString("id-ID")+" Hz";
      ui.durationLabel.textContent=fmt(audioBuffer.duration);ui.totalTime.textContent=fmt(audioBuffer.duration,false);
      ui.startRange.value=0;ui.endRange.value=1000;ui.startTime.value=fmt(0);ui.endTime.value=fmt(endAt);ui.selectedDuration.textContent=fmt(endAt);
      ui.playhead.style.left="0%";drawWaveform();ui.exportButton.disabled=false;ui.exportLabel.textContent="Export MP3";
    }catch(error){
      console.error(error);audioBuffer=null;file=null;ui.editor.classList.add("hidden");ui.dropzone.classList.remove("hidden");
      showToast("MP3 tidak bisa dibaca. File mungkin rusak atau memakai encoding yang tidak didukung.");
    }
  }
  async function exportMp3() {
    if(!audioBuffer||!file)return;
    if(!window.lamejs||!window.lamejs.Mp3Encoder){showToast("Encoder MP3 belum termuat. Periksa koneksi internet lalu refresh halaman.");return}
    stopPlayback();ui.exportButton.disabled=true;ui.exportLabel.textContent="Memproses…";ui.progressWrap.classList.remove("hidden");ui.progressBar.style.width="0%";
    try{
      const sampleRate=audioBuffer.sampleRate, channels=Math.min(2,audioBuffer.numberOfChannels), first=Math.floor(startAt*sampleRate), last=Math.floor(endAt*sampleRate), length=last-first;
      if(length<1)throw new Error("Pilihan audio terlalu pendek.");
      const encoder=new lamejs.Mp3Encoder(channels,sampleRate,192), chunkSize=1152, chunks=[];
      const left=audioBuffer.getChannelData(0), right=channels===2?audioBuffer.getChannelData(1):null;
      const toInt16=(data,from,to)=>{const out=new Int16Array(to-from);for(let i=from;i<to;i++){const v=Math.max(-1,Math.min(1,data[first+i]));out[i-from]=v<0?v*32768:v*32767}return out};
      for(let offset=0;offset<length;offset+=chunkSize){
        const stop=Math.min(length,offset+chunkSize), l=toInt16(left,offset,stop);
        const encoded=channels===2?encoder.encodeBuffer(l,toInt16(right,offset,stop)):encoder.encodeBuffer(l);
        if(encoded.length)chunks.push(new Int8Array(encoded));
        if(offset%(chunkSize*32)===0){const pct=Math.min(95,Math.round(offset/length*95));ui.progressBar.style.width=pct+"%";ui.progressText.textContent="Meng-encode MP3… "+pct+"%";await new Promise(resolve=>setTimeout(resolve,0))}
      }
      const tail=encoder.flush();if(tail.length)chunks.push(new Int8Array(tail));
      const blob=new Blob(chunks,{type:"audio/mpeg"}), url=URL.createObjectURL(blob), a=document.createElement("a");
      const base=file.name.replace(/\.mp3$/i,"").replace(/[\\/:*?"<>|]/g,"_");
      a.href=url;a.download=base+"-trimmed.mp3";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      ui.progressBar.style.width="100%";ui.progressText.textContent="Selesai · "+(blob.size/1024/1024).toFixed(2)+" MB";ui.exportLabel.textContent="Export MP3";showToast("MP3 berhasil diekspor. Cek folder Downloads kamu.");
      setTimeout(()=>ui.progressWrap.classList.add("hidden"),4000);
    }catch(error){console.error(error);showToast(error.message||"Gagal mengekspor audio. Coba lagi.");ui.progressText.textContent="Export gagal."}
    finally{ui.exportButton.disabled=false;ui.exportLabel.textContent="Export MP3"}
  }
  ui.dropzone.addEventListener("click",()=>ui.fileInput.click());
  ui.dropzone.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();ui.fileInput.click()}});
  ui.fileInput.addEventListener("change",e=>{loadFile(e.target.files[0]);e.target.value=""});
  ["dragenter","dragover"].forEach(type=>ui.dropzone.addEventListener(type,e=>{e.preventDefault();ui.dropzone.classList.add("dragover")}));
  ["dragleave","drop"].forEach(type=>ui.dropzone.addEventListener(type,e=>{e.preventDefault();ui.dropzone.classList.remove("dragover")}));
  ui.dropzone.addEventListener("drop",e=>loadFile(e.dataTransfer.files[0]));
  ui.removeFile.addEventListener("click",()=>{stopPlayback();file=null;audioBuffer=null;peaks=[];ui.editor.classList.add("hidden");ui.dropzone.classList.remove("hidden");ui.fileInput.value="";});
  ui.startRange.addEventListener("input",()=>syncTimes("start"));ui.endRange.addEventListener("input",()=>syncTimes("end"));
  [ui.startTime,ui.endTime].forEach(input=>input.addEventListener("change",()=>syncTimes(false)));
  ui.resetSelection.addEventListener("click",()=>{if(!audioBuffer)return;startAt=0;endAt=audioBuffer.duration;zoom=1;viewStart=0;ui.startRange.value=0;ui.endRange.value=1000;ui.startTime.value=fmt(0);ui.endTime.value=fmt(endAt);ui.selectedDuration.textContent=fmt(endAt);updateZoomUI()});
  ui.playButton.addEventListener("click",playSelection);ui.exportButton.addEventListener("click",exportMp3);
  function setZoom(next){if(!audioBuffer)return;const center=viewStart+viewDuration()/2;zoom=Math.max(1,Math.min(24,next));viewStart=center-viewDuration()/2;clampView();ui.startRange.value=String(Math.max(0,Math.min(1000,Math.round((startAt-viewStart)/viewDuration()*1000))));ui.endRange.value=String(Math.max(0,Math.min(1000,Math.round((endAt-viewStart)/viewDuration()*1000))));updateZoomUI()}
  ui.zoomIn.addEventListener("click",()=>setZoom(zoom<2?2:zoom<4?4:zoom<8?8:zoom<12?12:zoom<18?18:24));
  ui.zoomOut.addEventListener("click",()=>setZoom(zoom>18?18:zoom>12?12:zoom>8?8:zoom>4?4:zoom>2?2:1));
  ui.zoomFit.addEventListener("click",()=>{zoom=1;viewStart=0;ui.startRange.value=String(Math.round(startAt/audioBuffer.duration*1000));ui.endRange.value=String(Math.round(endAt/audioBuffer.duration*1000));updateZoomUI()});
  ui.timelinePan.addEventListener("input",()=>{if(!audioBuffer)return;viewStart=Number(ui.timelinePan.value)/1000*(audioBuffer.duration-viewDuration());clampView();ui.startRange.value=String(Math.max(0,Math.min(1000,Math.round((startAt-viewStart)/viewDuration()*1000))));ui.endRange.value=String(Math.max(0,Math.min(1000,Math.round((endAt-viewStart)/viewDuration()*1000))));updateZoomUI()});
  ui.themeToggle.addEventListener("click",()=>{const light=document.body.classList.toggle("light-mode");ui.themeToggle.setAttribute("aria-label",light?"Toggle dark mode":"Toggle light mode");ui.themeIcon.innerHTML=light?'<path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/>':'<path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>';document.querySelector('meta[name="theme-color"]').content=light?"#f5f5f7":"#090a0e"});

  let resizeTimer;window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawWaveform,100)});
})();