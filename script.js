    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMeHxt1EXJ3tfwRJ_m4Tl6hkaYajAI7yJplV4r-Fw4wPx3_nKC5Q9O1t4Lry_WvF3Pxg/exec";

    let inizializzazioneCompletata = false;
    let isScanning = false;
    let hardwareStarted = false;
    let ndefReader = null;
    let presentiOggi = [];
    let estrazioneFattaOggi = false;
    let giornataArchiviataOggi = false;

    function normalizzaNome(testo) {
      return testo.toString().replace(/\s+/g, ' ').trim().toUpperCase();
    }

    function playBeep(duplicato) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = duplicato ? 300 : 800; 
      gain.gain.value = 0.1; osc.start();
      setTimeout(() => osc.stop(), 150);
    }

    async function caricaLista() {
      const listaEl = document.getElementById('lista-presenze');
      const conteggioEl = document.getElementById('conteggio');
      listaEl.innerHTML = '<li style="text-align:center;">Caricamento...</li>';
      
      try {
        const response = await fetch(SCRIPT_URL);
        const dati = await response.json();
        presentiOggi = dati;
        
        listaEl.innerHTML = '';
        if (presentiOggi.length === 0) {
          if (giornataArchiviataOggi) {
            listaEl.innerHTML = '<li style="text-align:center; font-style: italic;">GIORNATA CHIUSA</li>';
          } else {
            listaEl.innerHTML = '<li style="text-align:center;">Nessuna presenza oggi.</li>';
          }
        } else {
          presentiOggi.slice().reverse().forEach(nome => {
            const li = document.createElement('li');
            li.innerText = nome;
            listaEl.appendChild(li);
          });
        }
        conteggioEl.innerText = presentiOggi.length;
      } catch (error) {
        listaEl.innerHTML = '<li style="color:red;">Errore caricamento</li>';
      }
    }

    function aggiungiAllaListaVisiva(nome) {
      if (presentiOggi.includes(nome)) return;
      presentiOggi.push(nome);
      document.getElementById('conteggio').innerText = presentiOggi.length;
      
      const listaEl = document.getElementById('lista-presenze');
      if (listaEl.innerText.includes('Nessuna presenza')) listaEl.innerHTML = '';
      
      const li = document.createElement('li');
      li.innerText = nome;
      listaEl.insertBefore(li, listaEl.firstChild);
    }

    async function startScan() {
      const status = document.getElementById('status');
      
      if (!inizializzazioneCompletata) { status.innerText = "Attendere inizializzazione..."; return; }
      
      if (!("NDEFReader" in window)) { status.innerText = "❌ Usa Chrome su Android!"; return; }
      try {
        if (!ndefReader) {
          ndefReader = new NDEFReader();
          ndefReader.onreading = event => {
            if (!isScanning) return;
            const textDecoder = new TextDecoder();
            let nomeTrovato = null;
            for (const record of event.message.records) {
              if (record.recordType === "text") nomeTrovato = textDecoder.decode(record.data);
            }
            if (nomeTrovato) inviaAlFoglio(nomeTrovato);
          };
          ndefReader.onreadingerror = () => {};
        }
        if (!hardwareStarted) { await ndefReader.scan(); hardwareStarted = true; }
        isScanning = true;
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'block';
        status.innerHTML = '<span class="listening">🟢 IN ASCOLTO... Avvicina la card</span>';
      } catch (error) { status.innerText = "❌ Errore: " + error.message; }
    }

    function stopScan() {
      isScanning = false;
      document.getElementById('startBtn').style.display = 'block';
      document.getElementById('stopBtn').style.display = 'none';
      document.getElementById('status').innerText = "⏸️ Scansione fermata.";
    }

    function toggleInserimentoManuale() {
      const container = document.getElementById('containerManuale');
      if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        setTimeout(() => document.getElementById('inputManuale').focus(), 100);
      } else {
        container.style.display = 'none';
      }
    }

    function registrazioneManuale() {
      const input = document.getElementById('inputManuale');
      const nome = input.value.trim();
      if (!nome) {
        document.getElementById('status').innerText = "⚠️ Scrivi prima il nome del socio!";
        return;
      }
      inviaAlFoglio(nome); 
      input.value = "";
      document.getElementById('containerManuale').style.display = 'none'; 
    }

    function inviaAlFoglio(testo) {
      testo = normalizzaNome(testo);
      const status = document.getElementById('status');
      navigator.vibrate(100); 
      fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({testoLetto: testo}) })
      .then(response => response.json())
      .then(data => {
        if (data.status === "duplicato") {
          status.innerText = "⚠️ Già presente: " + testo;
          navigator.vibrate([100, 50, 100]); playBeep(true);
        } else if (data.status === "archiviato") {
          status.innerText = "⚠️ Giornata già archiviata!";
          navigator.vibrate([100, 50, 100]); playBeep(true);
        } else {
          status.innerText = "✅ Registrato: " + testo;
          playBeep(false);
          aggiungiAllaListaVisiva(testo);
        }
        setTimeout(() => { if(isScanning) status.innerHTML = '<span class="listening">🟢 IN ASCOLTO... Avvicina la card</span>'; }, 2000);
      })
      .catch(err => { status.innerText = "❌ Errore di rete"; });
    }

    async function estraiFortunato() {
      const status = document.getElementById('status');

      if (!inizializzazioneCompletata) { status.innerText = "Attendere inizializzazione..."; return; }
      
      const vincitore = document.getElementById('vincitore');
      status.innerText = "🎲 Estrazione in corso...";
      vincitore.innerText = "";
      
      try {
        if (presentiOggi.length === 0) {
          await caricaLista();
          if (presentiOggi.length === 0) { status.innerText = "⚠️ Nessuna presenza oggi!"; return; }
        }
        
        let conteggio = 0;
        const intervallo = setInterval(() => {
          const casuale = presentiOggi[Math.floor(Math.random() * presentiOggi.length)];
          vincitore.innerText = casuale;
          conteggio++;
          if (conteggio > 20) {
            clearInterval(intervallo);
            const vincitoreFinale = presentiOggi[Math.floor(Math.random() * presentiOggi.length)];
            vincitore.innerText = "🏆 " + vincitoreFinale;
            status.innerText = "✅ Estratto da " + presentiOggi.length + " presenze!";
            
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({nomeVincitore: vincitoreFinale}) })
            .then(response => response.json())
            .then(data => {
              if (data.status === "duplicato") {
                status.innerText = "⚠️ Estrazione già fatta oggi!";
                document.getElementById('btnEstrai').disabled = true;
                checkStatoGiornata(); 
              } else {
                status.innerText += " (Salvato!)";
                document.getElementById('btnEstrai').disabled = true;
                estrazioneFattaOggi = true;
              }
            });
          }
        }, 100);
      } catch (error) { status.innerText = "❌ Errore: " + error.message; }
    }

    async function archiviaGiornata() {
      const status = document.getElementById('status');

      if (!inizializzazioneCompletata) { status.innerText = "Attendere inizializzazione..."; return; }

      if (!estrazioneFattaOggi) {
        if (!confirm("⚠️ ATTENZIONE: L'estrazione NON è stata effettuata oggi!\n\nVuoi archiviare comunque la giornata?")) {
          return;
        }
      } else {
        if (!confirm("Vuoi archiviare la giornata?")) {
          return;
        }
      }

      status.innerText = "🗄️ Archiviazione in corso...";
      
      try {
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({action: "archivia"}) });
        const data = await response.json();
        
        if (data.status === "successo") {
          status.innerText = "✅ Archiviate " + data.count + " presenze!";
          presentiOggi = [];
          caricaLista(); 
          checkStatoGiornata(); 
        } else if (data.status === "gia_archiviato") {
          status.innerText = "⚠️ Giornata già archiviata!";
          checkStatoGiornata();
        } else {
          status.innerText = "❌ Errore archiviazione";
        }
      } catch (error) {
        status.innerText = "❌ Errore di rete";
      }
    }

    async function checkStatoGiornata() {
      try {
        const response = await fetch(SCRIPT_URL + "?action=checkStato");
        const data = await response.json();

        const btnEstrai = document.getElementById('btnEstrai');
        const btnArchivia = document.getElementById('btnArchivia');
        const startBtn = document.getElementById('startBtn');
        const btnToggleManuale = document.getElementById('btnToggleManuale');
        const btnAggiorna = document.getElementById('btnAggiorna');
        const containerManuale = document.getElementById('containerManuale');

        if (data.giaArchiviato) {
          giornataArchiviataOggi = true;
          // GIORNATA CHIUSA: blocca TUTTI i pulsanti (senza cambiare il testo)
          startBtn.disabled = true; startBtn.style.background = "#7f8c8d";
          btnArchivia.disabled = true; btnArchivia.style.background = "#7f8c8d";
          btnEstrai.disabled = true; btnEstrai.style.background = "#7f8c8d";
          btnAggiorna.disabled = true; btnAggiorna.style.background = "#7f8c8d";
          btnToggleManuale.disabled = true; btnToggleManuale.style.background = "#7f8c8d"; btnToggleManuale.innerText = "INSERIMENTO MANUALE";
          containerManuale.style.display = 'none';
          document.getElementById('status').innerText = "🗄️ GIORNATA ARCHIVIATA!";
          
          if (data.giaEstratto) {
            estrazioneFattaOggi = true;
            document.getElementById('vincitore').innerText = "🏆 " + data.vincitore;
          }
          
          // Mostra "GIORNATA CHIUSA" nell'elenco
          const listaEl = document.getElementById('lista-presenze');
          listaEl.innerHTML = '<li style="text-align:center; font-style: italic;">GIORNATA CHIUSA</li>';
          document.getElementById('conteggio').innerText = "0";
          
          return;
        }

        if (data.giaEstratto) {
          estrazioneFattaOggi = true;
          btnEstrai.disabled = true; btnEstrai.style.background = "#7f8c8d";
          document.getElementById('vincitore').innerText = data.vincitore;
          document.getElementById('status').innerText = "Estrazione già effettuata oggi.";
        }
      } catch (error) { console.error("Errore controllo stato", error); }
    }

    window.onload = async function() {
      try {
        await Promise.all([caricaLista(), checkStatoGiornata()]);
      } catch (error) {
        console.error("Errore inizializzazione", error);
      } finally {
        inizializzazioneCompletata = true;
        // Nasconde l'overlay con fade-out
        document.getElementById('overlayInizializzazione').classList.add('nascosto');
      }
    };
