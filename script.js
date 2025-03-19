const retrieveBtn = document.getElementById("retrieveBtn");
const binIdInput = document.getElementById("binIdInput");
const resultSection = document.getElementById("resultSection");
const infoMessage = document.getElementById("infoMessage");
const visualContainer = document.getElementById("visualContainer");
const downloadBtn = document.getElementById("downloadBtn");

const JSONBIN_BASE_URL = "https://api.jsonbin.io/v3/b/";

window.structuredData = null; // Will hold the object { colorSequence, propsColors, firstColor, lastColor... }

/**************************************************
 * 1) When you click “Retrieve”
 **************************************************/
retrieveBtn.addEventListener("click", async () => {
  visualContainer.innerHTML = "";
  infoMessage.textContent = "Loading...";
  resultSection.classList.remove("hidden");
  downloadBtn.classList.add("hidden");
  window.structuredData = null;

  const binId = binIdInput.value.trim();
  if(!binId) {
    infoMessage.textContent = "Please, enter a Gradient ID.";
    return;
  }

  try {
    const url = `${JSONBIN_BASE_URL}${encodeURIComponent(binId)}`;
    const resp = await fetch(url);
    if(!resp.ok) {
      infoMessage.textContent = `Error: ID not found or server down. (status ${resp.status})`;
      return;
    }
    const fullJson = await resp.json(); // { record: {...}, metadata: {...} }

    infoMessage.textContent = "Gradient successfully retrieved.";
    downloadBtn.classList.remove("hidden");

    if(!fullJson.record) {
      visualContainer.innerHTML = "";
      infoMessage.textContent = "No 'record' field detected.";
      return;
    }

    let gradientData = fullJson.record.gradientData;
    if(!gradientData) {
      infoMessage.textContent = "No 'gradientData' in the record.";
      return;
    }

    // Convert to a single structure => window.structuredData
    const isXml = gradientData.trim().startsWith("<root>");
    let dataObj = null;

    if(isXml) {
      infoMessage.textContent = "Detected format: XML → converting to structured JSON.";
      dataObj = parseXmlToObject(gradientData);
    } else {
      infoMessage.textContent = "Detected format: JSON → direct parsing.";
      dataObj = parseJsonToObject(gradientData);
    }

    if(!dataObj) {
      infoMessage.textContent = "Unable to parse/convert into JSON structure.";
      return;
    }

    // Store the final object
    window.structuredData = dataObj;

    // Display the gradient on the page
    visualizeGradient(dataObj, isXml ? "Gradient (XML→JSON)" : "Gradient (JSON)");

  } catch(err) {
    infoMessage.textContent = "Network/fetch error: " + err;
  }
});

/**************************************************
 * 2) “Download structured JSON” button
 **************************************************/
downloadBtn.addEventListener("click", () => {
  if(!window.structuredData) {
    alert("No structured data available ! ");
    return;
  }
  // Serialize to JSON
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
 * => we parse the XML, rebuild an object
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
    console.warn("Error parsing XML:", errNode.textContent);
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
 * => we parse the JSON. We expect
 *    { colorSequence, propsColors, firstColor, lastColor }
 * => we normalize a bit
 **************************************************/
function parseJsonToObject(jsonString) {
  let obj;
  try {
    obj = JSON.parse(jsonString);
  } catch(err) {
    console.warn("Error parsing JSON:", err);
    return null;
  }
  if(!obj.colorSequence) obj.colorSequence = [];
  if(!obj.propsColors)  obj.propsColors = [];
  if(!obj.firstColor)   obj.firstColor = null;
  if(!obj.lastColor)    obj.lastColor = null;

  // Sort by time
  obj.colorSequence.sort((a,b) => (a.time || 0) - (b.time || 0));

  return obj;
}

/**************************************************
 * visualizeGradient(dataObj, label)
 * => dataObj = { colorSequence: [...], propsColors: [...], firstColor, lastColor }
 * => we build a multi-stop linear-gradient
 **************************************************/
function visualizeGradient(dataObj, label) {
  const colorSeq = dataObj.colorSequence;
  if(!colorSeq || colorSeq.length === 0) {
    visualContainer.innerHTML = "No colorSequence to display.";
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

// On cible le bouton du footer
const apiStatusBtn = document.getElementById("apiStatusBtn");
apiStatusBtn.addEventListener("click", () => {
  // Redirige l’utilisateur vers la page de statut
  // Ici on ouvre dans un nouvel onglet
  window.open("https://status.jsonbin.io/", "_blank");
});
