const retrieveBtn = document.getElementById("retrieveBtn");
const binIdInput = document.getElementById("binIdInput");
const resultSection = document.getElementById("resultSection");
const infoMessage = document.getElementById("infoMessage");
const visualContainer = document.getElementById("visualContainer");
const downloadBtn = document.getElementById("downloadBtn");

const JSONBIN_BASE_URL = "https://api.jsonbin.io/v3/b/";

window.structuredData = null; // Va contenir l'objet { colorSequence, propsColors, firstColor, lastColor... }

/**************************************************
 * 1) Quand on clique sur “Récupérer”
 **************************************************/
retrieveBtn.addEventListener("click", async () => {
  visualContainer.innerHTML = "";
  infoMessage.textContent = "Chargement...";
  resultSection.classList.remove("hidden");
  downloadBtn.classList.add("hidden");
  window.structuredData = null;

  const binId = binIdInput.value.trim();
  if(!binId) {
    infoMessage.textContent = "Veuillez saisir un Bin ID.";
    return;
  }

  try {
    const url = `${JSONBIN_BASE_URL}${encodeURIComponent(binId)}`;
    const resp = await fetch(url);
    if(!resp.ok) {
      infoMessage.textContent = `Erreur: bin introuvable ou serveur HS. (status ${resp.status})`;
      return;
    }
    const fullJson = await resp.json(); // { record: {...}, metadata: {...} }

    infoMessage.textContent = "Bin récupéré avec succès.";
    downloadBtn.classList.remove("hidden");

    if(!fullJson.record) {
      visualContainer.innerHTML = "";
      infoMessage.textContent = "Aucun champ 'record' détecté.";
      return;
    }

    let gradientData = fullJson.record.gradientData;
    if(!gradientData) {
      infoMessage.textContent = "Pas de 'gradientData' dans le record.";
      return;
    }

    // On convertit en structure unique => window.structuredData
    const isXml = gradientData.trim().startsWith("<root>");
    let dataObj = null;

    if(isXml) {
      infoMessage.textContent = "Format détecté: XML → conversion en JSON structuré.";
      dataObj = parseXmlToObject(gradientData);
    } else {
      infoMessage.textContent = "Format détecté: JSON → parse direct.";
      dataObj = parseJsonToObject(gradientData);
    }

    if(!dataObj) {
      infoMessage.textContent = "Impossible de parser/convertir en structure JSON.";
      return;
    }

    // On stocke l'objet final
    window.structuredData = dataObj;

    // Afficher le gradient sur la page
    visualizeGradient(dataObj, isXml ? "Gradient (XML→JSON)" : "Gradient (JSON)");

  } catch(err) {
    infoMessage.textContent = "Erreur réseau/fetch: " + err;
  }
});

/**************************************************
 * 2) Bouton “Télécharger JSON structuré”
 **************************************************/
downloadBtn.addEventListener("click", () => {
  if(!window.structuredData) {
    alert("Aucune data structurée disponible.");
    return;
  }
  // On sérialize en JSON
  const dataStr = JSON.stringify(window.structuredData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `gradient_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
});

/**************************************************
 * parseXmlToObject(xmlString)
 * => on parse le XML, on reconstruit un objet
 *    { colorSequence: [ {time, color}, ... ],
 *      propsColors: [ {name, color}, ...],
 *      firstColor: "...",
 *      lastColor: "..." }
 **************************************************/
function parseXmlToObject(xmlString) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(xmlString, "application/xml");
  const errNode = dom.querySelector("parsererror");
  if(errNode) {
    console.warn("Erreur parse XML:", errNode.textContent);
    return null;
  }

  const colorSeqNodes = [...dom.querySelectorAll("colorSequence > keypoint")];
  const propsNodes    = [...dom.querySelectorAll("propsColors > prop")];
  const firstC = dom.querySelector("firstColor")?.textContent?.trim() || null;
  const lastC  = dom.querySelector("lastColor")?.textContent?.trim() || null;

  // colorSequence
  let colorSequence = colorSeqNodes.map(kp => {
    let t = parseFloat(kp.getAttribute("time")) || 0;
    let c = kp.getAttribute("color") || "#FFF";
    return { time: t, color: c };
  });
  // propsColors
  let propsColors = propsNodes.map(pn => {
    let nm = pn.getAttribute("name") || "??";
    let col = pn.textContent.trim() || "#FFF";
    return { name: nm, color: col };
  });

  colorSequence.sort((a,b) => a.time - b.time);

  return {
    colorSequence,
    propsColors,
    firstColor: firstC,
    lastColor: lastC
  };
}

/**************************************************
 * parseJsonToObject(jsonString)
 * => on parse le JSON. On s'attend à
 *    { colorSequence, propsColors, firstColor, lastColor }
 * => on normalise un minimum
 **************************************************/
function parseJsonToObject(jsonString) {
  let obj;
  try {
    obj = JSON.parse(jsonString);
  } catch(err) {
    console.warn("Erreur parse JSON:", err);
    return null;
  }
  if(!obj.colorSequence) obj.colorSequence = [];
  if(!obj.propsColors)  obj.propsColors = [];
  if(!obj.firstColor)   obj.firstColor = null;
  if(!obj.lastColor)    obj.lastColor = null;

  // Tri par time
  obj.colorSequence.sort((a,b) => (a.time||0) - (b.time||0));

  return obj;
}

/**************************************************
 * visualizeGradient(dataObj, label)
 * => dataObj = { colorSequence: [...], propsColors: [...], firstColor, lastColor }
 * => on construit un linear-gradient multi-stop
 **************************************************/
function visualizeGradient(dataObj, label) {
  const colorSeq = dataObj.colorSequence;
  if(!colorSeq || colorSeq.length === 0) {
    visualContainer.innerHTML = "Pas de colorSequence à afficher.";
    return;
  }

  const gradientStr = buildMultiStopGradient(colorSeq);

  const box = document.createElement("div");
  box.classList.add("gradient-box");
  box.style.background = gradientStr;

  const title = document.createElement("div");
  title.classList.add("gradient-title");
  title.textContent = label;
  box.appendChild(title);

  visualContainer.appendChild(box);
}

/**************************************************
 * buildMultiStopGradient(kpArray)
 * => "linear-gradient(to right, #FFF 0%, #CCC 50%, #000 100%)"
 **************************************************/
function buildMultiStopGradient(kpArray) {
  const stops = kpArray.map(kp => {
    const pct = Math.round(kp.time * 100);
    return `${kp.color} ${pct}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
